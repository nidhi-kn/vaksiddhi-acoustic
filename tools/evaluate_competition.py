"""Offline audit of the six local demo fixtures, not a benchmark or tuner.

Run: python -m tools.evaluate_competition
Original inference is unchanged. Window outputs are research diagnostics only.
"""
import hashlib
import json
from pathlib import Path
import platform
from time import perf_counter

import numpy as np
import soundfile as sf
import torch

from demo.inference import AcousticAnalyzer, CHECKPOINT_PATH, SPOOF_THRESHOLD
from src.preprocessing.audio_utils import audio_to_logmel

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def distribution(values):
    values = np.asarray(values)
    return {name: float(value) for name, value in zip(
        ['min', 'p05', 'median', 'p95', 'max'], np.quantile(values, [0, .05, .5, .95, 1]))}


def window_diagnostics(analyzer, path):
    waveform, rate = sf.read(path, dtype='float32', always_2d=True)
    mono = waveform.mean(axis=1)
    # Slice at source sample rate, then use the exact existing preprocessing.
    starts = list(range(0, max(1, len(mono) - rate + 1), max(1, rate // 2)))
    final = max(0, len(mono) - rate)
    if starts[-1] != final:
        starts.append(final)
    segments = []
    started = perf_counter()
    for offset in starts:
        features = audio_to_logmel(mono[offset:offset + rate], sample_rate=rate)
        with torch.inference_mode():
            scores = torch.softmax(analyzer.model(features[None, None].to(analyzer.device)), dim=1)[0]
        segments.append({'start_seconds': offset / rate, 'spoof_score': float(scores[1].item())})
    values = [segment['spoof_score'] for segment in segments]
    return {'segments': segments, 'processing_ms': (perf_counter() - started) * 1000,
            'unvalidated_aggregates': {'max': max(values), 'mean': float(np.mean(values)),
                                     'top_3_mean': float(np.mean(sorted(values, reverse=True)[:3]))}}


def main():
    started = perf_counter()
    analyzer = AcousticAnalyzer()
    load_ms = (perf_counter() - started) * 1000
    files = sorted((ROOT / 'test_audio').glob('*.wav'))
    if len(files) != 6:
        raise RuntimeError('This fixed audit expects the six original local demo WAV fixtures.')
    analyzer.analyze(files[0])
    rows = []
    for path in files:
        if path.stem.split('_')[0] not in ('bonafide', 'spoof'):
            raise ValueError(f'No declared label for {path.name}')
        times = []
        for _ in range(3):
            started = perf_counter(); result = analyzer.analyze(path)
            times.append((perf_counter() - started) * 1000)
        diagnostics = window_diagnostics(analyzer, path)
        if abs(diagnostics['segments'][0]['spoof_score'] - result['acoustic']['spoof_score']) > 1e-6:
            raise RuntimeError('Window-zero parity failed; do not use these diagnostics.')
        rows.append({'file': path.name, 'declared_label': path.stem.split('_')[0],
                     'sha256': digest(path), 'duration_seconds': sf.info(path).duration,
                     'acoustic': result['acoustic'], 'risk_level': result['risk_level'],
                     'warm_latency_ms': times, 'window_diagnostics': diagnostics})
        rows[-1]['acoustic'].pop('checkpoint', None)
    matrix = [[0, 0], [0, 0]]
    for row in rows:
        matrix[int(row['declared_label'] == 'spoof')][int(row['acoustic']['prediction'] == 'spoof')] += 1
    summary = {
        'scope': 'Six local demonstration samples; NOT representative or held-out validation evidence.',
        'label_provenance': 'download_samples.py maps dataset label 0 to bonafide and 1 to spoof. Original utterance IDs and per-file protocol entries were not retained; filenames carry declared dataset labels.',
        'dataset': 'SpeechAntiSpoofingBenchmarks/ASVspoof2019_LA', 'split': 'test/evaluation',
        'selection': 'First three encountered recordings per class in downloader stream; no random sampling.',
        'examples': len(rows), 'class_counts': {'bonafide': 3, 'spoof': 3},
        'checkpoint_sha256': digest(CHECKPOINT_PATH), 'threshold': SPOOF_THRESHOLD,
        'environment': {'python': platform.python_version(), 'torch': torch.__version__,
                        'device': str(analyzer.device), 'platform': platform.platform(),
                        'torch_threads': torch.get_num_threads()},
        'model_load_ms': load_ms,
        'confusion_matrix_true_rows_predicted_columns_bonafide_spoof': matrix,
        'spoof_recall': matrix[1][1] / sum(matrix[1]),
        'bonafide_false_alert_rate': matrix[0][1] / sum(matrix[0]),
        'warm_latency_ms': distribution([t for row in rows for t in row['warm_latency_ms']]),
        'score_distributions': {label: distribution([row['acoustic']['spoof_score'] for row in rows if row['declared_label'] == label]) for label in ('bonafide', 'spoof')},
        'multi_segment_decision': 'NOT ENABLED: no independent development data, no validated aggregation threshold or generalization improvement. Test diagnostics are not used for selection.',
        'rows': rows,
    }
    output = ROOT / 'docs' / 'competition_baseline.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in summary.items() if key != 'rows'}, indent=2))


if __name__ == '__main__':
    main()

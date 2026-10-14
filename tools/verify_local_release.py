"""Offline six-file CLI/live-HTTP regression; does not write model/inference files."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_HASH = '4b8e30cf4f977571228688528de1e053dfe3a2e01b05b25a033432bdae91d980'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api', default='http://127.0.0.1:8010')
    args = parser.parse_args()
    checkpoint = ROOT / 'checkpoints/student_mobilenetv2_kd_corrected_teacher.pt'
    assert digest(checkpoint) == EXPECTED_HASH
    baseline = json.loads((ROOT / 'docs/competition_baseline.json').read_text())
    fixtures = {row['file']: row for row in baseline['rows']}
    results = []
    for path in sorted((ROOT / 'test_audio').glob('*.wav')):
        assert digest(path) == fixtures[path.name]['sha256']
        cli = json.loads(subprocess.run([sys.executable, '-m', 'demo.run_audio', str(path)], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
        boundary = 'vaksiddhi-release-boundary'
        content = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + path.read_bytes() + f'\r\n--{boundary}--\r\n'.encode())
        request = Request(args.api + '/api/analyze', data=content, headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
        with urlopen(request, timeout=120) as response:
            api = json.load(response)
        for key in ['spoof_score', 'bonafide_score']:
            assert abs(cli['acoustic'][key] - api['acoustic'][key]) <= 1e-7
        assert cli['acoustic']['prediction'] == api['acoustic']['prediction']
        assert cli['acoustic']['threshold'] == api['acoustic']['threshold'] == .05530281
        declared_label = fixtures[path.name]['declared_label']
        expected_decision = 'below_threshold' if declared_label == 'bonafide' else 'spoof'
        assert api['acoustic']['prediction'] == expected_decision
        assert abs(api['acoustic']['spoof_score'] - fixtures[path.name]['acoustic']['spoof_score']) <= 1e-7
        results.append({'file': path.name, 'sha256': digest(path), 'declared_dataset_label': declared_label,
                        'ground_truth_provenance': 'Original downloader class mapping and baseline fixture naming; original source utterance IDs were not retained.',
                        'cli_spoof_score': cli['acoustic']['spoof_score'], 'api_spoof_score': api['acoustic']['spoof_score'],
                        'absolute_difference': abs(cli['acoustic']['spoof_score'] - api['acoustic']['spoof_score']),
                        'prediction': api['acoustic']['prediction'], 'matches_declared_label': True})
        print(json.dumps(results[-1]), flush=True)
    assert len(results) == 6
    anchors = {r['file']: r['cli_spoof_score'] for r in results}
    assert abs(anchors['spoof_1.wav'] - .1198771521449089) <= 1e-7
    assert abs(anchors['bonafide_1.wav'] - .0033067096956074238) <= 1e-7
    assert digest(checkpoint) == EXPECTED_HASH
    report = {'status': 'PASS', 'checkpoint_sha256_before_and_after': EXPECTED_HASH,
              'api': args.api, 'numerical_tolerance': 1e-7, 'results': results,
              'source_commit': subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()}
    (ROOT / 'docs/final_release_regression.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()

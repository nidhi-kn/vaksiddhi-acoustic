"""Measure a fresh real Uvicorn process on this host; not a Linux/container claim."""
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile
from threading import Event, Thread
from time import perf_counter, sleep
from urllib.request import Request, urlopen

import numpy as np
import psutil
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]


def main():
    env = {**os.environ, 'OMP_NUM_THREADS': '1', 'MKL_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1',
           'CORS_ORIGINS': 'https://vaksiddhi.vercel.app'}
    output = ROOT / 'docs/render'
    output.mkdir(parents=True, exist_ok=True)
    measurements = {'startup': 0, 'fixture_inference': 0, 'large_valid_upload': 0}
    phase = ['startup']
    done = Event()
    native_peak = [0]
    with tempfile.TemporaryFile(mode='w+') as log:
        child = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.app:app', '--host', '127.0.0.1', '--port', '8015', '--workers', '1'], cwd=ROOT, env=env, stdout=log, stderr=log)
        def sample():
            try:
                candidates = [psutil.Process(child.pid)] + psutil.Process(child.pid).children(recursive=True)
                memory = [p.memory_info() for p in candidates]
                rss = sum(m.rss for m in memory)
                measurements[phase[0]] = max(measurements[phase[0]], rss)
                native_peak[0] = max(native_peak[0], sum(getattr(m, 'peak_wset', m.rss) for m in memory))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        def watch():
            while not done.wait(.02):
                sample()
        thread = Thread(target=watch, daemon=True); thread.start()
        try:
            started = perf_counter()
            while True:
                if child.poll() is not None:
                    log.seek(0); raise RuntimeError(log.read())
                try:
                    with urlopen('http://127.0.0.1:8015/api/ready', timeout=1) as response:
                        if json.load(response)['model_loaded']:
                            break
                except OSError:
                    if perf_counter()-started > 90:
                        raise RuntimeError('Startup timeout')
                    sleep(.1)
            startup_seconds = perf_counter()-started
            sample(); phase[0] = 'fixture_inference'
            def upload(name, content):
                boundary = 'vaksiddhi-memory-profile'
                body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: audio/wav\r\n\r\n'.encode()+content+f'\r\n--{boundary}--\r\n'.encode())
                with urlopen(Request('http://127.0.0.1:8015/api/analyze', data=body, headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}), timeout=120) as response:
                    return json.load(response)
            rows = []
            baseline = {row['file']: row for row in json.loads((ROOT/'docs/competition_baseline.json').read_text())['rows']}
            for path in sorted((ROOT/'test_audio').glob('*.wav')):
                result = upload(path.name, path.read_bytes())
                reference = baseline[path.name]['acoustic']
                delta = abs(result['acoustic']['spoof_score'] - reference['spoof_score'])
                assert delta <= 1e-6 and result['acoustic']['prediction'] == reference['prediction']
                assert result['acoustic']['threshold'] == .05530281
                rows.append({'file': path.name, 'spoof_score': result['acoustic']['spoof_score'], 'prediction': result['acoustic']['prediction'], 'absolute_baseline_difference': delta})
                sample()
            phase[0] = 'large_valid_upload'
            # 120s, 8-channel, 8kHz PCM16: 15.36 MB accepted by existing API.
            buffer = io.BytesIO()
            sf.write(buffer, np.zeros((120*8000, 8), dtype=np.float32), 8000, format='WAV', subtype='PCM_16')
            result = upload('large-silence.wav', buffer.getvalue())
            sample()
            preflight = Request('http://127.0.0.1:8015/api/analyze', method='OPTIONS', headers={'Origin': 'https://vaksiddhi.vercel.app', 'Access-Control-Request-Method': 'POST'})
            with urlopen(preflight) as response:
                assert response.headers['Access-Control-Allow-Origin'] == 'https://vaksiddhi.vercel.app'
            data = {'platform': platform.platform(), 'python': platform.python_version(), 'scope': 'Fresh server process tree RSS on Windows, not Render Linux/container memory; 20ms polling. Windows launcher child included.',
                    'peak_rss_bytes_by_phase': measurements, 'peak_rss_mb_decimal': max(measurements.values())/1e6,
                    'peak_rss_mib': max(measurements.values())/1024**2, 'windows_native_peak_working_set_bytes': native_peak[0],
                    'startup_seconds': startup_seconds, 'fixture_results': rows, 'large_upload_bytes': len(buffer.getvalue()),
                    'large_upload_prediction': result['acoustic']['prediction'], 'configured_vercel_cors_preflight': 'PASS',
                    'checkpoint_sha256': hashlib.sha256((ROOT/'checkpoints/student_mobilenetv2_kd_corrected_teacher.pt').read_bytes()).hexdigest()}
            (output/'memory.json').write_text(json.dumps(data, indent=2)+'\n')
            print(json.dumps(data, indent=2))
        finally:
            done.set(); thread.join(timeout=1)
            for process in reversed(psutil.Process(child.pid).children(recursive=True)):
                process.terminate()
            child.terminate()
            child.wait(timeout=10)


if __name__ == '__main__':
    main()

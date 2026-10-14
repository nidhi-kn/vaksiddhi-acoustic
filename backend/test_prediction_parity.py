"""Regression against the exact local WAV fixtures and original CLI."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

from fastapi.testclient import TestClient
from backend.app import app

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ('spoof_1.wav', .1198771521449089, 'spoof', 'elevated'),
    ('bonafide_1.wav', .0033067096956074238, 'below_threshold', 'inconclusive'),
    ('bonafide_2.wav', .0008955063531175256, 'below_threshold', 'inconclusive'),
    ('bonafide_3.wav', .006532737985253334, 'below_threshold', 'inconclusive'),
    ('spoof_2.wav', .1127827912569046, 'spoof', 'elevated'),
    ('spoof_3.wav', .1485045701265335, 'spoof', 'elevated'),
]


class PredictionParityTests(unittest.TestCase):
    def test_original_cli_and_api_agree_on_all_six_fixtures(self):
        with TestClient(app) as client:
            for filename, score, prediction, risk in CASES:
                with self.subTest(filename=filename):
                    path = ROOT / 'test_audio' / filename
                    cli = json.loads(subprocess.run(
                        [sys.executable, '-m', 'demo.run_audio', str(path)],
                        cwd=ROOT, check=True, capture_output=True, text=True,
                    ).stdout)
                    with path.open('rb') as audio:
                        response = client.post('/api/analyze', files={'file': (filename, audio, 'audio/wav')})
                    self.assertEqual(response.status_code, 200, response.text)
                    api = response.json()
                    for result in (cli, api):
                        self.assertAlmostEqual(result['acoustic']['spoof_score'], score, delta=1e-6)
                        self.assertEqual(result['acoustic']['prediction'], prediction)
                        self.assertEqual(result['acoustic']['threshold'], .05530281)
                        self.assertEqual(result['risk_level'], risk)
                    for key in ('spoof_score', 'bonafide_score'):
                        self.assertAlmostEqual(cli['acoustic'][key], api['acoustic'][key], delta=1e-6)
                    print(json.dumps({'file': filename, 'cli': cli['acoustic'], 'api': api['acoustic']}))

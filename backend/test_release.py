"""Release boundaries and per-worker lifecycle; canonical inference is unchanged."""
import io
import unittest
from unittest.mock import patch

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from backend.app import app
from backend.test_api import wav
from demo.inference import AcousticAnalyzer


class ReleaseTests(unittest.TestCase):
    def test_one_model_construction_per_worker_lifespan(self):
        with patch('backend.app.AcousticAnalyzer', wraps=AcousticAnalyzer) as constructor:
            with TestClient(app) as client:
                self.assertEqual(str(app.state.analyzer.device), 'cpu')
                instance = app.state.analyzer
                for _ in range(3):
                    response = client.post('/api/analyze', files={'file': ('silence.wav', wav(), 'audio/wav')})
                    self.assertEqual(response.status_code, 200)
                    self.assertIs(app.state.analyzer, instance)
                constructor.assert_called_once_with()
            self.assertIsNone(app.state.analyzer)

    def test_input_matrix_and_inference_failure(self):
        with TestClient(app) as client:
            for rate, channels, seconds in [(16000, 1, 1), (8000, 1, .05), (22050, 2, .4), (44100, 1, 1), (48000, 2, 1), (16000, 1, 10), (16000, 1, 120)]:
                with self.subTest(rate=rate, channels=channels, seconds=seconds):
                    result = client.post('/api/analyze', files={'file': ('input.wav', wav(rate, channels, seconds), 'audio/wav')})
                    self.assertEqual(result.status_code, 200, result.text)
                    data = result.json()['acoustic']
                    self.assertEqual(data['threshold'], .05530281)
                    self.assertEqual(data['prediction'], 'spoof' if data['spoof_score'] >= data['threshold'] else 'below_threshold')
            # Non-finite float WAV must fail at canonical input validation.
            buffer = io.BytesIO()
            sf.write(buffer, np.full(16000, np.nan), 16000, format='WAV', subtype='FLOAT')
            for name, content, status in [('nan.wav', buffer.getvalue(), 422), ('broken.wav', b'RIFFbroken', 422), ('empty.wav', b'', 422), ('audio.mp3', b'bad', 415), ('long.wav', wav(seconds=121), 422), ('channels.wav', wav(channels=9), 422)]:
                with self.subTest(name=name):
                    response = client.post('/api/analyze', files={'file': (name, content, 'audio/wav')})
                    self.assertEqual(response.status_code, status)
                    self.assertIsInstance(response.json()['detail'], str)
                    self.assertNotIn('acoustic', response.json())
            with patch.object(app.state.analyzer, 'analyze', side_effect=RuntimeError('diagnostic forced inference failure')):
                response = client.post('/api/analyze', files={'file': ('valid.wav', wav(), 'audio/wav')})
                self.assertEqual(response.status_code, 500)
                self.assertIn('Inference failed', response.json()['detail'])
                self.assertNotIn('acoustic', response.json())


if __name__ == '__main__':
    unittest.main()

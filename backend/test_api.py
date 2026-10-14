"""Run from repository root: python -m unittest backend.test_api -v."""
import io
from pathlib import Path
import unittest
from unittest.mock import patch
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from backend.app import app


def wav(rate=16000, channels=1, seconds=1):
    buffer = io.BytesIO()
    sf.write(buffer, np.zeros((int(rate * seconds), channels), dtype=np.float32), rate, format="WAV")
    return buffer.getvalue()


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def test_health_and_real_checkpoint(self):
        self.assertTrue(self.client.get('/api/health').json()['model_loaded'])
        response = self.client.post('/api/analyze', files={'file': ('sample.wav', wav(22050, 2, .4), 'audio/wav')})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result['audio_file'], 'sample.wav')
        self.assertEqual(result['sample_rate_hz'], 22050)
        self.assertAlmostEqual(result['acoustic']['spoof_score'] + result['acoustic']['bonafide_score'], 1, places=5)
        self.assertNotIn('checkpoint', result['acoustic'])
        self.assertEqual(result['acoustic']['threshold'], .05530281)

    def test_adapter_contract_and_cleanup(self):
        original = app.state.analyzer.analyze
        paths, scores = [], []
        def capture(path):
            paths.append(Path(path)); value = original(path)
            scores.append(value['acoustic']['spoof_score'])
            return value
        with patch.object(app.state.analyzer, 'analyze', side_effect=capture):
            response = self.client.post('/api/analyze', files={'file': ('test.wav', wav(), 'audio/wav')})
        self.assertEqual(response.json()['acoustic']['spoof_score'], scores[0])
        self.assertFalse(paths[0].exists())

    def test_rejections(self):
        for name, content, expected in [('bad.mp3', b'bad', 415), ('empty.wav', b'', 422), ('bad.wav', b'garbage', 422), ('long.wav', wav(seconds=121), 422)]:
            with self.subTest(name=name):
                self.assertEqual(self.client.post('/api/analyze', files={'file': (name, content, 'audio/wav')}).status_code, expected)
        with patch('backend.app.MAX_BYTES', 100):
            self.assertEqual(self.client.post('/api/analyze', files={'file': ('large.wav', wav(), 'audio/wav')}).status_code, 413)

    def test_content_validation(self):
        buffer = io.BytesIO(); sf.write(buffer, np.zeros(16000), 16000, format='FLAC')
        self.assertEqual(self.client.post('/api/analyze', files={'file': ('fake.wav', buffer.getvalue(), 'audio/wav')}).status_code, 422)

    def test_unavailable_and_cors(self):
        with patch.object(app.state, 'analyzer', None):
            self.assertFalse(self.client.get('/api/health').json()['model_loaded'])
            self.assertEqual(self.client.post('/api/analyze', files={'file': ('sample.wav', wav(), 'audio/wav')}).status_code, 503)
        response = self.client.options('/api/analyze', headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST'})
        self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:5173')

    def test_original_gui_import(self):
        from demo.app import VakSiddhiApp
        self.assertTrue(callable(VakSiddhiApp))


if __name__ == '__main__':
    unittest.main()

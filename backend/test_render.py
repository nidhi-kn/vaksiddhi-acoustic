import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app import app, cors_origins


class RenderTests(unittest.TestCase):
    def test_exact_cors_origins(self):
        with patch.dict(os.environ, {'CORS_ORIGINS': 'https://vaksiddhi.vercel.app,https://preview-specific.vercel.app'}):
            allowed = cors_origins()
            self.assertIn('https://vaksiddhi.vercel.app', allowed)
            self.assertNotIn('https://untrusted.vercel.app', allowed)
            self.assertIn('http://localhost:5173', allowed)
        for invalid in ['*', 'https://*.vercel.app', 'https://site.vercel.app/path', 'https://site.vercel.app/']:
            with patch.dict(os.environ, {'CORS_ORIGINS': invalid}):
                with self.assertRaises(ValueError):
                    cors_origins()

    def test_ready_reflects_model_health_without_changing_health_endpoint(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/ready').status_code, 200)
            with patch.object(app.state, 'analyzer', None):
                self.assertEqual(client.get('/api/ready').status_code, 503)
                self.assertEqual(client.get('/api/health').status_code, 200)
                self.assertFalse(client.get('/api/health').json()['model_loaded'])

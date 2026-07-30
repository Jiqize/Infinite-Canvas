import unittest

from fastapi.testclient import TestClient

import main


class SpaRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()

    def test_app_serves_react_shell(self):
        response = self.client.get("/app")

        self.assertEqual(response.status_code, 200)
        self.assertIn('<div id="root"></div>', response.text)

    def test_app_history_path_falls_back_to_react_shell(self):
        response = self.client.get("/app/canvas/some-id")

        self.assertEqual(response.status_code, 200)
        self.assertIn('<div id="root"></div>', response.text)

    def test_missing_app_asset_stays_404(self):
        response = self.client.get("/app/assets/不存在的文件.js")

        self.assertEqual(response.status_code, 404)
        self.assertNotIn('<div id="root"></div>', response.text)

    def test_legacy_paths_redirect_to_app(self):
        for path in ("/legacy", "/legacy/"):
            with self.subTest(path=path):
                response = self.client.get(path, follow_redirects=False)

                self.assertEqual(response.status_code, 302)
                self.assertEqual(response.headers["location"], "/app")

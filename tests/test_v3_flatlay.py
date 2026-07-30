import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import main


class FlatlayRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp.name) / "data"
        self.data_dir.mkdir()
        self.patches = [
            patch.object(main, "DATA_DIR", str(self.data_dir)),
            patch.object(
                main,
                "FLATLAY_DB",
                str(self.data_dir / "flatlay.db"),
                create=True,
            ),
        ]
        for item in self.patches:
            item.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def test_list_batches_returns_source_empty_contract(self):
        response = self.client.get("/api/flatlay/batches")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"batches": []})

    def test_update_phrase_for_missing_item_returns_source_404(self):
        response = self.client.patch(
            "/api/flatlay/items/nonexistent/phrase",
            json={"phrase": "针织上衣"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "平面图任务不存在"})

    def test_config_includes_flatlay_vision_model(self):
        response = self.client.get("/api/config")

        self.assertEqual(response.status_code, 200)
        self.assertIn("flatlay_vision_model", response.json())
        self.assertEqual(
            response.json()["flatlay_vision_model"],
            main.FLATLAY_VISION_MODEL,
        )

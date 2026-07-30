import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

import main


class BatchTryonRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.data_dir = self.root / "data"
        self.output_dir = self.root / "output"
        self.generated_dir = self.root / "generated"
        self.data_dir.mkdir()
        self.output_dir.mkdir()
        self.generated_dir.mkdir()
        (self.output_dir / "clothing.png").write_bytes(b"clothing")
        (self.output_dir / "model.png").write_bytes(b"model")
        self.patches = [
            patch.object(main, "DATA_DIR", str(self.data_dir)),
            patch.object(
                main,
                "BATCH_TRYON_DB",
                str(self.data_dir / "batch_tryon.db"),
                create=True,
            ),
            patch.object(main, "OUTPUT_DIR", str(self.output_dir)),
            patch.object(main, "OUTPUT_OUTPUT_DIR", str(self.generated_dir)),
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
        response = self.client.get("/api/batch-tryon/batches")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"batches": []})

    def test_create_batch_returns_source_detail_contract(self):
        response = self.client.post(
            "/api/batch-tryon/batches",
            json={
                "prompt": "把服装自然地穿到模特身上",
                "clothing_images": [{"url": "/output/clothing.png"}],
                "model_images": [{"url": "/output/model.png"}],
                "autostart": False,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), {"batch", "groups", "tasks"})
        self.assertTrue(body["batch"]["id"].startswith("bt_"))
        self.assertEqual(body["batch"]["status"], "pending")
        self.assertEqual(body["batch"]["counts"]["total"], 1)
        self.assertEqual(len(body["groups"]), 1)
        self.assertEqual(len(body["tasks"]), 1)
        self.assertEqual(body["tasks"][0]["status"], "pending")

    def test_start_missing_batch_returns_source_404(self):
        response = self.client.post(
            "/api/batch-tryon/batches/nonexistent/start",
            json={},
            headers={"X-Comfly-API-Key": "test-key"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "批次不存在"})

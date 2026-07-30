import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class GalleryRouteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.data_dir = self.root / "data"
        self.conversation_dir = self.data_dir / "conversations"
        self.canvas_dir = self.data_dir / "canvases"
        self.conversation_dir.mkdir(parents=True)
        self.canvas_dir.mkdir(parents=True)
        self.history_file = self.root / "history.json"
        self.history_file.write_text(json.dumps([]), encoding="utf-8")
        self.gallery_meta_file = self.data_dir / "gallery_meta.json"
        self.patches = [
            patch.object(main, "DATA_DIR", str(self.data_dir)),
            patch.object(main, "CONVERSATION_DIR", str(self.conversation_dir)),
            patch.object(main, "CANVAS_DIR", str(self.canvas_dir)),
            patch.object(main, "HISTORY_FILE", str(self.history_file)),
            patch.object(main, "GALLERY_META_FILE", str(self.gallery_meta_file), create=True),
            patch.object(main, "add_flatlay_gallery_assets", lambda assets: None, create=True),
            patch.object(main, "add_batch_tryon_gallery_assets", lambda assets: None, create=True),
        ]
        for item in self.patches:
            item.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def test_list_assets_returns_paginated_contract(self):
        response = self.client.get("/api/gallery/assets?page=1&page_size=6")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "assets": [],
                "page": 1,
                "page_size": 12,
                "pages": 1,
                "total": 0,
                "facets": {
                    "sources": [],
                    "artifact_types": [],
                    "statuses": [],
                    "models": [],
                    "favorites": 0,
                },
            },
        )

    def test_favorite_missing_asset_returns_source_404(self):
        response = self.client.patch(
            "/api/gallery/assets/nonexistent/favorite",
            json={"favorite": True},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "资产不存在"})

    def test_delete_missing_asset_returns_source_404(self):
        response = self.client.delete("/api/gallery/assets/nonexistent")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "资产不存在"})

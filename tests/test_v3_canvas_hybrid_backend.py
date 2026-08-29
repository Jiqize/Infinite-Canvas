import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


EXPECTED_ROUTES = {
    ("post", "/api/midjourney/submit"),
    ("post", "/api/midjourney/actions"),
    ("post", "/api/midjourney/modal"),
    ("get", "/api/midjourney/tasks/{task_id}"),
    ("post", "/api/smart-canvas/minimax-export"),
}


def source_routes():
    source = Path(main.__file__).read_text(encoding="utf-8")
    return [
        (method.lower(), path)
        for method, path in re.findall(
            r'@app\.(get|post|put|patch|delete)\(\s*["\']([^"\']+)["\']',
            source,
        )
    ]


class CanvasHybridRouteAuditTests(unittest.TestCase):
    def test_main_has_exactly_190_unique_route_decorators(self):
        routes = source_routes()

        self.assertEqual(len(routes), 190)
        self.assertEqual(len(set(routes)), 190)
        self.assertTrue(EXPECTED_ROUTES.issubset(set(routes)))

    def test_minimax_workflow_assets_are_loadable(self):
        root = Path(main.__file__).resolve().parent
        workflow = json.loads((root / "workflows" / "MiniMax_H3.json").read_text(encoding="utf-8"))
        config = json.loads((root / "workflows" / "MiniMax_H3.config.json").read_text(encoding="utf-8"))
        runninghub = json.loads((root / "static" / "runninghub" / "api_providers.json").read_text(encoding="utf-8"))

        self.assertIsInstance(workflow, dict)
        self.assertTrue(workflow)
        self.assertEqual(config["title"], "MiniMax H3")
        self.assertTrue(config["fields"])
        for field in config["fields"]:
            self.assertIn(field["node"], workflow)
        self.assertIn("SaveVideo", {node.get("class_type") for node in workflow.values()})

        rh_provider = next(item for item in runninghub if item["id"] == "runninghub")
        self.assertTrue(any(item.get("id") == "2084608321469898754" for item in rh_provider["rh_workflows"]))
        self.assertTrue((root / "static" / "runninghub" / "thumbnails" / "workflow-2084608321469898754.jpg").is_file())


class MidjourneyRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app, raise_server_exceptions=False)
        self.provider = {"id": "apimart", "name": "APIMart", "protocol": "apimart"}

    def tearDown(self):
        self.client.close()

    def test_submit_action_modal_and_query_contracts(self):
        request_result = ({"data": {"task_id": "mj-next", "status": "SUBMITTED"}}, "mj-next")
        with (
            patch.object(main, "apimart_midjourney_provider", return_value=self.provider, create=True),
            patch.object(main, "apimart_midjourney_request", new=AsyncMock(return_value=request_result), create=True),
            patch.object(main, "midjourney_modal_mask_url", new=AsyncMock(return_value="data:image/png;base64,AA=="), create=True),
            patch.object(
                main,
                "midjourney_result",
                new=AsyncMock(return_value={"status": "running", "task_id": "mj-next"}),
                create=True,
            ),
        ):
            submitted = self.client.post(
                "/api/midjourney/submit",
                json={"provider_id": "apimart", "prompt": "editorial look"},
            )
            action = self.client.post(
                "/api/midjourney/actions",
                json={"provider_id": "apimart", "task_id": "mj-source", "action": "variation", "index": 2},
            )
            modal = self.client.post(
                "/api/midjourney/modal",
                json={
                    "provider_id": "apimart",
                    "task_id": "mj-source",
                    "prompt": "replace sleeve",
                    "mask_image": {"url": "data:image/png;base64,AA=="},
                },
            )
            queried = self.client.get("/api/midjourney/tasks/mj-next?provider_id=apimart")

        self.assertEqual(submitted.status_code, 200)
        self.assertEqual(submitted.json()["task_id"], "mj-next")
        self.assertEqual(submitted.json()["mode"], "imagine")
        self.assertEqual(action.status_code, 200)
        self.assertEqual(action.json()["action"], "variation")
        self.assertEqual(modal.status_code, 200)
        self.assertEqual(modal.json()["task_id"], "mj-next")
        self.assertEqual(queried.status_code, 200)
        self.assertEqual(queried.json(), {"status": "running", "task_id": "mj-next"})

    def test_invalid_submit_values_are_visible_client_errors(self):
        with patch.object(main, "apimart_midjourney_provider", return_value=self.provider, create=True):
            speed = self.client.post(
                "/api/midjourney/submit",
                json={"provider_id": "apimart", "prompt": "look", "speed": "instant"},
            )
            size = self.client.post(
                "/api/midjourney/submit",
                json={"provider_id": "apimart", "prompt": "look", "size": "wide"},
            )

        self.assertEqual(speed.status_code, 400)
        self.assertIn("relax", speed.json()["detail"])
        self.assertEqual(size.status_code, 400)
        self.assertIn("16:9", size.json()["detail"])


class MidjourneyTimeoutTests(unittest.IsolatedAsyncioTestCase):
    async def test_upstream_timeout_is_reported_as_504(self):
        request_fn = getattr(main, "apimart_midjourney_request", None)
        self.assertIsNotNone(request_fn)

        class TimeoutClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return False

            async def post(self, *_args, **_kwargs):
                raise httpx.ReadTimeout("upstream timeout")

        with (
            patch.object(main.httpx, "AsyncClient", return_value=TimeoutClient()),
            patch.object(main, "api_headers", return_value={"Authorization": "Bearer test"}),
        ):
            with self.assertRaises(HTTPException) as raised:
                await request_fn(
                    {"id": "apimart", "name": "APIMart", "protocol": "apimart"},
                    "/v1/midjourney/generations",
                    {"prompt": "look"},
                )

        self.assertEqual(raised.exception.status_code, 504)
        self.assertIn("超时", str(raised.exception.detail))


class MiniMaxExportRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app, raise_server_exceptions=False)

    def tearDown(self):
        self.client.close()

    def test_empty_timeline_is_a_400(self):
        with patch.object(main.shutil, "which", return_value="/mock/ffmpeg"):
            response = self.client.post("/api/smart-canvas/minimax-export", json={"clips": []})

        self.assertEqual(response.status_code, 400)
        self.assertIn("时间轴", response.json()["detail"])

    def test_missing_ffmpeg_is_explicit(self):
        with patch.object(main.shutil, "which", return_value=None):
            response = self.client.post(
                "/api/smart-canvas/minimax-export",
                json={"clips": [{"url": "/output/source.mp4", "duration": 1}]},
            )

        self.assertEqual(response.status_code, 500)
        self.assertIn("ffmpeg", response.json()["detail"])

    def test_single_local_clip_exports_with_mock_ffmpeg(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.mp4"
            output = root / "timeline.mp4"
            source.write_bytes(b"source")

            def fake_run(command, **_kwargs):
                Path(command[-1]).write_bytes(b"encoded")
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            def fake_which(name):
                return "/mock/ffmpeg" if name == "ffmpeg" else None

            with (
                patch.object(main.shutil, "which", side_effect=fake_which),
                patch.object(main, "output_file_from_url", return_value=str(source)),
                patch.object(main, "output_path_for", return_value=str(output)),
                patch.object(main, "output_url_for", return_value="/assets/output/timeline.mp4"),
                patch.object(main.subprocess, "run", side_effect=fake_run),
            ):
                response = self.client.post(
                    "/api/smart-canvas/minimax-export",
                    json={
                        "clips": [{"url": "/output/source.mp4", "name": "source", "start": 0, "end": 1, "duration": 1}],
                        "filename": "timeline.mp4",
                    },
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"url": "/assets/output/timeline.mp4", "name": "timeline.mp4", "kind": "video"},
        )

    def test_ffmpeg_timeout_is_reported_as_504(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "source.mp4"
            source.write_bytes(b"source")
            with (
                patch.object(main.shutil, "which", side_effect=lambda name: "/mock/ffmpeg" if name == "ffmpeg" else None),
                patch.object(main, "output_file_from_url", return_value=str(source)),
                patch.object(main.subprocess, "run", side_effect=subprocess.TimeoutExpired("ffmpeg", 300)),
            ):
                response = self.client.post(
                    "/api/smart-canvas/minimax-export",
                    json={"clips": [{"url": "/output/source.mp4", "duration": 1}]},
                )

        self.assertEqual(response.status_code, 504)
        self.assertIn("超时", response.json()["detail"])

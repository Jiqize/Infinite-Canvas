import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class CanvasVideoTaskRouteTests(unittest.TestCase):
    def setUp(self):
        with main.CANVAS_TASK_LOCK:
            main.CANVAS_TASKS.clear()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        with main.CANVAS_TASK_LOCK:
            main.CANVAS_TASKS.clear()

    def test_create_returns_queued_task_contract(self):
        with patch.object(
            main,
            "run_canvas_video_task",
            new=AsyncMock(return_value=None),
            create=True,
        ):
            response = self.client.post(
                "/api/canvas-video-tasks",
                json={"prompt": "生成一段测试视频"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), {"task_id", "status"})
        self.assertTrue(body["task_id"].startswith("canvas_vid_"))
        self.assertEqual(body["status"], "queued")

    def test_created_task_is_retrievable_after_successful_worker(self):
        result = {"videos": ["/output/test-video.mp4"]}
        with patch.object(
            main,
            "canvas_video",
            new=AsyncMock(return_value=result),
        ):
            created = self.client.post(
                "/api/canvas-video-tasks",
                json={"prompt": "生成一段测试视频"},
            )
            fetched = self.client.get(
                f"/api/canvas-video-tasks/{created.json()['task_id']}"
            )

        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["status"], "succeeded")
        self.assertEqual(fetched.json()["result"], result)

    def test_missing_task_returns_source_404(self):
        response = self.client.get("/api/canvas-video-tasks/nonexistent")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json(),
            {"detail": "画布任务不存在，可能服务已重启或任务已过期"},
        )

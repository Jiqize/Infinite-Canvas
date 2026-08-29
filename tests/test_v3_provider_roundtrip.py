import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


class ProviderNormalizationTests(unittest.TestCase):
    def test_supported_image_modes_include_tudou_async(self):
        self.assertEqual(main.normalize_image_request_mode("tudou-async"), "tudou-async")

    def test_official_tudou_host_enables_async_mode_for_new_config(self):
        provider = main.normalize_provider(
            {
                "id": "new-tudou",
                "name": "New Tudou",
                "base_url": "https://api.ai-tudou.net/v1",
                "protocol": "openai",
                "image_models": ["gpt-image-2-2k"],
            }
        )

        self.assertEqual(provider["protocol"], "openai")
        self.assertEqual(provider["image_request_mode"], "tudou-async")

    def test_legacy_tudou_protocol_value_is_preserved(self):
        provider = main.normalize_provider(
            {
                "id": "legacy-tudou",
                "name": "Legacy Tudou",
                "base_url": "https://api.ai-tudou.net",
                "protocol": "tudou",
                "image_request_mode": "tudou-async",
                "image_models": ["gpt-image-2-1k"],
            }
        )

        self.assertEqual(provider["protocol"], "tudou")
        self.assertEqual(provider["image_request_mode"], "tudou-async")

    def test_apimart_gemini_uses_bearer_auth_and_official_host(self):
        provider = {
            "id": "apimart",
            "name": "APIMart",
            "base_url": "https://custom.example/v1",
            "protocol": "apimart",
            "model_protocols": {"gemini-model": "gemini"},
        }
        with (
            patch.object(main, "get_api_provider", return_value=provider),
            patch.object(main, "provider_env_key_value", return_value="secret"),
        ):
            base, headers, model = main.resolve_chat_provider("apimart", "gemini-model", "")

        self.assertEqual(model, "gemini-model")
        self.assertEqual(base, "https://api.apimart.ai/v1beta")
        self.assertEqual(headers["Authorization"], "Bearer secret")
        self.assertNotIn("x-goog-api-key", headers)


class ProviderRoundTripTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.provider_file = self.root / "api_providers.json"
        self.patches = [
            patch.object(main, "DATA_DIR", str(self.root)),
            patch.object(main, "API_PROVIDERS_FILE", str(self.provider_file)),
            patch.object(main, "update_env_values", return_value=None),
            patch.object(main, "reload_env_globals", return_value=None),
            patch.object(main, "provider_env_key_value", return_value=""),
        ]
        for item in self.patches:
            item.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def test_put_then_get_preserves_unedited_advanced_fields_and_types(self):
        provider = {
            "id": "roundtrip",
            "name": "Round Trip",
            "base_url": "https://provider.example/v1",
            "protocol": "gemini",
            "image_request_mode": "openai-responses",
            "image_generation_endpoint": "/v1/images/generations",
            "image_edit_endpoint": "/v1/images/edits",
            "enabled": True,
            "primary": True,
            "image_models": ["image-a"],
            "chat_models": ["chat-a"],
            "video_models": ["video-a"],
            "model_names": {"image-a": "Image A"},
            "model_protocols": {"chat-a": "gemini"},
            "ms_loras": [{"id": "lora-a", "name": "LoRA A"}],
            "ms_defaults_version": 2,
            "rh_apps": [{"id": "app-a", "name": "App A"}],
            "rh_workflows": [{"id": "workflow-a", "name": "Workflow A"}],
            "volcengine_project_name": "project-a",
            "volcengine_region": "cn-beijing",
        }

        saved = self.client.put("/api/providers", json=[provider])
        fetched = self.client.get("/api/providers")

        self.assertEqual(saved.status_code, 200)
        self.assertEqual(fetched.status_code, 200)
        stored = json.loads(self.provider_file.read_text(encoding="utf-8"))[0]
        public = next(item for item in fetched.json()["providers"] if item["id"] == "roundtrip")
        for key in (
            "protocol",
            "image_request_mode",
            "image_generation_endpoint",
            "image_edit_endpoint",
            "image_models",
            "chat_models",
            "video_models",
            "model_names",
            "model_protocols",
            "ms_loras",
            "ms_defaults_version",
            "rh_apps",
            "rh_workflows",
            "volcengine_project_name",
            "volcengine_region",
        ):
            self.assertEqual(stored[key], public[key], key)

        self.assertIsInstance(public["ms_loras"], list)
        self.assertIsInstance(public["ms_defaults_version"], int)

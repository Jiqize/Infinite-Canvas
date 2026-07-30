import importlib


APP_CONFIG_SYMBOLS = (
    "AI_API_KEY",
    "AI_BASE_URL",
    "AI_REQUEST_TIMEOUT",
    "APP_HOST",
    "APP_PORT",
    "API_ENV_FILE",
    "CANVAS_DIR",
    "CANVAS_TRASH_RETENTION_MS",
    "CHAT_MODEL",
    "CHAT_MODELS",
    "COMFYUI_ADDRESS",
    "COMFYUI_INSTANCES",
    "CORS_ALLOW_HEADERS",
    "CONVERSATION_DIR",
    "CORS_ALLOW_ORIGINS",
    "DATA_DIR",
    "FLATLAY_GENERATE_MODEL",
    "FLATLAY_VISION_MODEL",
    "GLOBAL_CONFIG_FILE",
    "HISTORY_FILE",
    "IMAGE_MODEL",
    "IMAGE_MODELS",
    "IMAGE_POLL_INTERVAL",
    "MAX_HISTORY_MESSAGES",
    "MODELSCOPE_API_KEY",
    "MODELSCOPE_CHAT_BASE_URL",
    "MODELSCOPE_CHAT_MODELS",
    "RMBG_API_KEY",
    "RMBG_BASE_URL",
    "RMBG_DEFAULT_VARIANT",
    "RMBG_LOCAL_BASE_URL",
    "RMBG_PROVIDER",
    "OUTPUT_DIR",
    "STATIC_DIR",
    "SYSTEM_PROMPT",
    "VIDEO_MODELS",
    "WORKFLOW_DIR",
    "ensure_runtime_dirs",
)

TASK_STATUS_SYMBOLS = (
    "TASK_FAILED",
    "TASK_QUEUED",
    "TASK_RUNNING",
    "TASK_SUCCEEDED",
    "TASK_TIMEOUT",
    "cloud_status_payload",
    "normalize_modelscope_status",
)


def test_app_config_provides_design_v2_1_imports():
    module = importlib.import_module("app_config")

    missing = [name for name in APP_CONFIG_SYMBOLS if not hasattr(module, name)]
    assert missing == []


def test_task_status_provides_design_v2_1_imports():
    module = importlib.import_module("task_status")

    missing = [name for name in TASK_STATUS_SYMBOLS if not hasattr(module, name)]
    assert missing == []

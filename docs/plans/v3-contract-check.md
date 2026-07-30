# V3 React 前端契约核对

核对范围：`frontend/src/lib/api.ts` 与 `frontend/src/lib/task-stream.ts` 中的固定后端端点。方法、请求字段与响应消费形状均对照当前 v3 `main.py`；`uploadCanvasUrlToComfy()` 接收调用方提供的动态媒体 URL，不属于固定后端端点。

| 端点 | 状态 | 备注 |
| --- | --- | --- |
| `GET /api/config` | 一致 | 返回模型列表、provider 列表和 key 可用性；前端新增字段均为可选消费。 |
| `GET /api/providers` | 一致 | 返回 `{ providers }`；`primary_provider_id` 在前端为可选字段。 |
| `PUT /api/providers` | 一致 | 请求 provider 数组，返回 `{ providers }`。 |
| `POST /api/providers/test-connection` | 上游差异已适配 | 上游返回 `model_count`、`all` 与分类 model 列表；`api.ts` 归一为 design/v2.1 消费的 `raw_count`、`models`。 |
| `POST /api/providers/fetch-models` | 上游差异已适配 | 上游返回 `total`、`all` 与分类 model 列表；`api.ts` 归一为 design/v2.1 消费的 `raw_count`、`models`。 |
| `POST /api/providers/probe-async` | 上游差异已适配 | 上游主要返回 `message`；`api.ts` 将其归一到现有 UI 消费的 `detail`，并保留 `status_code`、`protocol`。 |
| `GET /api/comfyui/instances` | 一致 | 返回 `{ instances }`；前端 `primary` 为可选字段。 |
| `PUT /api/comfyui/instances` | 一致 | 请求 `{ instances }`，返回规范化后的 `{ instances }`。 |
| `GET /api/workflows` | 一致 | 返回 `{ workflows }`，条目含名称及可选展示元数据。 |
| `GET /api/workflows/{name}` | 一致 | 返回 `{ name, workflow, config, builtin }`。 |
| `POST /api/workflows` | 一致 | 请求 `{ name, workflow }`，返回 `{ name }`。 |
| `PUT /api/workflows/{name}/config` | 一致 | 请求 workflow config，返回 `{ config }`。 |
| `DELETE /api/workflows/{name}` | 一致 | 返回 `{ ok: true }`。 |
| `POST /api/workflows/{name}/run` | 一致 | 请求 prompt、尺寸、字段和 config；响应为生成记录或任务字段的开放对象。 |
| `GET /api/queue_status?client_id=...` | 上游差异已适配 | 上游只返回 `total`、`position`；`api.ts` 按队列位置派生 design/v2.1 的 `status`。 |
| `GET /api/gallery/assets` | 一致 | 支持搜索、过滤与分页参数，返回 `{ assets, total, page, page_size, pages, facets }`；`page_size=6` 会按源实现下限归一到 12。 |
| `PATCH /api/gallery/assets/{asset_id}/favorite` | 一致 | 请求 `{ favorite }`，返回 `{ ok, asset }`。 |
| `DELETE /api/gallery/assets/{asset_id}` | 一致 | 返回 `{ ok }`。 |
| `POST /api/gallery/download` | 一致 | 请求 `{ asset_ids }`，成功响应为 ZIP Blob。 |
| `GET /api/canvases` | 一致 | 返回 `{ canvases }`。 |
| `GET /api/canvases/trash` | 一致 | 返回 `{ canvases, retention_days }`。 |
| `POST /api/canvases` | 一致 | 请求画布标题、图标和 kind，返回 `{ canvas }`。 |
| `GET /api/canvases/{canvas_id}` | 一致 | 返回 `{ canvas }`。 |
| `PUT /api/canvases/{canvas_id}` | 一致 | 请求画布文档与 `base_updated_at`，返回 `{ canvas }`。 |
| `DELETE /api/canvases/{canvas_id}` | 一致 | 软删除并返回 `{ ok }`。 |
| `POST /api/canvases/{canvas_id}/restore` | 一致 | 返回 `{ canvas }`。 |
| `DELETE /api/canvases/{canvas_id}/purge` | 一致 | 永久删除并返回 `{ ok }`。 |
| `POST /api/canvas-assets/check` | 上游差异已适配 | 请求和消费保持公共契约 `{ urls }` → `{ exists }`；上游扩大本地路径识别范围，不影响前端。 |
| `POST /api/canvas-assets/download` | 上游差异已适配 | 前端使用双方共有的 `urls`、`filename` 字段并按 Blob 消费；上游额外支持 `items` 与远程媒体。 |
| `GET /api/download-output?url=...&name=...` | 一致 | 返回单个输出文件 Blob；用于画布和 gallery 的单文件下载 URL。 |
| `GET /api/history?type=...` | 一致 | `zimage`、`enhance`、`klein`、`online`、`angle` 均返回生成记录数组。 |
| `POST /api/generate` | 一致 | 本地和 workflow 生图共用 `GenerateRequest`，返回生成记录。 |
| `POST /generate` | 一致 | 云端 Z-Image 请求返回 `url`、`task_id`、`status` 的可选组合。 |
| `POST /api/upload` | 一致 | multipart `files`，返回 `{ files: [{ comfy_name, name? }] }`。 |
| `POST /api/ai/upload` | 一致 | multipart `files`，返回 `{ files }`，每项包含可用 `url`。 |
| `POST /api/canvas-llm` | 一致 | 请求消息、上下文和媒体，返回 `{ text, model?, raw_usage? }`。 |
| `POST /api/canvas-video` | 上游差异已适配 | 响应仍为 `{ videos, task_id?, raw? }`；`api.ts` 将 UI 的 `camera_fixed` 映射为上游读取的 `camerafixed`。 |
| `POST /api/angle/generate` | 一致 | 返回 `url`、`task_id`、`status`、`message` 的可选组合。 |
| `POST /api/angle/poll_status` | 一致 | 请求 `task_id`，响应形状与 angle generate 相同。 |
| `POST /api/ms/generate` | 一致 | 返回 `url`、`task_id`、`status` 或错误细节。 |
| `POST /api/online-image` | 一致 | 请求 provider/model/reference image，返回生成记录。 |
| `POST /api/canvas-image-tasks` | 一致 | 返回 `{ task_id, status }`。 |
| `GET /api/canvas-image-tasks/{task_id}` | 一致 | 返回任务 id、状态、结果、错误和时间字段。 |
| `GET /api/conversations` | 一致 | 使用 `X-User-ID`，返回 `{ user_id, conversations }`。 |
| `POST /api/conversations` | 一致 | 请求 `{ title }`，返回 `{ conversation }`。 |
| `GET /api/conversations/{conversation_id}` | 一致 | 使用 `X-User-ID`，返回 `{ conversation }`。 |
| `DELETE /api/conversations/{conversation_id}` | 一致 | 使用 `X-User-ID`，返回 `{ ok }`。 |
| `POST /api/chat` | 一致 | 请求 conversation/message/model 字段，返回 `{ conversation, message? }`。 |
| `POST /api/chat/stream` | 一致 | 返回 SSE；前端处理 `meta`、`delta`、`done`、`error` 事件。 |
| `POST /api/history/delete` | 一致 | 请求 `{ timestamp }`，返回 `{ success, message? }`。 |
| `WS /ws/stats?client_id=...` | 一致 | `stats` 消息提供 `online_count`，其他任务消息原样交给调用方。 |

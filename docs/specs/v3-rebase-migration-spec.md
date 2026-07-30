# V3 换底盘移植 Spec（design/v2.1 → 基于 origin/main 的新基线）

**日期**：2026-07-30
**决策背景**：design/v2.1 与上游 origin/main 自 2026-05-11 分叉后各自重写了 main.py（本地 +9k 行 / 上游 +17k 行），textual merge 不可行。用户需要上游功能红利（Seedream、视频、RunningHub、PS 插件），决定选"换底盘"：以 origin/main 为新基线，移植本地 QCOS 资产。

## 目标

新分支 `v3`（基于 `origin/main` = `de469fe`）上，QCOS React 前端 + 其依赖的后端 API 全部可用，且上游原有全部功能不回归。

## 保留资产（移植对象）

1. **`frontend/` React + Vite 应用**（49 文件，整体拷贝，零冲突）
2. **本地独有后端 API**（上游 main.py 缺失的 24 条路由，按模块分组）：
   - gallery 资产库：`GET/DELETE /api/gallery/assets*`、`POST /api/gallery/download`（另核实 favorite 端点，路由 grep 两边均未命中，需人工确认前端 `api.ts` 调用的 `/api/gallery/assets/{id}/favorite` 的真实后端实现位置）
   - batch-tryon 批量试穿：`/api/batch-tryon/batches*` 全套 8 条
   - flatlay：`/api/flatlay/*` 全套 6 条
   - canvas-video-tasks：`POST /api/canvas-video-tasks`、`GET /api/canvas-video-tasks/{task_id}`
   - React SPA 挂载：`GET /app`、`GET /app/{path:path}`、`GET /legacy*`
3. **支撑模块**：`app_config.py`、`task_status.py`（上游没有这两个文件；若上游 main.py 已内联等价逻辑，以适配上游为准，不强行引入）
4. **QCOS 文档**：`docs/quiet-creative-os*`（原样拷贝，不改内容）

## 明确放弃（Out of Scope）

- design v2.1 对 static 单文件页面的 Mistral 风格 re-skin（Phase 0–4 的全部 static/ 改动）
- 本地 `static/design-system.css`、`static/icons/pixel.svg` 等皮肤资产
- 不重构上游代码（main.py 保持单文件追加风格）、不改上游 static 页面
- 不处理上游代码质量问题（18k 行 main.py 就让它 18k 行）

## 关键行为约束

- 移植的每个模块必须保持本地版的**请求/响应契约不变**（frontend/src/lib/*.ts 是消费方基准）
- 路由名相同但双方实现不同的端点（如 `/api/canvas-video`、`/api/canvas-assets`），以**上游实现为准**，前端适配上游契约；仅当前端功能因此损坏时才最小修补
- `API/.env` 真实配置保存在 `API/.env.local-backup`，任何操作不得覆盖/提交真实密钥；上游入库的空 `API/.env` 不动
- 每个模块移植 = 一个独立 commit；main.py 每次改动后 `python -m py_compile main.py` 必须通过

## 验收标准

1. `python -m py_compile main.py` 通过；`python main.py` 正常启动（127.0.0.1:3000）
2. `cd frontend && npm install && npm run build` 通过
3. 浏览器验证 `/app`：React shell 加载、画布 CRUD、gallery 列表、batch-tryon 建批次页面可打开
4. 上游 golden path 不回归：`/`（index shell）、canvas.html、smart-canvas、zimage、gpt-chat 各 iframe 正常加载
5. 上游已有测试 `tests/test_canvas_log_cleanup.py` 仍通过

# V3 QCOS 后端移植 Implementation Plan

**Goal:** 把 design/v2.1 独有的 QCOS 后端模块移植进基于 origin/main 的 v3 分支，使 `frontend/` React 应用完整可用。
**Architecture:** 上游 main.py 保持单文件追加风格；每个模块从 `design/v2.1:main.py` 提取（含常量、辅助函数、worker、路由），适配上游已有基础设施后追加。参照源用 `git show design/v2.1:main.py` 获取（建议先导出 `/tmp/local-main.py` 再按行号读）。
**Tech Stack:** FastAPI（单文件 main.py）、SQLite（stdlib）、React + Vite（frontend/）、pytest + TestClient。

## Global Constraints

- 工作分支固定为 `v3`，禁止切换分支、禁止 push
- 参照源：`git show design/v2.1:app_config.py` / `design/v2.1:task_status.py` / `design/v2.1:main.py`（下文行号均指 design/v2.1 版 main.py）
- main.py 只追加不重构；新增代码块用上游既有的 `# --- xxx ---` 分块注释风格标注
- 移植端点的请求/响应契约必须与 design/v2.1 版逐字段一致（消费方基准：`frontend/src/lib/*.ts`）
- 与上游同名但实现不同的端点（`/api/canvas-video`、`/api/canvas-assets/*`）以上游为准，不覆盖上游实现
- 每次修改 main.py 后 `python3 -m py_compile main.py` 必须通过
- 移植代码 import 的第三方包若不在 requirements.txt，追加声明（stdlib 不用）
- 禁止改动 `API/.env`（已设 skip-worktree）、禁止提交任何密钥
- 每个 Task 一个 commit，conventional message，末尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 上游既有测试 `python3 -m pytest tests/test_canvas_log_cleanup.py -q` 在每个 Task 结束时必须仍通过

### Task 1: 支撑模块 app_config.py + task_status.py

**Files:**
- Create: `app_config.py`（从 `git show design/v2.1:app_config.py` 原样落盘）
- Create: `task_status.py`（从 `git show design/v2.1:task_status.py` 原样落盘）
- Test: `tests/test_v3_support_modules.py`

**Interfaces:**
- Produces: design/v2.1 main.py 第 32 行 `from app_config import (...)` 与第 72 行 `from task_status import (...)` 引用的全部符号，供 Task 2–6 移植代码 import

**Requirements:**
- 两个文件内容与 design/v2.1 版完全一致，不做"顺手改进"
- 不在上游 main.py 顶部加全局 import——各 Task 移植时只 import 自己需要的符号
- 确认模块级代码无副作用（不读写文件、不发网络请求）；若有，在 commit message 里注明并保持原样

**Test cases:**
- `import app_config` → 成功，design/v2.1 main.py 第 32 行 import 的每个符号存在
- `import task_status` → 成功，第 72 行 import 的每个符号存在

- [ ] **Step 1: 写失败测试**（模块不存在 → ModuleNotFoundError）
- [ ] **Step 2: `python3 -m pytest tests/test_v3_support_modules.py -q` 确认失败**
- [ ] **Step 3: 落盘两个模块文件**
- [ ] **Step 4: 测试通过 + `python3 -m py_compile app_config.py task_status.py main.py` 通过**
- [ ] **Step 5: Commit**

### Task 2: gallery 资产库模块

**Files:**
- Modify: `main.py`（追加 gallery 分块）
- Test: `tests/test_v3_gallery.py`

**Interfaces:**
- Consumes: Task 1 的模块（仅当参照源 gallery 代码引用时）
- Produces: 路由 `GET /api/gallery/assets`、`PATCH /api/gallery/assets/{asset_id}/favorite`、`DELETE /api/gallery/assets/{asset_id}`、`POST /api/gallery/download`

**Requirements:**
- 参照源锚点：常量 `GALLERY_META_FILE`（约 184 行）、路由与辅助函数（约 9837–9900+ 行）；用 grep 找齐所有 `gallery` 相关的常量/锁/辅助函数一并移植
- `GET /api/gallery/assets` 支持参照源的全部 query 参数（分页 page/page_size 及过滤参数），响应字段名逐一保持
- favorite 为 **PATCH** 方法（路由 diff 曾漏掉 patch，勿改成 POST/PUT）
- 元数据文件路径保持 `data/gallery_meta.json`；读写必须沿用参照源的锁保护方式
- 若参照源引用了上游已有的同名函数/常量（如 `safe_user_id`、`OUTPUT_DIR`），直接用上游版本，不重复定义

**Test cases:**
- `GET /api/gallery/assets?page=1&page_size=6` → 200，响应含参照源定义的分页字段
- `PATCH /api/gallery/assets/nonexistent/favorite` → 参照源定义的错误状态码（读源确认，通常 404）
- `DELETE /api/gallery/assets/nonexistent` → 参照源定义的错误状态码

- [ ] **Step 1: 写失败测试**
- [ ] **Step 2: 运行确认失败（404 Not Found 路由级）**
- [ ] **Step 3: 移植实现**
- [ ] **Step 4: 测试 + py_compile + 上游既有测试全通过**
- [ ] **Step 5: Commit**

### Task 3: canvas-video-tasks 模块

**Files:**
- Modify: `main.py`
- Test: `tests/test_v3_canvas_video_tasks.py`

**Interfaces:**
- Produces: `POST /api/canvas-video-tasks`、`GET /api/canvas-video-tasks/{task_id}`

**Requirements:**
- 参照源锚点：约 8105–8228 行，及其引用的任务存储结构 / worker / 轮询辅助函数（向上追溯移植齐）
- 状态字段用 task_status.py 的统一状态（queued/running/succeeded/failed/timeout），与参照源一致
- 不触碰上游已有的 `POST /api/canvas-video`（同名不同物，上游版保留）
- 若参照源 worker 复用了本地版的视频生成函数而上游已有等价函数，优先适配上游函数；无法适配时把本地辅助函数带 `qcos_` 语义前缀移植，避免符号冲突

**Test cases:**
- `POST /api/canvas-video-tasks`（合法最小 payload，从参照源 Pydantic 模型读取必填字段）→ 参照源定义的成功响应（含 task_id）
- `GET /api/canvas-video-tasks/nonexistent` → 参照源定义的错误状态码

- [ ] **Step 1–5：同 Task 2 节奏（失败测试 → 移植 → 全部验证 → commit）**

### Task 4: batch-tryon 批量试穿模块

**Files:**
- Modify: `main.py`
- Test: `tests/test_v3_batch_tryon.py`

**Interfaces:**
- Consumes: Task 1 模块符号
- Produces: `GET/POST /api/batch-tryon/batches`、`GET /api/batch-tryon/batches/{batch_id}`、`POST .../{batch_id}/start|pause|resume|retry-failed`、`POST /api/batch-tryon/tasks/{task_id}/retry`

**Requirements:**
- 参照源锚点：`BATCH_TRYON_DB`（约 180 行，SQLite 路径 `data/batch_tryon.db`）、worker 启动（约 6231 行）、路由（约 8718–8778 行）；SQLite 建表、`BATCH_TRYON_WORKERS` 字典、`run_batch_tryon_worker` 及全部依赖函数一并移植
- worker 用 `asyncio.create_task` 启动的模式保持原样；应用关闭时的清理逻辑若参照源有则一并移植
- 批次状态机（参照源定义的状态值与流转）逐字保持

**Test cases:**
- `GET /api/batch-tryon/batches` → 200，空库返回参照源定义的空列表结构
- `POST /api/batch-tryon/batches`（合法最小 payload，字段从参照源 Pydantic 模型照抄）→ 成功响应含 batch_id
- `POST /api/batch-tryon/batches/nonexistent/start` → 参照源定义的错误状态码

- [ ] **Step 1–5：同 Task 2 节奏**

### Task 5: flatlay 模块

**Files:**
- Modify: `main.py`
- Test: `tests/test_v3_flatlay.py`

**Interfaces:**
- Produces: `GET/POST /api/flatlay/batches`、`GET /api/flatlay/batches/{batch_id}`、`POST .../{batch_id}/pause|resume|retry-failed`、`PATCH /api/flatlay/items/{item_id}/phrase`、`POST /api/flatlay/items/{item_id}/rerun`

**Requirements:**
- 参照源锚点：`FLATLAY_DB`（约 182 行）、worker（约 5539–5660 行）、路由（约 8780–8847+ 行）、模型配置常量 `FLATLAY_VISION_MODEL` / `FLATLAY_GENERATE_MODEL`
- 参照源在配置响应端点（约 7858 行处，注入 `flatlay_vision_model` / `flatlay_generate_model` 字段）的改动，要找到上游对应端点补上同名字段
- `PATCH .../phrase` 是 PATCH 方法，勿改
- SQLite 建表与状态机逐字保持

**Test cases:**
- `GET /api/flatlay/batches` → 200，空库结构与参照源一致
- `PATCH /api/flatlay/items/nonexistent/phrase` → 参照源定义的错误状态码
- 配置端点响应含 `flatlay_vision_model` 字段

- [x] **Step 1–5：同 Task 2 节奏**

> 进展（2026-07-30）：已按 design/v2.1 契约移植 flatlay 的模型、SQLite 状态机、worker、7 条路由及配置字段，新增 3 个 API 契约测试；同时恢复 origin/main 在 `a581fbb` 误删但既有测试仍要求的 canvas log cleanup 实现。`python3 -m py_compile main.py` 与全量 28 项测试均通过。

### Task 6: SPA 挂载 + 前端构建 + 契约核对

**Files:**
- Modify: `main.py`（追加 `/app`、`/legacy` 路由）
- Modify: `frontend/src/lib/*.ts`（仅契约不匹配处最小修补）
- Create: `docs/plans/v3-contract-check.md`（核对表）
- Test: `tests/test_v3_spa.py`

**Interfaces:**
- Consumes: Task 2–5 的全部路由
- Produces: `GET /app`、`GET /app/{path:path}`、`GET /legacy`、`GET /legacy/`；可用的 `frontend/dist` 构建产物

**Requirements:**
- 参照源锚点：约 6754–6765 行；`/app` 返回 `frontend/dist/index.html`，`/app/{path}` 先按静态文件解析、未命中回落 index.html（SPA history 路由），`/legacy` 行为照参照源
- `cd frontend && npm install && npm run build` 必须成功；构建失败先修 TS 错误
- 逐一核对 `frontend/src/lib/api.ts` 与 `task-stream.ts` 引用的每个端点在 v3 后端的存在性与响应结构，结果写进 `docs/plans/v3-contract-check.md`（三列：端点 / 状态[一致|上游差异已适配|缺失] / 备注）
- `/api/canvas-video`、`/api/canvas-assets/*` 按上游契约适配前端调用，改动控制在 `frontend/src/lib/` 内，UI 组件不动
- 核对表中不允许出现"缺失"状态——发现缺失即为 Task 2–5 的漏项，回头补齐

**Test cases:**
- `GET /app` → 200，body 含 React 挂载点（读 dist/index.html 确认标识）
- `GET /app/canvas/some-id` → 200，返回 index.html（SPA 回落）
- `GET /app/assets/不存在的文件.js` → 参照源定义的行为

- [x] **Step 1: `npm install && npm run build`，记录真实输出**
- [x] **Step 2: 写失败测试 → 确认失败**
- [x] **Step 3: 移植 SPA 路由 + 逐端点契约核对并落表**
- [x] **Step 4: 全部测试 + py_compile 通过**
- [x] **Step 5: Commit**

> 进展（2026-07-30）：已移植 `/app` SPA fallback、`/app/assets` 静态挂载与 `/legacy` 重定向，完成 51 个固定前端端点的契约核对并适配上游 provider/queue/canvas-video/canvas-assets 差异；前端构建、`main.py` 编译与全量 32 项测试均通过。

## 自查记录

- Spec 覆盖：spec"保留资产"四项 → Task 1（支撑模块）、Task 2–5（24+ 条路由，含补上的 2 条 PATCH）、Task 6（SPA + frontend 构建）；QCOS 文档已在基线 commit 迁入 ✓
- 类型一致性：Task 2–6 均以 design/v2.1 main.py 为唯一契约源，无跨任务自造签名 ✓
- 占位符扫描：无 TBD；错误码等以"参照源定义"锚定到可读的具体源码位置，属于精确引用而非模糊描述 ✓

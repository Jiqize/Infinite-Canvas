# V3 混合 Canvas 收口 Implementation Plan

**Goal:** 保留 React 工作区，以经典 Canvas、智能 Canvas 与 Canvas List 作为唯一正式画布实现，吸收两个固定上游提交的有效功能，并补齐无损供应商设置与可靠素材交接。  
**Architecture:** React 负责工作区、素材生产、常用设置和状态展示；旧 Canvas 模块独占节点解释、执行与保存。两侧通过同源消息和 `qcos_canvas_intake_items` 持久批次队列连接，后端继续以现有 FastAPI 单文件和 Canvas CRUD 为共享边界。  
**Tech Stack:** FastAPI、Pydantic、静态 HTML/CSS/JavaScript、React 19、TypeScript、Vite、pytest、Playwright。

## Global Constraints

- 唯一行为事实来源为 `docs/specs/2026-08-29-v3-canvas-hybrid.md`。
- 工作分支固定为 `codex/v3-canvas-hybrid`，物理工作树固定为 `/Users/lianglei/Projects/git/Infinite-Canvas.codex-worktrees/v3-canvas-hybrid`。
- 功能来源仅限上游提交 `2aeaba4fa15ec03a6d2b6926654a47f93b9a069e` 与 `1c141a5715c04bbf29b4c2cf76fb78739da8cfe8`。
- 不整文件覆盖 `main.py`；保留本地 Gallery、Flatlay、Batch Try-on、Canvas video tasks、SPA 和主题桥。
- 不引入 DX-OS、宣传文案、README、`VERSION`、更新公告、备份文件或无功能意义的全站缓存戳。
- 改动静态 HTML 的缓存标识统一为 `2026.08.29.canvas-hybrid`。
- 不删除 React Canvas 源码，但从运行时路由、import 和渲染分支移除。
- 不读取、打印、提交真实密钥；不直接修改用户原始画布。
- 不部署、不 push、不 rebase、不合并回 `v3`。
- 每个任务完成 focused verification、勾选步骤、追加真实进展备注后提交；完整门禁仅在 Task 6 执行。

## File Responsibilities

- `main.py`：五条新后端路由、第三方协议修复、供应商标准化和 MiniMax 导出。
- `workflows/MiniMax_H3.json`、`workflows/MiniMax_H3.config.json`：MiniMax H3 可加载工作流和参数声明。
- `static/runninghub/api_providers.json`、`static/runninghub/thumbnails/workflow-2084608321469898754.jpg`：RunningHub 固定模板与缩略图。
- `static/canvas.html`、`static/css/canvas.css`、`static/js/canvas.js`：经典 Canvas 的 Midjourney、MiniMax、intake 消费与活动状态。
- `static/smart-canvas.html`、`static/css/smart-canvas.css`、`static/js/smart-canvas.js`：智能 Canvas 的 MiniMax 时间线、intake 消费与活动状态。
- `static/canvas-list.html`、`static/css/canvas-list.css`、`static/js/canvas-list.js`：待放置提示、目标选择和取消入口。
- `static/js/canvas-intake.js`：旧 Canvas 侧唯一 intake 队列解析、迁移、计数、批次清除与幂等帮助模块。
- `static/api-settings.html`、`static/js/api-settings.js`、`static/js/i18n/api-settings.js`：高级供应商页与 Tudou 异步模式。
- `static/gpt-chat.html`：旧 Chat 画幅与分辨率字段透传。
- `frontend/src/lib/api.ts`：React 供应商公共类型与 API 载荷契约。
- `frontend/src/lib/canvas-intake.ts`：React 侧 V1 队列类型、追加写入和错误结果。
- `frontend/src/features/api-models/ApiModelsWorkspace.tsx`、`frontend/src/features/api-models/api-models.css`：常用供应商设置和高级入口。
- `frontend/src/features/embedded/EmbeddedWorkbench.tsx`：已知 frame 的同源消息桥、活动状态和高级页返回行为。
- `frontend/src/app/routes.tsx`、`frontend/src/app/App.tsx`：隐藏高级路由、导航归属、React Canvas 运行时冻结。
- `frontend/src/components/creation-rail/CreationRail.tsx`：Canvas 队列/保存状态展示。
- `tests/test_v3_canvas_hybrid_backend.py`：Midjourney、MiniMax、工作流和路由契约。
- `tests/test_v3_provider_roundtrip.py`：供应商标准化与无损往返契约。
- `frontend/tests/canvas_hybrid_qa.spec.mjs`：混合 Canvas 队列、选择、保存、冲突和安全消息浏览器测试。
- `frontend/tests/api_models_hybrid_qa.spec.mjs`：React 常用设置与旧高级设置浏览器测试。
- `docs/quiet-creative-os-next-agent-handoff.md`：当前方向和验证结果；历史 phase 文档不改写。
- `.gitignore`、`TODOS.md`：本地敏感/运行产物边界和明确延期事项。
- `static/app/index.html`、`static/app/assets/*`：Task 6 的唯一 React 构建产物。

### Task 0: 固化边界与安全执行环境

**Files:**
- Create: `.gitignore`
- Create: `TODOS.md`
- Create: `docs/specs/2026-08-29-v3-canvas-hybrid.md`
- Create: `docs/plans/2026-08-29-v3-canvas-hybrid-integration.md`

**Interfaces:**
- Consumes: `v3` HEAD `3c5d65e0b383db1582aee83e1ff4e51e4b4ffb89` 与用户批准计划。
- Produces: 独立工作树、唯一 spec、可恢复外部快照和后续任务的接口级执行清单。

**Requirements:**
- 当前用户工作区保持不变。
- 工作分支为 `codex/v3-canvas-hybrid`。
- 外部快照包含画布、项目、供应商与环境配置，目录权限不得授予 group/other。
- `.gitignore` 精确覆盖密钥备份、数据库、画布数据、运行日志、缓存、依赖和测试报告，不忽略 `scripts/` 或 `static/app`。
- `TODOS.md` 记录“稳定一个发布周期后删除 React Canvas 源码”和“未配置平台的真实验收”。

**Test cases:**
- 工作树 `git status -sb` → 分支为 `codex/v3-canvas-hybrid`，无用户脏文件。
- spec 行数 → 不超过 300 行。
- 快照目录权限 → `drwx------`，所需文件存在且内容不输出。
- ignore 审计 → 已知本地敏感/运行文件匹配，`scripts/` 与 `static/app` 不匹配。

- [x] **Step 1: 创建并守卫独立工作树**
- [x] **Step 2: 创建受限外部快照**
- [x] **Step 3: 写入并单独提交 spec**
- [x] **Step 4: 写入并单独提交本接口级 plan**
- [x] **Step 5: 写 `.gitignore` 与 `TODOS.md`，运行 ignore/状态审计并提交**

> 进展（2026-08-29）：独立工作树已从 `v3` HEAD 创建；外部快照位于 `/Users/lianglei/.codex/backups/infinite-canvas/20260829-204027` 且权限为 `0700`；spec 已在 `65cf914` 单独提交，plan 已在 `543e57c` 单独提交；精确 ignore 规则保留 `scripts/` 与 `static/app`，两项明确延期工作已按规范落入 `TODOS.md`。

### Task 1: 后端协议与运行资产

**Files:**
- Modify: `main.py`
- Create: `workflows/MiniMax_H3.json`
- Create: `workflows/MiniMax_H3.config.json`
- Modify: `static/runninghub/api_providers.json`
- Create: `static/runninghub/thumbnails/workflow-2084608321469898754.jpg`
- Create: `tests/test_v3_canvas_hybrid_backend.py`
- Create: `tests/test_v3_provider_roundtrip.py`

**Interfaces:**
- Consumes: 现有供应商配置、`/api/canvases`、上游两个固定提交的语义差异。
- Produces: `POST /api/midjourney/submit`、`POST /api/midjourney/actions`、`POST /api/midjourney/modal`、`GET /api/midjourney/tasks/{task_id}`、`POST /api/smart-canvas/minimax-export`；可加载的 MiniMax H3 与 RunningHub 资产；无损供应商公共契约。

**Requirements:**
- `SUPPORTED_PROVIDER_PROTOCOLS` 对新配置只允许 `openai|apimart|gemini|gemini-cli|volcengine|runninghub|jimeng|codex`，读取旧 `tudou` 时兼容保存。
- `SUPPORTED_IMAGE_REQUEST_MODES` 为 `openai|openai-json|openai-video-proxy|openai-responses|tudou-async`。
- 官方 Tudou host 自动选择 `tudou-async`，不得要求新建 `tudou` 协议。
- `ms_loras` 标准化为数组，`ms_defaults_version` 标准化为整数。
- Midjourney 与 MiniMax 的参数错误、上游失败、超时、空时间线和 ffmpeg 缺失返回明确错误。
- `main.py` 完成后为 190 条装饰器和 190 条唯一方法/路径组合。
- 不改变本地既有路由契约，不带入上游更新/宣传功能。

**Test cases:**
- Midjourney 四路由最小合法 payload → mock 成功响应；无效 payload、上游 4xx/5xx、超时 → 明确对应错误。
- MiniMax 空 clips → 400；mock 合成成功 → 返回可下载结果；ffmpeg 不存在/执行失败 → 明确错误。
- `MiniMax_H3.json` 与 config → JSON 可加载、必要键存在、引用一致。
- `GET providers → 修改一个公共字段 → save → GET` → `model_names/model_protocols/ms_loras/rh_apps/rh_workflows/volcengine_*` 未编辑值不变。
- 路由审计 → 190/190。

- [x] **Step 1: 写后端失败契约测试并运行确认失败**
- [x] **Step 2: 逐语义移植供应商协议、Midjourney 与 MiniMax 后端**
- [x] **Step 3: 移植 MiniMax/RunningHub 运行资产并排除备份文件**
- [x] **Step 4: 运行两个新测试文件、现有相关 pytest、py_compile 与路由审计**
- [x] **Step 5: 更新进展并 commit**

> 进展（2026-08-29）：先得到 13 failed / 1 passed 的预期失败基线，再移植五条路由、Tudou 异步、APIMart/Gemini、Jimeng/RunningHub 修复和 MiniMax/RunningHub 资产。额外补齐 Midjourney 网络超时与 MiniMax ffmpeg 超时的明确 504，并按 spec 保留旧 `protocol=tudou`、对官方 host 自动启用 `tudou-async`。新契约与既有相关测试共 22 项通过，`py_compile` 通过，路由审计为 190/190；无 DX-OS 或备份文件。

### Task 2: 经典与智能 Canvas 上游功能同步

**Files:**
- Modify: `static/canvas.html`
- Modify: `static/css/canvas.css`
- Modify: `static/js/canvas.js`
- Modify: `static/smart-canvas.html`
- Modify: `static/css/smart-canvas.css`
- Modify: `static/js/smart-canvas.js`
- Modify: `static/api-settings.html`
- Modify: `static/js/api-settings.js`
- Modify: `static/js/i18n/api-settings.js`
- Modify: `static/gpt-chat.html`

**Interfaces:**
- Consumes: Task 1 的五条路由、MiniMax H3 与 RunningHub 资产。
- Produces: 经典 Canvas 的 Midjourney/MiniMax 节点执行，智能 Canvas 的 MiniMax 创建/时间线/导出，高级页 Tudou 异步模式和旧 Chat 分辨率字段。

**Requirements:**
- 仅移植两个固定提交中的功能 hunk，保留本地 RunningHub、LTX、ComfyUI、任务恢复和主题覆盖。
- 经典 Canvas 显示 Midjourney 与 MiniMax 节点入口并完成提交、轮询、动作、modal 和失败显示。
- 智能 Canvas 显示 MiniMax 创建入口、时间线操作和导出结果。
- 旧高级设置不再提供手动新建 Tudou 协议，图片模式可选 `tudou-async`。
- 旧 Chat 只增加画幅/分辨率字段透传，不迁移到 React Chat。
- 所有修改 HTML 的缓存标识为 `2026.08.29.canvas-hybrid`，页面不得包含 `DX-OS`。

**Test cases:**
- 修改 JS `node --check` → 全部通过。
- 经典页面 → Midjourney/MiniMax 入口存在，mock 成功与错误可见。
- 智能页面 → MiniMax 入口、时间线和导出入口存在，mock 错误可见。
- 全仓功能文件扫描 → 无新增 DX-OS、backup/stable/broken 文件。

- [x] **Step 1: 增加 focused 浏览器断言并运行确认失败**
- [x] **Step 2: 移植经典 Canvas 功能 hunk**
- [x] **Step 3: 移植智能 Canvas、旧高级设置和旧 Chat 功能 hunk**
- [x] **Step 4: 运行静态语法与 focused 浏览器检查**
- [x] **Step 5: 更新进展并 commit**

> 进展（2026-08-29）：先得到 3 条 focused Playwright 预期失败基线，再按两个固定提交的语义 hunk 移植经典 Canvas 的 Midjourney/MiniMax、智能 Canvas 的 MiniMax 时间线与导出、旧高级设置的 Tudou 异步模式和旧 Chat 画幅/分辨率字段。保留本地 RunningHub、LTX、ComfyUI、任务恢复和主题桥；旧 `protocol=tudou` 仅在读取已有配置时以禁用选项显示。修改的 4 个静态 JS 全部通过 `node --check`，扩展后的 5 条浏览器用例覆盖入口、Midjourney mock 成功与明确失败，全部通过；四个 HTML 的缓存标识统一为 `2026.08.29.canvas-hybrid`，无 DX-OS 或临时备份文件。

### Task 3: React 供应商设置无损化与高级入口

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/features/api-models/ApiModelsWorkspace.tsx`
- Modify: `frontend/src/features/api-models/api-models.css`
- Modify: `frontend/src/features/embedded/EmbeddedWorkbench.tsx`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/app/App.tsx`
- Create: `frontend/tests/api_models_hybrid_qa.spec.mjs`

**Interfaces:**
- Consumes: Task 1 的供应商 GET/PUT 公共契约与 `/static/api-settings.html`。
- Produces: `ApiProvider`/`ApiProviderSavePayload` 的完整字段类型；隐藏路由 `id=provider-settings,path=provider-settings,src=/static/api-settings.html,nav=false,keepAlive=false,navParentId=api-config`。

**Requirements:**
- React 可编辑 spec 列出的八种协议和五种图片请求模式；兼容显示旧 `tudou`。
- `normalizeDraft` 不得把非 APIMart 协议改写为 OpenAI。
- `publicProviderPayload` 必须保留所有后端公共字段；用户只修改一个字段时其余字段逐字段不变。
- `ms_loras` 为数组，`ms_defaults_version` 为数字；无效高级字段不得静默改写成另一类型。
- 高级页不出现在 Sidebar/MobileNav，不保活，侧栏高亮 API / Models，关闭或返回时回到 `/app/api-models`。
- `providers-changed` 仅在同源已知 frame 之间传递。

**Test cases:**
- 多协议配置 GET → React 表单显示原协议而非 OpenAI。
- 修改 `name` 后保存 → 高级字段 mock PUT 逐字段不变。
- `ms_loras=[]`、`ms_defaults_version=2` → 表单读取和保存类型不变。
- 打开 `/app/provider-settings` → iframe 指向旧高级页、导航隐藏、API / Models 高亮、返回路径正确。
- 跨源或未知 source 的 `providers-changed` → 被忽略。

- [x] **Step 1: 写 Playwright/类型失败用例并确认失败**
- [x] **Step 2: 扩展公共类型和无损序列化**
- [x] **Step 3: 增加常用协议控件与隐藏高级路由**
- [x] **Step 4: 运行前端构建与供应商 focused Playwright**
- [x] **Step 5: 更新进展并 commit**

> 进展（2026-08-29）：先确认“Gemini 被改写为 OpenAI”和“隐藏高级路由不存在”两条失败基线。随后将 React 公共契约补齐为后端全部可写字段，`ms_loras` 固定为对象数组、`ms_defaults_version` 固定为整数；常用页可选 8 种新协议与 5 种图片请求模式，旧 `tudou` 仅对已有值显示并无损保存。新增 `/app/provider-settings` 隐藏、非保活 iframe，API / Models 侧栏保持高亮并可返回。主题和 `providers-changed` 改为精确同源发送，接收端同时校验 origin 与已登记 frame。5 条 focused Playwright 覆盖高级字段逐字段保留、旧 Tudou、无效类型显错、路由生命周期和伪造消息拒绝；`tsc -b`、生产构建与静态 JS 语法检查均通过。构建产物按计划留待 Task 6 统一生成和提交。

### Task 4: 共享 intake 队列与目标选择

**Files:**
- Create: `static/js/canvas-intake.js`
- Modify: `frontend/src/lib/canvas-intake.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `static/canvas-list.html`
- Modify: `static/css/canvas-list.css`
- Modify: `static/js/canvas-list.js`
- Modify: `frontend/tests/canvas_hybrid_qa.spec.mjs`

**Interfaces:**
- Consumes: React `CanvasIntakeItem` 与 localStorage key `qcos_canvas_intake_items`。
- Produces: `CanvasIntakeQueueV1`、`CanvasIntakeBatchV1`；浏览器全局 `window.QCOSCanvasIntake`，提供 `readQueue()`、`countItems()`、`clearBatches(batchIds)`、`clearAll()`、`itemKey(batchId,item,index)`；Canvas List 目标选择状态。

**Requirements:**
- React `writeCanvasIntakeItems` 返回带 `ok/items/batch/error` 的明确结果，只有 `ok=true` 才导航。
- 新发送追加独立 UUID 批次；总数将超过 100 时整批拒绝且原始 localStorage 字符串不变。
- 旧 `{created_at,items}` 读取为基于旧时间和值生成的稳定批次；重复读取 ID 不变。
- JSON 损坏时不得覆盖原始值，Canvas List 显示清理提示。
- Canvas List 显示准确待处理数量，可选择已有/新建经典或智能目标；选择前不清队列。
- 用户清空时发送 `canvas-intake-status` cancelled 状态。

**Test cases:**
- 空队列 + 两次发送 2/3 项 → 两批、总数 5。
- 99 项 + 新 2 项 → 新批拒绝，原字符串完全不变。
- localStorage.setItem 抛错 → React 显示失败且 URL 不变。
- 旧结构重复读取 → 一个相同 ID 批次。
- 损坏 JSON → 原值保留且显示错误/清理动作。
- 选择目标前刷新 → 队列仍存在；主动取消 → 队列清空且不创建节点。

- [x] **Step 1: 写队列/列表失败 Playwright 用例并确认失败**
- [x] **Step 2: 实现静态 intake 深模块与 React 追加生产端**
- [x] **Step 3: 接入 Canvas List 数量、目标选择和取消**
- [x] **Step 4: 运行前端构建、JS 语法与队列 focused Playwright**
- [x] **Step 5: 更新进展并 commit**

> 进展（2026-08-29）：先确认共享模块缺失、损坏值无提示、列表无待放置状态、React 写入失败无反馈这 4 条失败基线。新增静态 `QCOSCanvasIntake` 与同构 React 队列契约，发送按 UUID 批次追加，总量上限 100；超限或 localStorage 异常整批失败且原字符串不变，旧结构使用内容哈希生成稳定批次 ID。Canvas List 显示数量或损坏提示，已有画布和新建 Classic/Smart 均可作为目标，刷新与目标选择不消费队列，主动清空发出 `cancelled`。React 失败会留在原工作区并显示可见错误。新增 6 条队列/列表用例后，`canvas_hybrid_qa` 全文件 11 项通过；生产构建、`tsc -b`、两个静态 JS 语法检查和 diff 检查通过，构建产物继续留待 Task 6 统一提交。

### Task 5: Canvas 消费者、幂等保存与 React Canvas 冻结

**Files:**
- Modify: `static/js/canvas.js`
- Modify: `static/js/smart-canvas.js`
- Modify: `static/canvas.html`
- Modify: `static/smart-canvas.html`
- Modify: `frontend/src/features/embedded/EmbeddedWorkbench.tsx`
- Modify: `frontend/src/components/creation-rail/CreationRail.tsx`
- Modify: `frontend/src/app/routes.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/tests/canvas_hybrid_qa.spec.mjs`

**Interfaces:**
- Consumes: Task 4 的 `window.QCOSCanvasIntake` 和 Task 1 的 `/api/canvases` 保存契约。
- Produces: 节点字段 `qcos_intake_batch_id`、`qcos_intake_item_id`；`canvas-intake-status {status,batch_ids,item_count,detail}`；`canvas-active {active}`。

**Requirements:**
- 目标画布加载成功后才读取并映射队列；加载失败不得改队列。
- 经典 `image→image`、`output→output`；智能两种类型均为 `smart-image` 并保留元数据。
- 保存开始发 `saving`；200/成功发 `succeeded` 并只清已保存批次；失败发 `failed` 并保留。
- 409 使用现有合并重试；任何重试或刷新通过批次/素材节点标记防重复。
- React Creation Rail 只展示待处理数量、保存状态和高级设置入口。
- 删除 `native-canvas` RouteKind、静态 import 和渲染分支；`CanvasWorkspace.tsx` 与 `canvas.css` 源码不删。
- `canvas-active=false` 只暂停 Canvas 元数据轮询；`true` 时立即同步；生成/任务轮询继续。
- 所有 frame 消息严格检查 origin 与已知 source，发送 targetOrigin 为 `window.location.origin`。

**Test cases:**
- 经典/智能各消费一批 → 节点类型、元数据和幂等字段正确，保存 200 后清队列。
- 保存 500/断网 → 队列保留、错误可见。
- 保存首个 409、重试 200 → 只创建一组节点并清队列。
- 保存 200 后模拟清理前刷新 → 已标记节点不重复，批次最终清除。
- 后台/返回 → 元数据轮询停/立即恢复，生成任务未取消。
- `/app/canvas` → 只有旧 Canvas iframe；构建产物不包含 React Canvas 运行时 chunk/引用。

- [x] **Step 1: 写消费者/冻结/轮询失败 Playwright 用例并确认失败**
- [x] **Step 2: 接入经典与智能幂等消费者和状态消息**
- [x] **Step 3: 简化 Rail、冻结 React Canvas 运行时并实现 canvas-active**
- [x] **Step 4: 运行两类 Canvas 成功/失败/409/刷新 focused Playwright 与构建**
- [x] **Step 5: 更新进展并 commit**

> 进展（2026-08-29）：先以经典 Canvas 打开后 0 次 intake 保存确认消费者缺失的失败基线。经典/智能 Canvas 现均在目标加载成功后读取队列，按节点类型映射并写入批次/素材幂等标记；保存 200 后才清对应批次，500/网络错误保留队列并显错。智能 Canvas 保留原有 409 节点/图片合并，最终审查又为经典 Canvas 补齐远端节点、连接、日志和媒体结果合并后重存，服务端已有标记时刷新只清批次不重复插入。React 已删除 `native-canvas` RouteKind、静态 import 和渲染分支，源码仍保留；Creation Rail 只显示待处理数、保存状态和高级设置入口。`canvas-active` 仅控制两套元数据轮询，恢复时立即检查；frame 消息同时校验精确同源与登记 source。生成包中无 `CanvasWorkspace`/`native-canvas` 引用。

### Task 6: QA 替换、文档与完整阶段门禁

**Files:**
- Delete: `frontend/tests/native_canvas_complete_qa.spec.mjs`
- Modify: `frontend/tests/canvas_hybrid_qa.spec.mjs`
- Modify: `frontend/tests/api_models_hybrid_qa.spec.mjs`
- Modify: `docs/quiet-creative-os-next-agent-handoff.md`
- Modify: `static/app/index.html`
- Replace generated: `static/app/assets/*`

**Interfaces:**
- Consumes: Task 1–5 全部运行接口和测试。
- Produces: 不再断言“零 iframe”的正式混合 Canvas 回归套件、最新 handoff 和可运行 React 构建。

**Requirements:**
- 新 spec 明确 supersede 当前 handoff 的原生 React Canvas 方向；历史 phase 文档原样保留。
- 只有新的 Canvas 测试全部通过后才删除旧 `native_canvas_complete_qa.spec.mjs`。
- 构建只保留 `static/app/index.html` 当前引用的新 hash 文件；不得提交 sourcemap、report 或 node_modules。
- 完整阶段门禁的真实输出记录到 plan 进展，不用伪造或省略失败。

**Test cases:**
- `python3 -m py_compile main.py` → 通过。
- `python3 -m pytest -q` → 全部通过。
- 所有修改静态 JS `node --check` → 通过。
- `frontend npm run build` → 通过。
- 两个指定 Playwright 文件 → 全部通过。
- 路由审计 → 190/190；`git diff --check` → 通过；敏感文件审计 → 无命中。

- [x] **Step 1: 完成替代测试并确认绿色后删除旧测试**
- [x] **Step 2: 更新 handoff 的 superseded 指向与当前验证记录**
- [x] **Step 3: 构建并整理唯一新 hash 产物**
- [x] **Step 4: 运行完整 deterministic gates 和安全审计**
- [x] **Step 5: 更新进展并 commit**

> 进展（2026-08-29）：混合 Canvas 套件先以 22 项全绿取代旧原生 Canvas 行为，随后删除包含“零 iframe”错误目标的 `native_canvas_complete_qa.spec.mjs`。当前 spec 明确 supersede 三份 React 原生 Canvas 目标文档，历史 phase 文档不改写；handoff 已更新为混合架构与仅剩 Task 7。最终构建仅保留 `index-C6kl7yOc.js`、`index-CvLTBReO.css` 和入口 HTML，产物扫描无 `CanvasWorkspace`/`native-canvas`。完整门禁真实结果：`py_compile` 通过；pytest 为 46 passed、2 subtests passed、8 条既有 deprecation warnings；6 个变更后静态 JS 全部通过语法检查；构建成功；两个指定 Playwright 文件合计 27 passed；路由为 190/190；`git diff --check` 通过。安全审计覆盖从迁移基线起的 44 个变更路径，敏感/运行数据路径 0、高可信密钥模式 0、被跟踪运行产物 0；`static/app` 仅含当前 3 个文件。

### Task 7: 有限真实验收与收口

**Files:**
- Modify: `docs/plans/2026-08-29-v3-canvas-hybrid-integration.md`
- Modify: `docs/quiet-creative-os-next-agent-handoff.md`
- Modify: `TODOS.md`
- Create: `REVIEW_HANDOFF.md`

**Interfaces:**
- Consumes: 仓库外快照副本、当前已配置供应商和 Task 6 已通过构建。
- Produces: 真实请求结果、11 个画布副本 smoke 结果、环境阻塞清单和供审查者复核的 handoff。

**Requirements:**
- 应用只使用快照副本或临时测试数据目录，原始用户画布不写入。
- APIMart、Comfly 各最多提交一次最小请求，各最多等待 10 分钟；额度/限流失败不重试。
- MiniMax 只做本地依赖 readiness；缺节点/模型标为环境阻塞，不宣称通过。
- 7 个经典、4 个智能画布都需加载并对副本执行保存 smoke。
- 未配置 ModelScope、RunningHub 等真实验收写入 TODO，不扩展账号或采购范围。
- 最终不得 push、部署或合并。

**Test cases:**
- 临时数据目录启动 → 原始 11 个画布 mtime/hash 不变。
- APIMart/Comfly → 各一条真实结果记录，提交次数不超过 1。
- 11 个副本 → 均可读取并保存；失败项带明确画布 ID/原因。
- Git 状态 → 只含计划内文件；敏感/运行数据不在 index。

- [x] **Step 1: 建立临时运行数据并记录原始数据 hash**
- [x] **Step 2: 执行 APIMart、Comfly 有限真实请求与 MiniMax readiness**
- [x] **Step 3: 执行 11 个画布副本加载/保存 smoke 并核对原始 hash**
- [x] **Step 4: 更新 plan、handoff、TODO 与 `REVIEW_HANDOFF.md`**
- [x] **Step 5: 运行最终 focused closeout、提交且保持本地**

> 进展（2026-08-29）：验收应用运行在权限为 `0700` 的仓库外快照副本 `/Users/lianglei/.codex/tmp/v3-canvas-acceptance.80vMu9/app`，没有直接读取后写回原始数据。APIMart 仅提交 1 次最小请求，结果为 HTTP 200、返回 1 张图片；Comfly 仅提交 1 次，结果为 HTTP 401（密钥无效），按边界未重试。MiniMax H3 工作流 JSON 可加载并含 19 个节点，配置文件可加载并含 5 个字段，但本机 ComfyUI `127.0.0.1:8188` 不可达，节点与模型保持环境阻塞。7 个经典和 4 个智能画布副本均通过 API 读取/保存，并由真实无头浏览器完成 11/11 页面加载且无脚本错误；快照未包含历史输出图片，因此旧节点资源出现预期 404，不影响页面或画布保存。验收前后原始 11 个画布的 hash、大小和 mtime 变化为 0，原始供应商、项目和环境配置也与 Task 0 快照逐文件一致。

> 收口（2026-08-29）：按 pre-landing review 对 `v3` 基线逐项审查并修复 7 个边界问题：经典 Canvas 409 真合并、旧高级设置字段保留、Smart Canvas 加载失败可见、全部相关 frame 消息同源/已知 source、RunningHub 静态模板加锁原子写入、V1 intake 结构损坏原样保留，以及 React LoRA 示例契约。最终 `py_compile` 通过；pytest 为 48 passed、2 subtests passed、8 条既有 deprecation warnings；两个指定 Playwright 文件合计 31 passed；React 生产构建成功；8 个变更静态 JS 与 `static/theme.js` 通过语法检查；HTTP 路由为 190/190（另有 1 条 WebSocket）；无 `postMessage(..., "*")`、无 React Canvas 生产包引用，`git diff --check` 和敏感产物扫描通过。原始快照对照 14 个文件仍为 0 差异。审查剩余代码问题为 0；Comfly、MiniMax/ComfyUI、ModelScope、RunningHub 的真实环境限制继续留在 `TODOS.md`，没有被伪报为通过。

## Self-check

- Spec 覆盖：上游边界、唯一 Canvas、intake、同源消息、供应商、五条路由、失败处理、回滚与真实验收均映射到 Task 1–7。
- 占位符扫描：无 TBD；所有数量、枚举、路由、缓存标识、超时和错误保留规则均给出精确值。
- 类型一致性：React/静态端都使用 `CanvasIntakeQueueV1`、`CanvasIntakeBatchV1`、相同 storage key、节点幂等字段和消息状态枚举。
- 删除边界：只删除过时 QA 文件；React Canvas 源码、历史 phase 文档和用户数据都保留。

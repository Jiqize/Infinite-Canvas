# V3 混合 Canvas 收口 Spec

**日期：** 2026-08-29  
**目标分支：** `codex/v3-canvas-hybrid`  
**事实来源：** 本文是本次混合 Canvas 收口的唯一行为与验收标准。

## 背景与目标

V3 保留 React 工作区、Gallery、Generate、常用供应商设置和 Creation Rail。经典 Canvas、智能 Canvas 及 Canvas List 成为唯一正式画布实现，负责节点编辑、执行与画布保存。React 不再解释或保存 Canvas 节点。

本次吸收源项目 2026-08-01 与 2026-08-04 两个固定提交的有效功能，补齐 Midjourney、MiniMax H3、RunningHub、Tudou 异步请求和供应商协议设置，同时排除 DX-OS 及宣传性改动。

## 关键行为

### 1. 上游功能边界

- 功能来源仅限提交 `2aeaba4fa15ec03a6d2b6926654a47f93b9a069e` 与 `1c141a5715c04bbf29b4c2cf76fb78739da8cfe8`。
- 保留本地 Gallery、Flatlay、Batch Try-on、Canvas video tasks、React SPA 路由及现有主题桥。
- 吸收 Midjourney 请求与查询、MiniMax H3 生成与导出、RunningHub 运行资产、Tudou 异步图片模式、APIMart/Gemini/Jimeng 修复和旧 Chat 的画幅/分辨率字段。
- 静态资源缓存标识统一为 `2026.08.29.canvas-hybrid`。

### 2. Canvas 唯一实现

- `/app/canvas` 打开嵌入式 `/static/canvas-list.html`。
- Canvas List 可进入或新建经典、智能画布。
- 经典与智能 Canvas 是正式主实现，不是临时 fallback。
- React Canvas 源码本次保留，但不得出现在运行时路由、import 或渲染分支中。
- Creation Rail 只显示待放置素材数量、保存状态和高级设置入口，不展示 React Canvas 节点状态。

### 3. 素材交接队列

- localStorage key 保持 `qcos_canvas_intake_items`。
- 新结构为 `CanvasIntakeQueueV1 { version: 1, batches: CanvasIntakeBatchV1[] }`。
- 批次结构为 `CanvasIntakeBatchV1 { id, created_at, items }`。
- 素材字段保留 `id/url/title/prompt/source/model/type/width/height/created_at`；其中有效素材必须有非空 `url`，`type` 仅为 `image` 或 `output`。
- 兼容读取旧结构 `{ created_at, items }`，并转换成一个稳定批次。
- 多次发送追加为独立批次，不覆盖已有内容。
- 待处理素材总数最多 100；超过上限时拒绝整个新批次并保留原队列。
- localStorage 不可写时显示失败且不跳转 Canvas。
- 队列在成功保存目标画布后才清除；加载失败、保存失败、断网、5xx 或 409 重试未成功时必须保留。
- 用户可在 Canvas List 主动清空全部待放置素材；清空后不得创建节点。
- 选择或新建经典/智能画布前不得消费队列。
- 每个落盘节点保存 `qcos_intake_batch_id` 与 `qcos_intake_item_id`，刷新或重试不得重复插入。
- 经典 Canvas 将 `image` 转为图片节点、`output` 转为输出节点；智能 Canvas 将两者都转为 `smart-image`，并保留来源、提示词和模型元数据。

### 4. 同源消息与后台行为

- 跨 frame 消息仅接受 `event.origin === window.location.origin` 且来源为已知窗口的事件。
- 消息发送目标必须为 `window.location.origin`，不得使用 `"*"`。
- 支持消息 `providers-changed`、`studio-theme`、`studio-lang`、`canvas-active`、`canvas-intake-status`。
- `canvas-active` 载荷为 `{ active: boolean }`。
- `canvas-intake-status` 载荷为 `{ status, batch_ids, item_count, detail }`，状态只允许 `queued | saving | succeeded | failed | cancelled`。
- Canvas 在后台时只暂停经典/智能画布的元数据同步轮询；进行中的生成任务不得取消。
- 返回 Canvas 后立即执行一次元数据同步。

### 5. 供应商设置

- React 常用设置可编辑协议 `openai`、`apimart`、`gemini`、`gemini-cli`、`volcengine`、`runninghub`、`jimeng`、`codex`。
- 旧值 `tudou` 必须可显示和无损保存；新配置由官方域名自动识别。
- 图片请求模式可选 `openai`、`openai-json`、`openai-video-proxy`、`openai-responses`、`tudou-async`。
- React 保存供应商时必须无损往返未编辑字段，包括 `model_names`、`model_protocols`、`ms_loras`、`rh_apps`、`rh_workflows`、火山项目与区域字段。
- `ms_loras` 对外统一为数组，`ms_defaults_version` 对外统一为数字。
- 专属密钥、RunningHub 工作流和火山高级字段通过隐藏嵌入路由 `/app/provider-settings` 编辑。
- `/app/provider-settings` 不显示在导航中、不保活；打开时侧栏继续高亮 API / Models。

### 6. 后端接口

- 新增并保留 `POST /api/midjourney/submit`。
- 新增并保留 `POST /api/midjourney/actions`。
- 新增并保留 `POST /api/midjourney/modal`。
- 新增并保留 `GET /api/midjourney/tasks/{task_id}`。
- 新增并保留 `POST /api/smart-canvas/minimax-export`。
- 完成后 `main.py` 必须包含 190 条 FastAPI 路由装饰器，且方法与路径组合全部唯一。
- 第三方超时、额度不足、ffmpeg 缺失、MiniMax 模型或节点缺失必须产生明确失败，不得静默丢失画布或队列。

## Out of Scope

- 不继续补齐、重写或发布 React Canvas。
- 本次不删除 React Canvas 源码。
- 不把全部高级供应商设置重写成 React。
- 不回退整个应用到源项目。
- 不引入 DX-OS、Chrome 插件宣传、远端 README、`VERSION`、更新公告或任何备份文件。
- 不重构 `main.py`，不重做静态页面皮肤。
- 不购买额度、不创建第三方账号。
- 不部署、不 push、不合并回 `v3`。
- 未配置的 ModelScope、RunningHub 等平台不做伪真实验收。

## 验收标准

1. Python 编译、完整 pytest、前端构建、静态 JS 语法检查和指定 Playwright 测试全部通过。
2. `main.py` 路由审计为 190 条装饰器、190 条唯一方法与路径组合。
3. Gallery/Generate 可连续追加多批素材；选择经典或智能目标后一次保存，成功后队列清除，刷新无重复。
4. localStorage 不可写、队列损坏、超过 100 项、Canvas 加载失败、保存失败、断网、5xx 和 409 均有可见结果且不丢待处理素材。
5. 用户取消后不创建节点。
6. 未知窗口、跨源和伪造消息被忽略；同源已知消息正常工作。
7. React 常用设置与旧高级设置交替保存时，未编辑供应商字段逐字段保持不变。
8. Midjourney 四条接口、MiniMax 导出与工作流加载均有 mock 成功、失败和超时证据。
9. 工作区切换后 Canvas 元数据轮询暂停；返回 Canvas 后立即同步；生成任务不中止。
10. APIMart 与 Comfly 各最多一次最小真实请求、最多等待 10 分钟；额度或限流错误不重试并按真实结果记录。
11. 现有 7 个经典与 4 个智能画布使用快照副本完成加载/保存 smoke test，不直接修改用户原始画布。
12. Git 不包含密钥、数据库、画布数据、日志、本地备份、测试报告或依赖目录。
13. 当前用户工作区的未提交文件保持原样；工作只存在于独立分支 `codex/v3-canvas-hybrid`。

## 回滚要求

- 代码可回滚到迁移前 `v3` 提交 `3c5d65e0b383db1582aee83e1ff4e51e4b4ffb89`。
- 若测试期间产生画布写入，只能对快照副本或临时测试画布操作。
- 如需恢复配置与用户数据，使用仓库外受限快照，不通过删除新节点字段降级。

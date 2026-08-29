# Feebee Studios

Feebee Studios 是一个本地运行的 AI 创作工作台。它保留 Infinite Canvas 的经典画布与智能画布，并在外层提供统一的生成、编辑、画廊、供应商设置和素材交接体验。

## 当前版本

- React 工作区负责 Generate、Enhance、Edit、Online、Angle、Chat、Gallery 和 API / Models。
- Canvas List、Classic Canvas 与 Smart Canvas 是唯一正式画布实现。
- Gallery 与 Generate 可把素材加入持久队列，再选择目标画布落盘；保存失败不会丢失队列。
- 支持 OpenAI、APIMart、Gemini、Gemini CLI、火山引擎、RunningHub、即梦、Codex 及兼容的 Tudou 异步配置。
- 支持本地 ComfyUI、RunningHub 工作流、Midjourney、MiniMax H3 等画布节点。

架构和数据边界见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 启动

需要 Python 3.10 或更高版本。

```bash
python3 -m pip install -r requirements.txt
python3 main.py
```

启动后访问：

```text
http://127.0.0.1:3000/app/canvas
```

macOS 也可以双击 `mac-启动服务.command`；Windows 可以运行 `run.bat`，缺少依赖时先运行 `安装依赖.bat`。

## 前端开发与验证

```bash
cd frontend
npm ci
npm run build
```

```bash
python3 -m pytest -q
cd frontend
npx playwright test tests/canvas_hybrid_qa.spec.mjs tests/api_models_hybrid_qa.spec.mjs
```

Playwright 测试需要后端运行在 `127.0.0.1:3000`，前端开发服务器运行在 `127.0.0.1:5173`。

## 本地数据

以下内容只属于本机运行环境，不进入 Git：

- `API/.env*`：密钥与本地环境配置
- `data/`：画布、项目、供应商配置、会话与数据库
- `assets/`：上传素材与素材库
- `output/`：生成结果

迁移或清理仓库前，应单独备份这些目录。不要把真实密钥提交到仓库。

## 来源与许可

本项目在 Infinite Canvas 基础上持续演进，并保留原项目的来源说明与许可约束。使用和再分发前请阅读 [LICENSE](LICENSE)；原许可禁止未经授权的商业封装，并要求二次开发保持开源和注明来源作者。

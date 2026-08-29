# TODOS

## QA

### 补齐受环境阻塞平台的真实验收

**What:** 在具备有效配置后，对 ModelScope、RunningHub、MiniMax H3 和 Comfly 执行一次最小真实生成或工作流验收。

**Why:** 本次收口可以用 mock 合同证明代码路径，但无法替代缺少密钥、工作流或本地模型时的真实端到端结果。

**Context:** 2026-08-29 的有限验收中，MiniMax H3 工作流 JSON 可加载（19 个节点），配置文件可加载（5 个字段），但本机 `127.0.0.1:8188` 的 ComfyUI 不可达，因此节点与模型未做真实验证。Comfly 的唯一一次最小请求返回 HTTP 401（密钥无效），按计划未重试；后续需先更新有效密钥。RunningHub 和 ModelScope 本轮没有可用的真实验收环境。后续验收仍须遵守每个平台一次最小提交、有限等待和不自动购买额度的边界，并把环境版本与结果写入当前 handoff。

**Effort:** M
**Priority:** P2
**Depends on:** Comfly 有效密钥、ModelScope/RunningHub 有效配置，以及可访问且已安装 MiniMax H3 节点与模型的 ComfyUI

## Completed

### APIMart 最小真实验收

2026-08-29 在受限的快照副本环境中只提交一次最小图片请求，服务返回 HTTP 200 和 1 张图片；未修改原始用户画布、项目或供应商配置。

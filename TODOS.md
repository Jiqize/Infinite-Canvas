# TODOS

## Canvas

### 删除已冻结的 React Canvas 源码

**What:** 混合 Canvas 稳定运行一个完整发布周期后，删除不再参与构建的 `frontend/src/features/canvas/CanvasWorkspace.tsx` 与 `frontend/src/features/canvas/canvas.css`。

**Why:** 避免长期维护两套画布实现，也避免未来开发误把已冻结源码重新接回运行时。

**Context:** V3 混合收口已确定经典 Canvas 和智能 Canvas 为唯一正式实现。本次只移除 React Canvas 的路由、import 与渲染分支，保留源码作为一个发布周期内的可审计回退参考。删除前需确认该发布周期没有需要从旧源码恢复的行为，并重新运行混合 Canvas Playwright 套件。

**Effort:** S  
**Priority:** P3  
**Depends on:** 混合 Canvas 至少完成一个稳定发布周期

## QA

### 补齐未配置平台的真实验收

**What:** 在具备有效配置后，对 ModelScope、RunningHub 和 MiniMax H3 执行一次最小真实生成或工作流验收。

**Why:** 本次收口可以用 mock 合同证明代码路径，但无法替代缺少密钥、工作流或本地模型时的真实端到端结果。

**Context:** 真实验收必须遵守一次最小提交、有限等待和不自动购买额度的边界。RunningHub 需要有效平台配置；ModelScope 需要可用密钥；MiniMax H3 需要本地 ComfyUI 节点与模型。执行后将结果、环境版本和失败原因写入当前 handoff。

**Effort:** M  
**Priority:** P2  
**Depends on:** 对应平台密钥、额度或本地工作流依赖可用

## Completed


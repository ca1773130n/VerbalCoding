# 仓库指南 (中文)

> 本文是 [`AGENTS.md`](../../AGENTS.md) 的中文摘要。正式规则以英文原文为准。

VerbalCoding 是面向编码代理的 Discord 语音桥。运行时位于 `app-node/`,通过 `run.sh` 或 `vc` CLI 启动。

## 开发

- 文档与示例优先使用 `vc ...` 形式,而不是 `npm run vc -- ...`。
- 本地密钥放在 `.env` 或 `instances/*.env`,不要提交真实 Discord token、频道 ID、会话文件、语音样本、模型权重、虚拟环境、日志、缓存。
- 修改源文件而非自动生成物。
- 示例保持公开安全:本地路径、用户 ID、Discord ID、token 用占位符替代。

## 验证

报告完成前请运行 Node 测试:

```bash
npm test
```

## 模块布局

详情见 [`AGENTS.md`](../../AGENTS.md)。核心模块:

- `main.mjs` — Discord / 语音 / 代理调度器
- `agent_routing.mjs` — 语音驱动的跨代理路由
- `plan_mode.mjs` — 语音 plan 模式 (`which_agent` 槽)
- `session_ontology.mjs` — 按频道的类型图 (用于 handoff)
- `research_mode.mjs` — `"research X"` 语音命令流程

## 托管区域

HarnessSync 会把 `CLAUDE.md` 的规则同步进 `AGENTS.md` 的托管块,请勿手动修改该块。

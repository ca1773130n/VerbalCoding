# VerbalCoding

<p align="center"><strong>通过 Discord 语音像打电话一样使用 CLI 编程代理。</strong></p>

<p align="center">[English](../../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Français](README.fr.md) · [Русский](README.ru.md)</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding 将 Discord 语音频道变成编程代理的免手动控制台。你说出请求，让 CLI 代理工作，然后用语音和文本接收结果。

## 亮点

| 功能 | 好处 |
|---|---|
| 语音优先的代理控制 | 通过 Discord 语音控制 Hermes Agent、Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw 或 custom CLI。 |
| Guided setup | 不要手动编辑 `.env`；使用 `vc setup token` 和 `vc setup channels` 保存令牌和自动加入的语音频道。 |
| Local speech loop | Discord voice → `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Docker-aware troubleshooting | 如果看到 `Cannot perform IP discovery - socket closed`，说明频道已找到，但 Discord 语音 UDP 发现失败。在 Linux Docker 中使用 `network_mode: "host"`，并移除同一服务的 `ports:`。 |

## 快速开始

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

## Discord 设置

```bash
vc bot invite <discord-client-id>
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

## 简短命令表

```bash
vc setup --yes                         # bootstrap prerequisites and starter config
vc setup token                         # save/update Discord bot token
vc setup channels "General,Team Voice" # save auto-join voice channel names
vc bot invite CLIENT_ID                 # generate Discord invite URL
vc doctor                               # redacted health check and supported auto-fixes
vc start                                # start the default bridge
vc instance setup NAME                  # create isolated project bot config
vc instance start NAME                  # run that bot in the background
```

## Docker / 容器说明

如果看到 `Cannot perform IP discovery - socket closed`，说明频道已找到，但 Discord 语音 UDP 发现失败。在 Linux Docker 中使用 `network_mode: "host"`，并移除同一服务的 `ports:`。

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

## 了解更多

| 指南 | 链接 |
|---|---|
| Fresh install | [FRESH_INSTALL](FRESH_INSTALL.zh.md) |
| Usage | [USAGE](USAGE.zh.md) |
| Configuration | [CONFIGURATION](CONFIGURATION.zh.md) |
| Troubleshooting | [TROUBLESHOOTING](TROUBLESHOOTING.zh.md) |
| Multi-instance | [MULTI_INSTANCE](MULTI_INSTANCE.zh.md) |

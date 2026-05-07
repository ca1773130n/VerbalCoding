# VerbalCoding

<p align="center">
  <strong>Habla con tus agentes de programación CLI por voz en Discord, como en una llamada.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20Supertonic%20%7C%20SpeechSwift-0EA5E9">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding convierte un canal de voz de Discord en una superficie manos libres para agentes de programación. Di una petición, deja que el agente CLI trabaje y escucha una respuesta concisa, con transcripciones, eventos de progreso y protecciones para no leer código o logs interminables.

## Puntos clave

| Qué ofrece | Por qué importa |
|---|---|
| Control por voz primero | Controla Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw o cualquier CLI propia con la voz. |
| Bucle de voz local-first | Voz de Discord → STT `whisper.cpp` → agente → reproducción TTS por fragmentos. |
| Contexto compartido voz + texto | Los turnos de voz y `!ask` pueden reutilizar la misma sesión del agente compatible. |
| Interrupciones y sensibilidad | Interrumpe la reproducción de forma natural y cambia entre sensibilidad normal o conservadora. |
| Preajustes multilingües | `vc language ko/en/auto` cambia STT, idioma de progreso y voz TTS a la vez. |
| Aislamiento por proyecto | Un bot, perfil Hermes, sesión, memoria y logs por sala/proyecto. |

## Inicio rápido

```bash
git clone git@github.com:ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
vc doctor
./run.sh
```

## Cómo funciona

```mermaid
flowchart LR
  A[Discord voice] --> B[@discordjs/voice]
  B --> C[PCM cleanup + gates]
  C --> D[whisper.cpp STT]
  D --> E[CLI agent adapter]
  E --> F[Concise answer]
  F --> G[Chunked TTS]
  G --> H[Discord playback]
```

## Backends de agentes compatibles

| Backend | Default command | Session support |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Resume, verbose progress, cancellation, final-answer recovery |
| Claude Code / Claude CLI | `claude -p` | CLI session file support through adapter defaults |
| Codex CLI | `codex exec` | CLI session file support through adapter defaults |
| Gemini CLI | `gemini -p` | CLI session file support through adapter defaults |
| OpenCode | `opencode run` | CLI session file support through adapter defaults |
| OpenClaw | `openclaw run` | CLI session file support through adapter defaults |
| Custom | `AGENT_COMMAND` | Bring your own non-interactive command |

## Aprende más

| Guide | What you get |
|---|---|
| [Fresh Install](../FRESH_INSTALL.md) | Instalación desde cero, descarga del modelo y primera ejecución |
| [Usage Guide](../USAGE.md) | Comandos CLI, comandos de Discord, progreso y métricas de latencia |
| [Configuration](../CONFIGURATION.md) | .env, backends de agente, MCP, TTS y notas operativas |
| [Multi-Instance](../MULTI_INSTANCE.md) | Una sala de voz persistente por proyecto |
| [Release Notes](../RELEASE.md) | Capacidades actuales y checklist previo al lanzamiento |

## Mapa rápido de comandos

```bash
vc status
vc language ko|en|auto
vc bot invite CLIENT_ID
vc instance setup NAME
vc instance start NAME
vc doctor
```

## Requisitos

| Layer | Default |
|---|---|
| Runtime | Node.js 20+, npm |
| Audio | `ffmpeg` |
| STT | `whisper.cpp` / `whisper-cli` |
| Discord | Bot token, Message Content intent, voice permissions |
| Agent | At least one authenticated CLI harness, Hermes Agent by default |
| Platform focus | macOS / Apple Silicon currently gets the most testing |

## Contribuir

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

## Estado

VerbalCoding is public-release oriented but still early. Demo video/GIF, broader Linux notes, and a formal license file are still TODOs.

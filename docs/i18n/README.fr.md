# VerbalCoding

<p align="center">
  <strong>Pilotez vos agents de code CLI à la voix dans Discord, comme au téléphone.</strong>
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

VerbalCoding transforme un salon vocal Discord en interface mains libres pour agents de code. Dictez une demande, laissez le CLI travailler, puis écoutez une réponse concise — avec transcription texte, événements de progression et garde-fous pour éviter de lire de longs blocs de code ou logs.

## Points forts

| Fonction | Pourquoi c’est utile |
|---|---|
| Contrôle vocal d’abord | Pilotez Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw ou un CLI personnalisé à la voix. |
| Boucle vocale locale | Voix Discord → STT `whisper.cpp` → agent → lecture TTS par segments. |
| Contexte partagé voix + texte | Les tours vocaux et `!ask` peuvent réutiliser la même session d’agent compatible. |
| Interruption et sensibilité | Interrompez naturellement la lecture et basculez entre sensibilité normale ou conservatrice. |
| Préréglages vocaux multilingues | `vc language ko/en/auto` change ensemble STT, langue de progression et voix TTS. |
| Isolation par projet | Un bot, profil Hermes, session, mémoire et logs par salon/projet. |

## Démarrage rapide

```bash
git clone git@github.com:ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh
vc doctor
./run.sh
```

## Fonctionnement

```mermaid
flowchart LR
  A[Discord voice] --> B["@discordjs/voice"]
  B --> C[PCM cleanup + gates]
  C --> D["whisper.cpp STT"]
  D --> E["CLI agent adapter"]
  E --> F["Concise answer"]
  F --> G["Chunked TTS"]
  G --> H["Discord playback"]
```

## Backends d’agents pris en charge

| Backend | Default command | Session support |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Resume, verbose progress, cancellation, final-answer recovery |
| Claude Code | `claude -p` | CLI session file support through adapter defaults |
| Codex CLI | `codex exec` | CLI session file support through adapter defaults |
| Gemini CLI | `gemini -p` | CLI session file support through adapter defaults |
| OpenCode | `opencode run` | CLI session file support through adapter defaults |
| OpenClaw | `openclaw run` | CLI session file support through adapter defaults |
| Custom | `AGENT_COMMAND` | Bring your own non-interactive command |

## En savoir plus

| Guide | What you get |
|---|---|
| [Fresh Install](../FRESH_INSTALL.md) | Installation propre, téléchargement du modèle, premier lancement |
| [Usage Guide](../USAGE.md) | Commandes CLI, commandes Discord, progression, métriques de latence |
| [Configuration](../CONFIGURATION.md) | .env, backends agent, MCP, TTS et notes d’exploitation |
| [Multi-Instance](../MULTI_INSTANCE.md) | Un salon vocal Discord permanent par projet |
| [Release Notes](../RELEASE.md) | Fonctionnalités actuelles et checklist pré-release |

## Mini carte des commandes

```bash
vc status
vc language ko|en|auto
vc bot invite CLIENT_ID
vc instance setup NAME
vc instance start NAME
vc doctor
```

## Prérequis

| Layer | Default |
|---|---|
| Runtime | Node.js 20+, npm |
| Audio | `ffmpeg` |
| STT | `whisper.cpp` / `whisper-cli` |
| Discord | Bot token, Message Content intent, voice permissions |
| Agent | At least one authenticated CLI harness, Hermes Agent by default |
| Platform focus | macOS / Apple Silicon currently gets the most testing |

## Contribuer

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

## Statut

VerbalCoding is public-release oriented but still early. Demo video/GIF, broader Linux notes, and a formal license file are still TODOs.

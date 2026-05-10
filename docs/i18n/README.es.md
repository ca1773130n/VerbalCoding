# VerbalCoding

<p align="center"><strong>Trabaja con agentes de código por voz en Discord, como una llamada telefónica.</strong></p>

<p align="center">[English](../../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [Français](README.fr.md) · [Русский](README.ru.md)</p>

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

VerbalCoding convierte un canal de voz de Discord en una superficie manos libres para agentes de programación. Habla una petición, deja que el agente CLI trabaje y recibe la respuesta por voz y texto.

## Puntos clave

| Función | Beneficio |
|---|---|
| Control de agentes por voz | Controla Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw o un custom CLI desde voz de Discord. |
| Guided setup | En vez de editar `.env` manualmente, usa `vc setup token` y `vc setup channels` para guardar el token y los canales de voz de auto-unión. |
| Local speech loop | Discord voice → `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Docker-aware troubleshooting | Si ves `Cannot perform IP discovery - socket closed`, el canal fue encontrado pero falló el descubrimiento UDP de voz de Discord. En Docker sobre Linux usa `network_mode: "host"` y elimina `ports:` de ese servicio. |

## Inicio rápido

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

## Configuración de Discord

```bash
vc bot invite <discord-client-id>
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

## Mapa breve de comandos

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

## Nota sobre Docker / contenedores

Si ves `Cannot perform IP discovery - socket closed`, el canal fue encontrado pero falló el descubrimiento UDP de voz de Discord. En Docker sobre Linux usa `network_mode: "host"` y elimina `ports:` de ese servicio.

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

## Más información

| Guía | Enlace |
|---|---|
| Fresh install | [FRESH_INSTALL](FRESH_INSTALL.es.md) |
| Usage | [USAGE](USAGE.es.md) |
| Configuration | [CONFIGURATION](CONFIGURATION.es.md) |
| Troubleshooting | [TROUBLESHOOTING](TROUBLESHOOTING.es.md) |
| Multi-instance | [MULTI_INSTANCE](MULTI_INSTANCE.es.md) |

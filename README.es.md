# VerbalCoding

<p align="center"><strong>Habla con agentes de programación CLI por voz en Discord, como en una llamada.</strong></p>

<p align="center"><a href="./README.md">English</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.zh.md">中文</a> · <a href="./README.fr.md">Français</a> · <a href="./README.ru.md">Русский</a></p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20SpeechSwift-0EA5E9">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Por qué existe

VerbalCoding convierte una sala de voz de Discord en una cabina manos libres para agentes de programación. Pides algo hablando, dejas trabajar al agente CLI y recibes una respuesta breve por voz con transcripción y eventos de progreso. Los diffs y logs quedan fuera del TTS largo.

> **¿Ya usas Hermes Agent?** Hermes ya trae soporte de canales de voz de Discord con `/voice join` / `/voice channel`: puede unirse al VC actual, transcribir con Whisper y responder por TTS. Para ese bucle básico, VerbalCoding no es obligatorio. VerbalCoding añade una capa de flujo de trabajo: enrutamiento de proyectos/sesiones, contexto compartido de voz+texto, reglas de interrupción, avisos de progreso, presets de idioma, métricas de latencia y cambio de backend CLI más allá de Hermes.

## Qué lo hace distinto

| Capacidad | Por qué importa |
|---|---|
| Flujo tipo llamada | Habla, escucha, interrumpe y continúa en el mismo canal de voz de Discord. |
| Configuración guiada | `vc setup` reúne prerequisites, Discord token/client ID, voice channel, transcript target, backend y TTS settings en un solo flujo. |
| Bucle de voz local | Discord audio → local `whisper-cli` → selected CLI agent → TTS reply. |
| Elección de agente | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw o custom command. |
| Más allá de la voz integrada de Hermes | Mantiene el mismo bucle de voz en VC y añade salas de proyecto, contexto compartido con `!ask`, interrupciones afinadas, voz de progreso/estado y control de backends multiagente. |
| Operación real | Incluye doctor auto-fix, guía Docker UDP, latency metrics, multi-instance rooms y redacted config checks. |

## Inicio rápido

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

`vc setup` es la ruta normal para personas. Mantén abierto Discord Developer Portal mientras introduces bot token, application/client ID, transcript target y voice channel names.

En automatización puedes omitir prompts y completar los datos de Discord después.

```bash
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
vc doctor
```

## Discord en un minuto

1. Crea una application y un bot en Discord Developer Portal.
2. Activa Message Content privileged intent.
3. Ejecuta `vc setup` y pega bot token y application/client ID.
4. Introduce los nombres exactos de los voice channels para auto-join.
5. Invita el bot con estos comandos.

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

## Mapa mínimo de comandos

```bash
vc setup                                 # configuración guiada: prerequisites, Discord, backend, voice
vc setup --yes                           # bootstrap/starter config no interactiva
vc setup token                           # rotar o añadir Discord bot token/client ID después
vc setup channels "General,Team Voice"   # actualizar auto-join voice channel names
vc bot invite CLIENT_ID                  # generar Discord bot invite URL
vc status                                # mostrar configuración actual
vc language ko|en|auto                   # cambiar language preset
vc doctor                                # redacted health check y auto-fixes
vc start                                 # iniciar bridge por defecto
vc instance setup NAME                   # crear project voice bot aislado
vc instance start NAME                   # ejecutar ese bot en background
```

## Más información

| Guía | Qué obtienes |
|---|---|
| [Centro de documentación](docs/i18n/README.es.md) | Índice de guías localizadas. |
| [Fresh Install](docs/i18n/FRESH_INSTALL.es.md) | npm/global setup, configuración de Discord y primera ejecución. |
| [Usage](docs/i18n/USAGE.es.md) | Comandos CLI, comandos Discord, modos de ejecución y latency. |
| [Voz integrada de Hermes vs VerbalCoding](docs/i18n/HERMES_VOICE.es.md) | La voz Discord que Hermes ya ofrece y la diferencia de VerbalCoding. |
| [Configuration](docs/i18n/CONFIGURATION.es.md) | .env, agent backends, MCP, TTS y operación. |
| [Troubleshooting](docs/i18n/TROUBLESHOOTING.es.md) | Docker UDP y comprobaciones de token/channel. |
| [Multi-Instance](docs/i18n/MULTI_INSTANCE.es.md) | Una sala de voz fija por proyecto. |

## Requisitos

| Capa | Predeterminado |
|---|---|
| Runtime | Node.js 20+ y npm. |
| Audio | `ffmpeg` y local `whisper-cli`. |
| TTS | Edge TTS por defecto; OpenVoice, SpeechSwift/CosyVoice y Supertonic opcionales. |
| Discord | Bot token, Message Content intent, voice permissions y channel names coincidentes. |
| Agent | Al menos un CLI harness autenticado; Hermes Agent por defecto. |

## Nota Docker / contenedores

Si los logs muestran `Cannot perform IP discovery - socket closed`, Discord voice UDP está bloqueado. En Linux Docker Compose usa:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

No combines `network_mode: "host"` con `ports:`.

## Contribuir

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## Estado

VerbalCoding apunta a publicación pública, pero todavía es temprano. Demo video/GIF, validación Linux más amplia, CI y revisión de seguridad siguen como TODO.

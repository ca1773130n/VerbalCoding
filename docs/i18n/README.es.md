# VerbalCoding

<p align="center">
  <strong>Habla con tus agentes de programación CLI por voz en Discord, como una llamada telefónica para trabajo de software.</strong>
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
  <img alt="Agents" src="https://img.shields.io/badge/Agents-Hermes%20%7C%20Claude%20%7C%20Codex%20%7C%20Gemini%20%7C%20OpenCode-111827">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="Flujo de voz a agente de VerbalCoding" width="860">
</p>

## Por qué

VerbalCoding convierte un canal de voz de Discord en una superficie de control manos libres para agentes de programación. Di una solicitud, deja que tu agente CLI trabaje y escucha una respuesta concisa de vuelta, con transcripciones de texto, eventos de progreso y protecciones para salidas ruidosas de código o registros.

## Puntos destacados

| Qué obtienes | Por qué se siente bien |
|---|---|
| Control de agentes con voz primero | Habla con Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw o cualquier arnés CLI personalizado. |
| Bucle de voz en el dispositivo | Captura de voz de Discord → transcripción local con `whisper-cli` → agente → reproducción TTS por fragmentos. |
| Contexto compartido de voz y texto | Los turnos de voz y los comandos de texto `!ask` pueden reutilizar la misma sesión de agente compatible. |
| Interrupción natural y modos de sensibilidad | Interrumpe la reproducción de forma natural y cambia entre entornos normales y conservadores/ruidosos. |
| Preajustes de voz multilingües | Cambia STT, idioma de progreso y voz TTS juntos con `vc language ko/en/auto`. |
| Aislamiento de proyectos por salas | Ejecuta un bot por sala de proyecto con perfiles, sesiones, memoria y registros de Hermes aislados. |

## Inicio rápido

Ruta más rápida con npm:

```bash
npm install -g verbalcoding
vc setup --yes
vc doctor
vc start
```

O ejecútalo directamente sin una instalación global permanente:

```bash
npx verbalcoding setup --yes
vc doctor
vc start
```

Ruta de clonación de GitHub para colaboradores:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc doctor
./run.sh
```

`vc setup --yes` inicializa los prerrequisitos locales desde el paquete npm instalado. `./scripts/install.sh --yes` hace lo mismo solo dentro de un clon de GitHub. Ambos cubren, cuando es posible, dependencias de Node/npm, `ffmpeg`, `whisper-cli`, el modelo predeterminado de whisper.cpp, el asistente local de Edge TTS en `.venv-tts` y la configuración del asistente. Admiten macOS/Homebrew y administradores de paquetes comunes de Linux (`apt`, `dnf`, `pacman`); vuelve a ejecutar con `--no-wizard` para configurar solo dependencias o con `--skip-system` si quieres instalar los paquetes del sistema por tu cuenta.

¿Necesitas un recorrido de instalación limpia? Empieza con [Instalación limpia](FRESH_INSTALL.es.md).

## Backends de agentes compatibles

| Backend | Comando predeterminado | Soporte de sesión |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Reanudación, progreso detallado, cancelación, recuperación de respuesta final |
| Claude Code | `claude -p` | Soporte de archivo de sesión CLI mediante los valores predeterminados del adaptador |
| Codex CLI | `codex exec` | Soporte de archivo de sesión CLI mediante los valores predeterminados del adaptador |
| Gemini CLI | `gemini -p` | Soporte de archivo de sesión CLI mediante los valores predeterminados del adaptador |
| OpenCode | `opencode run` | Soporte de archivo de sesión CLI mediante los valores predeterminados del adaptador |
| OpenClaw | `openclaw run` | Soporte de archivo de sesión CLI mediante los valores predeterminados del adaptador |
| Personalizado | `AGENT_COMMAND` | Usa tu propio comando no interactivo |

## Aprende más

| Guía | Qué obtienes |
|---|---|
| [Instalación limpia](FRESH_INSTALL.es.md) | Configuración desde un clon limpio, descarga del modelo y primera ejecución |
| [Guía de uso](USAGE.es.md) | Comandos CLI, comandos de Discord, modo de progreso y métricas de latencia |
| [Configuración](CONFIGURATION.es.md) | `.env`, backends de agente, MCP, backends TTS y notas operativas |
| [Multiinstancia](MULTI_INSTANCE.es.md) | Una sala de voz permanente de Discord por proyecto |
| [Notas de versión](RELEASE.es.md) | Capacidades actuales y lista de verificación previa al lanzamiento |

## Mapa mínimo de comandos

```bash
vc status                 # current language, TTS, and bridge settings
vc language ko|en|auto    # switch STT/progress/TTS language preset
vc bot invite CLIENT_ID   # generate the Discord bot invite URL
vc instance setup NAME    # create an isolated project voice bot
vc instance start NAME    # run that bot in the background
vc doctor                 # redacted health check
vc start                  # start the default bridge
```

En Discord:

| Comando | Qué hace |
|---|---|
| `!join` | Se une a tu canal de voz actual. |
| `!ask <prompt>` | Envía texto al mismo backend de agente. |
| `!verbose on\|off` | Muestra/dice actualizaciones cortas de progreso. |
| `!latency` | Resume la latencia reciente de voz/STT/agente/TTS. |
| `!sensitivity normal` | Usa sensibilidad normal de interrupción para interiores. |
| `!sensitivity conservative` | Usa sensibilidad más estricta para entornos ruidosos/exteriores. |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Vincula una sesión de proyecto a una sala de voz. |

## Requisitos

| Capa | Predeterminado |
|---|---|
| Runtime | Node.js 20+, npm; el script de instalación puede instalar vía Homebrew/apt/dnf/pacman |
| Audio | `ffmpeg`; el script de instalación puede instalarlo |
| Reconocimiento de voz | `whisper-cli` local de whisper.cpp; el script usa Homebrew en macOS o compilación local alternativa en Linux |
| TTS | CLI de Edge TTS; el script de instalación crea `.venv-tts` si hace falta |
| Discord | Token de bot, intent Message Content, permisos de voz |
| Agente | Al menos un arnés CLI autenticado, Hermes Agent por defecto |
| Enfoque de plataforma | macOS / Apple Silicon es lo más probado; el arranque de Linux es de mejor esfuerzo y está documentado |

## Contribuir

Ejecuta las comprobaciones ligeras antes de enviar cambios:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
npm pack --dry-run
vc doctor
```

## Estado

VerbalCoding está orientado al lanzamiento público, pero aún es temprano. Video/GIF de demostración, validación más amplia en Linux, CI y una revisión de seguridad más profunda siguen pendientes.

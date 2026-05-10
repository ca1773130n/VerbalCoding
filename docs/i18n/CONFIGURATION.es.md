# Configuración de VerbalCoding


## Flujo setup actualizado

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

No edites `.env` manualmente: usa `vc setup token` para guardar `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` y `vc setup channels` para guardar `AUTO_JOIN_VOICE_CHANNELS`. Si Docker muestra `Cannot perform IP discovery - socket closed`, usa `network_mode: "host"` en Linux Compose y elimina `ports:`.

## Asistente de configuración

La configuración de la aplicación/bot de Discord no se vuelve a explicar desde cero aquí de forma intencionada. Usa estas guías originales para los pasos del lado de Discord y luego vuelve a la configuración de VerbalCoding:

- Guía de mensajería Discord de Hermes Agent: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Resumen oficial de bots de Discord: <https://docs.discord.com/developers/bots/overview>
- Inicio rápido oficial de Discord: <https://docs.discord.com/developers/quick-start/getting-started>

```bash
./scripts/install.sh
```

El instalador solicita token de Discord, usuarios permitidos, nombres de canales de voz para auto-unión, canal/hilo de transcripción, backend de arnés CLI, idioma de voz predeterminado, ajustes de TTS y comportamiento de palabra de activación. Escribe `.env` con modo `0600`; `.env` está ignorado por git. También enlaza el comando corto de shell `vc`.

Si solo necesitas el comando de shell después de una instalación manual:

```bash
npm link
```

## Backends de agentes compatibles

Define `AGENT_BACKEND` en `.env`.

| Backend | Comando predeterminado | Notas |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | Predeterminado. Conserva el comportamiento de reanudación de `.verbalcoding-session`. |
| `claude-code` / `claude` | `claude -p` | Sobrescribe con `CLAUDE_COMMAND` o `AGENT_COMMAND`. |
| `codex` | `codex exec` | Sobrescribe con `CODEX_COMMAND` o `AGENT_COMMAND`. |
| `gemini` | `gemini -p` | Sobrescribe con `GEMINI_COMMAND` o `AGENT_COMMAND`. |
| `opencode` | `opencode run` | Sobrescribe con `OPENCODE_COMMAND` o `AGENT_COMMAND`. |
| `openclaw` | `openclaw run` | Sobrescribe con `OPENCLAW_COMMAND` o `AGENT_COMMAND`. |
| `custom` | `AGENT_COMMAND` requerido | El prompt se añade como argumento argv final. |

Sobrescrituras genéricas:

```bash
AGENT_BACKEND=custom
AGENT_LABEL="My Harness"
AGENT_COMMAND="my-harness run --non-interactive"
AGENT_TASK_TIMEOUT_MS=0
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0
UTTERANCE_IDLE_MS=4500
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## Contrato del adaptador de agente

El puente de voz habla con cada backend mediante un único contrato de adaptador:

- `run({ text }, signal, plan)` devuelve estado, texto de respuesta final, etiqueta del backend, tiempo transcurrido y metadatos de sesión opcionales.
- `ask(text, signal, plan)` es el atajo de compatibilidad que devuelve solo el texto de la respuesta final.
- `capabilities` declara si el backend admite reanudación de sesión, progreso en streaming y cancelación.
- Hermes es el adaptador de referencia: reanudación, streaming de progreso detallado, cancelación y recuperación de respuesta final desde archivos de sesión de Hermes.

Los nuevos backends deberían implementar el mismo contrato y mantener el comportamiento de voz/STT/TTS fuera del adaptador.

## Ejemplo de `.env`

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="123456789012345678"

AGENT_BACKEND="hermes"
STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_female"
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"

REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="4500"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## Selección de voz TTS

Los preajustes de idioma y la selección de voz están separados:

- `vc language ko|en|auto` cambia el idioma STT, el idioma de progreso y la voz predeterminada para ese idioma.
- Comandos de voz en vivo como “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female` y `switch speaker to English` cambian solo el hablante/tipo de voz.
- `!voice-test <text>` reproduce una muestra rápida con el backend y la voz actualmente seleccionados.

La selección de voz se guarda por defecto en `config/tts-voices.json`. Sobrescribe la ruta con `TTS_VOICE_CONFIG`. El puente en ejecución vuelve a leer/aplicar la selección de voz antes de sintetizar, por lo que los comandos de voz surten efecto sin reinicio completo.

Catálogo Edge predeterminado:

| `TTS_VOICE_TYPE` | `TTS_VOICE` | Idioma |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | Coreano |
| `korean_female` | `ko-KR-SunHiNeural` | Coreano |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | Coreano |
| `english_male` | `en-US-GuyNeural` | Inglés |
| `english_female` | `en-US-AriaNeural` | Inglés |

Sobrescritura manual persistente:

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

Para OpenVoice, SpeechSwift o Supertonic, mantén los ajustes de voz/referencia específicos del backend en las secciones siguientes; el mismo archivo de catálogo de voces aún puede rastrear el tipo de voz activo.

Opciones de voz específicas de backend:

| Backend | Ajustes | Opciones de voz |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | Tipos integrados anteriores, más cualquier voz devuelta por `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5`; idioma `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | WAV de referencia permitido proporcionado por el usuario; el estilo predeterminado es `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | Voces de muestra de referencia para CosyVoice, o IDs de hablante/modelo admitidos por el backend |

## Segmentación de emisiones

`UTTERANCE_IDLE_MS` controla cuánto espera el puente después de un segmento de habla antes de decidir que el usuario terminó y empezar STT. El valor predeterminado es `4500` ms para conservar instrucciones habladas más largas con pausas naturales. Los valores menores se sienten más rápidos para comandos cortos, pero pueden dividir dictado largo; los valores mayores son más seguros para habla reflexiva.

```bash
UTTERANCE_IDLE_MS="4500"  # balanced default
UTTERANCE_IDLE_MS="6000"  # safer for long dictation with pauses
```

## Servidor MCP

VerbalCoding incluye un servidor MCP stdio para que Hermes Agent o cualquier cliente MCP pueda controlar el puente mediante herramientas en lugar de depender de skills o comandos de shell de forma libre.

Ejemplo de configuración de Hermes:

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

Herramientas MCP expuestas:

| Herramienta | Propósito |
|---|---|
| `status` | Informar estado del puente/configuración sin secretos |
| `doctor` | Ejecutar la comprobación doctor con secretos redactados |
| `set_auto_restart` | Habilitar/deshabilitar el reinicio automático del bot de voz al hacer commit |
| `set_language` | Actualizar juntos STT/progreso/TTS |
| `start`, `stop`, `restart` | Controlar el puente de voz de Discord |

## TTS OpenVoice opcional

Edge TTS sigue siendo el valor predeterminado y la alternativa. Para probar clonación de voz local con OpenVoice V2:

```bash
./scripts/setup_openvoice.sh
# Download checkpoints_v2_0417.zip from OpenVoice docs and extract under vendor/OpenVoice/checkpoints_v2/
mkdir -p voice-samples
# Put a permitted reference sample at voice-samples/user-reference.wav,
# or capture one from Discord with !voice-clone capture.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Luego define:

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

Clona solo voces que poseas o tengas permiso para usar. Si OpenVoice falla o agota el tiempo, VerbalCoding vuelve a Edge TTS.

## TTS Supertonic opcional

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

Luego define:

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

Si Supertonic falta, falla o agota el tiempo, VerbalCoding vuelve a Edge TTS.

## TTS SpeechSwift / CosyVoice opcional

En Apple Silicon, `speech-swift` es un backend local para clonación de voz coreana con CosyVoice/Qwen3-TTS nativo de MLX.

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

Entorno recomendado:

```bash
TTS_BACKEND="speechswift"
SPEECHSWIFT_MODE="server"
SPEECHSWIFT_ENGINE="cosyvoice"
SPEECHSWIFT_LANGUAGE="korean"
SPEECHSWIFT_REF_AUDIO="./voice-samples/user-reference.wav"
SPEECHSWIFT_SERVER_HOST="127.0.0.1"
SPEECHSWIFT_SERVER_PORT="18080"
SPEECHSWIFT_SERVER_URL="http://127.0.0.1:18080"
SPEECHSWIFT_PROGRESS="0"
```

Mantén Edge para prompts rápidos de progreso/backchannel.

## Notas operativas

- El bot necesita el intent privilegiado Message Content de Discord habilitado para comandos de texto.
- El bot necesita permisos de conectar/hablar en el canal de voz.
- Para Hermes Agent, configura/autentica Hermes normalmente (`hermes setup`, `hermes login`, etc.) en tu perfil predeterminado.
- Para Claude Code, Codex, Gemini, OpenCode y OpenClaw, instala y autentica esas CLIs por separado.
- Si una CLI emite salida de diff/código durante un timeout o fallo de señal, el puente evita leerla en voz alta y envía texto detallado en su lugar.

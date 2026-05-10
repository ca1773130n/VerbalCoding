# Instalación limpia


## Flujo setup actualizado

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

No edites `.env` manualmente: usa `vc setup token` para guardar `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` y `vc setup channels` para guardar `AUTO_JOIN_VOICE_CHANNELS`. Si Docker muestra `Cannot perform IP discovery - socket closed`, usa `network_mode: "host"` en Linux Compose y elimina `ports:`.

Esta guía es para una instalación pública limpia. Evita suposiciones locales y usa el instalador para inicializar todo lo posible.

## 1. Instala la CLI

Ruta recomendada con npm:

```bash
npm install -g verbalcoding
```

O ejecuta directamente el paquete publicado:

```bash
npx verbalcoding setup --yes
```

Si usaste `npm install -g`, continúa con:

```bash
vc setup
```

Ruta de clonación de GitHub para colaboradores:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. Inicializa dependencias y ejecuta el asistente de configuración

En una instalación npm, no ejecutes `./scripts/install.sh` directamente; no hay un checkout del repositorio en tu directorio actual. Usa en su lugar el wrapper CLI empaquetado:

```bash
vc setup
```

`vc setup` ejecuta el `scripts/install.sh` incluido dentro del paquete npm instalado. Usa `./scripts/install.sh --yes` solo cuando estés dentro de un clon de GitHub:

```bash
./scripts/install.sh --yes
```

Qué hace esto:

- instala las dependencias npm cuando falta `node_modules/`,
- instala el comando corto de shell `vc` con `npm link`,
- instala `ffmpeg`, Node/npm y `whisper-cli` cuando el administrador de paquetes del SO lo admite,
- descarga `models/ggml-small-q5_1.bin`,
- crea `.venv-tts` e instala `edge-tts` cuando `edge-tts` no está ya en `PATH`,
- ejecuta el asistente interactivo de `.env`.

Rutas de arranque del sistema compatibles:

| SO | Ruta de dependencias del sistema |
|---|---|
| macOS | Homebrew: `brew install node ffmpeg whisper-cpp` según sea necesario |
| Debian/Ubuntu | `apt-get` para Node/npm, ffmpeg, Python y herramientas de compilación; compilación local alternativa de whisper.cpp |
| Fedora/RHEL | `dnf` para Node/npm, ffmpeg, Python y herramientas de compilación; compilación local alternativa de whisper.cpp |
| Arch | `pacman` para Node/npm, ffmpeg, Python y herramientas de compilación; compilación local alternativa de whisper.cpp |

Variantes útiles del instalador:

```bash
vc setup --yes --no-wizard                   # dependency/bootstrap only from npm install
./scripts/install.sh --yes --no-wizard       # dependency/bootstrap only from a clone
./scripts/install.sh --skip-system           # do not install OS packages
./scripts/install.sh --skip-model            # do not download the default STT model
./scripts/install.sh --skip-edge-tts         # do not create .venv-tts
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

Si tu SO no es compatible, instala esto manualmente antes de volver a ejecutar:

- Node.js 20+ y npm
- ffmpeg
- Python 3 con venv/pip
- `whisper-cli` de whisper.cpp
- un backend de agente CLI autenticado, Hermes Agent por defecto

## 3. Configuración de la aplicación de Discord

Lee primero las guías originales de configuración de bots de Discord si este es tu primer bot:

- Guía de mensajería Discord de Hermes Agent: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Resumen oficial de bots de Discord: <https://docs.discord.com/developers/bots/overview>
- Guía oficial de primeros pasos de Discord: <https://docs.discord.com/developers/quick-start/getting-started>

Esas páginas muestran cómo crear una aplicación de Discord, añadir un usuario bot, habilitar intents privilegiados e invitarlo a un servidor. VerbalCoding usa la misma configuración de bot de Discord y luego añade recepción de voz, STT, ejecución de agentes CLI y reproducción TTS encima.

1. Crea una aplicación y un bot de Discord en el Discord Developer Portal.
2. Habilita el intent privilegiado Message Content.
3. Copia el token del bot en el prompt del instalador o en `.env` como `DISCORD_BOT_TOKEN`.
4. Genera una URL de invitación:

```bash
vc bot invite <discord-client-id>
# or pin it to one server:
vc bot invite <discord-client-id> --guild <guild-id>
```

La invitación incluye los scopes de bot y comandos slash, además de los permisos de texto/voz usados por VerbalCoding.

## 4. Verifica

```bash
vc doctor
```

`vc doctor` está redactado: informa tokens/comandos/modelos faltantes sin imprimir valores secretos. Cuando falten prerrequisitos locales reparables (`ffmpeg`, `whisper-cli`, el modelo predeterminado o el asistente Edge TTS), primero vuelve a ejecutar automáticamente el bootstrap empaquetado. Corrige cualquier elemento `✗` restante y vuelve a ejecutarlo.

El éxito esperado incluye:

```text
✓ Node.js
✓ npm
✓ ffmpeg
✓ whisper-cli
✓ whisper.cpp model
✓ Discord bot token configured — [REDACTED]
✓ edge-tts
✓ hermes CLI
Doctor passed. Run vc start to start VerbalCoding.
```

Si el instalador creó un asistente local de Edge TTS, `.env` debería contener una ruta `EDGE_TTS_COMMAND` que apunte a `.venv-tts/bin/edge-tts`.

## 5. Ejecuta el bot predeterminado único

```bash
vc start
# or, from a GitHub clone:
./run.sh
```

Los registros de inicio correcto incluyen:

```text
Logged in as <bot-name>
Listening in voice channel <server> / <channel>
```

En Discord:

```text
!ping
!join
!ask say hello briefly
!verbose on
```

Luego habla en el canal de voz configurado. Deberías ver texto STT, texto de progreso cuando el modo detallado está activado, una respuesta final de texto y escuchar la reproducción TTS.

## 6. Configuración de un proyecto por sala

Para un bot permanente por sala de voz de proyecto, crea una aplicación de Discord por proyecto y luego:

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

Cada instancia escribe un `instances/<name>.env` ignorado con su propio token, canal de voz, destino de transcripción, ruta de registro, archivo de sesión de Hermes y perfil de Hermes opcional.

## 7. Configuración opcional de OpenVoice

La clonación de voz de OpenVoice es opcional. Mantén `TTS_BACKEND=edge` para una instalación pública nueva. Para habilitar OpenVoice más adelante:

```bash
./scripts/setup_openvoice.sh
# Download OpenVoice V2 checkpoints into vendor/OpenVoice/checkpoints_v2/
# Add a permitted local sample at voice-samples/user-reference.wav,
# or run the bot, say "목소리 샘플 녹음 시작해", then speak 10-30 seconds.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Luego define `TTS_BACKEND=openvoice`, ejecuta `vc doctor` y prueba `!voice-test <text>` en Discord.

## 8. Prueba rápida de clon limpio para mantenedores

Prueba rápida solo en el host:

```bash
TMPDIR=$(mktemp -d)
git clone https://github.com/ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
cp .env.example .env
chmod 600 .env
vc doctor || true
```

El fallo esperado en este punto es la ausencia de secretos locales o una CLI de agente no autenticada, no tokens filtrados ni scripts de instalación faltantes.

Prueba rápida de instalación limpia en Ubuntu basada en Docker:

```bash
./scripts/docker_ubuntu_smoke.sh
```

Esto ejecuta `ubuntu:24.04`, copia el árbol del repositorio rastreado a un contenedor limpio, ejecuta `./scripts/install.sh --yes --no-wizard`, escribe un `.env` de prueba sin secretos, comprueba `vc`, ejecuta pruebas de Node y verifica `vc doctor`. No se conecta a voz de Discord; usa una VM real de Ubuntu o WSL2 después de esto si necesitas una prueba de extremo a extremo con canal de voz.

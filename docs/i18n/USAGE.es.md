# Guía de uso de VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="README.es.md">Centro de documentación</a> ·
  <a href="FRESH_INSTALL.es.md">Fresh Install</a> ·
  <a href="USAGE.es.md">Usage</a> ·
  <a href="CONFIGURATION.es.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.es.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.es.md">Multi-Instance</a>
</p>

> Ruta rápida: `npm install -g verbalcoding@latest → vc setup → vc doctor → vc start`
<!-- /readme-glow-up:intro -->

## Flujo setup actualizado

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

No edites `.env` manualmente: usa `vc setup token` para guardar `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` y `vc setup channels` para guardar `AUTO_JOIN_VOICE_CHANNELS`. Si Docker muestra `Cannot perform IP discovery - socket closed`, usa `network_mode: "host"` en Linux Compose y elimina `ports:`.

Esta página contiene los detalles operativos que antes hacían que el README fuera demasiado largo.

## Comandos CLI

```bash
vc status                    # show STT language, progress language, and TTS voice
vc language en               # English STT + English progress/TTS voice
vc language ko               # Korean STT + Korean progress/TTS voice
vc language auto             # Whisper auto-detect STT + English progress/TTS voice
vc restart auto status       # show commit-time voice-bot auto-restart setting
vc restart auto on           # enable commit-time voice-bot auto-restart
vc restart auto off          # disable it; this is the default
vc bot invite CLIENT_ID      # print a Discord invite URL with required permissions
vc instance status           # list per-instance bridge configs and process status
vc instance setup NAME       # write instances/NAME.env and create ~/.hermes/profiles/NAME
vc instance start NAME       # start ./run.sh instances/NAME.env detached
vc instance stop NAME        # stop a detached instance and remove its pid file
vc doctor                    # run the redacted doctor check
npm run mcp                  # run the stdio MCP server
```

Los cambios de idioma actualizan `.env`; reinicia el puente con `./run.sh` o tu gestor de procesos para que surtan efecto.

## Modos de ejecución

Puente de instancia única:

```bash
./run.sh
```

Puente por instancia usando un entorno local de sobrescritura:

```bash
./run.sh instances/my-project.env
# or
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

El bot se une automáticamente al primer nombre de canal configurado, con valor predeterminado `일반,General,general`.

## Comandos de Discord

Antes de cablear comandos, configura la aplicación/bot de Discord usando las guías originales:

- Guía de Discord de Hermes Agent: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Documentación oficial de bots de Discord: <https://docs.discord.com/developers/bots/overview>

Luego usa `vc bot invite CLIENT_ID` para generar la URL de invitación específica de VerbalCoding con permisos de texto y voz.

| Comando | Propósito |
|---|---|
| `!ping` | Comprobación básica del bot |
| `!join` / `!leave` | Unirse a voz o salir de voz |
| `!say <text>` | Decir texto directamente mediante TTS |
| `!voice-test <text>` | Probar el backend/voz TTS activo |
| `!voice-clone capture` | Guardar la siguiente emisión válida como muestra de referencia para OpenVoice |
| `!voice-clone status` / `!voice-clone cancel` | Inspeccionar o cancelar la captura |
| `!ask <prompt>` | Enviar texto mediante el mismo adaptador de arnés seleccionado que la voz |
| `!session status` | Mostrar la sesión actual de proyecto/adaptador predeterminado |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Crear una sesión Hermes con alcance de proyecto |
| `!session attach-voice [sessionName] --voice <voice-channel>` | Vincular canal/hilo de texto a un canal de voz |
| `!session list` | Listar sesiones de proyecto configuradas |
| `!session reset` / `!reset-session` | Borrar el archivo de sesión actual del proyecto/adaptador predeterminado |
| `!verbose on/off` | Alternar actualizaciones de progreso detalladas |
| `!latency` / `!metrics` | Mostrar resumen de latencia reciente |
| `!sensitivity normal/conservative` | Cambiar sensibilidad de interrupción |

Equivalentes de voz como “외부 모드”, “보수 모드”, “실내”, “기본 감도” y frases claras de parada como “잠깐”, “멈춰”, “그만” son gestionados por el puente. También puedes decir “상세 진행 켜” / “상세 진행 꺼” para alternar el progreso detallado por voz.

## Cambiar la voz

`vc language ko|en|auto` cambia juntos el idioma STT, el idioma de progreso y la voz TTS predeterminada correspondiente. Si solo quieres cambiar el hablante/voz mientras el puente está en ejecución, dilo en la voz de Discord:

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

El puente en vivo reconoce esto como comandos de control por voz, actualiza `config/tts-voices.json`, actualiza el entorno TTS efectivo del proceso en ejecución y responde con una confirmación corta como “목소리를 Korean male로 바꿨어.” Usa `!voice-test <text>` justo después de cambiarla para escuchar el backend y la voz actuales.

Tipos de voz Edge integrados:

| Tipo de voz | Voz Edge |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

Para configuración manual persistente, define `TTS_BACKEND=edge`, `TTS_VOICE_TYPE=<voice-type>` y opcionalmente `TTS_VOICE=<edge-voice>` en `.env`, o edita `config/tts-voices.json` para catálogos de voz personalizados.

Controles de voz específicos de backend:

| Backend | Ajuste de voz | Opciones comunes |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`, `korean_female`, `korean_multilingual_male`, `english_male`, `english_female`; cualquier voz Edge de `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5`; define `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | una referencia WAV permitida más un estilo como `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | WAV de referencia para CosyVoice, o valores de hablante/modelo admitidos por el backend |

Para Supertonic y backends locales de clonación, usa las variables de entorno del backend anteriores junto con `!voice-test <text>` para probar cambios. El cambio por comandos de voz actualmente asigna los tipos de voz integrados de estilo Edge; se pueden añadir catálogos de backend más completos en `config/tts-voices.json`.

## Dictado largo y pausas

VerbalCoding espera una ventana de inactividad antes de enviar el habla a STT. El valor predeterminado `UTTERANCE_IDLE_MS=4500` es deliberadamente un poco paciente para que una pausa natural en una instrucción larga no divida la oración, inicie un turno de agente demasiado pronto y luego trate el resto como una interrupción durante el procesamiento.

Si prefieres comandos cortos más rápidos, bájalo en `.env`; si el dictado largo en coreano aún se divide, súbelo:

```bash
UTTERANCE_IDLE_MS="6000"
```

## Modo de progreso detallado

El progreso detallado está desactivado por defecto salvo que `AGENT_VERBOSE_PROGRESS=1` esté definido. Habilítalo con `!verbose on` o con un comando de voz como “상세 진행 켜”. Puede emitir líneas cortas de progreso como:

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

Este modo pide al arnés CLI seleccionado que emita líneas `VERBALCODING_PROGRESS: ...` y resume marcadores comunes de herramientas desde stdout/stderr en streaming cuando están disponibles. Los campos con aspecto de secreto se redactan y las líneas de progreso se eliminan de la respuesta final hablada.

## Métricas de latencia

VerbalCoding escribe registros de latencia por turno como JSONL. Ruta predeterminada:

```text
./.logs/latency.jsonl
```

Cada registro incluye estado, tiempo total, tiempo de captura de voz, espera de inactividad de emisión, tiempo STT, tiempo del agente, tiempo de síntesis/reproducción TTS, conteos de fragmentos, longitud de transcripción, longitud de respuesta y niveles de audio cuando están disponibles.

En Discord:

```text
!latency
!metrics
```

El resumen usa los últimos 200 registros: conteo, promedio, p95, máximo y estados no OK.

## Pruebas

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor` redacta secretos intencionadamente y solo informa si los valores requeridos están configurados. También comprueba `instances/*.env` en busca de huellas de token duplicadas y rutas de ejecución en conflicto.

# Notas de versión de VerbalCoding

## Candidato de lanzamiento actual

VerbalCoding es un puente de voz de Discord para controlar por voz agentes de programación basados en CLI. Está orientado al lanzamiento público, con macOS / Apple Silicon como la ruta más probada y soporte de arranque de mejor esfuerzo en Linux para administradores de paquetes comunes.

### Incluido

- Recepción de voz de Discord mediante Node `@discordjs/voice`.
- STT local en coreano mediante `whisper.cpp` + Metal.
- Reproducción Edge TTS con voz coreana predeterminada.
- Capa genérica de adaptador para arneses CLI:
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - comando personalizado
- Soporte de sesión compartida de voz/texto para el backend Hermes.
- Fragmentación TTS de respuestas largas e interrupción receptiva.
- Protecciones para diff/código/registros para que las salidas técnicas grandes no se lean en voz alta.
- Modos de sensibilidad normal y conservador para uso en interiores frente a uso ruidoso/exterior.
- Asistente de configuración, `.env.example`, comprobador de prerrequisitos `vc doctor` y arranque `./scripts/install.sh --yes` para paquetes del SO, dependencias npm, asistente de Edge TTS y el modelo predeterminado de whisper.cpp.
- Ruta de instalación del paquete npm: `npm install -g verbalcoding`, `vc setup --yes` y `vc start`.
- Modo opcional de progreso detallado para actualizaciones intermedias solo de texto durante trabajos largos del agente.
- Métricas de latencia JSONL siempre activas más resumen `!latency` / `!metrics` para optimización del pipeline.
- Espera de inactividad de emisión más paciente (`UTTERANCE_IDLE_MS=4500`) para que las instrucciones habladas largas con pausas naturales no se dividan en un prompt parcial más habla durante procesamiento ignorada.
- Aislamiento de perfiles Hermes multiinstancia: `vc instance setup <name>` clona automáticamente un perfil Hermes a `~/.hermes/profiles/<name>` con el workdir de la instancia, inicializa SOUL.md y escribe `HERMES_HOME` en el env de la instancia para mantener separadas la memoria y las skills por proyecto; `vc instance start` autorepara un perfil faltante, y `vc doctor` comprueba la presencia del directorio de perfil y la consistencia de `terminal.cwd`.

### Lista de verificación previa al lanzamiento

Ejecuta desde la raíz del repositorio:

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # requires Docker; validates ubuntu:24.04 clean install
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # ok when no Python tests exist
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

Prueba manual rápida:

1. Inicia el puente con `vc start` o `./run.sh`.
2. Verifica que el registro contenga `Logged in as <bot-name>`.
3. Verifica que el registro contenga `Listening in voice channel ... / 일반` o el canal predeterminado configurado.
4. En Discord, ejecuta `!ping`.
5. En voz de Discord, di una solicitud corta en coreano.
6. Verifica transcripción STT, respuesta del agente, reproducción TTS y comportamiento de interrupción.

### Requisitos conocidos

- macOS con Homebrew, o Linux con `apt`, `dnf` o `pacman` para arranque de mejor esfuerzo.
- `ffmpeg`; el instalador intenta instalarlo.
- `whisper-cli`; el instalador usa Homebrew en macOS o una compilación local alternativa de `vendor/whisper.cpp` en Linux.
- Modelo predeterminado en `models/ggml-small-q5_1.bin`; el instalador lo descarga salvo que se use `--skip-model`.
- CLI de Edge TTS en `PATH` o `.venv-tts/bin/edge-tts` local; el instalador crea el asistente local cuando hace falta.
- Token de bot de Discord en `.env`, `instances/<name>.env`, `~/.zshrc` o env de runtime.
- Arnés CLI seleccionado instalado y autenticado.

### Aún no listo para lanzamiento público

Antes del lanzamiento público, considera añadir:

- CI de GitHub Actions.
- Video / GIF de demostración.
- Capturas de pantalla de configuración de bot de Discord.
- Validación más amplia en distribuciones Linux reales más allá de comprobaciones a nivel de script.
- Revisión de seguridad de todas las rutas de registro.

# Hermes Agent — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

Hermes Agent es el backend por defecto de VerbalCoding y el único harness con un contrato real de reanudación de sesión: el contexto entre turnos se mantiene limpio. Posicionamiento frente al `/voice` integrado de Hermes en [HERMES_VOICE.es.md](./HERMES_VOICE.es.md).

## Instalación

Guía oficial: <https://hermes-agent.nousresearch.com>. Verifica el CLI primero:

```bash
hermes chat -Q -q "hello"
```

## Configuración

```bash
# .env
AGENT_BACKEND=hermes
HERMES_COMMAND="hermes chat -Q -q"
HERMES_HOME=/Users/you/.hermes
HERMES_PROJECT_CONTEXT="Project session: ..."
HERMES_TASK_TIMEOUT_MS=0
HERMES_CHAT_TIMEOUT_MS=45000
HERMES_WORKDIR=/Users/you/code/your-project
```

El fichero de sesión vive en `<repo>/.verbalcoding-session` por defecto (sobreescribible con `HERMES_SESSION_FILE`).

## Reanudación de sesión

Hermes es el único adaptador con reanudación. Tras cada turno con éxito, el adaptador escribe el nuevo `session_id` y antepone `--resume <id>` en la siguiente llamada. `!session reset` lo limpia.

Si un turno aborta antes de que Hermes emita `session_id:` en stderr, el adaptador lee `~/.hermes/sessions/session_<id>.json` para recuperar el último mensaje del asistente.

## Progreso detallado

En modo verboso, el adaptador quita el flag `-Q` para que stdout emita previas `┊ <emoji> <tool>`, que se resumen en eventos de progreso (lectura de archivos, búsqueda web, terminal). Sin verboso solo suena la respuesta final del recuadro.

## Frases de voz para cambiar a Hermes

- en: `"switch to Hermes"`, `"ask Hermes ..."`
- es: `"cambia a Hermes"`, `"pregunta a Hermes"`

## Trampas

- El prefijo TTS en handoff es localizado: `"Hermes says: "` / `"Hermes: "`.
- `HERMES_HOME` es el botón de aislamiento por proyecto más usado; típicamente `HERMES_HOME=/Users/you/.hermes/profiles/<project>` en el `.env` de instancia.
- Si verboso está activo pero Hermes termina con caja vacía (timeout), el adaptador rasca el JSON de sesión antes de rendirse.

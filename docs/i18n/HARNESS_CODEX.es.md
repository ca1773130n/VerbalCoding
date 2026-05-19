# Codex — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

Codex CLI es el agente de codificación de terminal de OpenAI. VerbalCoding lo invoca con `codex exec`. Como `codex exec` escribe el texto final del asistente a un fichero temporal cuando recibe `--output-last-message <path>`, el adaptador inserta ese flag automáticamente y lee la respuesta desde el fichero incluso si stdout está ruidoso.

## Instalación

```bash
npm install -g @openai/codex
codex login                     # o OPENAI_API_KEY headless
codex exec "hello"
```

## Configuración

```bash
# .env
AGENT_BACKEND=codex
CODEX_COMMAND="codex exec"
AGENT_PROJECT_CONTEXT="Qué estamos haciendo, qué ya está decidido."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

`AGENT_SESSION_FILE` no se usa (Codex `exec` es stateless entre llamadas).

## Captura de salida

El adaptador para Codex:

1. Genera una ruta temporal `verbalcoding-codex-last-<pid>-<ts>.txt` en `os.tmpdir()`.
2. Inserta `--output-last-message <path>` justo antes del argumento posicional final.
3. Tras la ejecución, lee ese fichero como respuesta autoritativa (preferida sobre stdout).
4. Borra el temporal.

Aunque Codex pinte tool-use en stdout, la respuesta hablada viene siempre del fichero capturado.

## Frases de voz para cambiar a Codex

- en: `"switch to Codex"`, `"ask Codex what it thinks"`
- es: `"cambia a Codex"`, `"pregunta a Codex"`

## Trampas

- **Tareas largas.** Pon `AGENT_TASK_TIMEOUT_MS=0` para generación que tarde minutos. El adaptador respeta `signal.aborted`, así que el barge-in corta limpio.
- **Sin reanudación.** Pasa contexto vía `AGENT_PROJECT_CONTEXT` y deja el bloque de handoff hacer el resto.
- **Seguridad ante patches.** Si el turno se interrumpe con Codex a medio diff, el puente no lee el diff: anuncia "interrumpido" y te manda al canal de texto.
- **Autenticación.** Un 401 sale como exit no cero; si no eras el backend por defecto, fallback ofrece el por defecto.

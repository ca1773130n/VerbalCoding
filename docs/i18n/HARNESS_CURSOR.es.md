# Cursor CLI — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

Cursor CLI (`cursor-agent`) es el agente de terminal de Cursor. VerbalCoding lo invoca con `cursor-agent --print --prompt`, pasando la transcripción como valor de `--prompt`. `--print` mantiene la corrida no interactiva.

## Instalación

```bash
cursor-agent --print --prompt "hello"
```

## Configuración

```bash
# .env
AGENT_BACKEND=cursor                                       # alias 'cursor-cli' aceptado
CURSOR_COMMAND="cursor-agent --print --prompt"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Frases de voz para cambiar a Cursor

- en: `"switch to Cursor"`, `"switch to cursor cli"`, `"switch to cursor agent"`
- es: `"cambia a Cursor"`

Alias: `cursor`, `cursor cli`, `cursor-cli`, `cursor agent`, `cursor-agent`.

## Trampas

- **Posición del prompt.** `--prompt` espera el valor a continuación; el constructor de argv coloca la transcripción al final, así que `CURSOR_COMMAND` debe terminar en `--prompt`.
- **Efectos colaterales del editor.** Cursor CLI puede tocar ficheros de estado en el cwd; aísla con `AGENT_WORKDIR`.
- **Sin reanudación.** `AGENT_PROJECT_CONTEXT` + bloque de handoff para continuidad.
- **Patch safety.** Si se interrumpe en medio de un diff, no se lee en voz.

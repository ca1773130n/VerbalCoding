# OpenCode — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

OpenCode es un agente de codificación de terminal open source. VerbalCoding lo invoca con `opencode run`.

## Instalación

```bash
opencode run "hello"
```

## Configuración

```bash
# .env
AGENT_BACKEND=opencode
OPENCODE_COMMAND="opencode run"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Frases de voz para cambiar a OpenCode

- en: `"switch to OpenCode"`, `"switch to open code"`
- es: `"cambia a OpenCode"`

Alias: `opencode`, `open code`.

## Trampas

- **Sin reanudación por defecto.** Si tu build soporta resume, añádelo: `OPENCODE_COMMAND="opencode run --resume"`.
- **Selección de modelo.** Añade `--model` u otras flags en `OPENCODE_COMMAND`.
- **Progreso detallado.** Coincidencia por keywords sobre stdout/stderr (lectura, búsqueda, terminal). Sin `SMART_PROGRESS_API_KEY`, fallback a labels raw.

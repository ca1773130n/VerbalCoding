# OpenClaw — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

OpenClaw es un agente de codificación de terminal open source. VerbalCoding lo invoca con `openclaw run`.

## Instalación

```bash
openclaw run "hello"
```

## Configuración

```bash
# .env
AGENT_BACKEND=openclaw
OPENCLAW_COMMAND="openclaw run"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Frases de voz para cambiar a OpenClaw

- en: `"switch to OpenClaw"`, `"switch to open claw"`
- es: `"cambia a OpenClaw"`

Alias: `openclaw`, `open claw`.

## Trampas

- **Sin reanudación por defecto.** Añade la flag adecuada en `OPENCLAW_COMMAND` si tu build la soporta.
- **Progreso detallado.** Igual que OpenCode: keywords + posible LLM summarizer.
- **Colisión de nombres.** Los alias `openclaw` y la etiqueta `OpenClaw` se distinguen claramente de `claude` / `claude code`; el modo strict del router no los confunde.

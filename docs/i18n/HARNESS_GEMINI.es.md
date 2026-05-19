# Gemini CLI — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

Gemini CLI es el agente de codificación de terminal de Google. VerbalCoding lo invoca con `gemini -p`. Cada turno de voz es una invocación; no hay reanudación entre llamadas.

## Instalación

Sigue la guía oficial de Gemini CLI. Confirma:

```bash
gemini -p "hello"
```

## Configuración

```bash
# .env
AGENT_BACKEND=gemini
GEMINI_COMMAND="gemini -p"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Frases de voz para cambiar a Gemini

- en: `"switch to Gemini"`, `"ask Gemini ..."`, `"switch to Gemini CLI"`
- es: `"cambia a Gemini"`, `"pregunta a Gemini"`

Alias: `gemini`, `gemini cli`, `gemini-cli`.

## Trampas

- **Sin reanudación.** Misma estrategia que Claude/Codex: `AGENT_PROJECT_CONTEXT` + bloque de handoff.
- **Respuestas largas.** Gemini a veces devuelve respuestas estructuradas grandes; el sentencer las parte en frases TTSables. Las cercas de código se eliminan del audio (el canal de texto sí trae el código).
- **API key.** Si Gemini sale con error de auth, el puente reporta; el fallback ofrece el agente por defecto.
- **Progreso detallado.** Gemini no emite previos al estilo `┊` de Hermes; el progreso detallado depende del summarizer LLM.

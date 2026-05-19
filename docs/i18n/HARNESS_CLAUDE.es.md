# Claude Code — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

Claude Code es el agente de codificación oficial de Anthropic en terminal. VerbalCoding lo invoca con `claude -p`: cada turno de voz es una invocación. `-p` no expone un contrato estable de reanudación entre llamadas, así que cada turno empieza con contexto fresco — usa `AGENT_PROJECT_CONTEXT` y el bloque de handoff entre agentes para mantener continuidad.

## Instalación

```bash
npm install -g @anthropic-ai/claude-code
claude login
claude -p "hello"
```

## Configuración

```bash
# .env
AGENT_BACKEND=claude
CLAUDE_COMMAND="claude -p"
AGENT_PROJECT_CONTEXT="Trabajando en el módulo de auth; decisiones previas: oauth=github."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
AGENT_VERBOSE_PROGRESS=0
```

`AGENT_SESSION_FILE` no se usa en este harness (Claude Code `-p` es stateless).

## Lo que recibe Claude por turno

Cada turno el adaptador antepone: el preamble Discord (en/es según `VOICE_LANGUAGE`), el contexto del proyecto, el contexto reciente del canal de texto y por último la transcripción. En un handoff entre agentes, también se incluye un bloque "Recent user voice" (hasta 4 elocuciones) y las decisiones de plan más recientes, para que Claude no parta de frío.

## Progreso detallado

Claude Code no emite un stream estándar bajo `-p`. Con `AGENT_VERBOSE_PROGRESS=1` el adaptador extrae menciones de herramientas/archivos/web de stdout/stderr, pero más groseramente que Hermes.

## Frases de voz para cambiar a Claude Code

- en: `"switch to Claude Code"`, `"ask Claude ..."`, `"let Claude finish this"`
- es: `"cambia a Claude"`, `"pregunta a Claude"`

El matcher acepta `claude` y `claude code`. El modo strict para enrutamiento puro exige coincidencia exacta.

## Trampas

- **Sin reanudación de sesión.** Las sesiones largas dependen del bloque de handoff para arrastrar decisiones; dentro del mismo backend, pon `AGENT_PROJECT_CONTEXT` con un resumen corto.
- **Comandos entrecomillados.** Si `CLAUDE_COMMAND` tiene una ruta absoluta con espacios (p. ej. `"/Applications/Claude Code/claude" -p`), la sonda de instalación usa `shellSplit` y respeta las comillas.
- **Refresco de auth.** La caducidad de `claude login` se ve como salida no cero; el puente reporta el fallo y, si no era el backend por defecto, ofrece fallback.
- **Salida tipo patch.** Si se interrumpe el turno mientras Claude devuelve un diff, el puente no lee el diff en voz alta; dice "interrumpido; revisa el canal de texto".

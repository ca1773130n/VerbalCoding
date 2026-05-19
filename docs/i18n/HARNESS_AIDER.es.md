# Aider — Notas del Harness

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="HARNESSES.es.md">Harnesses</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a>
</p>

Aider es un CLI de pair-programming centrado en edits directos. VerbalCoding lo invoca con `aider --no-pretty --yes-always --message`, pasando el prompt como valor de `--message`. Cada turno de voz se vuelve una corrida no interactiva de Aider que puede modificar archivos en `AGENT_WORKDIR`.

## Instalación

```bash
pip install aider-chat
aider --version
aider --no-pretty --yes-always --message "list the top-level files"
```

Aider necesita una API key para el modelo elegido (OpenAI / Anthropic / servidor local). Ver <https://aider.chat>.

## Configuración

```bash
# .env
AGENT_BACKEND=aider
AIDER_COMMAND="aider --no-pretty --yes-always --message"
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_PROJECT_CONTEXT="..."
AGENT_CHAT_TIMEOUT_MS=120000
AGENT_TASK_TIMEOUT_MS=0
```

`--no-pretty` quita caracteres de caja de Rich. `--yes-always` mantiene la corrida no interactiva.

## Frases de voz para cambiar a Aider

- en: `"switch to Aider"`, `"ask Aider to ..."`
- es: `"cambia a Aider"`, `"pásalo a Aider"`

Alias: `aider`.

## Trampas

- **Aider edita ficheros.** A diferencia de Claude / Codex / Gemini bajo `-p`, Aider modifica el árbol de trabajo al responder. Ajusta `AGENT_WORKDIR` con cuidado.
- **Diffs en salida.** Si se interrumpe el turno, el puente no lee diffs; consulta el canal de texto y `git status`.
- **Auth.** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` deben estar en el entorno de Aider; suelen vivir en `instances/<project>.env`.
- **Estado por canal.** El enrutamiento es por canal de Discord; cambiar a Aider en una sala no afecta a las otras.

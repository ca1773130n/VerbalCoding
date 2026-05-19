# OpenClaw — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

OpenClaw est un agent terminal open source. VerbalCoding l'invoque via `openclaw run`.

## Installation

```bash
openclaw run "hello"
```

## Configuration

```bash
# .env
AGENT_BACKEND=openclaw
OPENCLAW_COMMAND="openclaw run"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Phrases vocales pour basculer vers OpenClaw

- en: `"switch to OpenClaw"`, `"switch to open claw"`
- fr: `"passe à OpenClaw"`

Alias : `openclaw`, `open claw`.

## Pièges

- **Pas de reprise par défaut.** Ajoutez le flag adéquat à `OPENCLAW_COMMAND` si la build le supporte.
- **Progression verbeuse.** Identique à OpenCode.
- **Collision de noms.** Les alias `openclaw` et l'étiquette `OpenClaw` se distinguent clairement de `claude` / `claude code` ; le mode strict du routeur ne les confond pas.

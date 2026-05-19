# OpenCode — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

OpenCode est un agent terminal open source. VerbalCoding l'invoque via `opencode run`.

## Installation

```bash
opencode run "hello"
```

## Configuration

```bash
# .env
AGENT_BACKEND=opencode
OPENCODE_COMMAND="opencode run"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Phrases vocales pour basculer vers OpenCode

- en: `"switch to OpenCode"`, `"switch to open code"`
- fr: `"passe à OpenCode"`

Alias : `opencode`, `open code`.

## Pièges

- **Pas de reprise par défaut.** Si votre build supporte resume, ajoutez le flag dans `OPENCODE_COMMAND`.
- **Choix de modèle.** Ajoutez `--model` ou autres flags dans `OPENCODE_COMMAND`.
- **Progression verbeuse.** Matching par mots-clés sur stdout/stderr ; sans `SMART_PROGRESS_API_KEY`, fallback sur les labels bruts.

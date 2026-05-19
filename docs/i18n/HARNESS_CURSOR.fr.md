# Cursor CLI — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

Cursor CLI (`cursor-agent`) est l'agent terminal de Cursor. VerbalCoding l'invoque via `cursor-agent --print --prompt`, en passant la transcription comme valeur de `--prompt`. `--print` maintient le run non interactif.

## Installation

```bash
cursor-agent --print --prompt "hello"
```

## Configuration

```bash
# .env
AGENT_BACKEND=cursor                                       # alias 'cursor-cli' accepté
CURSOR_COMMAND="cursor-agent --print --prompt"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Phrases vocales pour basculer vers Cursor

- en: `"switch to Cursor"`, `"switch to cursor cli"`, `"switch to cursor agent"`
- fr: `"passe à Cursor"`

Alias : `cursor`, `cursor cli`, `cursor-cli`, `cursor agent`, `cursor-agent`.

## Pièges

- **Position du prompt.** `--prompt` attend la valeur juste après ; le builder argv place la transcription en dernier, donc `CURSOR_COMMAND` doit se terminer par `--prompt`.
- **Effets de bord éditeur.** Cursor CLI peut toucher des fichiers d'état dans le cwd ; isolez via `AGENT_WORKDIR`.
- **Pas de reprise.** `AGENT_PROJECT_CONTEXT` + bloc de handoff pour la continuité.
- **Patch safety.** Aucune lecture vocale du diff en cas d'interruption.

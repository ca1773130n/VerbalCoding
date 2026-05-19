# Aider — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

Aider est un CLI de pair-programming centré sur les edits directs. VerbalCoding l'invoque via `aider --no-pretty --yes-always --message`, en passant le prompt comme valeur de `--message`. Chaque tour vocal devient un run Aider non interactif susceptible de modifier des fichiers dans `AGENT_WORKDIR`.

## Installation

```bash
pip install aider-chat
aider --version
aider --no-pretty --yes-always --message "list the top-level files"
```

Aider requiert la clé API du modèle utilisé (OpenAI / Anthropic / serveur local). Voir <https://aider.chat>.

## Configuration

```bash
# .env
AGENT_BACKEND=aider
AIDER_COMMAND="aider --no-pretty --yes-always --message"
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_PROJECT_CONTEXT="..."
AGENT_CHAT_TIMEOUT_MS=120000
AGENT_TASK_TIMEOUT_MS=0
```

`--no-pretty` retire les caractères de cadre Rich. `--yes-always` garde la run non interactive.

## Phrases vocales pour basculer vers Aider

- en: `"switch to Aider"`, `"ask Aider to ..."`
- fr: `"passe à Aider"`

Alias : `aider`.

## Pièges

- **Aider modifie les fichiers.** Contrairement à Claude/Codex/Gemini en `-p`, Aider touche directement à l'arbre de travail. `AGENT_WORKDIR` doit être bien choisi (généralement le `workdir` d'une session projet).
- **Diffs dans la sortie.** Si le tour est interrompu, le bridge ne lit pas le diff — utilisez le canal texte et `git status`.
- **Auth.** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` doivent être dans l'env d'Aider ; en isolation, mettez-les dans `instances/<project>.env`.
- **État par canal.** Le routage inter-agents est par canal Discord ; passer à Aider dans un salon n'affecte pas les autres.

# Claude Code — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

Claude Code est l'agent de codage de terminal officiel d'Anthropic. VerbalCoding l'invoque via `claude -p` : un tour vocal = une invocation. `-p` n'expose pas de contrat stable de reprise — chaque tour repart sur un contexte vierge. Utilisez `AGENT_PROJECT_CONTEXT` et le bloc de handoff inter-agents pour la continuité.

## Installation

```bash
npm install -g @anthropic-ai/claude-code
claude login
claude -p "hello"
```

## Configuration

```bash
# .env
AGENT_BACKEND=claude
CLAUDE_COMMAND="claude -p"
AGENT_PROJECT_CONTEXT="Module auth en cours ; décisions : oauth=github."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
AGENT_VERBOSE_PROGRESS=0
```

`AGENT_SESSION_FILE` n'est pas utilisé pour ce harness (Claude `-p` est stateless).

## Ce que reçoit Claude par tour

À chaque tour, l'adaptateur préfixe : préambule Discord (en/fr selon `VOICE_LANGUAGE`), contexte projet, contexte texte récent, puis la transcription. Lors d'un handoff inter-agents, on ajoute une ligne "Recent user voice" (jusqu'à 4 énoncés) et les décisions de plan résolues les plus récentes, pour éviter le démarrage à froid.

## Progression verbeuse

Claude Code n'émet pas de stream standard via `-p`. Avec `AGENT_VERBOSE_PROGRESS=1`, l'adaptateur extrait les mentions d'outils/fichiers/web de stdout/stderr — granularité plus grossière qu'Hermes.

## Phrases vocales pour basculer vers Claude Code

- en: `"switch to Claude Code"`, `"ask Claude ..."`, `"let Claude finish this"`
- fr: `"passe à Claude"`, `"demande à Claude"`

Le matcher accepte `claude` et `claude code`. Le mode strict du routage exige une correspondance exacte.

## Pièges

- **Pas de reprise.** Les sessions longues s'appuient sur le bloc de handoff ; à l'intérieur d'un même backend, fournissez un résumé via `AGENT_PROJECT_CONTEXT`.
- **Chemins entre guillemets.** Si `CLAUDE_COMMAND` contient un chemin absolu avec espaces (ex. `"/Applications/Claude Code/claude" -p`), la sonde d'installation utilise `shellSplit` et respecte les guillemets.
- **Expiration d'auth.** L'expiration `claude login` ressort en exit non-nul ; le bridge signale et propose un fallback si Claude n'était pas le défaut.
- **Sortie type patch.** Si Claude est interrompu en plein diff, le bridge ne lit pas le diff — il annonce "interrompu, vérifiez le canal texte".

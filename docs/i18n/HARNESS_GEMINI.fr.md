# Gemini CLI — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

Gemini CLI est l'agent terminal de Google. VerbalCoding l'invoque via `gemini -p`. Un tour vocal = un appel ; pas de reprise entre appels.

## Installation

Suivez le guide officiel, puis vérifiez :

```bash
gemini -p "hello"
```

## Configuration

```bash
# .env
AGENT_BACKEND=gemini
GEMINI_COMMAND="gemini -p"
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Phrases vocales pour basculer vers Gemini

- en: `"switch to Gemini"`, `"ask Gemini ..."`, `"switch to Gemini CLI"`
- fr: `"passe à Gemini"`, `"demande à Gemini"`

Alias : `gemini`, `gemini cli`, `gemini-cli`.

## Pièges

- **Pas de reprise.** Même stratégie que Claude/Codex : `AGENT_PROJECT_CONTEXT` + bloc de handoff.
- **Réponses longues.** Gemini renvoie parfois de grands blocs structurés ; le sentencer les découpe. Les blocs de code sont retirés de la voix (canal texte conserve le code).
- **Clé API.** Une erreur d'auth ressort en exit non-nul ; fallback proposé si Gemini n'était pas le défaut.
- **Progression verbeuse.** Gemini ne sort pas de previews `┊` à la Hermes ; la progression dépend principalement du summarizer LLM.

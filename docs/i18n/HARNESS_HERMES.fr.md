# Hermes Agent — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

Hermes Agent est le backend par défaut de VerbalCoding et le seul harness disposant d'un vrai contrat de reprise de session — le contexte entre les tours reste propre. Comparaison avec le `/voice` intégré d'Hermes dans [HERMES_VOICE.fr.md](./HERMES_VOICE.fr.md).

## Installation

Guide officiel : <https://hermes-agent.nousresearch.com>. Vérifiez d'abord le CLI :

```bash
hermes chat -Q -q "hello"
```

## Configuration

```bash
# .env
AGENT_BACKEND=hermes
HERMES_COMMAND="hermes chat -Q -q"
HERMES_HOME=/Users/you/.hermes
HERMES_PROJECT_CONTEXT="Project session: ..."
HERMES_TASK_TIMEOUT_MS=0
HERMES_CHAT_TIMEOUT_MS=45000
HERMES_WORKDIR=/Users/you/code/your-project
```

Le fichier de session est dans `<repo>/.verbalcoding-session` par défaut (`HERMES_SESSION_FILE` pour surcharger).

## Reprise de session

Hermes est le seul adaptateur intégré avec reprise. Après chaque tour réussi, l'adaptateur écrit le nouveau `session_id` et préfixe `--resume <id>` au prochain appel. `!session reset` efface.

Si un tour est abort avant que Hermes n'émette `session_id:` sur stderr, l'adaptateur lit `~/.hermes/sessions/session_<id>.json` pour retrouver le dernier message assistant.

## Progression verbeuse

En mode verbeux, l'adaptateur retire `-Q` pour que stdout émette les aperçus `┊ <emoji> <tool>`, résumés en événements de progression (lecture de fichiers, web, terminal). Sans verbeux, seule la réponse finale du cadre est vocale.

## Phrases vocales pour basculer vers Hermes

- en: `"switch to Hermes"`, `"ask Hermes ..."`
- fr: `"passe à Hermes"`, `"demande à Hermes"`

## Pièges

- Le préfixe TTS de handoff est localisé : `"Hermes says: "` / `"Hermes : "`.
- `HERMES_HOME` est le bouton d'isolation projet le plus utilisé ; typiquement `HERMES_HOME=/Users/you/.hermes/profiles/<project>` dans `.env`.
- En verbeux, si Hermes termine sur une boîte vide (timeout), l'adaptateur fouille le JSON de session avant d'abandonner.

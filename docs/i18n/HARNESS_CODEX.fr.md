# Codex — Notes Harness

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="HARNESSES.fr.md">Harnesses</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a>
</p>

Codex CLI est l'agent terminal d'OpenAI. VerbalCoding l'invoque via `codex exec`. Comme `codex exec` écrit le texte final assistant dans un fichier temp si on lui passe `--output-last-message <path>`, l'adaptateur insère ce flag automatiquement et lit la réponse depuis le fichier même si stdout est bruyant.

## Installation

```bash
npm install -g @openai/codex
codex login                     # ou OPENAI_API_KEY headless
codex exec "hello"
```

## Configuration

```bash
# .env
AGENT_BACKEND=codex
CODEX_COMMAND="codex exec"
AGENT_PROJECT_CONTEXT="Ce qu'on fait, ce qui est déjà tranché."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

`AGENT_SESSION_FILE` est inutilisé (Codex `exec` est stateless).

## Capture de sortie

Pour Codex, l'adaptateur :

1. Génère `verbalcoding-codex-last-<pid>-<ts>.txt` dans `os.tmpdir()`.
2. Insère `--output-last-message <path>` juste avant l'argument final.
3. Après exécution, lit ce fichier comme réponse de référence (prioritaire sur stdout).
4. Supprime le fichier temp.

Même si Codex pollue stdout, la voix joue toujours la réponse capturée.

## Phrases vocales pour basculer vers Codex

- en: `"switch to Codex"`, `"ask Codex what it thinks"`
- fr: `"passe à Codex"`, `"demande à Codex"`

## Pièges

- **Tâches longues.** Mettez `AGENT_TASK_TIMEOUT_MS=0` pour la génération sur plusieurs minutes ; `signal.aborted` est respecté, le barge-in coupe net.
- **Pas de reprise.** Continuité via `AGENT_PROJECT_CONTEXT` et bloc de handoff.
- **Sortie type patch.** En cas d'interruption durant un diff, on annonce "interrompu" sans lire le diff.
- **Auth.** Un 401 ressort en exit non-nul ; fallback vers le défaut si Codex n'était pas le défaut.

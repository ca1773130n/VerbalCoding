# Harnesses d'agents de codage

<p align="center">
  <a href="../../README.fr.md">README</a> ·
  <a href="README.fr.md">Docs hub</a> ·
  <a href="USAGE.fr.md">Utilisation</a> ·
  <a href="CONFIGURATION.fr.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.fr.md">Dépannage</a>
</p>

VerbalCoding est agnostique : il pilote le CLI de codage installé chez vous, un appel par tour vocal, en lui passant la transcription comme prompt et en jouant la réponse. Choisissez **un** agent par défaut ; le routage par voix permet d'atteindre les autres en cours de session.

| Harness | Commande par défaut | Reprise de session | Doc dédiée |
|---|---|---|---|
| Hermes Agent | `hermes chat -Q -q` | ✅ (`--resume <id>`) | [HERMES_VOICE.fr.md](./HERMES_VOICE.fr.md) · [HARNESS_HERMES.fr.md](./HARNESS_HERMES.fr.md) |
| Claude Code | `claude -p` | ❌ | [HARNESS_CLAUDE.fr.md](./HARNESS_CLAUDE.fr.md) |
| Codex | `codex exec` | ❌ (capture du dernier message) | [HARNESS_CODEX.fr.md](./HARNESS_CODEX.fr.md) |
| Gemini CLI | `gemini -p` | ❌ | [HARNESS_GEMINI.fr.md](./HARNESS_GEMINI.fr.md) |
| OpenCode | `opencode run` | ❌ | [HARNESS_OPENCODE.fr.md](./HARNESS_OPENCODE.fr.md) |
| OpenClaw | `openclaw run` | ❌ | [HARNESS_OPENCLAW.fr.md](./HARNESS_OPENCLAW.fr.md) |
| Aider | `aider --no-pretty --yes-always --message` | ❌ | [HARNESS_AIDER.fr.md](./HARNESS_AIDER.fr.md) |
| Cursor CLI | `cursor-agent --print --prompt` | ❌ | [HARNESS_CURSOR.fr.md](./HARNESS_CURSOR.fr.md) |

## Choisir l'agent par défaut

`vc setup` détecte les binaires installés et propose un choix. Sans interaction :

```bash
# .env ou instance .env
AGENT_BACKEND=claude              # hermes | claude | codex | gemini | opencode | openclaw | aider | cursor | custom
```

Chaque harness lit sa commande dans l'env homonyme (`HERMES_COMMAND`, `CLAUDE_COMMAND`, etc.). Les envs partagées (`AGENT_LABEL`, `AGENT_COMMAND`, `AGENT_SESSION_FILE`, `AGENT_WORKDIR`, `AGENT_PROJECT_CONTEXT`, `AGENT_TASK_TIMEOUT_MS`, `AGENT_CHAT_TIMEOUT_MS`, `AGENT_VERBOSE_PROGRESS`) surchargent les valeurs par défaut.

## Routage entre harnesses par voix

Une fois configuré, vous atteignez n'importe quel harness **installé** sans redémarrer :

- `"ask Codex what it thinks"` — routage à un tour ; le tour suivant revient au défaut.
- `"switch to Aider"` — routage sticky jusqu'à `"back to default"`.
- Slot `which_agent` du mode plan — l'agent propose lui-même quel backend exécute le plan.

Le routeur vérifie la présence du binaire dans `PATH` (les chemins relatifs sont résolus contre le workdir de la session projet active). Sinon, il demande `"Utiliser l'agent par défaut à la place ?"` — `"yes"` pour le fallback, `"no"` pour annuler.

Alias reconnus : `claude` / `claude code`, `codex`, `gemini` / `gemini cli`, `opencode`, `openclaw`, `aider`, `cursor` / `cursor cli`, `hermes`.

## Sémantique partagée

Tous les adaptateurs respectent :

- **Mode plan vocal** — `"plan it first"` narre un plan, édition vocale, `"approve"` exécute via le harness choisi.
- **Barge-in** — l'interruption coupe le TTS courant et abort la tâche de l'agent. Le routage sticky survit aux interruptions ; seuls les routages à un tour sont effacés.
- **Progression verbeuse** — `AGENT_VERBOSE_PROGRESS=1` affiche les événements ; avec `SMART_PROGRESS_API_KEY`, un LLM les résume.
- **Push notification** — `NOTIFY_PROVIDER=ntfy|pushover` + `NOTIFY_MIN_TASK_MS` envoie un push quand une tâche longue se termine et que le canal vocal est vide ; debounce par corps + `NOTIFY_DEBOUNCE_MS`.
- **État par canal** — chaque canal vocal Discord conserve son routage, son état de plan, son buffer d'énoncés.
- **Sessions projet** — `!session new <name> <workdir>` lie un canal à un projet ; les adaptateurs (harness, session) sont cachés et invalidés au rebind.

Détails d'installation et pièges par harness dans leurs docs respectifs. Référence env complète : `docs/CONFIGURATION.fr.md`.

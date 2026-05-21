# Guide du dépôt (français)

> Ce fichier est un résumé français de [`AGENTS.md`](../../AGENTS.md). Les règles formelles restent dans l'original anglais.

VerbalCoding est un pont vocal Discord pour les agents de codage. Le runtime est l'implémentation Node sous `app-node/`, lancée via `run.sh` ou le CLI `vc`.

## Développement

- Dans les docs et exemples, préférez `vc ...` à `npm run vc -- ...`.
- Les secrets locaux vivent dans `.env` ou `instances/*.env`; ne commitez jamais de vrais tokens Discord, IDs de salon, fichiers de session, échantillons vocaux, poids de modèle, virtualenvs, logs ni caches.
- Modifiez les fichiers source, pas les artefacts générés.
- Exemples publics-safe : placeholders pour chemins locaux, IDs utilisateur, IDs Discord, tokens.

## Vérification

Avant de signaler un changement comme terminé, exécutez:

```bash
npm test
```

## Cartographie des modules

Détail dans [`AGENTS.md`](../../AGENTS.md). Modules clés :

- `main.mjs` — dispatcher Discord / voix / agent
- `agent_routing.mjs` — routage inter-agent par voix
- `plan_mode.mjs` — mode plan vocal (slot `which_agent`)
- `session_ontology.mjs` — graphe typé par salon (handoff)
- `research_mode.mjs` — commande `"research X"`

## Bloc géré

HarnessSync synchronise les règles de `CLAUDE.md` dans `AGENTS.md`. Ne pas éditer manuellement ce bloc.

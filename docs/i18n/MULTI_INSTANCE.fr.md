# VerbalCoding multi-instance


## Flux setup actuel

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

Ne modifiez pas `.env` à la main : utilisez `vc setup token` pour enregistrer `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`, et `vc setup channels` pour `AUTO_JOIN_VOICE_CHANNELS`. Si Docker affiche `Cannot perform IP discovery - socket closed`, utilisez `network_mode: "host"` avec Compose sous Linux et supprimez `ports:`.

VerbalCoding peut exécuter plusieurs processus indépendants de passerelle vocale Discord. Chaque processus reste la passerelle Node à instance unique existante, mais il charge un fichier `instances/<name>.env` différent et utilise un jeton de bot Discord différent.

Utilisez ceci quand chaque projet doit occuper de façon permanente son propre salon vocal Discord et écrire dans son propre salon/fil de transcription.

## Pourquoi plusieurs jetons de bot sont nécessaires

La résidence vocale Discord correspond en pratique à une connexion vocale active par compte bot et par guilde. Si un jeton de bot rejoint un autre salon vocal dans la même guilde, il ne peut pas aussi rester connecté en permanence au salon précédent. Pour des salons de projet simultanés, créez une application/un bot Discord par projet.

## Organisation des fichiers

```text
instances/
  README.md
  example.env
  llm-wiki.env        # local only, ignored by git
  verbalcoding.env    # local only, ignored by git
.run/instances/
  llm-wiki.pid        # runtime only, ignored by git
```

Les vrais fichiers `instances/*.env` sont ignorés car ils peuvent contenir des jetons Discord. `instances/example.env` est le modèle commité.

## Assistant de configuration d'instance

Les utilisateurs ne doivent pas copier et modifier manuellement les fichiers env pour un usage normal. Lancez plutôt l'assistant :

```bash
vc instance setup llm-wiki
# or through the project setup script:
./scripts/install.sh --instance llm-wiki
```

L'assistant demande le jeton du bot, l'ID Application/Client Discord, le salon vocal, la cible de transcription, le workdir, le contexte de projet et les chemins d'exécution isolés. Il écrit `instances/<name>.env` avec le mode `0600`, sauvegarde un fichier existant avant de l'écraser et imprime les prochaines commandes de démarrage/statut.

Si vous saisissez l'ID Application/Client Discord pendant la configuration, le résumé imprime aussi l'URL d'invitation de ce bot. Vous pouvez générer la même URL à tout moment avec :

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

Discord exige toujours une application/un bot Developer Portal par salon vocal simultané, mais cela évite de construire manuellement des URL OAuth ou des entiers de permissions.

### Isolation des profils Hermes

Chaque instance reçoit son propre dossier Hermes à `~/.hermes/profiles/<name>` afin que la mémoire, MEMORY.md, SOUL.md et les skills appris ne fuient pas entre projets.

`vc instance setup <name>` automatiquement :

- exécute `hermes profile create <name> --clone-from default` (reprend les clés API
  et le modèle de votre `~/.hermes` actuel ; les sessions et la mémoire repartent de zéro),
- définit le `terminal.cwd` du nouveau profil sur le workdir de l'instance,
- initialise `<profile>/SOUL.md` depuis la réponse de contexte de projet de l'assistant,
- écrit `HERMES_HOME=...` dans `instances/<name>.env`.

`vc instance start <name>` s'auto-répare : si l'env pointe vers un répertoire de profil Hermes qui n'existe plus, la commande start le recrée avant le lancement.

Les noms d'instance doivent correspondre à `^[a-z0-9][a-z0-9_-]{0,63}$`, car Hermes utilise le nom comme répertoire et clé de configuration.

## Env minimal généré pour une instance

```env
INSTANCE_NAME=my-project
DISCORD_TOKEN=replac...oken
DISCORD_CLIENT_ID=123456789012345678
AUTO_JOIN_VOICE_CHANNELS=Project Room
TRANSCRIPT_CHANNEL_ID=123456789012345678
PROJECT_SESSIONS_FILE=config/project-sessions.my-project.json
BRIDGE_LOG_PATH=/tmp/verbalcoding-my-project.log
NODE_AUDIO_DEBUG_DIR=/tmp/verbalcoding-my-project-debug
HERMES_SESSION_FILE=.agent-sessions/hermes/my-project.session
HERMES_HOME=/home/you/.hermes/profiles/my-project
AGENT_LABEL=VerbalCoding · My Project
AGENT_CWD=/path/to/my-project
AGENT_PROJECT_CONTEXT=Project session: My Project
```

Donnez à chaque instance des valeurs uniques pour les fichiers de journal/debug/session. `HERMES_HOME` et le répertoire correspondant `~/.hermes/profiles/<name>` sont créés automatiquement par `vc instance setup`. `vc doctor` vérifie les jetons dupliqués, les chemins d'exécution en collision, les répertoires de profil manquants et les divergences de `terminal.cwd` entre profil et instance — le tout sans imprimer de secrets.

## Commandes

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

`start` exécute `./run.sh instances/<name>.env` en mode détaché et écrit `.run/instances/<name>.pid`.

`stop` envoie `SIGTERM`, attend jusqu'à 10 secondes, puis bascule vers `SIGKILL` et supprime le fichier pid.

## Exemple : deux salons vocaux permanents

1. Créez deux applications/bots Discord :
   - bot VerbalCoding
   - bot LLM-Wiki

2. Invitez les deux sur le serveur avec permissions texte et voix :
   - Voir le salon
   - Envoyer des messages
   - Envoyer des messages dans les fils
   - Lire l'historique des messages
   - Utiliser les commandes d'application
   - Se connecter
   - Parler

   Utilisez `vc bot invite <client-id>` après avoir créé chaque application Discord pour imprimer l'URL d'invitation exacte avec ces permissions.

3. Lancez l'assistant de configuration pour chaque instance locale :

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

L'assistant écrit les fichiers ignorés `instances/verbalcoding.env` et `instances/llm-wiki.env` avec le mode `0600` ; il sauvegarde aussi l'env d'une instance existante avant de le remplacer. Chaque exécution crée également `~/.hermes/profiles/<name>` cloné depuis votre dossier Hermes par défaut, afin que les deux instances démarrent avec la même auth/le même modèle mais accumulent mémoire et skills indépendants à mesure qu'elles apprennent chaque projet.

4. Vérifiez la configuration :

```bash
vc doctor
```

5. Démarrez les deux :

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. Vérifiez les journaux :

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

Lignes de journal attendues :

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. Arrêtez les deux :

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## Liaison texte/voix de courte durée avec un seul bot

Si vous n'avez qu'un seul jeton de bot, utilisez plutôt la liaison vocale de session de projet au lieu d'une résidence multi-salons simultanée.

Exécutez ceci dans le salon/fil texte cible :

```text
!session attach-voice --voice "LLM-Wiki"
```

Comportement :

- Lie le salon vocal sélectionné au salon/fil texte actuel.
- Si le salon texte actuel n'a pas de session de projet, crée une session isolée ad hoc.
- Le texte STT/résultat/progression/réponse finale de la voix est routé vers cette cible de transcription de projet active.

Pour attacher une session de projet nommée existante :

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

C'est pratique pour le routage, mais cela ne fait pas rester un même bot dans deux salons vocaux en même temps. Utilisez plusieurs jetons/processus de bots pour une résidence permanente simultanée.

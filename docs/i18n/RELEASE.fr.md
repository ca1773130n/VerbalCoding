# Notes de version de VerbalCoding


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

## Candidat de version actuel

VerbalCoding est une passerelle vocale Discord pour contrôler par la voix des agents de codage basés sur CLI. Il vise une publication publique, avec macOS / Apple Silicon comme chemin le plus testé et une prise en charge d'amorçage Linux au mieux pour les gestionnaires de paquets courants.

### Inclus

- Réception vocale Discord via Node `@discordjs/voice`.
- STT coréen local via `whisper.cpp` + Metal.
- Lecture Edge TTS avec voix coréenne par défaut.
- Couche générique d'adaptateur de harnais CLI :
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - commande personnalisée
- Prise en charge de session voix/texte partagée pour le backend Hermes.
- Découpage TTS des longues réponses et interruption réactive.
- Garde-fous diff/code/journaux pour que les grandes sorties techniques ne soient pas lues à voix haute.
- Modes de sensibilité normal et conservateur pour usage intérieur vs bruyant/extérieur.
- Assistant de configuration, `.env.example`, vérificateur de prérequis `vc doctor` et amorçage `./scripts/install.sh --yes` pour les paquets OS, les dépendances npm, l'assistant Edge TTS et le modèle whisper.cpp par défaut.
- Chemin d'installation par paquet npm : `npm install -g verbalcoding`, `vc setup --yes` et `vc start`.
- Mode de progression détaillée facultatif pour les mises à jour textuelles d'étapes intermédiaires pendant les longs travaux d'agent.
- Métriques de latence JSONL toujours actives plus résumé `!latency` / `!metrics` pour l'optimisation du pipeline.
- Attente d'inactivité d'énonciation plus patiente (`UTTERANCE_IDLE_MS=4500`) afin que les longues instructions parlées avec pauses naturelles ne soient pas coupées en prompt partiel plus parole ignorée pendant le traitement.
- Isolation multi-instance des profils Hermes : `vc instance setup <name>` clone automatiquement un profil Hermes vers `~/.hermes/profiles/<name>` avec le workdir de l'instance, initialise SOUL.md et écrit `HERMES_HOME` dans l'env de l'instance afin que la mémoire et les skills par projet restent séparés ; `vc instance start` répare automatiquement un profil manquant, et `vc doctor` vérifie la présence du répertoire de profil et la cohérence de `terminal.cwd`.

### Checklist de pré-version

Exécutez depuis la racine du dépôt :

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # requires Docker; validates ubuntu:24.04 clean install
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # ok when no Python tests exist
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

Smoke test manuel :

1. Démarrez la passerelle avec `vc start` ou `./run.sh`.
2. Vérifiez que le journal contient `Logged in as <bot-name>`.
3. Vérifiez que le journal contient `Listening in voice channel ... / 일반` ou le salon par défaut configuré.
4. Dans Discord, exécutez `!ping`.
5. Dans la voix Discord, dites une courte demande en coréen.
6. Vérifiez la transcription STT, la réponse de l'agent, la lecture TTS et le comportement d'interruption.

### Exigences connues

- macOS avec Homebrew, ou Linux avec `apt`, `dnf` ou `pacman` pour l'amorçage au mieux.
- `ffmpeg` ; l'installateur tente de l'installer.
- `whisper-cli` ; l'installateur utilise Homebrew sur macOS ou un fallback de build local `vendor/whisper.cpp` sur Linux.
- Modèle par défaut à `models/ggml-small-q5_1.bin` ; l'installateur le télécharge sauf si `--skip-model` est utilisé.
- CLI Edge TTS dans `PATH` ou `.venv-tts/bin/edge-tts` local ; l'installateur crée l'assistant local si nécessaire.
- Jeton de bot Discord dans `.env`, `instances/<name>.env`, `~/.zshrc` ou l'env d'exécution.
- Harnais CLI sélectionné installé et authentifié.

### Pas encore prêt pour la publication publique

Avant la publication publique, envisagez d'ajouter :

- CI GitHub Actions.
- Vidéo / GIF de démonstration.
- Captures d'écran de configuration du bot Discord.
- Validation Linux plus large sur de vraies distributions au-delà des contrôles au niveau des scripts.
- Revue de sécurité de tous les chemins de journalisation.

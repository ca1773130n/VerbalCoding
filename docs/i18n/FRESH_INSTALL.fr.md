# Installation propre

Ce guide couvre une installation publique propre. Il évite les hypothèses propres à une machine locale et utilise l'installateur pour amorcer autant d'éléments que possible.

## 1. Installer la CLI

Chemin npm recommandé :

```bash
npm install -g verbalcoding
```

Ou exécutez directement le paquet publié :

```bash
npx verbalcoding setup --yes
```

Si vous avez utilisé `npm install -g`, continuez avec :

```bash
vc setup --yes
```

Chemin de clonage GitHub pour les contributeurs :

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. Amorcer les dépendances et lancer l'assistant de configuration

Pour une installation npm, n'exécutez pas `./scripts/install.sh` directement : il n'y a pas de checkout du dépôt dans votre répertoire courant. Utilisez plutôt l'enveloppe CLI empaquetée :

```bash
vc setup --yes
```

`vc setup` exécute le `scripts/install.sh` inclus dans le paquet npm installé. N'utilisez `./scripts/install.sh --yes` que lorsque vous êtes dans un clone GitHub :

```bash
./scripts/install.sh --yes
```

Ce que cela fait :

- installe les dépendances npm quand `node_modules/` est absent,
- installe la commande shell courte `vc` avec `npm link`,
- installe `ffmpeg`, Node/npm et `whisper-cli` quand le gestionnaire de paquets de l'OS le permet,
- télécharge `models/ggml-small-q5_1.bin`,
- crée `.venv-tts` et installe `edge-tts` quand `edge-tts` n'est pas déjà dans `PATH`,
- lance l'assistant interactif `.env`.

Chemins d'amorçage système pris en charge :

| OS | Chemin pour les dépendances système |
|---|---|
| macOS | Homebrew : `brew install node ffmpeg whisper-cpp` selon les besoins |
| Debian/Ubuntu | `apt-get` pour Node/npm, ffmpeg, Python, outils de build ; fallback de build whisper.cpp local |
| Fedora/RHEL | `dnf` pour Node/npm, ffmpeg, Python, outils de build ; fallback de build whisper.cpp local |
| Arch | `pacman` pour Node/npm, ffmpeg, Python, outils de build ; fallback de build whisper.cpp local |

Variantes utiles de l'installateur :

```bash
vc setup --yes --no-wizard                   # dépendances/amorcage seulement depuis l'installation npm
./scripts/install.sh --yes --no-wizard       # dépendances/amorcage seulement depuis un clone
./scripts/install.sh --skip-system           # ne pas installer de paquets OS
./scripts/install.sh --skip-model            # ne pas télécharger le modèle STT par défaut
./scripts/install.sh --skip-edge-tts         # ne pas créer .venv-tts
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

Si votre OS n'est pas pris en charge, installez manuellement ces éléments avant de relancer :

- Node.js 20+ et npm
- ffmpeg
- Python 3 avec venv/pip
- `whisper-cli` de whisper.cpp
- un backend d'agent CLI authentifié, Hermes Agent par défaut

## 3. Configuration de l'application Discord

Lisez d'abord les guides amont de configuration d'un bot Discord si c'est votre premier bot :

- Guide de messagerie Discord de Hermes Agent : <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Vue d'ensemble officielle des bots Discord : <https://docs.discord.com/developers/bots/overview>
- Guide officiel de démarrage Discord : <https://docs.discord.com/developers/quick-start/getting-started>

Ces pages montrent comment créer une application Discord, ajouter un utilisateur bot, activer les intents privilégiés et l'inviter sur un serveur. VerbalCoding utilise la même configuration de bot Discord, puis ajoute par-dessus la réception vocale, le STT, l'exécution d'agent CLI et la lecture TTS.

1. Créez une application Discord et un bot dans le portail développeur Discord.
2. Activez l'intent privilégié Message Content.
3. Copiez le jeton du bot dans l'invite de l'installateur ou dans `.env` en tant que `DISCORD_BOT_TOKEN`.
4. Générez une URL d'invitation :

```bash
vc bot invite <discord-client-id>
# or pin it to one server:
vc bot invite <discord-client-id> --guild <guild-id>
```

L'invitation inclut les scopes bot et commandes slash ainsi que les permissions texte/voix utilisées par VerbalCoding.

## 4. Vérifier

```bash
vc doctor
```

`vc doctor` est expurgé : il signale les jetons/commandes/modèles manquants sans imprimer de valeurs secrètes. Corrigez chaque élément `✗`, puis relancez-le.

Un succès attendu ressemble à :

```text
✓ Node.js
✓ npm
✓ ffmpeg
✓ whisper-cli
✓ whisper.cpp model
✓ Discord bot token configured — [REDACTED]
✓ edge-tts
✓ hermes CLI
Doctor passed. Run vc start to start VerbalCoding.
```

Si l'installateur a créé un assistant Edge TTS local, `.env` doit contenir un chemin `EDGE_TTS_COMMAND` pointant vers `.venv-tts/bin/edge-tts`.

## 5. Lancer le bot par défaut unique

```bash
vc start
# or, from a GitHub clone:
./run.sh
```

Les journaux d'un démarrage réussi incluent :

```text
Logged in as <bot-name>
Listening in voice channel <server> / <channel>
```

Dans Discord :

```text
!ping
!join
!ask say hello briefly
!verbose on
```

Parlez ensuite dans le salon vocal configuré. Vous devriez voir le texte STT, le texte de progression quand le mode détaillé est activé, une réponse texte finale et entendre la lecture TTS.

## 6. Configuration un projet par salon

Pour un bot permanent par salon vocal de projet, créez une application Discord par projet, puis :

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

Chaque instance écrit un fichier ignoré `instances/<name>.env` avec son propre jeton, salon vocal, cible de transcription, chemin de journal, fichier de session Hermes et profil Hermes facultatif.

## 7. Configuration OpenVoice facultative

Le clonage vocal OpenVoice est facultatif. Gardez `TTS_BACKEND=edge` pour une nouvelle installation publique. Pour activer OpenVoice plus tard :

```bash
./scripts/setup_openvoice.sh
# Download OpenVoice V2 checkpoints into vendor/OpenVoice/checkpoints_v2/
# Add a permitted local sample at voice-samples/user-reference.wav,
# or run the bot, say "목소리 샘플 녹음 시작해", then speak 10-30 seconds.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

Définissez ensuite `TTS_BACKEND=openvoice`, exécutez `vc doctor` et testez `!voice-test <text>` dans Discord.

## 8. Smoke test de clone propre pour les mainteneurs

Smoke test rapide sur l'hôte uniquement :

```bash
TMPDIR=$(mktemp -d)
git clone https://github.com/ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
cp .env.example .env
chmod 600 .env
vc doctor || true
```

L'échec attendu à ce stade est l'absence de secrets locaux ou d'authentification de la CLI d'agent, et non une fuite de jetons ou des scripts d'installation manquants.

Smoke test d'installation propre Ubuntu basé sur Docker :

```bash
./scripts/docker_ubuntu_smoke.sh
```

Cela lance `ubuntu:24.04`, copie l'arborescence suivie du dépôt dans un conteneur propre, exécute `./scripts/install.sh --yes --no-wizard`, écrit un `.env` de smoke test sans secret, vérifie `vc`, lance les tests Node et vérifie `vc doctor`. Il ne se connecte pas à la voix Discord ; utilisez une vraie VM Ubuntu ou WSL2 après cela si vous avez besoin d'un test de bout en bout dans un salon vocal.

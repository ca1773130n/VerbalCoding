# VerbalCoding

<p align="center"><strong>Parlez à des agents de code CLI depuis Discord vocal, comme lors d’un appel.</strong></p>

<p align="center"><a href="./README.md">English</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.zh.md">中文</a> · <a href="./README.es.md">Español</a> · <a href="./README.ru.md">Русский</a></p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20SpeechSwift-0EA5E9">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Pourquoi ce projet existe

VerbalCoding transforme un salon vocal Discord en poste de pilotage mains libres pour agents de code. Dictez une demande, laissez le CLI travailler, puis recevez une réponse vocale concise avec transcription et progression. Les diffs et logs ne sont pas lus longuement par TTS.

> **Vous utilisez déjà Hermes Agent ?** Hermes prend déjà en charge les salons vocaux Discord via `/voice join` / `/voice channel` : il peut rejoindre votre VC, transcrire avec Whisper et répondre en TTS. Pour cette boucle de base, VerbalCoding n’est pas obligatoire. VerbalCoding ajoute une couche de workflow : routage projet/session, contexte voix+texte partagé, règles d’interruption, annonces de progression, préréglages de langue, métriques de latence et changement de backend CLI au-delà de Hermes.

## Ce qui change

| Capacité | Pourquoi c’est utile |
|---|---|
| Flux type appel | Parler, écouter, interrompre et continuer dans le même salon vocal Discord. |
| Configuration guidée | `vc setup` couvre prerequisites, Discord token/client ID, voice channel, transcript target, backend et TTS settings en un seul flux. |
| Boucle vocale locale | Discord audio → local `whisper-cli` → selected CLI agent → TTS reply. |
| Choix de l’agent | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw ou custom command. |
| Au-delà de la voix intégrée de Hermes | Garde la même boucle vocale VC, puis ajoute salons de projet, contexte partagé `!ask`, interruptions réglées, annonces progression/état et contrôle de backends multiagents. |
| Exploitation réelle | doctor auto-fix, guide Docker UDP, latency metrics, multi-instance rooms et redacted config checks inclus. |

## Démarrage rapide

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

`vc setup` est le parcours normal pour une personne. Gardez Discord Developer Portal ouvert pendant la saisie du bot token, application/client ID, transcript target et voice channel names.

En automatisation, vous pouvez ignorer les prompts puis renseigner Discord ensuite.

```bash
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
vc doctor
```

## Discord en une minute

1. Créez une application et un bot dans Discord Developer Portal.
2. Activez Message Content privileged intent.
3. Lancez `vc setup` et collez bot token et application/client ID.
4. Saisissez les noms exacts des voice channels à rejoindre.
5. Invitez le bot avec ces commandes.

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

## Carte rapide des commandes

```bash
vc setup                                 # configuration guidée: prerequisites, Discord, backend, voice
vc setup --yes                           # bootstrap/starter config non interactive
vc setup token                           # modifier ou ajouter Discord bot token/client ID plus tard
vc setup channels "General,Team Voice"   # mettre à jour auto-join voice channel names
vc bot invite CLIENT_ID                  # générer Discord bot invite URL
vc status                                # afficher les réglages actuels
vc language ko|en|auto                   # changer language preset
vc doctor                                # redacted health check et auto-fixes
vc start                                 # démarrer le bridge par défaut
vc instance setup NAME                   # créer un project voice bot isolé
vc instance start NAME                   # exécuter ce bot en background
```

## En savoir plus

| Guide | Contenu |
|---|---|
| [Centre de documentation](docs/i18n/README.fr.md) | Index des guides localisés. |
| [Fresh Install](docs/i18n/FRESH_INSTALL.fr.md) | npm/global setup, configuration Discord, premier lancement. |
| [Usage](docs/i18n/USAGE.fr.md) | Commandes CLI, commandes Discord, modes d’exécution, latency. |
| [Voix intégrée Hermes vs VerbalCoding](docs/i18n/HERMES_VOICE.fr.md) | La voix Discord déjà fournie par Hermes et la différence VerbalCoding. |
| [Configuration](docs/i18n/CONFIGURATION.fr.md) | .env, agent backends, MCP, TTS, exploitation. |
| [Troubleshooting](docs/i18n/TROUBLESHOOTING.fr.md) | Docker UDP et vérifications token/channel. |
| [Multi-Instance](docs/i18n/MULTI_INSTANCE.fr.md) | Un salon vocal fixe par projet. |

## Exigences

| Couche | Défaut |
|---|---|
| Runtime | Node.js 20+ et npm. |
| Audio | `ffmpeg` et local `whisper-cli`. |
| TTS | Edge TTS par défaut; OpenVoice, SpeechSwift/CosyVoice et Supertonic en option. |
| Discord | Bot token, Message Content intent, voice permissions et channel names correspondants. |
| Agent | Au moins un CLI harness authentifié; Hermes Agent par défaut. |

## Note Docker / conteneurs

Si les logs affichent `Cannot perform IP discovery - socket closed`, Discord voice UDP est bloqué. Avec Linux Docker Compose, utilisez:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Ne combinez pas `network_mode: "host"` avec `ports:`.

## Contribuer

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## Statut

VerbalCoding vise une publication publique mais reste jeune. Vidéo/GIF de démo, validation Linux plus large, CI et revue sécurité restent TODO.

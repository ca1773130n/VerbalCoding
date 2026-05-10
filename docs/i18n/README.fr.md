# VerbalCoding

<p align="center">
  <strong>Parlez à vos agents de codage CLI via la voix Discord — comme un appel téléphonique pour le travail logiciel.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="TTS" src="https://img.shields.io/badge/TTS-Edge%20%7C%20OpenVoice%20%7C%20Supertonic%20%7C%20SpeechSwift-0EA5E9">
  <img alt="Agents" src="https://img.shields.io/badge/Agents-Hermes%20%7C%20Claude%20%7C%20Codex%20%7C%20Gemini%20%7C%20OpenCode-111827">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="Flux voix-vers-agent de VerbalCoding" width="860">
</p>

## Pourquoi

VerbalCoding transforme un salon vocal Discord en surface de contrôle mains libres pour agents de codage. Énoncez une demande, laissez votre agent CLI travailler, puis écoutez une réponse concise — avec transcriptions texte, événements de progression et garde-fous pour les sorties de code/journaux bruyantes.

## Points forts

| Ce que vous obtenez | Pourquoi c'est agréable |
|---|---|
| Contrôle d'agent pensé pour la voix | Parlez à Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw ou à n'importe quel harnais CLI personnalisé. |
| Boucle vocale sur l'appareil | Capture vocale Discord → transcription locale `whisper-cli` → agent → lecture TTS par morceaux. |
| Contexte partagé voix + texte | Les tours vocaux et les commandes texte `!ask` peuvent réutiliser la même session d'agent prise en charge. |
| Interruption et modes de sensibilité | Interrompez naturellement la lecture et basculez entre environnements normaux et conservateurs/bruyants. |
| Préréglages vocaux multilingues | Changez ensemble la langue STT, la langue de progression et la voix TTS avec `vc language ko/en/auto`. |
| Isolation multi-salons par projet | Lancez un bot par salon de projet avec profils Hermes, sessions, mémoire et journaux isolés. |

## Démarrage rapide

Chemin le plus rapide avec npm :

```bash
npm install -g verbalcoding
vc setup --yes
vc doctor
vc start
```

Ou exécutez directement sans installation globale permanente :

```bash
npx verbalcoding setup --yes
vc doctor
vc start
```

Chemin de clonage GitHub pour les contributeurs :

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc doctor
./run.sh
```

`vc setup --yes` amorce les prérequis locaux depuis le paquet npm installé. `./scripts/install.sh --yes` fait la même chose uniquement dans un clone GitHub. Les deux couvrent, quand c'est possible, les dépendances Node/npm, `ffmpeg`, `whisper-cli`, le modèle whisper.cpp par défaut, l'assistant Edge TTS local `.venv-tts` et la configuration par assistant. Ils prennent en charge macOS/Homebrew ainsi que les gestionnaires de paquets Linux courants (`apt`, `dnf`, `pacman`) ; relancez avec `--no-wizard` pour une configuration limitée aux dépendances ou `--skip-system` si vous voulez installer vous-même les paquets du système.

Besoin d'une procédure d'installation propre ? Commencez par [Installation propre](FRESH_INSTALL.fr.md).

## Backends d'agents pris en charge

| Backend | Commande par défaut | Prise en charge des sessions |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | Reprise, progression détaillée, annulation, récupération de la réponse finale |
| Claude Code | `claude -p` | Prise en charge du fichier de session CLI via les valeurs par défaut de l'adaptateur |
| Codex CLI | `codex exec` | Prise en charge du fichier de session CLI via les valeurs par défaut de l'adaptateur |
| Gemini CLI | `gemini -p` | Prise en charge du fichier de session CLI via les valeurs par défaut de l'adaptateur |
| OpenCode | `opencode run` | Prise en charge du fichier de session CLI via les valeurs par défaut de l'adaptateur |
| OpenClaw | `openclaw run` | Prise en charge du fichier de session CLI via les valeurs par défaut de l'adaptateur |
| Personnalisé | `AGENT_COMMAND` | Apportez votre propre commande non interactive |

## En savoir plus

| Guide | Ce que vous obtenez |
|---|---|
| [Installation propre](FRESH_INSTALL.fr.md) | Configuration depuis un clone propre, téléchargement du modèle, premier lancement |
| [Guide d'utilisation](USAGE.fr.md) | Commandes CLI, commandes Discord, mode progression, métriques de latence |
| [Configuration](CONFIGURATION.fr.md) | `.env`, backends d'agents, MCP, backends TTS, notes d'exploitation |
| [Multi-instance](MULTI_INSTANCE.fr.md) | Un salon vocal Discord permanent par projet |
| [Notes de version](RELEASE.fr.md) | Capacités actuelles et checklist de pré-version |

## Mini-carte des commandes

```bash
vc status                 # paramètres actuels de langue, TTS et passerelle
vc language ko|en|auto    # changer le préréglage langue STT/progression/TTS
vc bot invite CLIENT_ID   # générer l'URL d'invitation du bot Discord
vc instance setup NAME    # créer un bot vocal de projet isolé
vc instance start NAME    # exécuter ce bot en arrière-plan
vc doctor                 # contrôle de santé expurgé
vc start                  # démarrer la passerelle par défaut
```

Dans Discord :

| Commande | Effet |
|---|---|
| `!join` | Rejoint votre salon vocal actuel. |
| `!ask <prompt>` | Envoie du texte au même backend d'agent. |
| `!verbose on\|off` | Affiche/énonce de courtes mises à jour de progression. |
| `!latency` | Résume la latence récente voix/STT/agent/TTS. |
| `!sensitivity normal` | Utilise la sensibilité d'interruption normale en intérieur. |
| `!sensitivity conservative` | Utilise une sensibilité plus stricte pour les environnements bruyants/extérieurs. |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Lie une session de projet à un salon vocal. |

## Exigences

| Couche | Valeur par défaut |
|---|---|
| Runtime | Node.js 20+, npm ; le script d'installation peut l'installer via Homebrew/apt/dnf/pacman |
| Audio | `ffmpeg` ; le script d'installation peut l'installer |
| Reconnaissance vocale | `whisper-cli` local depuis whisper.cpp ; le script d'installation utilise Homebrew sur macOS ou un fallback de build Linux local |
| TTS | CLI Edge TTS ; le script d'installation crée `.venv-tts` si nécessaire |
| Discord | Jeton de bot, intent Message Content, permissions vocales |
| Agent | Au moins un harnais CLI authentifié, Hermes Agent par défaut |
| Plateforme privilégiée | macOS / Apple Silicon le plus testé ; l'amorçage Linux est documenté et fourni au mieux |

## Contribution

Exécutez les contrôles légers avant d'envoyer des changements :

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
npm pack --dry-run
vc doctor
```

## Statut

VerbalCoding vise une publication publique mais reste jeune. Vidéo/GIF de démonstration, validation Linux plus large, CI et revue de sécurité plus approfondie restent à faire.

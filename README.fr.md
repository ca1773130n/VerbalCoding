# VerbalCoding

<p align="center"><strong>Pilotez des agents de code CLI par la voix dans Discord, comme un appel téléphonique.</strong></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.zh.md">中文</a> ·
  <a href="./README.es.md">Español</a> ·
  <a href="./README.ru.md">Русский</a>
</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="docs/assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding transforme un salon vocal Discord en interface mains libres pour agents de développement. Parlez, laissez le CLI travailler, puis recevez la réponse en voix et en texte.

## Points forts

| Fonction | Bénéfice |
|---|---|
| Contrôle vocal des agents | Pilotez Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw ou un custom CLI depuis la voix Discord. |
| Guided setup | `vc setup` guides Discord Developer Portal values, bot token, client ID, and voice channels in one flow. `vc setup token` / `vc setup channels` are for later updates. |
| Local speech loop | Discord voice → `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Docker-aware troubleshooting | Si `Cannot perform IP discovery - socket closed` apparaît, le salon a été trouvé mais la découverte UDP vocale Discord a échoué. Sous Docker Linux, utilisez `network_mode: "host"` et supprimez `ports:` pour ce service. |

## Démarrage rapide

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## Configuration Discord

`vc setup` vous guide avec le Discord Developer Portal ouvert afin de saisir le jeton, l’ID client et les salons vocaux d’auto-connexion en un seul flux. Plus tard, utilisez `vc setup token` ou `vc setup channels` pour changer seulement une valeur.

```bash
vc setup
vc bot invite <discord-client-id>
# later updates only:
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

## Carte rapide des commandes

```bash
vc setup                               # guided setup: prerequisites, Discord token, voice channels
vc setup token                         # save/update Discord bot token
vc setup channels "General,Team Voice" # save auto-join voice channel names
vc bot invite CLIENT_ID                 # generate Discord invite URL
vc doctor                               # redacted health check and supported auto-fixes
vc start                                # start the default bridge
vc instance setup NAME                  # create isolated project bot config
vc instance start NAME                  # run that bot in the background
```

## Note Docker / conteneurs

Si `Cannot perform IP discovery - socket closed` apparaît, le salon a été trouvé mais la découverte UDP vocale Discord a échoué. Sous Docker Linux, utilisez `network_mode: "host"` et supprimez `ports:` pour ce service.

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

## En savoir plus

| Guide | Lien |
|---|---|
| Fresh install | [FRESH_INSTALL](docs/i18n/FRESH_INSTALL.fr.md) |
| Usage | [USAGE](docs/i18n/USAGE.fr.md) |
| Configuration | [CONFIGURATION](docs/i18n/CONFIGURATION.fr.md) |
| Troubleshooting | [TROUBLESHOOTING](docs/i18n/TROUBLESHOOTING.fr.md) |
| Multi-instance | [MULTI_INSTANCE](docs/i18n/MULTI_INSTANCE.fr.md) |

# VerbalCoding

<p align="center"><strong>Pilotez des agents de code CLI par la voix dans Discord, comme un appel téléphonique.</strong></p>

<p align="center">[English](../../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · [中文](README.zh.md) · [Español](README.es.md) · [Русский](README.ru.md)</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/verbalcoding?color=CB3837&logo=npm&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="Discord" src="https://img.shields.io/badge/Discord-voice%20bridge-5865F2?logo=discord&logoColor=white">
  <img alt="STT" src="https://img.shields.io/badge/STT-whisper.cpp-7C3AED">
  <img alt="License" src="https://img.shields.io/github/license/ca1773130n/VerbalCoding">
</p>

<p align="center">
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding voice-to-agent flow" width="860">
</p>

## Why

VerbalCoding transforme un salon vocal Discord en interface mains libres pour agents de développement. Parlez, laissez le CLI travailler, puis recevez la réponse en voix et en texte.

## Points forts

| Fonction | Bénéfice |
|---|---|
| Contrôle vocal des agents | Pilotez Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw ou un custom CLI depuis la voix Discord. |
| Guided setup | Au lieu de modifier `.env` à la main, utilisez `vc setup token` et `vc setup channels` pour enregistrer le jeton et les salons vocaux d’auto-connexion. |
| Local speech loop | Discord voice → `whisper-cli` STT → CLI agent → chunked TTS playback. |
| Shared voice + text context | Voice turns and `!ask` text commands can reuse the same supported agent session. |
| Docker-aware troubleshooting | Si `Cannot perform IP discovery - socket closed` apparaît, le salon a été trouvé mais la découverte UDP vocale Discord a échoué. Sous Docker Linux, utilisez `network_mode: "host"` et supprimez `ports:` pour ce service. |

## Démarrage rapide

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

## Configuration Discord

```bash
vc bot invite <discord-client-id>
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
```

## Carte rapide des commandes

```bash
vc setup --yes                         # bootstrap prerequisites and starter config
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
| Fresh install | [FRESH_INSTALL](FRESH_INSTALL.fr.md) |
| Usage | [USAGE](USAGE.fr.md) |
| Configuration | [CONFIGURATION](CONFIGURATION.fr.md) |
| Troubleshooting | [TROUBLESHOOTING](TROUBLESHOOTING.fr.md) |
| Multi-instance | [MULTI_INSTANCE](MULTI_INSTANCE.fr.md) |

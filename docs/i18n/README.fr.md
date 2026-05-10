# Documentation VerbalCoding

<p align="center"><a href="../../README.md">English README</a> · <a href="../../README.ko.md">한국어</a> · <a href="../../README.ja.md">日本語</a> · <a href="../../README.zh.md">中文</a> · <a href="../../README.es.md">Español</a> · <a href="../../README.fr.md">Français</a> · <a href="../../README.ru.md">Русский</a></p>

Le README est l’entrée compacte; cette page indexe les guides détaillés. Pour configurer un vrai bot vocal Discord pour la première fois, commencez par Fresh Install.

## Chemin rapide

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## Guides

| Guides | À utiliser pour |
|---|---|
| [Fresh Install](FRESH_INSTALL.fr.md) | npm/global install propre, Discord app setup, premier bot invite et première voice run. |
| [Usage](USAGE.fr.md) | Commandes CLI, commandes Discord, modes d’exécution, voice changes, progress et latency metrics. |
| [Voix intégrée Hermes vs VerbalCoding](HERMES_VOICE.fr.md) | Ce que fait déjà la voix Discord intégrée de Hermes et ce qu’ajoute VerbalCoding. |
| [Configuration](CONFIGURATION.fr.md) | .env, agent backends, MCP server, TTS backends et réglages opérationnels. |
| [Troubleshooting](TROUBLESHOOTING.fr.md) | Docker UDP, voice join failures, missing token/channel checks et doctor behavior. |
| [Multi-Instance](MULTI_INSTANCE.fr.md) | Un Discord voice bot permanent par salon projet avec Hermes profiles isolés. |
| [Release Notes](RELEASE.fr.md) | Capacités actuelles, verification checklist et TODO avant public release. |

## README localisé

- [README.fr.md](../../README.fr.md)
- [English README](../../README.md)

## Note contributeur

Dans les docs utilisateur, privilégiez les commandes `vc ...`. Réservez `./scripts/...` aux flux contributor avec source checkout.

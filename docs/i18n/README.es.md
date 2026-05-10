# Documentación de VerbalCoding

<p align="center"><a href="../../README.md">English README</a> · <a href="../../README.ko.md">한국어</a> · <a href="../../README.ja.md">日本語</a> · <a href="../../README.zh.md">中文</a> · <a href="../../README.es.md">Español</a> · <a href="../../README.fr.md">Français</a> · <a href="../../README.ru.md">Русский</a></p>

El README es la portada compacta; esta página es el índice de guías detalladas. Si configuras un bot de voz de Discord real por primera vez, empieza por Fresh Install.

## Ruta rápida

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## Guías

| Guías | Úsala cuando necesites |
|---|---|
| [Fresh Install](FRESH_INSTALL.es.md) | npm/global install limpio, Discord app setup, primer bot invite y primera voice run. |
| [Usage](USAGE.es.md) | Comandos CLI, comandos Discord, modos de ejecución, voice changes, progress y latency metrics. |
| [Voz integrada de Hermes vs VerbalCoding](HERMES_VOICE.es.md) | Qué hace ya la voz de Discord integrada en Hermes y qué añade VerbalCoding. |
| [Configuration](CONFIGURATION.es.md) | .env, agent backends, MCP server, TTS backends y ajustes operativos. |
| [Troubleshooting](TROUBLESHOOTING.es.md) | Docker UDP, voice join failures, missing token/channel checks y doctor behavior. |
| [Multi-Instance](MULTI_INSTANCE.es.md) | Un Discord voice bot fijo por sala de proyecto con Hermes profiles aislados. |
| [Release Notes](RELEASE.es.md) | Capacidades actuales, verification checklist y TODO antes del public release. |

## README localizado

- [README.es.md](../../README.es.md)
- [English README](../../README.md)

## Nota para contribuidores

En documentación para usuarios, prioriza comandos `vc ...`. Reserva `./scripts/...` para flujos de contributor con source checkout.

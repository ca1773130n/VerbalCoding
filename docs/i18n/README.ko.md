# VerbalCoding 문서

<p align="center"><a href="../../README.md">English README</a> · <a href="../../README.ko.md">한국어</a> · <a href="../../README.ja.md">日本語</a> · <a href="../../README.zh.md">中文</a> · <a href="../../README.es.md">Español</a> · <a href="../../README.fr.md">Français</a> · <a href="../../README.ru.md">Русский</a></p>

README는 간결한 첫 화면이고, 이 페이지는 상세 가이드 색인입니다. 실제 Discord 음성 bot을 처음 설정한다면 Fresh Install부터 시작하세요.

## 빠른 경로

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

## 가이드

| 가이드 | 필요할 때 |
|---|---|
| [Fresh Install](FRESH_INSTALL.ko.md) | 깨끗한 npm/global install, Discord app setup, 첫 bot invite, 첫 voice run. |
| [Usage](USAGE.ko.md) | CLI 명령, Discord 명령, 실행 모드, voice changes, progress, latency metrics. |
| [Hermes 기본 음성 vs VerbalCoding](HERMES_VOICE.ko.md) | Hermes 기본 Discord 음성이 이미 하는 일과 VerbalCoding이 더하는 것. |
| [Configuration](CONFIGURATION.ko.md) | .env, agent backends, MCP server, TTS backends, 운영 설정. |
| [Troubleshooting](TROUBLESHOOTING.ko.md) | Docker UDP, voice join failures, missing token/channel checks, doctor behavior. |
| [Multi-Instance](MULTI_INSTANCE.ko.md) | 격리된 Hermes profile로 프로젝트 방마다 고정 Discord voice bot 하나. |
| [Release Notes](RELEASE.ko.md) | 현재 기능, verification checklist, public-release 전 TODO. |

## 현지화된 README

- [README.ko.md](../../README.ko.md)
- [English README](../../README.md)

## 기여자 참고

사용자 문서에서는 `vc ...` 명령을 우선 사용하고, `./scripts/...` 명령은 source checkout 기여자 흐름에만 사용하세요.

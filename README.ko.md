# VerbalCoding

<p align="center"><strong>Discord 음성으로 CLI 코딩 에이전트와 통화하듯 작업하세요.</strong></p>

<p align="center"><a href="./README.md">English</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.zh.md">中文</a> · <a href="./README.es.md">Español</a> · <a href="./README.fr.md">Français</a> · <a href="./README.ru.md">Русский</a></p>

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

## 존재 이유

VerbalCoding은 Discord 음성 방을 코딩 에이전트용 핸즈프리 조종석으로 바꿉니다. 말로 요청하고, CLI 에이전트가 작업하게 두고, 간결한 음성 답변과 텍스트 기록을 받습니다. diff와 로그는 TTS로 길게 읽지 않도록 보호합니다.

> **Hermes Agent를 이미 쓰고 있나요?** Hermes 자체도 `/voice join` / `/voice channel`로 Discord 음성 채널에 들어가 Whisper STT와 TTS 답변을 처리할 수 있습니다. 그 기본 루프만 필요하다면 VerbalCoding은 필수가 아닙니다. VerbalCoding은 그 위에 프로젝트/세션 라우팅, 음성+텍스트 공유 컨텍스트, 바지인 규칙, 진행 음성 안내, 언어 프리셋, 지연 시간 지표, Hermes 외 CLI 백엔드 전환을 얹는 워크플로 레이어입니다.

## 무엇이 다른가

| 기능 | 왜 중요한가 |
|---|---|
| 통화 같은 작업 흐름 | 한 Discord 음성 채널에서 말하고, 듣고, 끼어들고, 이어서 작업합니다. |
| 안내형 사람용 설정 | `vc setup`이 prerequisites, Discord token/client ID, voice channel, transcript target, backend, TTS 설정을 한 흐름으로 묻습니다. |
| 로컬 음성 루프 | Discord audio → local `whisper-cli` → selected CLI agent → TTS 답변. |
| 에이전트 선택 | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, custom command를 지원합니다. |
| Hermes 기본 음성 너머 | 같은 VC 음성 루프를 기반으로 프로젝트 방, `!ask` 공유 컨텍스트, 세밀한 끼어들기 처리, 진행/상태 음성 안내, 다중 에이전트 백엔드 제어를 더합니다. |
| 운영 친화 기능 | doctor auto-fix, Docker UDP 안내, latency metrics, multi-instance rooms, redacted config checks가 포함됩니다. |

## 빠른 시작

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

`vc setup`이 일반 사용자 경로입니다. Discord Developer Portal을 열어 둔 상태에서 bot token, application/client ID, transcript target, voice channel names를 입력하세요.

자동화에서는 프롬프트를 건너뛴 뒤 Discord 값을 나중에 넣을 수 있습니다.

```bash
vc setup --yes
vc setup token <bot-token> --client-id <discord-client-id>
vc setup channels "General,Team Voice"
vc doctor
```

## Discord 설정 1분 요약

1. Discord Developer Portal에서 application과 bot을 만듭니다.
2. Message Content privileged intent를 켭니다.
3. `vc setup`을 실행하고 bot token과 application/client ID를 붙여넣습니다.
4. 자동 입장할 voice channel 이름을 정확히 입력합니다.
5. 아래 명령으로 bot을 초대합니다.

```bash
vc bot invite <discord-client-id>
vc bot invite <discord-client-id> --guild <guild-id>
```

## 작은 명령 지도

```bash
vc setup                                 # 안내형 설정: prerequisites, Discord, backend, voice
vc setup --yes                           # 비대화형 bootstrap/starter config
vc setup token                           # 나중에 Discord bot token과 client ID 회전/추가
vc setup channels "General,Team Voice"   # auto-join voice channel names 업데이트
vc bot invite CLIENT_ID                  # Discord bot invite URL 생성
vc status                                # 현재 설정 표시
vc language ko|en|auto                   # language preset 전환
vc doctor                                # redacted health check와 auto-fix
vc start                                 # 기본 bridge 시작
vc instance setup NAME                   # 격리된 project voice bot 생성
vc instance start NAME                   # 해당 bot을 background로 실행
```

## 더 보기

| 가이드 | 내용 |
|---|---|
| [문서 허브](docs/i18n/README.ko.md) | 현지화된 가이드 색인. |
| [Fresh Install](docs/i18n/FRESH_INSTALL.ko.md) | npm/global setup, Discord 설정, 첫 실행. |
| [Usage](docs/i18n/USAGE.ko.md) | CLI 명령, Discord 명령, 실행 모드, latency. |
| [Hermes 기본 음성 vs VerbalCoding](docs/i18n/HERMES_VOICE.ko.md) | Hermes가 이미 지원하는 Discord 음성과 VerbalCoding의 차이. |
| [Configuration](docs/i18n/CONFIGURATION.ko.md) | .env, agent backends, MCP, TTS, 운영. |
| [Troubleshooting](docs/i18n/TROUBLESHOOTING.ko.md) | Docker UDP, token/channel 누락 점검. |
| [Multi-Instance](docs/i18n/MULTI_INSTANCE.ko.md) | 프로젝트마다 하나의 고정 음성 방. |

## 요구 사항

| 계층 | 기본값 |
|---|---|
| Runtime | Node.js 20+와 npm. |
| Audio | `ffmpeg`와 local `whisper-cli`. |
| TTS | 기본 Edge TTS, 선택 OpenVoice, SpeechSwift/CosyVoice, Supertonic, OmniVoice, Qwen3 TTS CLI. |
| Discord | Bot token, Message Content intent, voice permissions, 일치하는 channel names. |
| Agent | 인증된 CLI harness 하나 이상, 기본은 Hermes Agent. |

## Docker / 컨테이너 참고

로그에 `Cannot perform IP discovery - socket closed`가 보이면 Discord voice UDP가 막힌 것입니다. Linux Docker Compose에서는 다음을 사용하세요:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

`network_mode: "host"`와 `ports:`를 함께 쓰지 마세요.

## 기여

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
npm pack --dry-run
vc doctor
```

## 상태

VerbalCoding은 공개 릴리스를 지향하지만 아직 초기 단계입니다. 데모 영상/GIF, 더 넓은 Linux 검증, CI, 보안 리뷰는 TODO입니다.

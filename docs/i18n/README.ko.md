# VerbalCoding

<p align="center">
  <strong>Discord 음성으로 CLI 코딩 에이전트와 대화하세요 — 소프트웨어 작업을 위한 전화 통화처럼.</strong>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
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
  <img src="../assets/figures/verbalcoding-flow.svg" alt="VerbalCoding 음성-에이전트 흐름" width="860">
</p>

## 왜 필요한가

VerbalCoding은 Discord 음성 채널을 코딩 에이전트를 위한 핸즈프리 제어면으로 바꿉니다. 요청을 말하고, CLI 에이전트가 작업하게 둔 뒤, 간결한 답변을 음성으로 들을 수 있습니다 — 텍스트 기록, 진행 이벤트, 시끄러운 코드/로그 출력에 대한 안전장치도 함께 제공합니다.

## 주요 기능

| 제공되는 것 | 좋은 이유 |
|---|---|
| 음성 우선 에이전트 제어 | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw 또는 임의의 커스텀 CLI 하네스와 말로 대화합니다. |
| 온디바이스 음성 루프 | Discord 음성 캡처 → 로컬 `whisper-cli` 전사 → 에이전트 → 분할 TTS 재생. |
| 공유 음성 + 텍스트 컨텍스트 | 음성 턴과 `!ask` 텍스트 명령이 지원되는 동일 에이전트 세션을 재사용할 수 있습니다. |
| 끼어들기 및 감도 모드 | 재생 중 자연스럽게 끼어들고 일반/보수적(시끄러운 환경) 모드를 전환합니다. |
| 다국어 음성 프리셋 | `vc language ko/en/auto`로 STT, 진행 언어, TTS 음성을 함께 전환합니다. |
| 여러 방의 프로젝트 격리 | 프로젝트 방마다 하나의 봇을 실행하고 Hermes 프로필, 세션, 메모리, 로그를 분리합니다. |

## 빠른 시작

npm으로 가장 빠르게 시작하는 방법:

```bash
npm install -g verbalcoding
vc setup --yes
vc doctor
vc start
```

영구 전역 설치 없이 바로 실행하려면:

```bash
npx verbalcoding setup --yes
vc doctor
vc start
```

기여자를 위한 GitHub 클론 경로:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
vc doctor
./run.sh
```

`vc setup --yes`와 `./scripts/install.sh --yes`는 가능한 경우 로컬 필수 구성요소를 부트스트랩합니다: Node/npm 의존성, `ffmpeg`, `whisper-cli`, 기본 whisper.cpp 모델, 로컬 `.venv-tts` Edge TTS 헬퍼, 클론 설치용 짧은 `vc` 셸 명령. macOS/Homebrew와 일반적인 Linux 패키지 관리자(`apt`, `dnf`, `pacman`)를 지원합니다. 의존성만 설정하려면 `--no-wizard`로 다시 실행하고, OS 패키지를 직접 설치하려면 `--skip-system`을 사용하세요.

깨끗한 설치 안내가 필요하다면 [Fresh Install](FRESH_INSTALL.ko.md)부터 시작하세요.

## 지원되는 에이전트 백엔드

| 백엔드 | 기본 명령 | 세션 지원 |
|---|---:|---|
| Hermes Agent | `hermes chat -Q -q` | 이어받기, 자세한 진행, 취소, 최종 답변 복구 |
| Claude Code | `claude -p` | 어댑터 기본값을 통한 CLI 세션 파일 지원 |
| Codex CLI | `codex exec` | 어댑터 기본값을 통한 CLI 세션 파일 지원 |
| Gemini CLI | `gemini -p` | 어댑터 기본값을 통한 CLI 세션 파일 지원 |
| OpenCode | `opencode run` | 어댑터 기본값을 통한 CLI 세션 파일 지원 |
| OpenClaw | `openclaw run` | 어댑터 기본값을 통한 CLI 세션 파일 지원 |
| Custom | `AGENT_COMMAND` | 직접 만든 비대화형 명령 사용 |

## 더 알아보기

| 가이드 | 제공 내용 |
|---|---|
| [Fresh Install](FRESH_INSTALL.ko.md) | 깨끗한 클론 설정, 모델 다운로드, 첫 실행 |
| [Usage Guide](USAGE.ko.md) | CLI 명령, Discord 명령, 진행 모드, 지연 시간 지표 |
| [Configuration](CONFIGURATION.ko.md) | `.env`, 에이전트 백엔드, MCP, TTS 백엔드, 운영 참고 사항 |
| [Multi-Instance](MULTI_INSTANCE.ko.md) | 프로젝트마다 하나의 영구 Discord 음성 방 |
| [Release Notes](RELEASE.ko.md) | 현재 기능과 사전 릴리스 체크리스트 |

## 작은 명령 지도

```bash
vc status                 # 현재 언어, TTS, 브리지 설정
vc language ko|en|auto    # STT/진행/TTS 언어 프리셋 전환
vc bot invite CLIENT_ID   # Discord 봇 초대 URL 생성
vc instance setup NAME    # 격리된 프로젝트 음성 봇 생성
vc instance start NAME    # 해당 봇을 백그라운드에서 실행
vc doctor                 # 민감 정보가 제거된 상태 점검
vc start                  # 기본 브리지 시작
```

Discord에서:

| 명령 | 하는 일 |
|---|---|
| `!join` | 현재 음성 채널에 참가합니다. |
| `!ask <prompt>` | 동일 에이전트 백엔드로 텍스트를 보냅니다. |
| `!verbose on\|off` | 짧은 진행 업데이트를 표시/낭독합니다. |
| `!latency` | 최근 음성/STT/에이전트/TTS 지연 시간을 요약합니다. |
| `!sensitivity normal` | 일반 실내 끼어들기 감도를 사용합니다. |
| `!sensitivity conservative` | 더 엄격한 시끄러운/실외 감도를 사용합니다. |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | 프로젝트 세션을 음성 방에 연결합니다. |

## 요구 사항

| 계층 | 기본값 |
|---|---|
| 런타임 | Node.js 20+, npm; 설치 스크립트가 Homebrew/apt/dnf/pacman으로 설치 가능 |
| 오디오 | `ffmpeg`; 설치 스크립트가 설치 가능 |
| 음성 인식 | whisper.cpp의 로컬 `whisper-cli`; 설치 스크립트는 macOS에서 Homebrew를 사용하거나 Linux에서 로컬 빌드 폴백 사용 |
| TTS | Edge TTS CLI; 필요한 경우 설치 스크립트가 `.venv-tts` 생성 |
| Discord | 봇 토큰, Message Content intent, 음성 권한 |
| 에이전트 | 인증된 CLI 하네스 하나 이상, 기본값은 Hermes Agent |
| 중점 플랫폼 | macOS / Apple Silicon에서 가장 많이 테스트됨; Linux 부트스트랩은 최선 노력으로 문서화됨 |

## 기여

변경 사항을 보내기 전에 가벼운 점검을 실행하세요:

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
npm pack --dry-run
vc doctor
```

## 상태

VerbalCoding은 공개 릴리스를 지향하지만 아직 초기 단계입니다. 데모 비디오/GIF, 더 넓은 Linux 검증, CI, 더 깊은 보안 검토는 아직 TODO입니다.

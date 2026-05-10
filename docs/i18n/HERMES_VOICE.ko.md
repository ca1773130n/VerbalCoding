# Hermes 기본 음성 vs VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="README.ko.md">문서 허브</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a> ·
  <a href="TROUBLESHOOTING.ko.md">문제 해결</a>
</p>

> Hermes는 이미 Discord 음성 채널을 지원합니다. VerbalCoding은 그 기본 음성 루프를 대체하는 것이 아니라, 코딩 에이전트와 통화하듯 일하기 위한 워크플로 레이어입니다.
<!-- /readme-glow-up:intro -->

## Hermes가 이미 하는 일

Hermes Agent에는 Discord gateway 기반 음성 채널 지원이 들어 있습니다. 봇이 서버에 들어온 뒤 `/voice join` 또는 `/voice channel`을 실행하면, 사용자가 현재 들어가 있는 음성 채널에 참가할 수 있습니다. 그 다음 Whisper/STT로 말을 전사하고, Edge TTS, ElevenLabs, OpenAI 등 설정된 TTS provider로 음성 답변을 재생합니다.

기본 라이브 음성 대화만 필요하면 이 흐름으로 충분합니다.

```text
Discord VC → Hermes STT → Hermes agent → TTS → Discord VC playback
```

요구사항이 여기까지라면 Hermes 기본 음성 모드를 먼저 쓰면 됩니다.

## VerbalCoding이 더하는 것

VerbalCoding은 같은 큰 루프를 유지하되, CLI 에이전트용 코딩 워크플로 런타임으로 다듬습니다.

| 영역 | Hermes 기본 음성 | VerbalCoding |
|---|---|---|
| 주 목적 | Discord VC에서 일반 Hermes 대화 | CLI 에이전트와 통화하듯 코딩 작업 |
| 명령 | `/voice join`, `/voice channel`, `/voice leave`, `/voice tts` | `vc setup`, `vc start`, `!join`, `!ask`, `!session`, `!verbose`, `!latency`, multi-instance 명령 |
| 백엔드 | Hermes Agent | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, custom command |
| 세션 모델 | 일반 Hermes gateway 세션 | 프로젝트/세션 라우팅, 음성 채널 바인딩, 지원되는 경우 음성 + `!ask` 텍스트 공유 컨텍스트 |
| 음성 UX | 기본 STT + TTS | 조정된 발화 종료 판단, 언어 프리셋, transcript cleanup, text mirror, voice test |
| 끼어들기 | 기본 재생 동작 | 재생은 멈추되 실행 중인 에이전트 작업은 실수로 죽이지 않는 바지인 규칙 |
| 긴 코딩 작업 | 일반 agent 응답 | 진행/상태 음성, verbose tool-progress 요약, diff/log TTS 낭독 방지 |
| 운영 | Hermes gateway 설정과 config | `vc doctor` auto-fix, redacted diagnostics, latency metrics, Docker UDP 안내, multi-bot/project rooms |

## 무엇을 선택할까

**Hermes 기본 음성**이 맞는 경우:

- Discord 음성 채널 하나에서 간단히 말하고 답변을 듣고 싶다;
- speak → transcribe → answer → speak-back 흐름이면 충분하다;
- 추가 소프트웨어를 최소화하고 공식 Hermes gateway 경로를 쓰고 싶다;
- Hermes 세션과 도구만 쓰면 된다.

**VerbalCoding**이 맞는 경우:

- 음성과 텍스트가 코딩 프로젝트 컨텍스트를 함께 공유해야 한다;
- Hermes 외 Claude Code, Codex 등 여러 CLI 에이전트 백엔드를 쓰고 싶다;
- 프로젝트별 Discord 방이나 여러 bot instance가 필요하다;
- 한국어/영어 언어 프리셋과 런타임 voice control이 필요하다;
- 긴 작업 중 끼어들기 처리와 취소 의미를 세밀하게 다루고 싶다;
- 거대한 diff, stack trace, log를 음성으로 읽지 않고 진행 상황만 듣고 싶다;
- `vc doctor`, latency summary, container voice-network 안내 같은 운영 도구가 필요하다.

## 정직한 포지셔닝

VerbalCoding을 “Hermes에 Discord 음성을 처음 붙이는 프로젝트”라고 설명하면 안 됩니다. Hermes는 이미 그 기본 기능을 갖고 있습니다. 더 정확한 설명은 다음과 같습니다.

> VerbalCoding은 CLI 코딩 에이전트용 Discord 음성 워크플로 레이어입니다. Hermes를 기본 백엔드로 사용할 수 있고, 긴 소프트웨어 작업을 위해 프로젝트 라우팅, 끼어들기 의미론, 진행 UX, 진단, 백엔드 전환을 추가합니다.

# VerbalCoding 설정


## 최신 setup 흐름

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

수동 `.env` 편집 대신 `vc setup token`으로 `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`를 저장하고, `vc setup channels`로 `AUTO_JOIN_VOICE_CHANNELS`를 저장하세요. Docker에서 `Cannot perform IP discovery - socket closed`가 보이면 Linux Compose 서비스에 `network_mode: "host"`를 사용하고 `ports:`를 제거하세요.

## 설정 마법사

Discord 봇/애플리케이션 설정은 여기서 처음부터 다시 설명하지 않습니다. Discord 쪽 단계는 다음 업스트림 가이드를 사용한 뒤 VerbalCoding 설정으로 돌아오세요:

- Hermes Agent Discord 메시징 가이드: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 공식 봇 개요: <https://docs.discord.com/developers/bots/overview>
- Discord 공식 빠른 시작: <https://docs.discord.com/developers/quick-start/getting-started>

```bash
./scripts/install.sh
```

설치 프로그램은 Discord 토큰, 허용 사용자, 자동 참가 음성 채널 이름, 전사 채널/스레드, CLI 하네스 백엔드, 기본 음성 언어, TTS 설정, 웨이크워드 동작을 묻습니다. mode `0600`으로 `.env`를 작성하며, `.env`는 git에서 무시됩니다. 또한 짧은 셸 명령 `vc`도 연결합니다.

수동 설치 후 셸 명령만 필요하다면:

```bash
npm link
```

## 지원되는 에이전트 백엔드

`.env`에서 `AGENT_BACKEND`를 설정하세요.

| 백엔드 | 기본 명령 | 참고 |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | 기본값. `.verbalcoding-session` 이어받기 동작을 보존합니다. |
| `claude-code` / `claude` | `claude -p` | `CLAUDE_COMMAND` 또는 `AGENT_COMMAND`로 재정의. |
| `codex` | `codex exec` | `CODEX_COMMAND` 또는 `AGENT_COMMAND`로 재정의. |
| `gemini` | `gemini -p` | `GEMINI_COMMAND` 또는 `AGENT_COMMAND`로 재정의. |
| `opencode` | `opencode run` | `OPENCODE_COMMAND` 또는 `AGENT_COMMAND`로 재정의. |
| `openclaw` | `openclaw run` | `OPENCLAW_COMMAND` 또는 `AGENT_COMMAND`로 재정의. |
| `custom` | 필수 `AGENT_COMMAND` | 프롬프트가 마지막 argv 인자로 추가됩니다. |

일반 재정의:

```bash
AGENT_BACKEND=custom
AGENT_LABEL="My Harness"
AGENT_COMMAND="my-harness run --non-interactive"
AGENT_TASK_TIMEOUT_MS=0
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_VERBOSE_PROGRESS=0
UTTERANCE_IDLE_MS=4500
LATENCY_LOG_PATH=./.logs/latency.jsonl
```

## 에이전트 어댑터 계약

음성 브리지는 하나의 어댑터 계약을 통해 모든 백엔드와 통신합니다:

- `run({ text }, signal, plan)`은 상태, 최종 답변 텍스트, 백엔드 라벨, 경과 시간, 선택적 세션 메타데이터를 반환합니다.
- `ask(text, signal, plan)`은 최종 답변 텍스트만 반환하는 호환성 단축 함수입니다.
- `capabilities`는 백엔드가 세션 이어받기, 스트리밍 진행, 취소를 지원하는지 선언합니다.
- Hermes는 참조 어댑터입니다: 이어받기, 자세한 진행 스트리밍, 취소, Hermes 세션 파일에서 최종 답변 복구.

새 백엔드는 동일한 계약을 구현하고 음성/STT/TTS 동작은 어댑터 밖에 유지해야 합니다.

## `.env` 예시

```bash
DISCORD_BOT_TOKEN="***"
DISCORD_ALLOWED_USERS="123456789012345678"
AUTO_JOIN_VOICE_CHANNELS="일반,General,general"
TRANSCRIPT_CHANNEL_ID="123456789012345678"

AGENT_BACKEND="hermes"
STT_ENGINE="whisper_cpp"
WHISPER_CPP_BIN="whisper-cli"
WHISPER_CPP_MODEL="./models/ggml-small-q5_1.bin"

TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_female"
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"

REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="4500"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
```

## TTS 음성 선택

언어 프리셋과 음성 선택은 별개입니다:

- `vc language ko|en|auto`는 STT 언어, 진행 언어, 해당 언어의 기본 음성을 변경합니다.
- “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female`, `switch speaker to English` 같은 라이브 음성 명령은 화자/음성 유형만 변경합니다.
- `!voice-test <text>`는 현재 선택된 백엔드와 음성으로 빠른 샘플을 재생합니다.

음성 선택은 기본적으로 `config/tts-voices.json`에 저장됩니다. `TTS_VOICE_CONFIG`로 경로를 재정의하세요. 실행 중인 브리지는 합성 전에 음성 선택을 다시 읽고 적용하므로, 전체 재시작 없이도 음성 명령이 적용됩니다.

기본 Edge 카탈로그:

| `TTS_VOICE_TYPE` | `TTS_VOICE` | 언어 |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | 한국어 |
| `korean_female` | `ko-KR-SunHiNeural` | 한국어 |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | 한국어 |
| `english_male` | `en-US-GuyNeural` | 영어 |
| `english_female` | `en-US-AriaNeural` | 영어 |

수동 영구 재정의:

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

OpenVoice, SpeechSwift 또는 Supertonic의 경우 아래 섹션의 백엔드별 음성/참조 설정을 유지하세요. 동일한 음성 카탈로그 파일은 여전히 활성 음성 유형을 추적할 수 있습니다.

백엔드별 음성 옵션:

| 백엔드 | 설정 | 음성 선택지 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | 위 내장 유형 및 `edge-tts --list-voices`가 반환하는 모든 음성 |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5`; 언어 `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | 사용자가 제공한 허용된 참조 WAV; 스타일 기본값은 `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | CosyVoice용 참조 샘플 음성 또는 백엔드가 지원하는 화자/모델 ID |

## 발화 분할

`UTTERANCE_IDLE_MS`는 음성 구간 이후 사용자가 말을 끝냈다고 판단하고 STT를 시작하기 전까지 브리지가 기다리는 시간을 제어합니다. 기본값은 자연스러운 멈춤이 있는 긴 음성 지시를 보존하기 위해 `4500` ms입니다. 낮은 값은 짧은 명령에서 더 빠르게 느껴지지만 긴 받아쓰기를 나눌 수 있고, 높은 값은 생각하며 말할 때 더 안전합니다.

```bash
UTTERANCE_IDLE_MS="4500"  # 균형 잡힌 기본값
UTTERANCE_IDLE_MS="6000"  # 멈춤이 있는 긴 받아쓰기에 더 안전
```

## MCP 서버

VerbalCoding은 stdio MCP 서버를 포함하므로 Hermes Agent 또는 모든 MCP 클라이언트가 skill이나 자유 형식 셸 명령에 의존하지 않고 도구를 통해 브리지를 제어할 수 있습니다.

Hermes 설정 예시:

```yaml
mcp_servers:
  verbalcoding:
    command: "node"
    args: ["/path/to/VerbalCoding/scripts/mcp-server.mjs"]
    timeout: 120
    connect_timeout: 30
```

노출되는 MCP 도구:

| 도구 | 목적 |
|---|---|
| `status` | 비밀 정보 없이 브리지/설정 상태 보고 |
| `doctor` | 민감 정보가 제거된 doctor 점검 실행 |
| `set_auto_restart` | 커밋 시점 음성 봇 자동 재시작 활성화/비활성화 |
| `set_language` | STT/진행/TTS 언어를 함께 업데이트 |
| `start`, `stop`, `restart` | Discord 음성 브리지 제어 |

## 선택 사항: OpenVoice TTS

Edge TTS는 기본값이자 폴백으로 유지됩니다. OpenVoice V2로 로컬 음성 복제를 시도하려면:

```bash
./scripts/setup_openvoice.sh
# OpenVoice 문서에서 checkpoints_v2_0417.zip을 다운로드하고 vendor/OpenVoice/checkpoints_v2/ 아래에 압축을 풉니다.
mkdir -p voice-samples
# 허용된 참조 샘플을 voice-samples/user-reference.wav에 넣거나,
# Discord에서 !voice-clone capture로 하나를 캡처합니다.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

그런 다음 다음을 설정하세요:

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

본인이 소유했거나 사용할 권한이 있는 음성만 복제하세요. OpenVoice가 실패하거나 시간이 초과되면 VerbalCoding은 Edge TTS로 폴백합니다.

## 선택 사항: Supertonic TTS

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

그런 다음 다음을 설정하세요:

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

Supertonic이 없거나 실패하거나 시간이 초과되면 VerbalCoding은 Edge TTS로 폴백합니다.

## 선택 사항: SpeechSwift / CosyVoice TTS

Apple Silicon에서 `speech-swift`는 MLX 네이티브 CosyVoice/Qwen3-TTS를 사용하는 한국어 음성 복제용 로컬 백엔드입니다.

```bash
brew tap soniqo/speech https://github.com/soniqo/speech-swift
brew install speech
```

권장 env:

```bash
TTS_BACKEND="speechswift"
SPEECHSWIFT_MODE="server"
SPEECHSWIFT_ENGINE="cosyvoice"
SPEECHSWIFT_LANGUAGE="korean"
SPEECHSWIFT_REF_AUDIO="./voice-samples/user-reference.wav"
SPEECHSWIFT_SERVER_HOST="127.0.0.1"
SPEECHSWIFT_SERVER_PORT="18080"
SPEECHSWIFT_SERVER_URL="http://127.0.0.1:18080"
SPEECHSWIFT_PROGRESS="0"
```

빠른 진행/백채널 프롬프트에는 Edge를 유지하세요.

## 운영 참고 사항

- 봇은 텍스트 명령을 위해 Discord privileged Message Content intent가 활성화되어 있어야 합니다.
- 봇은 음성 채널 connect/speak 권한이 필요합니다.
- Hermes Agent의 경우 기본 프로필에서 Hermes를 일반적인 방식으로 설정/인증하세요(`hermes setup`, `hermes login` 등).
- Claude Code, Codex, Gemini, OpenCode, OpenClaw의 경우 해당 CLI를 별도로 설치하고 인증하세요.
- CLI가 시간 초과 또는 signal 실패 시 diff/code 출력을 내보내면, 브리지는 이를 소리 내어 읽지 않고 자세한 텍스트를 대신 보냅니다.

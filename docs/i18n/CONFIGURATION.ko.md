# VerbalCoding 설정 가이드

## 설정 마법사

npm으로 설치한 경우:

```bash
vc setup --yes
```

GitHub 클론에서 직접 실행하는 경우:

```bash
./scripts/install.sh --yes
```

설치기는 Discord 토큰, 허용 사용자, 자동 입장 음성 채널 이름, transcript 채널/스레드, CLI 하네스 백엔드, 기본 음성 언어, TTS 설정, wake word 동작을 묻습니다. 결과는 권한 `0600`의 `.env`에 저장되며, `.env`는 git에서 무시됩니다. 클론 설치에서는 짧은 셸 명령 `vc`도 연결합니다.

수동 설치 후 셸 명령만 연결하려면:

```bash
npm link
```

## 지원 에이전트 백엔드

`.env`에서 `AGENT_BACKEND`를 설정합니다.

| 백엔드 | 기본 명령 | 메모 |
|---|---|---|
| `hermes` | `hermes chat -Q -q` | 기본값. `.verbalcoding-session` resume 동작을 유지합니다. |
| `claude-code` / `claude` | `claude -p` | `CLAUDE_COMMAND` 또는 `AGENT_COMMAND`로 재정의 가능 |
| `codex` | `codex exec` | `CODEX_COMMAND` 또는 `AGENT_COMMAND`로 재정의 가능 |
| `gemini` | `gemini -p` | `GEMINI_COMMAND` 또는 `AGENT_COMMAND`로 재정의 가능 |
| `opencode` | `opencode run` | `OPENCODE_COMMAND` 또는 `AGENT_COMMAND`로 재정의 가능 |
| `openclaw` | `openclaw run` | `OPENCLAW_COMMAND` 또는 `AGENT_COMMAND`로 재정의 가능 |
| `custom` | `AGENT_COMMAND` 필수 | 사용자 prompt가 마지막 argv 인자로 붙습니다. |

공통 override 예시:

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

음성 브릿지는 모든 백엔드와 하나의 어댑터 계약으로 통신합니다.

- `run({ text }, signal, plan)`은 상태, 최종 답변 텍스트, 백엔드 라벨, elapsed time, 선택적 세션 metadata를 반환합니다.
- `ask(text, signal, plan)`은 호환용 단축 함수이며 최종 답변 텍스트만 반환합니다.
- `capabilities`는 해당 백엔드가 session resume, streaming progress, cancellation을 지원하는지 선언합니다.
- Hermes는 기준 어댑터입니다. resume, verbose progress streaming, cancellation, Hermes 세션 파일에서 최종 답변 복구를 지원합니다.

새 백엔드는 같은 계약을 구현하고, voice/STT/TTS 동작은 어댑터 밖에 유지하는 것이 좋습니다.

## 예시 `.env`

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

## TTS 목소리 선택

언어 프리셋과 목소리 선택은 분리되어 있습니다.

- `vc language ko|en|auto`는 STT 언어, 진행 언어, 해당 언어의 기본 목소리를 함께 바꿉니다.
- “남자 한국어 목소리로 바꿔”, “여자 한국어 목소리로 바꿔”, `change voice to Korean female`, `switch speaker to English` 같은 실시간 음성 명령은 말하는 사람/목소리 타입만 바꿉니다.
- `!voice-test <text>`는 현재 선택된 백엔드와 목소리로 짧은 샘플을 재생합니다.

목소리 선택은 기본적으로 `config/tts-voices.json`에 저장됩니다. 경로는 `TTS_VOICE_CONFIG`로 바꿀 수 있습니다. 실행 중인 브릿지는 합성 직전에 목소리 선택을 다시 적용하므로, 음성 명령으로 바꾼 목소리는 전체 재시작 없이 바로 반영됩니다.

기본 Edge 카탈로그:

| `TTS_VOICE_TYPE` | `TTS_VOICE` | 언어 |
|---|---|---|
| `korean_male` | `ko-KR-InJoonNeural` | 한국어 |
| `korean_female` | `ko-KR-SunHiNeural` | 한국어 |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` | 한국어 |
| `english_male` | `en-US-GuyNeural` | 영어 |
| `english_female` | `en-US-AriaNeural` | 영어 |

수동 영구 override 예시:

```bash
TTS_BACKEND="edge"
TTS_VOICE_TYPE="korean_male"
TTS_VOICE="ko-KR-InJoonNeural"
TTS_VOICE_CONFIG="config/tts-voices.json"
```

OpenVoice, SpeechSwift, Supertonic을 쓸 때는 아래 백엔드별 reference/voice 설정을 유지하세요. 같은 voice catalog 파일에서 현재 voice type을 추적할 수 있습니다.

백엔드별 목소리 옵션:

| 백엔드 | 설정 | 목소리 선택지 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | 위 기본 타입, 또는 `edge-tts --list-voices`가 반환하는 모든 voice |
| Supertonic | `SUPERTONIC_VOICE`, `SUPERTONIC_LANGUAGE` | `M1`–`M5`, `F1`–`F5`; 언어 `ko`, `en`, `es`, `pt`, `fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE`, `OPENVOICE_LANGUAGE` | 사용자가 제공한 허가된 reference WAV; style 기본값은 `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER`, `SPEECHSWIFT_MODEL_ID` | CosyVoice reference sample voice 또는 백엔드가 지원하는 speaker/model ID |

## 발화 분리 설정

`UTTERANCE_IDLE_MS`는 음성 segment가 끝난 뒤 사용자의 말이 끝났다고 판단하고 STT를 시작하기 전까지 기다리는 시간입니다. 기본값은 `4500` ms입니다. 긴 지시 중 자연스러운 멈춤을 보존하기 위한 값입니다. 낮추면 짧은 명령 반응은 빨라지지만 긴 발화가 잘릴 수 있고, 높이면 생각하면서 말하는 긴 dictation에 더 안전합니다.

```bash
UTTERANCE_IDLE_MS="4500"  # 균형 잡힌 기본값
UTTERANCE_IDLE_MS="6000"  # 중간 멈춤이 있는 긴 발화에 더 안전
```

## MCP 서버

VerbalCoding은 stdio MCP 서버를 포함합니다. Hermes Agent 또는 MCP client는 자유 형식 shell 명령 대신 도구로 브릿지를 제어할 수 있습니다.

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

| 도구 | 용도 |
|---|---|
| `status` | 비밀값 없이 브릿지/설정 상태 보고 |
| `doctor` | 비밀값을 숨긴 doctor 점검 실행 |
| `set_auto_restart` | 커밋 시 음성 봇 자동 재시작 켜기/끄기 |
| `set_language` | STT/진행/TTS 언어를 함께 변경 |
| `start`, `stop`, `restart` | Discord 음성 브릿지 제어 |

## 선택: OpenVoice TTS

Edge TTS가 기본값이자 fallback입니다. OpenVoice V2로 로컬 음성 복제를 시험하려면:

```bash
./scripts/setup_openvoice.sh
# OpenVoice 문서에서 checkpoints_v2_0417.zip을 받아 vendor/OpenVoice/checkpoints_v2/ 아래에 풉니다.
mkdir -p voice-samples
# 허가된 기준 샘플을 voice-samples/user-reference.wav에 넣거나,
# Discord에서 !voice-clone capture로 샘플을 캡처합니다.
python3 scripts/openvoice_smoke.py
```

그 뒤 설정:

```bash
TTS_BACKEND="openvoice"
OPENVOICE_REF_AUDIO="./voice-samples/user-reference.wav"
OPENVOICE_PROGRESS="0"
```

본인 소유이거나 사용 허가를 받은 목소리만 복제하세요. OpenVoice가 실패하거나 timeout되면 VerbalCoding은 Edge TTS로 fallback합니다.

## 선택: Supertonic TTS

```bash
./scripts/setup_supertonic.sh
supertonic tts '안녕하세요. 수퍼토닉 테스트입니다.' --lang ko --voice M1 --steps 2 --speed 1.0 -o /tmp/verbalcoding-supertonic.wav
```

그 뒤 설정:

```bash
TTS_BACKEND="supertonic"
SUPERTONIC_COMMAND="./.venv-supertonic/bin/supertonic"
SUPERTONIC_VOICE="M1"
SUPERTONIC_LANGUAGE="ko"
SUPERTONIC_STEPS="2"
SUPERTONIC_SPEED="1.0"
SUPERTONIC_PROGRESS="0"
```

Supertonic이 없거나 실패하거나 timeout되면 VerbalCoding은 Edge TTS로 fallback합니다.

## 선택: SpeechSwift / CosyVoice TTS

Apple Silicon에서는 `speech-swift`가 MLX-native CosyVoice/Qwen3-TTS 기반 한국어 음성 복제용 로컬 백엔드로 동작할 수 있습니다.

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

빠른 진행/짧은 backchannel prompt는 Edge를 유지하는 편이 안전합니다.

## 운영 메모

- 텍스트 명령을 쓰려면 Discord bot의 privileged Message Content intent가 켜져 있어야 합니다.
- 봇에는 음성 채널 connect/speak 권한이 필요합니다.
- Hermes Agent를 쓴다면 기본 프로필에서 Hermes를 정상 설정/인증하세요. 예: `hermes setup`, `hermes login` 등.
- Claude Code, Codex, Gemini, OpenCode, OpenClaw를 쓰려면 해당 CLI를 별도로 설치하고 인증하세요.
- CLI가 timeout 또는 signal 실패 중 diff/code를 출력하면 브릿지는 그 내용을 음성으로 읽지 않고 자세한 텍스트로만 보냅니다.

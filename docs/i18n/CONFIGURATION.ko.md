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
UTTERANCE_IDLE_MS=2000
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
TTS_VOICE="ko-KR-SunHiNeural"
TTS_RATE="+10%"
TTS_MAX_CHARS="495"
TTS_VOLUME="1.0"

REQUIRE_WAKE_WORD="0"
MIN_UTTERANCE_SECONDS="1.0"
UTTERANCE_IDLE_MS="2000"
HERMES_TASK_TIMEOUT_MS="0"
HERMES_CHAT_TIMEOUT_MS="45000"
AGENT_VERBOSE_PROGRESS="0"
LATENCY_LOG_PATH="./.logs/latency.jsonl"
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

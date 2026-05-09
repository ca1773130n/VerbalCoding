# VerbalCoding Руководство по использованию

Operational details for Русский users.

## CLI Commands

```bash
vc status
vc language en
vc language ko
vc language auto
vc restart auto status
vc restart auto on
vc restart auto off
vc bot invite CLIENT_ID
vc instance status
vc instance setup NAME
vc instance start NAME
vc instance stop NAME
vc doctor
npm run mcp
```

Language commands update `.env`; restart with `vc start`, `./run.sh`, or your process manager.

## Run Modes

```bash
vc start
./run.sh
./run.sh instances/my-project.env
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

The bot auto-joins the first configured channel name, defaulting to `일반,General,general`.

## Discord Commands

Before using commands, set up the Discord application/bot:

- Hermes Agent Discord guide: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord official bot docs: <https://docs.discord.com/developers/bots/overview>

Then run `vc bot invite CLIENT_ID` for the VerbalCoding permissions.

| Command | Purpose |
|---|---|
| `!ping` | Basic bot check |
| `!join` / `!leave` | Join or leave voice |
| `!say <text>` | Speak text directly through TTS |
| `!voice-test <text>` | Test the active TTS backend/voice |
| `!voice-clone capture` | Save the next valid utterance as an OpenVoice reference sample |
| `!voice-clone status` / `!voice-clone cancel` | Inspect or cancel capture |
| `!ask <prompt>` | Send text through the same harness adapter as voice |
| `!session status` | Show current project/default adapter session |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Create a project-scoped Hermes session |
| `!session attach-voice [sessionName] --voice <voice-channel>` | Bind a text channel/thread to a voice channel |
| `!session list` | List configured project sessions |
| `!session reset` / `!reset-session` | Clear the current session file |
| `!verbose on/off` | Toggle detailed progress updates |
| `!latency` / `!metrics` | Show recent latency summary |
| `!sensitivity normal/conservative` | Switch barge-in sensitivity |

Voice equivalents such as “외부 모드”, “보수 모드”, “실내”, “기본 감도”, “상세 진행 켜”, and clear stop phrases like “잠깐”, “멈춰”, “그만” are handled by the bridge.

## Changing the Voice

`vc language ko|en|auto` changes STT language, progress language, and the matching default TTS voice together. Live voice commands can change the speaker without restart:

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

Built-in Edge types:

| Voice type | Edge voice |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

Backend voice settings:

| Backend | Voice setting | Common choices |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | Built-in types or any Edge voice from `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5`; `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | A permitted reference WAV plus style such as `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | Reference WAV or backend speaker/model values |

## Long Dictation and Pauses

The default `UTTERANCE_IDLE_MS=4500` waits long enough to keep natural pauses inside one spoken instruction. Lower it for faster short commands or raise it for long dictation:

```bash
UTTERANCE_IDLE_MS="6000"
```

## Verbose Progress Mode

Enable with `!verbose on`, `AGENT_VERBOSE_PROGRESS=1`, or “상세 진행 켜”. Progress lines look like:

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

Secret-looking fields are redacted and progress lines are removed from final spoken answers.

## Latency Metrics

Latency records are written to `./.logs/latency.jsonl`. In Discord, run:

```text
!latency
!metrics
```

## Testing

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

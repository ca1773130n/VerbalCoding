# VerbalCoding Usage Guide

This page holds the operational details that used to make the README too long.

## CLI Commands

```bash
vc status                    # show STT language, progress language, and TTS voice
vc language en               # English STT + English progress/TTS voice
vc language ko               # Korean STT + Korean progress/TTS voice
vc language auto             # Whisper auto-detect STT + English progress/TTS voice
vc restart auto status       # show commit-time voice-bot auto-restart setting
vc restart auto on           # enable commit-time voice-bot auto-restart
vc restart auto off          # disable it; this is the default
vc bot invite CLIENT_ID      # print a Discord invite URL with required permissions
vc instance status           # list per-instance bridge configs and process status
vc instance setup NAME       # write instances/NAME.env and create ~/.hermes/profiles/NAME
vc instance start NAME       # start ./run.sh instances/NAME.env detached
vc instance stop NAME        # stop a detached instance and remove its pid file
vc doctor                    # run the redacted doctor check
npm run mcp                  # run the stdio MCP server
```

Language changes update `.env`; restart the bridge with `./run.sh` or your process manager for them to take effect.

## Run Modes

Single-instance bridge:

```bash
./run.sh
```

Per-instance bridge using a local override env:

```bash
./run.sh instances/my-project.env
# or
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

The bot auto-joins the first configured channel name, defaulting to `일반,General,general`.

## Discord Commands

| Command | Purpose |
|---|---|
| `!ping` | Basic bot check |
| `!join` / `!leave` | Join or leave voice |
| `!say <text>` | Speak text directly through TTS |
| `!voice-test <text>` | Test the active TTS backend/voice |
| `!voice-clone capture` | Save the next valid utterance as an OpenVoice reference sample |
| `!voice-clone status` / `!voice-clone cancel` | Inspect or cancel capture |
| `!ask <prompt>` | Send text through the same selected harness adapter as voice |
| `!session status` | Show current project/default adapter session |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | Create a project-scoped Hermes session |
| `!session attach-voice [sessionName] --voice <voice-channel>` | Bind text channel/thread to a voice channel |
| `!session list` | List configured project sessions |
| `!session reset` / `!reset-session` | Clear current project/default adapter session file |
| `!verbose on/off` | Toggle detailed progress updates |
| `!latency` / `!metrics` | Show recent latency summary |
| `!sensitivity normal/conservative` | Switch barge-in sensitivity |

Voice equivalents such as “외부 모드”, “보수 모드”, “실내”, “기본 감도”, and clear stop phrases like “잠깐”, “멈춰”, “그만” are handled by the bridge. You can also say “상세 진행 켜” / “상세 진행 꺼” to toggle verbose progress by voice.

## Changing the Voice

`vc language ko|en|auto` changes STT language, progress language, and the matching default TTS voice together. If you only want to change the speaker/voice while the bridge is running, say it in Discord voice:

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

The live bridge recognizes these as voice-control commands, updates `config/tts-voices.json`, updates the effective TTS env for the running process, and answers with a short confirmation such as “목소리를 Korean male로 바꿨어.” Use `!voice-test <text>` right after changing it to hear the current backend and voice.

Built-in Edge voice types:

| Voice type | Edge voice |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

For persistent manual config, set `TTS_BACKEND=edge`, `TTS_VOICE_TYPE=<voice-type>`, and optionally `TTS_VOICE=<edge-voice>` in `.env`, or edit `config/tts-voices.json` for custom voice catalogs.

Backend-specific voice knobs:

| Backend | Voice setting | Common choices |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`, `korean_female`, `korean_multilingual_male`, `english_male`, `english_female`; any Edge voice from `edge-tts --list-voices` |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5`; set `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | a permitted reference WAV plus style such as `default` |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | reference WAV for CosyVoice, or backend-supported speaker/model values |

For Supertonic and local clone backends, use the backend env vars above plus `!voice-test <text>` to audition changes. Voice-command switching currently maps the built-in Edge-style voice types; richer backend catalogs can be added in `config/tts-voices.json`.

## Long Dictation and Pauses

VerbalCoding waits for an idle window before sending speech to STT. The default `UTTERANCE_IDLE_MS=4500` is intentionally a bit patient so a natural pause in a long instruction does not split the sentence, start an agent turn too early, and then treat the rest as a processing-time interruption.

If you prefer faster short commands, lower it in `.env`; if long Korean dictation is still being split, raise it:

```bash
UTTERANCE_IDLE_MS="6000"
```

## Verbose Progress Mode

Verbose progress is off by default unless `AGENT_VERBOSE_PROGRESS=1` is set. Enable it with `!verbose on` or a voice command like “상세 진행 켜”. It can emit short progress lines such as:

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

This mode asks the selected CLI harness to emit `VERBALCODING_PROGRESS: ...` lines and summarizes common tool markers from streaming stdout/stderr when available. Secret-looking fields are redacted and progress lines are removed from the final spoken answer.

## Latency Metrics

VerbalCoding writes per-turn latency records as JSONL. Default path:

```text
./.logs/latency.jsonl
```

Each record includes status, total time, voice capture time, utterance idle wait, STT time, agent time, TTS synthesis/playback time, chunk counts, transcript length, answer length, and audio levels where available.

In Discord:

```text
!latency
!metrics
```

The summary uses the latest 200 records: count, average, p95, max, and non-OK statuses.

## Testing

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor` intentionally redacts secrets and only reports whether required values are configured. It also checks `instances/*.env` for duplicate token fingerprints and colliding runtime paths.

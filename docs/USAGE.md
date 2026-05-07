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
| `!voice-test <text>` | Test the active TTS backend |
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

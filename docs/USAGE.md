# VerbalCoding Usage Guide

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../README.md">README</a> ·
  <a href="README.md">Docs hub</a> ·
  <a href="FRESH_INSTALL.md">Fresh Install</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.md">Troubleshooting</a> ·
  <a href="MULTI_INSTANCE.md">Multi-Instance</a>
</p>

> Operational command reference for the voice bridge.
>
> Fast path: `vc setup → vc start → speak or use !ask in Discord`
<!-- /readme-glow-up:intro -->

This page holds the operational details that should stay out of the README.

## CLI Commands

```bash
vc setup                               # guided setup: prerequisites, Discord token, voice channels
vc setup --yes                         # non-interactive bootstrap/starter config for automation
vc setup --yes --no-wizard             # dependency/bootstrap only
vc setup token                         # later update Discord bot token
vc setup token TOKEN --client-id ID     # non-interactive token/client-id update
vc setup channels "General,Team Voice" # later update auto-join voice channel names
vc setup channel "General"             # alias for setup channels
vc setup voice "General"               # alias for setup channels
vc bot invite CLIENT_ID                 # print a Discord invite URL with required permissions
vc status                               # show STT language, progress language, and TTS voice
vc language en                          # English STT + English progress/TTS voice
vc language ko                          # Korean STT + Korean progress/TTS voice
vc language auto                        # Whisper auto-detect STT + English progress/TTS voice
vc restart auto status                  # show commit-time voice-bot auto-restart setting
vc restart auto on                      # enable commit-time voice-bot auto-restart
vc restart auto off                     # disable it; this is the default
vc instance list                        # list per-instance bridge configs
vc instance status [NAME]               # show instance process status
vc instance setup NAME                  # write instances/NAME.env and create ~/.hermes/profiles/NAME
vc instance start NAME                  # start ./run.sh instances/NAME.env detached
vc instance stop NAME                   # stop a detached instance and remove its pid file
vc doctor                               # run the redacted doctor check and supported auto-fixes
vc start                                # start the default bridge
npm run mcp                             # run the stdio MCP server from a clone
```

For npm/global installs, prefer `vc ...` commands. Use `./scripts/install.sh` only from a GitHub clone.

`vc setup token` and `vc setup channels` are safe follow-up commands: they update `.env` in place, preserve unrelated keys, set file mode `0600`, and avoid printing secrets.

Language changes update `.env`; restart the bridge with `vc start`, `./run.sh`, or your process manager for them to take effect.

## Run Modes

Single-instance bridge:

```bash
vc start
# clone equivalent:
./run.sh
```

Per-instance bridge using a local override env:

```bash
vc instance start my-project
# clone/debug equivalent:
./run.sh instances/my-project.env
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

The bot auto-joins the first matching configured channel name. Set it with:

```bash
vc setup channels "VerbalCoding,LLM-Wiki,General"
```

## Discord Commands

Before wiring commands, set up the Discord application/bot using the upstream guides:

- Hermes Agent Discord guide: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord official bot docs: <https://docs.discord.com/developers/bots/overview>

Then use `vc bot invite CLIENT_ID` to generate the VerbalCoding-specific invite URL with text and voice permissions.

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

## Cross-agent voice routing

VerbalCoding can route a single turn (or the rest of the session) to a different installed CLI agent without restarting.

| Voice phrase (en) | Voice phrase (ko) | Behavior |
|---|---|---|
| `ask Codex what it thinks` | `코덱스한테 물어봐` | Single-turn route to Codex; next utterance returns to the default. |
| `switch to Aider` | `aider로 전환` | Sticky route — every following utterance goes to Aider. |
| `back to default` | `기본으로 돌아가` | Restore the default agent (`AGENT_BACKEND` / `vc setup` selection). |
| `let Claude finish this` | — | Treated as sticky route to Claude Code. |

Recognized aliases: `hermes`, `claude` / `claude code`, `codex` / `코덱스`, `gemini` / `gemini cli` / `제미나이`, `opencode`, `openclaw`, `aider` / `에이더`, `cursor` / `cursor cli`.

Behaviors on top:

- **Missing-binary fallback** — if the requested backend's binary is not on `PATH` (resolved against the active project session's workdir when applicable), the bridge asks "Want me to use the default agent instead?" Answer "yes" / "예" to retry on the default; "no" / "아니오" to cancel.
- **TTS prefix on backend change** — when the active backend changes between turns, the spoken answer is prefixed (`Codex says: …` / `코덱스: …`). No prefix on stable backends.
- **Cross-agent context handoff** — the routed agent receives a prompt block containing the prior agent label, recent voice utterances (last 4), and the most recently resolved plan decisions, so it doesn't restart cold.
- **Plan-mode `which_agent` slot** — plans can include a `which_agent` decision listing CLI options (e.g. `codex, aider, claude, gemini, opencode, openclaw, cursor, hermes`); the user's voice answer selects which agent executes that plan.
- **Per-channel state** — routing is scoped per Discord channel; switching agents in one project room does not affect others.
- **Sticky survives interrupts** — barge-in or aborted turns keep a sticky route intact; only single-turn routes are cleared.

## Changing the Voice

`vc language ko|en|auto` changes STT language, progress language, and the matching default TTS voice together. If you only want to change the speaker/voice while the bridge is running, say it in Discord voice:

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

The live bridge recognizes these as voice-control commands, updates `config/tts-voices.json`, updates the effective TTS env for the running process, and answers with a short confirmation. Use `!voice-test <text>` right after changing it to hear the current backend and voice.

Built-in Edge voice types:

| Voice type | Edge voice |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

## Long Dictation and Pauses

VerbalCoding waits for an idle window before sending speech to STT. The default `UTTERANCE_IDLE_MS=4500` is intentionally patient so a natural pause in a long instruction does not split the sentence.

```bash
UTTERANCE_IDLE_MS="6000"  # safer for long dictation with pauses
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

Secret-looking fields are redacted and progress lines are removed from the final spoken answer.

## Docker / Container Run Mode

If you run VerbalCoding in Docker and voice auto-join fails with `Cannot perform IP discovery - socket closed`, the likely issue is UDP connectivity, not channel lookup. For Linux Docker Compose:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Remove `ports:` from that service. Docker Desktop for macOS/Windows has different host networking behavior; if UDP voice still fails there, run on the host or in a Linux VM. See [Troubleshooting](TROUBLESHOOTING.md).

## Latency Metrics

VerbalCoding writes per-turn latency records as JSONL. Default path:

```text
./.logs/latency.jsonl
```

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
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh
vc doctor
```

`vc doctor` intentionally redacts secrets and only reports whether required values are configured. It also checks `instances/*.env` for duplicate token fingerprints and colliding runtime paths.

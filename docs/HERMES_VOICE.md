# Hermes Built-in Voice vs VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../README.md">README</a> ·
  <a href="README.md">Docs hub</a> ·
  <a href="USAGE.md">Usage</a> ·
  <a href="CONFIGURATION.md">Configuration</a> ·
  <a href="TROUBLESHOOTING.md">Troubleshooting</a>
</p>

> Hermes already supports Discord voice channels. VerbalCoding is the workflow layer for people who want a coding-agent phone call, not just the baseline voice loop.
<!-- /readme-glow-up:intro -->

## What Hermes already does

Hermes Agent has built-in Discord voice-channel support through the Discord gateway. After the bot is in your server, slash commands such as `/voice join` or `/voice channel` can join the voice channel you are currently in. Hermes can then transcribe speech with Whisper/STT and speak replies back through TTS providers such as Edge TTS, ElevenLabs, OpenAI, or other configured providers.

For basic live voice chat, this is enough:

```text
Discord VC → Hermes STT → Hermes agent → TTS → Discord VC playback
```

If that is your whole requirement, use Hermes built-in voice mode first.

## What VerbalCoding adds

VerbalCoding keeps the same high-level loop, but makes it a coding-workflow runtime around CLI agents.

| Area | Hermes built-in voice | VerbalCoding |
|---|---|---|
| Primary goal | General Hermes conversation in a Discord VC | Phone-call-style coding workflow with CLI agents |
| Commands | `/voice join`, `/voice channel`, `/voice leave`, `/voice tts` | `vc setup`, `vc start`, `!join`, `!ask`, `!session`, `!verbose`, `!latency`, multi-instance commands |
| Backend | Hermes Agent | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw, or custom command |
| Session model | Normal Hermes gateway session | Project/session routing, voice-channel bindings, shared voice + `!ask` text context where supported |
| Speech UX | Baseline STT + TTS | Tuned utterance windows, language presets, transcript cleanup, text mirrors, voice tests |
| Interruption | Basic voice playback behavior | Barge-in rules that stop playback without accidentally killing an active agent task |
| Long coding tasks | Generic agent response | Progress/status prompts, verbose tool-progress summaries, diff/log suppression for TTS |
| Operations | Hermes gateway setup and config | `vc doctor` auto-fixes, redacted diagnostics, latency metrics, Docker UDP guidance, multi-bot/project rooms |

## When to choose which

Use **Hermes built-in voice** when you want:

- one bot in one Discord voice channel;
- simple speak → transcribe → answer → speak-back behavior;
- the official Hermes gateway path with minimal extra software;
- Hermes-only sessions and tools.

Use **VerbalCoding** when you want:

- voice and text to cooperate around a coding project;
- multiple agent backends, not only Hermes;
- project-specific Discord rooms or multiple bot instances;
- Korean/English language presets and runtime voice controls;
- careful barge-in behavior during long agent work;
- spoken progress without reading giant diffs, stack traces, or logs aloud;
- operational debugging with `vc doctor`, latency summaries, and container voice-network guidance.

## Honest positioning

VerbalCoding should not be described as “adding Discord voice to Hermes from scratch.” Hermes already has that baseline. A better description is:

> VerbalCoding is a Discord voice workflow layer for CLI coding agents. It can use Hermes as the default backend, while adding project routing, interruption semantics, progress UX, diagnostics, and backend switching for long-running software work.

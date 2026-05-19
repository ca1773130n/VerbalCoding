# TTS backends and latency notes

This document captures the current VerbalCoding TTS backends, the live-selection rules, and the latency caveats observed while testing on the current Mac mini.

## Current test machine

Observed host for these notes:

- Machine: Mac mini, Apple M4
- Memory: 16 GB
- OS: macOS 26.3 / Darwin 25.3.0 arm64
- Workload caveat: several measurements were taken while other heavy local processes or model-training jobs could be active. Treat local neural TTS timings as operational observations, not clean benchmarks.

## Operational rule

Edge TTS is the default safe live backend. Local neural backends are optional and should normally fall back to Edge for progress prompts unless explicitly enabled with each backend's `*_PROGRESS=1` setting.

When a user explicitly asks to switch to a specific backend, update both:

```bash
TTS_BACKEND=<backend>
TTS_VOICE_TYPE=<voice-type>
```

and `config/tts-voices.json`:

```json
{
  "currentBackend": "<backend>",
  "currentVoiceType": "<voice-type>"
}
```

The runtime re-reads voice config, so changing only `.env` can be overridden.

### Fallback notice

When a non-Edge backend fails to synthesize (model missing, runtime crash, timeout, install error), the bridge silently re-routes that utterance through Edge so the user still hears a response. The first time this happens for each backend in a session, VerbalCoding posts a one-shot warning to the active Discord text channel and speaks the same message ("`<backend>` synthesis failed; using Edge for the rest of this session." / "`<backend>` 음성 생성에 실패해서 이번 세션은 Edge로 진행할게."). Subsequent failures for the same backend stay silent.

If you see the warning, check `vc doctor` and the backend's venv/model install — the bridge will keep using Edge until the next `vc start`.

## Supported backends

| Backend | Purpose | Default path / command | Live-call suitability | Notes |
|---|---|---|---|---|
| `edge` | Free cloud TTS baseline | `edge-tts` | Best current default | Korean and English voices, fast enough for phone-call mode, progress cache works well. |
| `openvoice` | Reference-sample voice cloning | `integrations/openvoice/synth.py` | Experimental | Requires permitted reference audio. Progress falls back to Edge unless `OPENVOICE_PROGRESS=1`. |
| `speechswift` | Apple Silicon local CosyVoice / Qwen3 wrapper | `audio speak ...` | Experimental | CosyVoice is usable for demos but not as responsive as Edge; Qwen3 path is much slower. |
| `supertonic` | Local Supertonic CLI wrapper | `supertonic tts ...` | Experimental | Supports voice IDs such as `M1`; falls back to Edge on failure. |
| `omnivoice` | OmniVoice local reference/design voice | `.venv-omnivoice/bin/python integrations/omnivoice/synth.py` | Experimental | Startup/model load can feel hung. Keep Edge for live mode unless explicitly testing. |
| `qwen3tts` | Qwen3 TTS via `audio` CLI | `audio speak --engine qwen3 ...` | Slow experimental | Correct backend name is `qwen3tts` / alias `qwen3`; do not use old `q13` aliases. |
| `mlxaudio` | MLX Audio Qwen3 wrapper | `.venv-mlxaudio/bin/python integrations/mlxaudio/synth.py` | Experimental | Uses MLX Qwen3 model defaults; validate actual audible output, not only file existence. |
| `neuttsair` | NeuTTS-Air English reference cloning | `.venv-neuttsair/bin/python integrations/neuttsair/synth.py` | Too slow for current live use | English-only in practice. Q4 GGUF lowers latency but still felt unusably slow under contention. |
| `fireredtts2` | FireRedTTS-2 prompt-reference backend | `./.local/bin/fireredtts2` | Slow experimental | Can stall restart/final TTS long enough to feel broken. Honor explicit user selection, but report slowness instead of silently reverting. |
| FireRedTTS-2 MLX helper | Apple Silicon FireRed LLM-port experiment | `integrations/fireredtts2/synth_mlx.py` | Not wired as canonical backend yet | Ports the FireRed LLM token generator to MLX/Metal while keeping RedCodec in Torch; intended to avoid upstream Torch Qwen hangs/slowness. |
| `mossttsnano` | OpenMOSS / MOSS-TTS-Nano PyTorch backend | `.venv-mossttsnano/bin/python vendor/MOSS-TTS-Nano/infer.py` | Very slow experimental | On macOS use Python 3.11 venv and `--disable-wetext-processing`. |
| `mossttsnano_mlx` | MOSS-TTS-Nano hybrid MLX port | `.venv-mossttsnano/bin/python integrations/mossttsnano_mlx/synth.py` | Active experiment, not live default | Native MLX generator, KV cache, and persistent JSON-line worker were added. Still verify audibility and tokenizer/model parity. |

## Backend aliases

Accepted aliases normalize to canonical backend names:

| Alias examples | Canonical backend |
|---|---|
| `qwen3`, `qwen3-tts`, `qtts` | `qwen3tts` |
| `mlx`, `mlx-audio`, `qwen3-mlx` | `mlxaudio` |
| `neutts`, `neutts-air`, `neu tts air` | `neuttsair` |
| `firered`, `fireredtts`, `firered-tts-2` | `fireredtts2` |
| `moss`, `moss-tts`, `mossnano`, `openmoss` | `mossttsnano` |
| `moss-mlx`, `mossttsnano-mlx`, `openmoss-mlx` | `mossttsnano_mlx` |

## Observed latency

### End-to-end voice loop log

From `.logs/latency.jsonl`, 160 successful voice turns were available. These measure the whole Discord voice loop, not just TTS:

| Stage | Median | P90 | Min | Max |
|---|---:|---:|---:|---:|
| STT | 3.81 s | 4.60 s | 0.75 s | 23.70 s |
| Agent call | 16.90 s | 209.74 s | 5.58 s | 825.90 s |
| TTS synth | 3.98 s | 12.77 s | 0.72 s | 760.73 s |
| TTS playback | 19.50 s | 47.16 s | 0.99 s | 90.36 s |
| TTS total | 23.14 s | 62.28 s | 1.90 s | 782.89 s |
| Voice capture | 11.66 s | 30.02 s | 3.20 s | 109.10 s |
| Utterance idle wait | 2.60 s | 4.50 s | 2.60 s | 4.54 s |
| Total turn | 69.06 s | 289.56 s | 20.99 s | 905.24 s |

Interpretation:

- Long perceived latency is often not only TTS. Agent work and spoken playback length dominate many turns.
- A high TTS-synth max indicates local/experimental TTS can stall badly under load or fallback paths.
- Playback time is real audio duration, so long answers sound slow even if synthesis is fast.
- The idle wait is intentionally a few seconds to avoid cutting off Korean phone-call utterances.

### Local neural TTS observations

| Backend / mode | Observed behavior on this Mac mini | Practical conclusion |
|---|---|---|
| Edge TTS | Usually low seconds for chunks; reliable enough for current live mode. | Keep as default/fallback. |
| SpeechSwift CosyVoice CLI | About 6.9 s wall time for a 1.68 s Korean sample after warm-up. | Demo-capable, but sluggish for conversation. |
| SpeechSwift audio-server | Warm short Korean requests varied around 4.5-7.7 s and sometimes hung. | Not safe as the always-on live backend yet. |
| SpeechSwift/Qwen3 | About 62.5 s wall time, first chunk around 47.6 s in prior testing. | Too slow for live phone-call mode. |
| NeuTTS Air | Produced valid WAVs, but felt unusably slow while the machine was under unrelated GPU/model load. | English-only experiment; use Edge for live answers. |
| FireRedTTS-2 | Can be slow enough that restart/final TTS appears stalled. Timeout is 180 s by default. | Useful to test, but report slowness clearly. |
| FireRedTTS-2 MLX helper | Added as an Apple Silicon experiment that moves the LLM token generator to MLX/Metal and keeps RedCodec encode/decode in Torch. | Not a production backend yet; verify dependencies, imports, generated frames, and decoded volume before wiring it to `TTS_BACKEND`. |
| MOSS-TTS-Nano PyTorch | Works as an OpenMOSS path but is very slow on macOS. | Keep as correctness baseline, not live default. |
| MOSS-TTS-Nano MLX | Added native generator, sampling fixes, KV cache, and persistent worker; can reduce repeated startup overhead. | Still experimental; verify audible volume and parity before live use. |

## MOSS-TTS-Nano MLX status

Recent implementation work added:

- `integrations/mossttsnano_mlx/convert.py` for conversion experiments.
- `integrations/mossttsnano_mlx/gpt2_mlx.py` for a native MLX GPT2-like generator.
- `integrations/mossttsnano_mlx/synth.py` for the hybrid synthesis path.
- `integrations/mossttsnano_mlx/worker.py` for a persistent JSON-line worker.
- `MOSSTTSNANO_MLX_WORKER=1` to keep the worker hot between requests.
- KV cache and sampling-semantics fixes in the MLX generator.

Known caution:

- A generated WAV is not enough. Check audibility with playback or `ffmpeg volumedetect`.
- Near-silent or strange audio usually means model/tokenizer/audio-code parity is still wrong.
- Keep the PyTorch MOSS path as a reference until MLX parity is proven.

## Configuration examples

### Safe live default

```bash
TTS_BACKEND=edge
TTS_VOICE_TYPE=korean_male
TTS_VOICE=ko-KR-InJoonNeural
TTS_RATE=+10%
```

### Qwen3 TTS preset

```bash
TTS_BACKEND=qwen3tts
TTS_VOICE_TYPE=korean_preset
QWEN3TTS_COMMAND=audio
QWEN3TTS_MODE=custom
QWEN3TTS_MODEL=customVoice
QWEN3TTS_LANGUAGE=korean
QWEN3TTS_SPEAKER=sohee
QWEN3TTS_PROGRESS=0
```

### NeuTTS Air English experiment

```bash
TTS_BACKEND=neuttsair
TTS_VOICE_TYPE=cloned_reference
VOICE_LANGUAGE=en
STT_LANGUAGE=en
WHISPER_CPP_LANGUAGE=en
NEUTTSAIR_PYTHON=./.venv-neuttsair/bin/python
NEUTTSAIR_SCRIPT=integrations/neuttsair/synth.py
NEUTTSAIR_BACKBONE_REPO=neuphonic/neutts-air-q4-gguf
NEUTTSAIR_CODEC_REPO=neuphonic/neucodec
NEUTTSAIR_PROGRESS=0
```

### FireRedTTS-2 experiment

```bash
TTS_BACKEND=fireredtts2
TTS_VOICE_TYPE=prompt_reference
FIREREDTTS2_COMMAND=./.local/bin/fireredtts2
FIREREDTTS2_PRETRAINED_DIR=./pretrained_models/FireRedTTS2
FIREREDTTS2_PROMPT_AUDIO=./voice-samples/user-reference.wav
FIREREDTTS2_PROGRESS=0
```

### MOSS-TTS-Nano PyTorch experiment

```bash
TTS_BACKEND=mossttsnano
TTS_VOICE_TYPE=prompt_reference
MOSSTTSNANO_COMMAND=./.venv-mossttsnano/bin/python
MOSSTTSNANO_SCRIPT=vendor/MOSS-TTS-Nano/infer.py
MOSSTTSNANO_CHECKPOINT=OpenMOSS-Team/MOSS-TTS-Nano
MOSSTTSNANO_PROMPT_AUDIO=./voice-samples/user-reference.wav
MOSSTTSNANO_PROGRESS=0
```

### MOSS-TTS-Nano MLX worker experiment

```bash
TTS_BACKEND=mossttsnano_mlx
TTS_VOICE_TYPE=prompt_reference
MOSSTTSNANO_MLX_PYTHON=./.venv-mossttsnano/bin/python
MOSSTTSNANO_MLX_SCRIPT=integrations/mossttsnano_mlx/synth.py
MOSSTTSNANO_MLX_WORKER=1
MOSSTTSNANO_MLX_WORKER_SCRIPT=integrations/mossttsnano_mlx/worker.py
MOSSTTSNANO_TORCH_DEVICE=cpu
MOSSTTSNANO_TORCH_DTYPE=float32
MOSSTTSNANO_PROMPT_AUDIO=./voice-samples/user-reference.wav
MOSSTTSNANO_MLX_PROGRESS=0
```

## How to benchmark safely

Use a quiet machine, short fixed text, and separate synthesis from playback:

```bash
vc doctor
node --test app-node/tts_backends.test.mjs app-node/tts_settings.test.mjs app-node/tts_voice_config.test.mjs
```

For live logs, compare these fields in `.logs/latency.jsonl`:

- `stt_ms`: speech-to-text time.
- `agent_ms`: CLI agent time.
- `tts_synth_ms`: time to synthesize audio files.
- `tts_play_ms`: time spent playing generated audio.
- `total_ms`: full turn time.

When testing local neural backends, also verify:

```bash
ffmpeg -i output.wav -af volumedetect -f null -
```

A non-empty file can still be inaudible or near-silent.

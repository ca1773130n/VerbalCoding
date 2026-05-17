# 001: MOSS-TTS-Nano MLX Port Feasibility

## Question

Given VerbalCoding currently runs MOSS-TTS-Nano via PyTorch CPU on a Mac Mini M4, can we port enough of the backend to MLX to get faster local inference?

## Current PyTorch path

VerbalCoding calls:

```bash
.venv-mossttsnano/bin/python vendor/MOSS-TTS-Nano/infer.py \
  --text '...' \
  --output-audio-path /tmp/verbalcoding-mossttsnano-....wav \
  --checkpoint OpenMOSS-Team/MOSS-TTS-Nano \
  --mode voice_clone \
  --prompt-audio-path voice-samples/user-reference.wav \
  --device auto \
  --dtype auto \
  --max-new-frames 375 \
  --disable-wetext-processing
```

Observed smoke-test result on this Mac Mini M4:

- Output: 48 kHz stereo WAV (`pcm_f32le`)
- Short sentence: ~2.32 seconds of audio
- Wall time: ~52 seconds for one short Korean line
- Live shutdown/test chunks: `mossttsnano` confirmed, but 18–64 seconds per chunk

## Architecture facts discovered

### TTS autoregressive model

Loaded via:

```python
AutoModelForCausalLM.from_pretrained('OpenMOSS-Team/MOSS-TTS-Nano', trust_remote_code=True)
```

Class:

```text
MossTTSNanoForCausalLM
```

Shape:

```text
params: 117,311,232
global transformer: GPT2-like, 12 layers, hidden=768, heads=12, RoPE, vocab=16384
local transformer: GPT2-like, 1 layer, hidden=768, heads=12, RoPE, sequence n_vq+1
audio codebooks: 16 x 1024
text head tied to transformer.wte
audio heads tied to audio_embeddings[i]
```

Relevant implementation files:

```text
~/.cache/huggingface/hub/models--OpenMOSS-Team--MOSS-TTS-Nano/snapshots/.../modeling_moss_tts_nano.py
~/.cache/huggingface/hub/models--OpenMOSS-Team--MOSS-TTS-Nano/snapshots/.../gpt2_decoder.py
```

The core model is MLX-portable: embeddings, Linear layers, LayerNorm, GELU-new, RoPE causal attention, KV cache, sampling.

### Audio tokenizer / codec

Loaded via:

```python
AutoModel.from_pretrained('OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano', trust_remote_code=True)
```

Class:

```text
MossAudioTokenizerModel
```

Shape:

```text
params: 21,969,664
encoder: convolution/transformer stack
quantizer: residual LFQ
 decoder: convolution/transformer stack
```

Relevant implementation file:

```text
~/.cache/huggingface/hub/models--OpenMOSS-Team--MOSS-Audio-Tokenizer-Nano/snapshots/.../modeling_moss_audio_tokenizer.py
```

This is the harder part of a complete MLX port because it includes streaming codec logic, residual quantization, and audio decode.

## Porting options

### Option A — hybrid MLX TTS + PyTorch codec

Port only `MossTTSNanoForCausalLM` to MLX. Keep audio tokenizer encode/decode in PyTorch.

Flow:

1. PyTorch audio tokenizer encodes prompt WAV → audio codes.
2. MLX global/local transformers generate new audio-code frames.
3. PyTorch audio tokenizer decodes generated codes → waveform.

Pros:

- Much smaller first step.
- Likely captures most autoregressive generation cost.
- Avoids rewriting the codec immediately.
- Easier parity testing: compare generated token logits with PyTorch layer-by-layer.

Cons:

- Still imports PyTorch and keeps codec CPU-side.
- Prompt encode/decode may remain slow.
- Data crosses MLX↔NumPy↔Torch boundaries.

### Option B — full MLX TTS + MLX codec

Port both the TTS model and `MossAudioTokenizerModel`.

Pros:

- Real end-to-end MLX backend.
- Best chance of exploiting M4 unified memory / Metal.

Cons:

- Larger project.
- Needs faithful Conv1D/ConvTranspose/Transformer/residual LFQ implementation.
- More parity tests required.
- Streaming decode state machine must be reproduced or simplified.

### Option C — ONNX/CoreML instead of MLX

The repo already has ONNX export/runtime code. Another path is export ONNX and run with CoreML/ANE or ORT optimizations.

Pros:

- Existing export wrappers expose global prefill, decode, local decoder, and codec decode pieces.
- Less hand-porting.

Cons:

- User specifically asked MLX.
- ORT macOS may still be CPU-bound depending providers.
- CoreML conversion of dynamic KV-cache decoding can be painful.

## Recommended implementation path

Start with **Option A hybrid MLX TTS + PyTorch codec**.

Milestones:

1. Install MLX in `.venv-mossttsnano`.
2. Create `integrations/mossttsnano_mlx/` with:
   - `gpt2_mlx.py`: GPT2-like RoPE block with KV cache
   - `convert.py`: load PyTorch state dict, transpose Linear weights as needed, save MLX `.safetensors`/`.npz`
   - `generate_codes.py`: run global prefill/decode + local decoder in MLX
   - `synth.py`: hybrid wrapper that keeps PyTorch codec for prompt encode/decode
3. Parity tests:
   - embedding row construction equals PyTorch `_build_inputs_embeds`
   - one GPT2 block output close to PyTorch on fixed random input
   - global transformer logits close to PyTorch for a short prompt
   - local decoder logits close to PyTorch for a single audio frame prefix
4. Wire VerbalCoding backend `mossttsnano_mlx` or `MOSSTTSNANO_ENGINE=mlx`.
5. Benchmark on Mac Mini M4 against current PyTorch CPU path.

## Expected difficulty

Partial/hybrid MLX port: **medium-high**, likely doable in a few focused iterations.

Full end-to-end MLX codec port: **high**, because the tokenizer/codec has ~3.3k lines of custom PyTorch code and stateful streaming decode.

## Verdict: PARTIAL / WORTH SPIKING

A full MLX port is feasible but not a one-file change. The fastest useful path is to port the 117M GPT2-like TTS generator first and keep the 22M audio codec in PyTorch. If the autoregressive generator is the bottleneck, this should materially improve M4 latency. If the codec dominates, then a second phase must port `MossAudioTokenizerModel` too.

#!/usr/bin/env python3
"""Experimental MLX FireRedTTS-2 synthesis wrapper.

This ports the FireRedTTS-2 LLM token generator to MLX/Metal while keeping the
RedCodec encode/decode path in Torch. It is intended for Apple Silicon where the
upstream Torch Qwen generation path can hang or be unusably slow.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve(root: Path, value: str | None) -> str | None:
    if not value:
        return None
    p = Path(value).expanduser()
    if not p.is_absolute():
        p = root / p
    return str(p)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesize speech with FireRedTTS-2 MLX LLM")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--pretrained-dir", default="pretrained_models/FireRedTTS2")
    parser.add_argument("--device", default="mlx", help="accepted for compatibility; MLX chooses Metal automatically")
    parser.add_argument("--gen-type", default="monologue", choices=["monologue", "dialogue"])
    parser.add_argument("--speaker", default="S1")
    parser.add_argument("--prompt-audio", default="")
    parser.add_argument("--prompt-text", default="")
    parser.add_argument("--temperature", type=float, default=0.9)
    parser.add_argument("--topk", type=int, default=30)
    parser.add_argument("--max-audio-ms", type=float, default=12_000)
    parser.add_argument("--bf16", action="store_true", help="ignored; compatibility with torch wrapper")
    return parser.parse_args()


def log(msg: str) -> None:
    print(f"[firered-mlx] {msg}", file=sys.stderr, flush=True)


def main() -> int:
    args = parse_args()
    root = _repo_root()
    vendor = root / "vendor" / "FireRedTTS2"
    if vendor.exists():
        sys.path.insert(0, str(vendor))
    sys.path.insert(0, str(root))

    try:
        import numpy as np
        import mlx.core as mx
        import torch
        import torchaudio
        import soundfile as sf
        from transformers import AutoTokenizer
        from fireredtts2.codec import RedCodecInfer
        from integrations.fireredtts2.mlx_llm import load_firered_mlx_from_state_dict
    except Exception as exc:
        print(f"FireRedTTS-2 MLX dependencies missing: {exc}", file=sys.stderr, flush=True)
        return 127

    pretrained_dir = Path(_resolve(root, args.pretrained_dir) or "")
    if not pretrained_dir.exists():
        print(f"FireRedTTS-2 pretrained model not found: {pretrained_dir}", file=sys.stderr, flush=True)
        return 66

    llm_ckpt = pretrained_dir / ("llm_pretrain.pt" if args.gen_type == "monologue" else "llm_posttrain.pt")
    codec_config = pretrained_dir / "config_codec.json"
    codec_ckpt = pretrained_dir / "codec.pt"
    qwen_path = pretrained_dir / "Qwen2.5-1.5B"
    output = Path(args.output).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)

    text = args.text.strip()
    if args.gen_type == "monologue" and args.speaker and not text.startswith("["):
        text = f"[{args.speaker}]{text}"

    try:
        log("loading MLX LLM checkpoint")
        ckpt = torch.load(str(llm_ckpt), map_location="cpu", weights_only=False)["model"]
        model = load_firered_mlx_from_state_dict(ckpt)
        model.reset_caches()
        del ckpt
        log("MLX LLM loaded")

        log("loading tokenizer")
        tokenizer = AutoTokenizer.from_pretrained(str(qwen_path))

        log("loading Torch codec")
        original_torch_load = torch.load
        def torch_load_with_map_location(*load_args, **load_kwargs):
            load_kwargs.setdefault("map_location", torch.device("cpu"))
            return original_torch_load(*load_args, **load_kwargs)
        torch.load = torch_load_with_map_location
        codec = RedCodecInfer.from_pretrained(str(codec_config), str(codec_ckpt)).eval()
        torch.load = original_torch_load
        # Keep codec on MPS if possible for decode/optional prompt encode.
        codec_device = "mps" if torch.backends.mps.is_available() else "cpu"
        codec = codec.to(codec_device)
        log(f"codec loaded on {codec_device}")

        frame_tokens = []
        frame_masks = []
        prompt_audio = _resolve(root, args.prompt_audio)
        prompt_text = args.prompt_text or ""
        if prompt_audio and Path(prompt_audio).exists():
            log("encoding prompt audio with Torch codec")
            audio, sr = torchaudio.load(prompt_audio)
            if audio.shape[0] > 1:
                audio = audio[0, :].unsqueeze(0)
            audio16k = torchaudio.functional.resample(audio, sr, 16000)
            audio_len = torch.tensor([audio16k.shape[1]], dtype=torch.long, device=codec_device)
            audio_tokens, _ = codec.encode(audio16k.to(codec_device), audio_len, batch_size=24)
            audio_tokens = audio_tokens.squeeze(0).detach().cpu().numpy()

            speaker = f"[{args.speaker}]" if args.speaker and not args.speaker.startswith("[") else args.speaker
            ptext = speaker + "<|text_start|>" + prompt_text + "<|text_end|>" if prompt_text else speaker + "<|text_start|><|text_end|>"
            ids = tokenizer.encode(ptext)
            tframe = mx.zeros((len(ids), 17), dtype=mx.int32)
            tmask = mx.zeros((len(ids), 17), dtype=mx.bool_)
            tframe[:, -1] = mx.array(ids, dtype=mx.int32)
            tmask[:, -1] = True
            frame_tokens.append(tframe)
            frame_masks.append(tmask)

            # add EOS frame after prompt audio
            eos = np.zeros((audio_tokens.shape[0], 1), dtype=audio_tokens.dtype)
            audio_tokens = np.concatenate([audio_tokens, eos], axis=1)
            aframe = mx.zeros((audio_tokens.shape[1], 17), dtype=mx.int32)
            amask = mx.zeros((audio_tokens.shape[1], 17), dtype=mx.bool_)
            aframe[:, :-1] = mx.array(audio_tokens.T, dtype=mx.int32)
            amask[:, :-1] = True
            frame_tokens.append(aframe)
            frame_masks.append(amask)

        log("tokenizing target text")
        speaker = ""
        target = text
        if text.startswith("[") and "]" in text:
            speaker = text[: text.index("]") + 1]
            target = text[text.index("]") + 1 :]
        ids = tokenizer.encode(speaker + "<|text_start|>" + target + "<|text_end|>")
        tframe = mx.zeros((len(ids), 17), dtype=mx.int32)
        tmask = mx.zeros((len(ids), 17), dtype=mx.bool_)
        tframe[:, -1] = mx.array(ids, dtype=mx.int32)
        tmask[:, -1] = True
        frame_tokens.append(tframe)
        frame_masks.append(tmask)

        curr_tokens = mx.expand_dims(mx.concatenate(frame_tokens, axis=0), 0)
        curr_mask = mx.expand_dims(mx.concatenate(frame_masks, axis=0), 0)
        mx.eval(curr_tokens, curr_mask)
        log(f"prompt frames={curr_tokens.shape[1]}")

        max_generation_len = max(1, int(args.max_audio_ms / 80))
        samples = []
        for i in range(max_generation_len):
            sample = model.generate_frame(curr_tokens, curr_mask, args.temperature, args.topk)
            mx.eval(sample)
            if bool(mx.all(sample == 0).item()):
                log(f"eos at frame {i}")
                break
            samples.append(sample)
            zero = mx.zeros((1, 1), dtype=mx.int32)
            curr_tokens = mx.expand_dims(mx.concatenate([sample, zero], axis=1), 1)
            curr_mask = mx.expand_dims(mx.concatenate([mx.ones(sample.shape, dtype=mx.bool_), mx.zeros((1, 1), dtype=mx.bool_)], axis=1), 1)
            if i == 0 or (i + 1) % 20 == 0:
                log(f"generated frames={i+1}")
        if not samples:
            raise RuntimeError("MLX LLM produced no audio frames")

        log("decoding audio tokens with Torch codec")
        toks_np = mx.concatenate([mx.expand_dims(s, 0) for s in samples], axis=0)
        toks_np = np.array(toks_np).transpose(1, 2, 0)
        toks = torch.from_numpy(toks_np).long().to(codec_device)
        audio = codec.decode(toks).squeeze(0).squeeze(0).detach().cpu().numpy()
        sf.write(str(output), audio, 24000)
        log(f"wrote {output}")
        return 0
    except Exception as exc:
        print(f"FireRedTTS-2 MLX synthesis failed: {exc}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Synthesize speech with k2-fsa OmniVoice for VerbalCoding.

The wrapper keeps the Node bridge independent from OmniVoice's Python runtime.
It accepts one text chunk and writes a 24 kHz WAV file.
"""

from __future__ import annotations

import argparse
import inspect
import sys
from pathlib import Path
from typing import Any


def _torch_dtype(name: str):
    import torch

    normalized = (name or "").lower()
    if normalized in {"auto", ""}:
        return None
    if normalized in {"float16", "fp16", "half"}:
        return torch.float16
    if normalized in {"bfloat16", "bf16"}:
        return torch.bfloat16
    if normalized in {"float32", "fp32"}:
        return torch.float32
    raise ValueError(f"Unsupported OmniVoice dtype: {name}")


def _filtered_call(fn, **kwargs: Any):
    """Call fn with only supported kwargs when the signature is inspectable."""

    try:
        sig = inspect.signature(fn)
    except (TypeError, ValueError):
        return fn(**{k: v for k, v in kwargs.items() if v not in (None, "")})

    accepts_kwargs = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
    clean = {k: v for k, v in kwargs.items() if v not in (None, "")}
    if accepts_kwargs:
        return fn(**clean)
    return fn(**{k: v for k, v in clean.items() if k in sig.parameters})


def synthesize(args: argparse.Namespace) -> None:
    try:
        import soundfile as sf
        import torch
        from omnivoice import OmniVoice
    except Exception as exc:  # pragma: no cover - exercised in real install
        raise RuntimeError(
            "OmniVoice dependencies are missing. Install them in OMNIVOICE_PYTHON's environment: "
            "pip install torch torchaudio soundfile omnivoice"
        ) from exc

    dtype = _torch_dtype(args.dtype)
    load_kwargs = {"device_map": args.device}
    if dtype is not None:
        load_kwargs["dtype"] = dtype

    model = OmniVoice.from_pretrained(args.model, **load_kwargs)
    if hasattr(torch, "set_grad_enabled"):
        torch.set_grad_enabled(False)

    audio = _filtered_call(
        model.generate,
        text=args.text,
        ref_audio=args.ref_audio,
        ref_text=args.ref_text,
        language=args.language,
        speaker=args.speaker,
    )
    if isinstance(audio, tuple):
        audio = audio[0]
    if isinstance(audio, list):
        if not audio:
            raise RuntimeError("OmniVoice returned no audio")
        audio = audio[0]

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out), audio, 24000)
    if not out.exists() or out.stat().st_size <= 0:
        raise RuntimeError(f"OmniVoice wrote empty output: {out}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="VerbalCoding OmniVoice TTS wrapper")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="k2-fsa/OmniVoice")
    parser.add_argument("--device", default="mps")
    parser.add_argument("--dtype", default="float16")
    parser.add_argument("--ref-audio", default="")
    parser.add_argument("--ref-text", default="")
    parser.add_argument("--language", default="ko")
    parser.add_argument("--speaker", default="")
    args = parser.parse_args(argv)
    synthesize(args)
    return 0


if __name__ == "__main__":  # pragma: no cover
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"OmniVoice synthesis failed: {exc}", file=sys.stderr)
        raise SystemExit(1)

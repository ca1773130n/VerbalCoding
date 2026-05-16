#!/usr/bin/env python3
"""VerbalCoding FireRedTTS-2 synthesis wrapper.

This wrapper gives the Node bridge a stable CLI even though upstream FireRedTTS-2
is primarily documented as a Python API.
"""
from __future__ import annotations

import argparse
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


def _auto_device(requested: str) -> str:
    requested = (requested or "auto").lower()
    if requested != "auto":
        return requested
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesize speech with FireRedTTS-2")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--output", required=True, help="Output WAV path")
    parser.add_argument("--pretrained-dir", default="pretrained_models/FireRedTTS2")
    parser.add_argument("--device", default="auto", help="auto | cuda | mps | cpu")
    parser.add_argument("--gen-type", default="monologue", choices=["monologue", "dialogue"])
    parser.add_argument("--speaker", default="S1", help="Speaker tag for monologue text; empty for raw text")
    parser.add_argument("--prompt-audio", default="", help="Optional zero-shot prompt audio")
    parser.add_argument("--prompt-text", default="", help="Transcript for prompt audio")
    parser.add_argument("--temperature", type=float, default=0.9)
    parser.add_argument("--topk", type=int, default=30)
    parser.add_argument("--bf16", action="store_true", help="Use bfloat16 when upstream supports it")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = _repo_root()
    vendor = root / "vendor" / "FireRedTTS2"
    if vendor.exists():
        sys.path.insert(0, str(vendor))

    try:
        import torch
        import soundfile as sf
        from fireredtts2.fireredtts2 import FireRedTTS2
    except Exception as exc:
        print(
            "FireRedTTS-2 Python dependencies are missing. Run `vc doctor` or "
            "`scripts/install_fireredtts2.sh --yes` first.\n"
            f"Import error: {exc}",
            file=sys.stderr,
        )
        return 127

    pretrained_dir = _resolve(root, args.pretrained_dir)
    if not pretrained_dir or not Path(pretrained_dir).exists():
        print(
            f"FireRedTTS-2 pretrained model not found: {pretrained_dir}. "
            "Run `vc doctor` to download it.",
            file=sys.stderr,
        )
        return 66

    prompt_audio = _resolve(root, args.prompt_audio)
    prompt_text = args.prompt_text or None
    if prompt_audio and not Path(prompt_audio).exists():
        # Do not fail hard for a missing reference sample; random speaker mode is useful
        # for first-run smoke tests and package installs.
        prompt_audio = None
        prompt_text = None

    device = _auto_device(args.device)
    output = Path(args.output).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)

    text = args.text.strip()
    if args.gen_type == "monologue" and args.speaker and not text.startswith("["):
        text = f"[{args.speaker}]{text}"

    try:
        if not torch.cuda.is_available():
            original_torch_load = torch.load

            def torch_load_with_map_location(*load_args, **load_kwargs):
                load_kwargs.setdefault("map_location", torch.device(device))
                return original_torch_load(*load_args, **load_kwargs)

            torch.load = torch_load_with_map_location

        model_kwargs = {
            "pretrained_dir": pretrained_dir,
            "gen_type": args.gen_type,
            "device": device,
        }
        # Upstream added bf16 later; pass only if accepted.
        if args.bf16:
            model_kwargs["use_bf16"] = True
        try:
            tts = FireRedTTS2(**model_kwargs)
        except TypeError:
            model_kwargs.pop("use_bf16", None)
            tts = FireRedTTS2(**model_kwargs)

        generate_kwargs = {"text": text, "temperature": args.temperature, "topk": args.topk}
        if prompt_audio:
            generate_kwargs["prompt_wav"] = prompt_audio
            if prompt_text:
                generate_kwargs["prompt_text"] = prompt_text
        try:
            audio = tts.generate_monologue(**generate_kwargs)
        except TypeError:
            generate_kwargs.pop("temperature", None)
            generate_kwargs.pop("topk", None)
            audio = tts.generate_monologue(**generate_kwargs)

        if hasattr(audio, "detach"):
            audio = audio.detach().cpu()
        if hasattr(audio, "numpy"):
            audio_np = audio.numpy()
        else:
            audio_np = audio
        if getattr(audio_np, "ndim", 1) == 2 and audio_np.shape[0] <= 8:
            audio_np = audio_np.T
        sf.write(str(output), audio_np, 24000)
    except Exception as exc:
        print(f"FireRedTTS-2 synthesis failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

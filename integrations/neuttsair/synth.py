#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve(root: Path, value: str | None) -> str | None:
    if not value:
        return None
    p = Path(value).expanduser()
    if not p.is_absolute():
        p = root / p
    return str(p)


def read_text_arg(value: str | None) -> str:
    if not value:
        return ""
    p = Path(value).expanduser()
    if p.exists():
        return p.read_text(encoding="utf-8").strip()
    return value.strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NeuTTS-Air synthesis wrapper for VerbalCoding")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--backbone", "--backbone-repo", dest="backbone", default="neuphonic/neutts-air-q4-gguf")
    parser.add_argument("--codec", "--codec-repo", dest="codec", default="neuphonic/neucodec")
    parser.add_argument("--backbone-device", default="cpu")
    parser.add_argument("--codec-device", default="cpu")
    parser.add_argument("--ref-audio", default="")
    parser.add_argument("--ref-text", default="")
    parser.add_argument("--ref-text-file", default="")
    parser.add_argument("--language", default="en")
    parser.add_argument("--sample-rate", type=int, default=24000)
    parser.add_argument("--cache-ref", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = repo_root()
    vendor = root / "vendor" / "neutts-air"
    if vendor.exists():
        sys.path.insert(0, str(vendor))
    try:
        import soundfile as sf
        import torch
        from neutts import NeuTTS
    except Exception as exc:
        print(f"NeuTTS-Air dependencies are missing: {exc}", file=sys.stderr, flush=True)
        return 127

    ref_audio = resolve(root, args.ref_audio)
    ref_text = read_text_arg(args.ref_text_file) or read_text_arg(args.ref_text)
    if not ref_audio or not Path(ref_audio).exists():
        print(f"NeuTTS-Air reference audio not found: {ref_audio}", file=sys.stderr, flush=True)
        return 66
    if not ref_text:
        # Fall back to a short generic transcript; users should configure NEUTTSAIR_REF_TEXT
        # or NEUTTSAIR_REF_TEXT_FILE for best cloning quality.
        ref_text = "This is a reference voice sample."

    out = Path(args.output).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    cache_path = Path(ref_audio).with_suffix(".neutts.pt")

    try:
        print(f"[neutts-air] loading backbone={args.backbone} codec={args.codec}", file=sys.stderr, flush=True)
        tts = NeuTTS(
            backbone_repo=args.backbone,
            backbone_device=args.backbone_device,
            codec_repo=args.codec,
            codec_device=args.codec_device,
        )
        if args.cache_ref and cache_path.exists():
            print(f"[neutts-air] loading cached reference {cache_path}", file=sys.stderr, flush=True)
            ref_codes = torch.load(cache_path, map_location="cpu", weights_only=False)
        else:
            print(f"[neutts-air] encoding reference {ref_audio}", file=sys.stderr, flush=True)
            ref_codes = tts.encode_reference(ref_audio)
            if args.cache_ref:
                torch.save(ref_codes, cache_path)
        print(f"[neutts-air] generating chars={len(args.text)}", file=sys.stderr, flush=True)
        wav = tts.infer(args.text, ref_codes, ref_text)
        sf.write(str(out), wav, args.sample_rate)
        print(f"[neutts-air] wrote {out}", file=sys.stderr, flush=True)
        return 0
    except Exception as exc:
        print(f"NeuTTS-Air synthesis failed: {exc}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

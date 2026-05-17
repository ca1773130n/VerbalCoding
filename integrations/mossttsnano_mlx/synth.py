#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import subprocess
import sys
import time
from pathlib import Path
from typing import Sequence


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def check_mlx() -> dict[str, object]:
    try:
        import mlx.core as mx  # type: ignore
    except Exception as exc:  # pragma: no cover - exercised by CLI smoke in envs without mlx
        return {"available": False, "error": f"{type(exc).__name__}: {exc}"}
    try:
        device = str(mx.default_device())
    except Exception as exc:
        device = f"unknown: {type(exc).__name__}: {exc}"
    return {"available": True, "device": device}


def inspect_tts_model(checkpoint: str) -> dict[str, object]:
    try:
        from transformers import AutoConfig  # type: ignore
    except Exception as exc:
        return {"ok": False, "error": f"transformers import failed: {type(exc).__name__}: {exc}"}
    try:
        cfg = AutoConfig.from_pretrained(checkpoint, trust_remote_code=True)
        gpt2 = getattr(cfg, "gpt2_config", None)
        return {
            "ok": True,
            "model_type": getattr(cfg, "model_type", None),
            "architectures": getattr(cfg, "architectures", None),
            "n_vq": getattr(cfg, "n_vq", None),
            "audio_codebook_sizes": getattr(cfg, "audio_codebook_sizes", None),
            "global_layers": getattr(gpt2, "n_layer", None),
            "hidden_size": getattr(gpt2, "n_embd", None) or getattr(gpt2, "hidden_size", None),
            "heads": getattr(gpt2, "n_head", None),
            "position_embedding_type": getattr(gpt2, "position_embedding_type", None),
            "local_transformer_layers": getattr(cfg, "local_transformer_layers", None),
        }
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


def build_torch_infer_args(args: argparse.Namespace) -> list[str]:
    infer_script = Path(args.torch_infer_script)
    if not infer_script.is_absolute():
        infer_script = repo_root() / infer_script
    cmd = [
        sys.executable,
        str(infer_script),
        "--text",
        args.text,
        "--output-audio-path",
        args.output_audio_path,
        "--checkpoint",
        args.checkpoint,
        "--mode",
        args.mode,
        "--device",
        args.torch_device,
        "--dtype",
        args.torch_dtype,
        "--max-new-frames",
        str(args.max_new_frames),
    ]
    if args.audio_tokenizer_pretrained_name_or_path:
        cmd.extend(["--audio-tokenizer-pretrained-name-or-path", args.audio_tokenizer_pretrained_name_or_path])
    if args.prompt_audio_path:
        cmd.extend(["--prompt-audio-path", args.prompt_audio_path])
    if args.prompt_text:
        cmd.extend(["--prompt-text", args.prompt_text])
    if args.seed is not None:
        cmd.extend(["--seed", str(args.seed)])
    if args.disable_wetext_processing:
        cmd.append("--disable-wetext-processing")
    return cmd


def run_hybrid(args: argparse.Namespace) -> int:
    started = time.time()
    mlx_status = check_mlx()
    model_info = inspect_tts_model(args.checkpoint)
    logging.info("mlx status: %s", json.dumps(mlx_status, ensure_ascii=False))
    logging.info("moss tts model: %s", json.dumps(model_info, ensure_ascii=False))

    if not mlx_status.get("available"):
        logging.warning("MLX unavailable; using PyTorch MOSS fallback")
    if not model_info.get("ok"):
        logging.warning("Could not inspect MOSS checkpoint; using PyTorch MOSS fallback")

    # Phase-1 scaffold: keep audio codec and actual generation on the upstream
    # PyTorch implementation while exposing a stable CLI/backend boundary for
    # the MLX generator port. The next step replaces this subprocess with:
    # PyTorch codec encode -> MLX global/local generator -> PyTorch codec decode.
    cmd = build_torch_infer_args(args)
    logging.info("phase1 hybrid fallback command: %s", " ".join(cmd[:2] + ["..."]))
    proc = subprocess.run(cmd, cwd=repo_root(), check=False)
    elapsed = time.time() - started
    logging.info("mossttsnano_mlx phase1 completed code=%s elapsed=%.3fs output=%s", proc.returncode, elapsed, args.output_audio_path)
    return int(proc.returncode or 0)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Experimental MLX/hybrid MOSS-TTS-Nano synthesizer.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output-audio-path", required=True)
    parser.add_argument("--checkpoint", default="OpenMOSS-Team/MOSS-TTS-Nano")
    parser.add_argument("--audio-tokenizer-pretrained-name-or-path", default="OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano")
    parser.add_argument("--mode", default="voice_clone", choices=("continuation", "voice_clone"))
    parser.add_argument("--prompt-audio-path", default="")
    parser.add_argument("--prompt-text", default="")
    parser.add_argument("--max-new-frames", type=int, default=120)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--torch-infer-script", default="vendor/MOSS-TTS-Nano/infer.py")
    parser.add_argument("--torch-device", default="cpu")
    parser.add_argument("--torch-dtype", default="float32")
    parser.add_argument("--disable-wetext-processing", action="store_true", default=True)
    parser.add_argument("--enable-wetext-processing", dest="disable_wetext_processing", action="store_false")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
    args = parse_args(argv)
    return run_hybrid(args)


if __name__ == "__main__":
    raise SystemExit(main())

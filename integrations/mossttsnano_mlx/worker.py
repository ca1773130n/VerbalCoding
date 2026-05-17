#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Sequence

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from integrations.mossttsnano_mlx.synth import (
    _ensure_vendor_imports,
    _install_mlx_generator,
    _load_model,
    _prepare_text,
    _resolve_device,
    _resolve_dtype,
    check_mlx,
    inspect_tts_model,
)


def _json_stdout(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


class MossTtsNanoMlxWorker:
    def __init__(self, args: argparse.Namespace) -> None:
        started = time.time()
        mlx_status = check_mlx()
        model_info = inspect_tts_model(args.checkpoint)
        logging.info("mlx status: %s", json.dumps(mlx_status, ensure_ascii=False))
        logging.info("moss tts model: %s", json.dumps(model_info, ensure_ascii=False))
        if not mlx_status.get("available"):
            raise RuntimeError(f"MLX requested but unavailable: {mlx_status.get('error')}")
        if not model_info.get("ok"):
            raise RuntimeError(f"Could not inspect MOSS checkpoint for MLX generation: {model_info.get('error')}")

        _ensure_vendor_imports()
        self.args = args
        self.device = _resolve_device(args.torch_device)
        self.dtype = _resolve_dtype(args.torch_dtype, self.device)
        if args.seed is not None:
            import torch

            torch.manual_seed(args.seed)
        self.model = _load_model(args.checkpoint, device=self.device, dtype=self.dtype)
        _install_mlx_generator(self.model)
        logging.info("mossttsnano_mlx worker ready elapsed=%.3fs", time.time() - started)

    def synthesize(self, request: dict[str, Any]) -> dict[str, Any]:
        started = time.time()
        text_value = str(request.get("text") or "")
        output_audio_path = str(request.get("output_audio_path") or request.get("output") or "")
        if not text_value.strip():
            raise ValueError("request.text is required")
        if not output_audio_path.strip():
            raise ValueError("request.output_audio_path is required")

        args = SimpleNamespace(**vars(self.args))
        args.text = text_value
        args.output_audio_path = output_audio_path
        text, prompt_text = _prepare_text(args, self.model)
        logging.info("worker inference start chars=%s mode=%s max_new_frames=%s", len(text), args.mode, args.max_new_frames)
        result = self.model.inference(
            text=text,
            output_audio_path=output_audio_path,
            mode=args.mode,
            prompt_text=prompt_text,
            prompt_audio_path=args.prompt_audio_path,
            text_tokenizer_path=args.text_tokenizer_path,
            audio_tokenizer_type="moss-audio-tokenizer-nano",
            audio_tokenizer_pretrained_name_or_path=args.audio_tokenizer_pretrained_name_or_path,
            device=self.device,
            nq=args.nq,
            max_new_frames=args.max_new_frames,
            voice_clone_max_text_tokens=args.voice_clone_max_text_tokens,
            voice_clone_max_memory_per_sample_gb=args.voice_clone_max_memory_per_sample_gb,
            do_sample=bool(args.do_sample),
            text_temperature=1.5 if args.text_temperature is None else args.text_temperature,
            text_top_p=1.0 if args.text_top_p is None else args.text_top_p,
            text_top_k=50 if args.text_top_k is None else args.text_top_k,
            audio_temperature=1.7 if args.audio_temperature is None else args.audio_temperature,
            audio_top_p=0.8 if args.audio_top_p is None else args.audio_top_p,
            audio_top_k=25 if args.audio_top_k is None else args.audio_top_k,
            audio_repetition_penalty=1.0 if args.audio_repetition_penalty is None else args.audio_repetition_penalty,
            use_kv_cache=True,
        )
        elapsed = time.time() - started
        frames = int(result["audio_token_ids"].shape[0])
        logging.info("worker inference done output=%s frames=%s elapsed=%.3fs", result["audio_path"], frames, elapsed)
        return {
            "output_audio_path": str(result["audio_path"]),
            "sample_rate": int(result["sample_rate"]),
            "frames": frames,
            "elapsed": elapsed,
        }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Persistent JSONL worker for native-MLX MOSS-TTS-Nano synthesis.")
    parser.add_argument("--checkpoint", default="OpenMOSS-Team/MOSS-TTS-Nano")
    parser.add_argument("--audio-tokenizer-pretrained-name-or-path", default="OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano")
    parser.add_argument("--mode", default="voice_clone", choices=("continuation", "voice_clone"))
    parser.add_argument("--prompt-audio-path", default="")
    parser.add_argument("--prompt-text", default="")
    parser.add_argument("--text-tokenizer-path", default=None)
    parser.add_argument("--max-new-frames", type=int, default=120)
    parser.add_argument("--nq", type=int, default=None)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--torch-device", default="cpu")
    parser.add_argument("--torch-dtype", default="float32")
    parser.add_argument("--do-sample", type=int, nargs="?", const=1, default=1, choices=[0, 1])
    parser.add_argument("--text-temperature", type=float, default=None)
    parser.add_argument("--text-top-p", type=float, default=None)
    parser.add_argument("--text-top-k", type=int, default=None)
    parser.add_argument("--audio-temperature", type=float, default=None)
    parser.add_argument("--audio-top-p", type=float, default=None)
    parser.add_argument("--audio-top-k", type=int, default=None)
    parser.add_argument("--audio-repetition-penalty", type=float, default=None)
    parser.add_argument("--voice-clone-max-text-tokens", type=int, default=160)
    parser.add_argument("--voice-clone-max-memory-per-sample-gb", type=float, default=4.0)
    parser.add_argument("--print-voice-clone-text-chunks", action="store_true", default=False)
    parser.add_argument("--disable-wetext-processing", action="store_true", default=True)
    parser.add_argument("--enable-wetext-processing", dest="disable_wetext_processing", action="store_false")
    parser.add_argument("--enable-normalize-tts-text", action="store_true", default=True)
    parser.add_argument("--disable-normalize-tts-text", dest="enable_normalize_tts_text", action="store_false")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO, stream=sys.stderr)
    args = parse_args(argv)
    try:
        worker = MossTtsNanoMlxWorker(args)
        _json_stdout({"type": "ready"})
    except Exception as exc:
        logging.exception("worker startup failed")
        _json_stdout({"type": "ready", "ok": False, "error": f"{type(exc).__name__}: {exc}"})
        return 1

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            request_id = request.get("id")
            if request.get("type") == "shutdown":
                _json_stdout({"id": request_id, "ok": True, "type": "shutdown"})
                return 0
            result = worker.synthesize(request)
            _json_stdout({"id": request_id, "ok": True, **result})
        except Exception as exc:
            logging.exception("worker request failed")
            request_id = None
            try:
                request_id = json.loads(line).get("id")
            except Exception:
                pass
            _json_stdout({"id": request_id, "ok": False, "error": f"{type(exc).__name__}: {exc}"})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

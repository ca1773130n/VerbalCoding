#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Sequence


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


def _ensure_vendor_imports() -> None:
    root = repo_root()
    vendor = root / "vendor" / "MOSS-TTS-Nano"
    for path in (root, vendor):
        value = str(path)
        if value not in sys.path:
            sys.path.insert(0, value)


def _resolve_device(name: str) -> Any:
    from infer import resolve_device  # type: ignore

    return resolve_device(name)


def _resolve_dtype(name: str, device: Any) -> Any:
    from infer import resolve_dtype  # type: ignore

    return resolve_dtype(name, device)


def _load_model(checkpoint: str, *, device: Any, dtype: Any) -> Any:
    from infer import load_model  # type: ignore

    return load_model(checkpoint, device=device, dtype=dtype)


def _prepare_text(args: argparse.Namespace, model: Any) -> tuple[str, str | None]:
    from infer import maybe_print_voice_clone_text_chunks, resolve_prompt_text, resolve_text  # type: ignore
    from text_normalization_pipeline import WeTextProcessingManager, prepare_tts_request_texts  # type: ignore

    raw_text = resolve_text(args)
    raw_prompt_text = resolve_prompt_text(args) or ""
    enable_wetext_processing = bool(getattr(args, "enable_wetext_processing", False)) and not bool(args.disable_wetext_processing)
    enable_normalize_tts_text = bool(getattr(args, "enable_normalize_tts_text", True)) and not bool(getattr(args, "disable_normalize_tts_text", False))
    text_normalizer_manager = None
    if enable_wetext_processing:
        text_normalizer_manager = WeTextProcessingManager()
        snapshot = text_normalizer_manager.ensure_ready()
        if not snapshot.ready:
            raise RuntimeError(snapshot.error or snapshot.message)
    prepared_texts = prepare_tts_request_texts(
        text=raw_text,
        prompt_text=raw_prompt_text,
        voice="",
        enable_wetext=enable_wetext_processing,
        enable_normalize_tts_text=enable_normalize_tts_text,
        text_normalizer_manager=text_normalizer_manager,
    )
    text = str(prepared_texts["text"])
    prompt_text = str(prepared_texts["prompt_text"]).strip() or None
    maybe_print_voice_clone_text_chunks(model=model, args=args, text=text)
    return text, prompt_text


def _install_mlx_generator(model: Any) -> None:
    import torch

    from integrations.mossttsnano_mlx.gpt2_mlx import MossTTSNanoMLXGenerator

    generator = MossTTSNanoMLXGenerator.from_torch_model(model)

    def _generate_audio_token_ids_with_mlx(
        *,
        prompt_input_ids,
        attention_mask,
        effective_nq: int,
        max_new_frames: int,
        do_sample: bool,
        text_temperature: float,
        text_top_p: float,
        text_top_k: int,
        audio_temperature: float,
        audio_top_p: float,
        audio_top_k: int,
        audio_repetition_penalty: float,
        use_kv_cache: bool,
        resolved_device,
    ):
        del resolved_device
        logging.info(
            "mossttsnano_mlx native generator start batch=%s prompt_frames=%s max_new_frames=%s nq=%s do_sample=%s kv_cache=%s",
            tuple(prompt_input_ids.shape),
            int(prompt_input_ids.shape[1]),
            int(max_new_frames),
            int(effective_nq),
            bool(do_sample),
            bool(use_kv_cache),
        )
        audio_np = generator.generate_audio_token_ids(
            prompt_input_ids,
            attention_mask,
            max_new_frames=max_new_frames,
            effective_nq=effective_nq,
            do_sample=bool(do_sample),
            text_temperature=float(text_temperature),
            text_top_k=int(text_top_k) if text_top_k is not None else None,
            text_top_p=float(text_top_p) if text_top_p is not None else None,
            audio_temperature=float(audio_temperature),
            audio_top_k=int(audio_top_k) if audio_top_k is not None else None,
            audio_top_p=float(audio_top_p) if audio_top_p is not None else None,
            audio_repetition_penalty=float(audio_repetition_penalty),
            use_kv_cache=bool(use_kv_cache),
        )
        logging.info("mossttsnano_mlx native generator done frames=%s", int(audio_np.shape[1]))
        return torch.as_tensor(audio_np, dtype=torch.long, device=prompt_input_ids.device)

    model._generate_audio_token_ids_with_fallback = _generate_audio_token_ids_with_mlx


def run_mlx(args: argparse.Namespace) -> int:
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
    device = _resolve_device(args.torch_device)
    dtype = _resolve_dtype(args.torch_dtype, device)
    if args.seed is not None:
        import torch

        torch.manual_seed(args.seed)
    model = _load_model(args.checkpoint, device=device, dtype=dtype)
    _install_mlx_generator(model)
    text, prompt_text = _prepare_text(args, model)
    logging.info("running inference mode=%s generator=mlx codec=torch", args.mode)
    result = model.inference(
        text=text,
        output_audio_path=args.output_audio_path,
        mode=args.mode,
        prompt_text=prompt_text,
        prompt_audio_path=args.prompt_audio_path,
        text_tokenizer_path=args.text_tokenizer_path,
        audio_tokenizer_type="moss-audio-tokenizer-nano",
        audio_tokenizer_pretrained_name_or_path=args.audio_tokenizer_pretrained_name_or_path,
        device=device,
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
    logging.info(
        "saved generated audio to %s sample_rate=%s frames=%s generator=mlx codec=torch elapsed=%.3fs",
        result["audio_path"],
        result["sample_rate"],
        int(result["audio_token_ids"].shape[0]),
        elapsed,
    )
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Experimental native-MLX MOSS-TTS-Nano synthesizer with PyTorch codec.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output-audio-path", required=True)
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
    # Backward-compatible no-op: old Node settings still pass this argument.
    parser.add_argument("--torch-infer-script", default="vendor/MOSS-TTS-Nano/infer.py")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
    args = parse_args(argv)
    return run_mlx(args)


if __name__ == "__main__":
    raise SystemExit(main())

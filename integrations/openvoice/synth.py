#!/usr/bin/env python3
"""Synthesize speech with OpenVoice V2 for VerbalCoding.

This wrapper intentionally imports OpenVoice lazily inside main(), so --help and
basic argument validation work before the optional OpenVoice environment is set up.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
import tempfile


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OpenVoice V2 synthesis wrapper for VerbalCoding")
    parser.add_argument("--openvoice-dir", required=True, help="Path to cloned myshell-ai/OpenVoice repo")
    parser.add_argument("--ref-audio", required=True, help="User-owned reference voice sample")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--language", default="KR", help="MeloTTS language code, e.g. KR")
    parser.add_argument("--style", default="default", help="Reserved style label for future OpenVoice control")
    parser.add_argument("--output", required=True, help="Output WAV path")
    parser.add_argument("--speed", type=float, default=1.0, help="Base TTS speed")
    return parser.parse_args()


def fail(message: str, code: int = 2) -> None:
    print(f"openvoice_synth: {message}", file=sys.stderr)
    raise SystemExit(code)


def main() -> int:
    args = parse_args()
    openvoice_dir = Path(args.openvoice_dir).expanduser().resolve()
    ref_audio = Path(args.ref_audio).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()

    if not openvoice_dir.exists():
        fail(f"OpenVoice directory not found: {openvoice_dir}")
    if not ref_audio.exists():
        fail(f"reference audio not found: {ref_audio}")
    if not args.text.strip():
        fail("text is empty")

    sys.path.insert(0, str(openvoice_dir))
    try:
        import torch  # type: ignore
        from melo.api import TTS  # type: ignore
        from openvoice.api import ToneColorConverter  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on optional env
        fail(
            "OpenVoice/MeloTTS import failed. Run scripts/setup_openvoice.sh "
            f"and install checkpoints first. Detail: {exc}",
            code=3,
        )

    ckpt_converter = openvoice_dir / "checkpoints_v2" / "converter"
    config = ckpt_converter / "config.json"
    checkpoint = ckpt_converter / "checkpoint.pth"
    if not config.exists() or not checkpoint.exists():
        fail("OpenVoice V2 checkpoints missing under vendor/OpenVoice/checkpoints_v2/converter", code=4)

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        # The OpenVoice demo disables MPS for parts of MeloTTS; CPU is more predictable on macOS.
        device = "cpu"

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="verbalcoding-openvoice-") as tmp:
        tmp_wav = Path(tmp) / "base.wav"
        tone_color_converter = ToneColorConverter(str(config), device=device)
        tone_color_converter.watermark_model = None
        tone_color_converter.load_ckpt(str(checkpoint))
        target_se = tone_color_converter.extract_se([str(ref_audio)])

        model = TTS(language=args.language, device=device)
        speaker_ids = model.hps.data.spk2id
        speaker_key = next(iter(speaker_ids.keys()))
        speaker_id = speaker_ids[speaker_key]
        speaker_file_key = speaker_key.lower().replace("_", "-")
        source_se_path = openvoice_dir / "checkpoints_v2" / "base_speakers" / "ses" / f"{speaker_file_key}.pth"
        if not source_se_path.exists():
            fail(f"source speaker embedding missing: {source_se_path}", code=4)
        source_se = torch.load(str(source_se_path), map_location=device)

        model.tts_to_file(args.text, speaker_id, str(tmp_wav), speed=args.speed)
        tone_color_converter.convert(
            audio_src_path=str(tmp_wav),
            src_se=source_se,
            tgt_se=target_se,
            output_path=str(output),
            message="@VerbalCoding",
        )

    if not output.exists() or output.stat().st_size <= 0:
        fail("OpenVoice produced empty output", code=5)
    print(f"openvoice_synth: wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

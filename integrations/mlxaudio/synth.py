#!/usr/bin/env python3
"""VerbalCoding mlx-audio synthesis wrapper."""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesize speech with mlx-audio")
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="mlx-community/Qwen3-TTS-12Hz-1.7B-Base-8bit")
    parser.add_argument("--voice", default="Chelsie")
    parser.add_argument("--lang-code", default="ko")
    parser.add_argument("--stream", action="store_true")
    return parser.parse_args()


def newest_audio_file(directory: Path) -> Path | None:
    candidates = []
    for pattern in ("*.wav", "*.mp3", "*.flac", "*.m4a"):
        candidates.extend(directory.glob(pattern))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def main() -> int:
    args = parse_args()
    output = Path(args.output).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="verbalcoding-mlxaudio-") as tmp:
        out_dir = Path(tmp)
        cmd = [
            sys.executable,
            "-m",
            "mlx_audio.tts.generate",
            "--model",
            args.model,
            "--text",
            args.text,
            "--voice",
            args.voice,
            "--lang_code",
            args.lang_code,
            "--output_path",
            str(out_dir),
            "--join_audio",
        ]
        if args.stream:
            cmd.extend(["--stream", "--save"])
        try:
            subprocess.run(cmd, check=True, text=True, timeout=None)
        except ModuleNotFoundError:
            print("mlx-audio is not installed. Run scripts/install_mlxaudio.sh --yes first.", file=sys.stderr)
            return 127
        except subprocess.CalledProcessError as exc:
            print(f"mlx-audio synthesis failed with exit {exc.returncode}", file=sys.stderr)
            return exc.returncode or 1
        audio = newest_audio_file(out_dir)
        if not audio:
            print("mlx-audio did not produce an audio file", file=sys.stderr)
            return 66
        shutil.copyfile(audio, output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

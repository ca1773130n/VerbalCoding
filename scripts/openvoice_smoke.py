#!/usr/bin/env python3
"""Small OpenVoice smoke-test helper for VerbalCoding."""

from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a short Korean OpenVoice smoke test")
    parser.add_argument("--openvoice-dir", default="./vendor/OpenVoice")
    parser.add_argument("--ref-audio", default="./voice-samples/user-reference.wav")
    parser.add_argument("--output", default="/tmp/verbalcoding-openvoice-smoke.wav")
    parser.add_argument("--text", default="안녕하세요. 버벌코딩 목소리 복제 테스트입니다.")
    args = parser.parse_args()
    script = Path(__file__).with_name("openvoice_synth.py")
    cmd = [
        sys.executable,
        str(script),
        "--openvoice-dir", args.openvoice_dir,
        "--ref-audio", args.ref_audio,
        "--text", args.text,
        "--language", "KR",
        "--style", "default",
        "--output", args.output,
    ]
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())

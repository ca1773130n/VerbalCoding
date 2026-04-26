from __future__ import annotations

import asyncio
import subprocess
import wave
from pathlib import Path

import pytest

from app.stt import STT, WhisperCppSTT


def test_stt_factory_selects_whisper_cpp_backend():
    stt = STT(
        engine="whisper_cpp",
        model_name="/models/ggml-base.bin",
        whisper_cpp_bin="/usr/local/bin/whisper-cli",
    )

    assert isinstance(stt.backend, WhisperCppSTT)


def test_whisper_cpp_backend_writes_valid_wav_and_reads_txt(monkeypatch, tmp_path):
    captured: dict[str, object] = {}

    def fake_run(cmd, *, capture_output, text, timeout, check):
        captured["cmd"] = cmd
        captured["capture_output"] = capture_output
        captured["text"] = text
        captured["timeout"] = timeout
        captured["check"] = check
        wav_path = Path(cmd[cmd.index("-f") + 1])
        with wave.open(str(wav_path), "rb") as wav:
            captured["channels"] = wav.getnchannels()
            captured["sample_rate"] = wav.getframerate()
            captured["sample_width"] = wav.getsampwidth()
            captured["frames"] = wav.getnframes()
        out_base = Path(cmd[cmd.index("-of") + 1])
        out_base.with_suffix(".txt").write_text(" 안녕하세요 헤르메스 \n", encoding="utf-8")
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr("app.stt.shutil.which", lambda name: "/usr/local/bin/whisper-cli" if name == "whisper-cli" else None)
    backend = WhisperCppSTT(
        model_path="/models/ggml-base.bin",
        binary="whisper-cli",
        language="ko",
        timeout=7,
    )

    text = asyncio.run(backend.transcribe(b"\x01\x00" * 16000))

    assert text == "안녕하세요 헤르메스"
    assert captured["cmd"][:5] == ["/usr/local/bin/whisper-cli", "-m", "/models/ggml-base.bin", "-f", captured["cmd"][4]]
    assert "-l" in captured["cmd"] and "ko" in captured["cmd"]
    assert "-otxt" in captured["cmd"]
    assert "-sns" in captured["cmd"]
    assert "-nf" in captured["cmd"]
    assert "--suppress-regex" not in captured["cmd"]
    assert captured["channels"] == 1
    assert captured["sample_rate"] == 16000
    assert captured["sample_width"] == 2
    assert captured["frames"] == 16000
    assert captured["timeout"] == 7


def test_whisper_cpp_backend_rejects_stage_direction_noise():
    assert WhisperCppSTT._clean_text("(끄덕끄덕)") == ""
    assert WhisperCppSTT._clean_text("[음악]") == ""
    assert WhisperCppSTT._clean_text("구독과 좋아요 부탁드려요!") == ""
    assert WhisperCppSTT._clean_text("구독과 좋아요는 저에게 아주 큰 힘이 됩니다.") == ""
    assert WhisperCppSTT._clean_text(" 안녕하세요\n(끄덕끄덕)\n") == "안녕하세요"


def test_whisper_cpp_backend_rejects_missing_binary():
    backend = WhisperCppSTT(model_path="/models/ggml-base.bin", binary="/no/such/whisper-cli")

    with pytest.raises(FileNotFoundError):
        backend.transcribe_sync(b"\x01\x00" * 16000)

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
import wave
from pathlib import Path

from .audio_utils import pcm16_to_float32

log = logging.getLogger(__name__)


class FasterWhisperSTT:
    """Lazy faster-whisper speech-to-text wrapper."""

    def __init__(self, model_name: str = "base", device: str = "cpu", compute_type: str = "int8"):
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self._model = None

    @property
    def model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        return self._model

    async def transcribe(self, pcm16_16k: bytes) -> str:
        return await asyncio.to_thread(self.transcribe_sync, pcm16_16k)

    def transcribe_sync(self, pcm16_16k: bytes) -> str:
        samples = pcm16_to_float32(pcm16_16k)
        if samples.size == 0:
            return ""

        segments, _info = self.model.transcribe(
            samples,
            language="ko",
            vad_filter=True,
            beam_size=3,
            condition_on_previous_text=False,
            temperature=0.0,
            no_speech_threshold=0.55,
            log_prob_threshold=-1.0,
            compression_ratio_threshold=2.4,
        )
        accepted: list[str] = []
        for segment in segments:
            text = segment.text.strip()
            no_speech_prob = getattr(segment, "no_speech_prob", 0.0) or 0.0
            avg_logprob = getattr(segment, "avg_logprob", 0.0) or 0.0
            if not text:
                continue
            if no_speech_prob > 0.85 or avg_logprob < -1.4:
                continue
            accepted.append(text)
        return " ".join(accepted).strip()


class WhisperCppSTT:
    """whisper.cpp CLI backend. Input must be signed 16-bit 16 kHz mono PCM."""

    def __init__(self, model_path: str, binary: str = "whisper-cli", language: str = "ko", timeout: int = 20):
        self.model_path = model_path
        self.binary = binary
        self.language = language
        self.timeout = timeout

    async def transcribe(self, pcm16_16k: bytes) -> str:
        return await asyncio.to_thread(self.transcribe_sync, pcm16_16k)

    def transcribe_sync(self, pcm16_16k: bytes) -> str:
        if not pcm16_16k:
            return ""
        binary = self._resolve_binary()
        with tempfile.TemporaryDirectory(prefix="mouthcode-stt-") as tmp:
            tmpdir = Path(tmp)
            wav_path = tmpdir / "input.wav"
            out_base = tmpdir / "transcript"
            with wave.open(str(wav_path), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(16000)
                wav.writeframes(pcm16_16k)

            cmd = [
                binary,
                "-m",
                self.model_path,
                "-f",
                str(wav_path),
                "-l",
                self.language,
                "-nt",
                "-otxt",
                "-of",
                str(out_base),
                "-sns",
                "-nf",
                "-nth",
                "0.35",
                "-et",
                "2.2",
                "-lpt",
                "-0.8",
            ]
            log.debug("running whisper.cpp: %s", " ".join(cmd))
            completed = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                check=False,
            )
            if completed.returncode != 0:
                raise RuntimeError(f"whisper.cpp failed ({completed.returncode}): {completed.stderr.strip()}")
            txt_path = out_base.with_suffix(".txt")
            raw_text = txt_path.read_text(encoding="utf-8", errors="ignore") if txt_path.exists() else completed.stdout
            cleaned = self._clean_text(raw_text)
            self._save_debug_artifacts(pcm16_16k, cleaned, completed.stdout, completed.stderr)
            return cleaned

    def _save_debug_artifacts(self, pcm16_16k: bytes, text: str, stdout: str, stderr: str) -> None:
        debug_dir = os.getenv("STT_DEBUG_DIR", "").strip()
        if not debug_dir:
            return
        path = Path(debug_dir).expanduser()
        path.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        base = path / f"stt-{stamp}-{int(time.time() * 1000) % 1000:03d}"
        wav_path = base.with_suffix(".wav")
        with wave.open(str(wav_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(pcm16_16k)
        base.with_suffix(".txt").write_text(text, encoding="utf-8")
        base.with_suffix(".log").write_text(f"STDOUT:\n{stdout}\n\nSTDERR:\n{stderr}\n", encoding="utf-8", errors="ignore")

    def _resolve_binary(self) -> str:
        if Path(self.binary).exists():
            return self.binary
        resolved = shutil.which(self.binary)
        if resolved:
            return resolved
        raise FileNotFoundError(f"whisper.cpp binary not found: {self.binary}")

    @staticmethod
    def _clean_text(text: str) -> str:
        lines: list[str] = []
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue
            line = re.sub(r"^\[[^\]]+\]\s*", "", line).strip()
            if WhisperCppSTT._is_stage_direction_or_noise(line):
                continue
            if line:
                lines.append(line)
        cleaned = " ".join(lines).strip()
        if WhisperCppSTT._is_stage_direction_or_noise(cleaned):
            return ""
        return cleaned

    @staticmethod
    def _is_stage_direction_or_noise(text: str) -> bool:
        stripped = text.strip()
        if not stripped:
            return True
        normalized = re.sub(r"\s+", "", stripped)
        if re.fullmatch(r"[\(\[（【].*[\)\]）】]", normalized):
            return True
        noise_words = {"끄덕", "끄덕끄덕", "박수", "웃음", "음악", "자막", "침묵", "무음"}
        without_punct = re.sub(r"[\W_]+", "", normalized)
        if without_punct in noise_words:
            return True
        hallucination_patterns = (
            "구독",
            "좋아요",
            "알림설정",
            "시청해주셔서",
            "시청해주신",
            "다음영상",
            "영상에서만나요",
            "부탁드려요",
            "큰힘이됩니다",
        )
        return any(pattern in without_punct for pattern in hallucination_patterns)


class STT:
    """Runtime-selectable STT facade."""

    def __init__(
        self,
        model_name: str = "base",
        device: str = "cpu",
        compute_type: str = "int8",
        engine: str = "faster_whisper",
        whisper_cpp_bin: str = "whisper-cli",
    ):
        self.engine = engine
        if engine == "whisper_cpp":
            self.backend = WhisperCppSTT(model_path=model_name, binary=whisper_cpp_bin)
        elif engine == "faster_whisper":
            self.backend = FasterWhisperSTT(model_name=model_name, device=device, compute_type=compute_type)
        else:
            raise ValueError(f"unsupported STT engine: {engine}")

    async def transcribe(self, pcm16_16k: bytes) -> str:
        return await self.backend.transcribe(pcm16_16k)

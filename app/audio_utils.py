from __future__ import annotations

from collections.abc import Iterator
import audioop
import math

import numpy as np


def pcm48k_stereo_to_16k_mono(pcm: bytes) -> bytes:
    """Convert Discord PCM (48 kHz, stereo, signed 16-bit LE) to 16 kHz mono PCM."""
    if not pcm:
        return b""
    # Use CPython's audioop for channel mixing + rate conversion instead of a
    # naive triple-average. It also makes assumptions explicit: 16-bit samples,
    # 2 channels, 48 kHz input, 16 kHz mono output.
    if len(pcm) % 4:
        pcm = pcm[: len(pcm) - (len(pcm) % 4)]
    if not pcm:
        return b""
    mono48 = audioop.tomono(pcm, 2, 0.5, 0.5)
    mono16, _state = audioop.ratecv(mono48, 2, 1, 48000, 16000, None)
    return mono16


def pcm_duration_seconds(pcm: bytes, sample_rate: int = 16000) -> float:
    """Duration for signed 16-bit mono PCM."""
    return (len(pcm) // 2) / float(sample_rate)


def chunk_pcm16(pcm: bytes, frame_ms: int = 30, sample_rate: int = 16000) -> Iterator[bytes]:
    """Yield complete fixed-size PCM16 mono frames; drop incomplete tail."""
    frame_bytes = int(sample_rate * frame_ms / 1000) * 2
    if frame_bytes <= 0:
        raise ValueError("frame_ms/sample_rate produce an empty frame")
    for i in range(0, len(pcm) - frame_bytes + 1, frame_bytes):
        yield pcm[i : i + frame_bytes]


def pcm16_to_float32(pcm: bytes) -> np.ndarray:
    """Convert signed 16-bit PCM bytes to normalized float32 samples for Whisper."""
    if not pcm:
        return np.array([], dtype=np.float32)
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
    return samples / 32768.0


def pcm_rms_dbfs(pcm: bytes) -> float:
    """Return RMS loudness in dBFS for signed 16-bit PCM, or -inf for silence."""
    if not pcm:
        return float("-inf")
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
    if samples.size == 0:
        return float("-inf")
    rms = float(np.sqrt(np.mean(np.square(samples))))
    if rms <= 0:
        return float("-inf")
    return 20.0 * math.log10(rms / 32768.0)


def pcm_clip_ratio(pcm: bytes, threshold: int = 32760) -> float:
    if not pcm:
        return 0.0
    samples = np.frombuffer(pcm, dtype=np.int16)
    if samples.size == 0:
        return 0.0
    return float(np.mean((samples <= -threshold) | (samples >= threshold)))


def pcm_zero_ratio(pcm: bytes) -> float:
    if not pcm:
        return 1.0
    samples = np.frombuffer(pcm, dtype=np.int16)
    if samples.size == 0:
        return 1.0
    return float(np.mean(samples == 0))

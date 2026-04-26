from __future__ import annotations

from .audio_utils import chunk_pcm16


class VAD:
    """WebRTC VAD wrapper for 16 kHz mono PCM."""

    def __init__(self, aggressiveness: int = 3, frame_ms: int = 20, sample_rate: int = 16000):
        import webrtcvad

        self.vad = webrtcvad.Vad(aggressiveness)
        self.frame_ms = frame_ms
        self.sample_rate = sample_rate

    def is_speech(self, pcm: bytes) -> bool:
        frames = list(chunk_pcm16(pcm, frame_ms=self.frame_ms, sample_rate=self.sample_rate))
        if not frames:
            return False
        voiced = sum(1 for frame in frames if self.vad.is_speech(frame, self.sample_rate))
        return voiced / len(frames) >= 0.5

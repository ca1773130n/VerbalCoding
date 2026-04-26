from __future__ import annotations

import tempfile
from pathlib import Path


class TTS:
    """Text-to-speech using Edge TTS (free, no API key)."""

    def __init__(self, voice: str = "en-US-AriaNeural"):
        self.voice = voice
        self._stop = False

    async def synthesize_to_file(self, text: str) -> Path:
        import edge_tts

        self._stop = False
        fd, name = tempfile.mkstemp(prefix="hermes-discord-", suffix=".mp3")
        Path(name).unlink(missing_ok=True)
        # Close the fd created by mkstemp; edge-tts will create/write the file.
        import os

        os.close(fd)
        communicate = edge_tts.Communicate(text, self.voice)
        await communicate.save(name)
        return Path(name)

    async def stop(self) -> None:
        self._stop = True

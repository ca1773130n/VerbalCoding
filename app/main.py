from __future__ import annotations

import logging

from .audio_discord import DiscordAudio
from .config import load_settings


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = load_settings()
    DiscordAudio(settings).run()


if __name__ == "__main__":
    main()

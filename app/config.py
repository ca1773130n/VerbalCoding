from __future__ import annotations

import os
import shlex
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    discord_token: str
    allowed_users: set[int]
    command_prefix: str = "!"
    hermes_command: str = "hermes chat -Q -q"
    whisper_model: str = "base"
    stt_engine: str = "whisper_cpp"
    whisper_cpp_bin: str = "whisper-cli"
    wake_words: tuple[str, ...] = ("hermes", "헤르메스", "허미스")
    require_wake_word: bool = False
    tts_voice: str = "ko-KR-SunHiNeural"
    auto_join_voice_channels: tuple[str, ...] = ("일반", "General", "general")
    startup_phrase: str = ""
    transcript_channel_id: int | None = None


def _load_exports_from_zshrc() -> None:
    """Load simple `export NAME=value` assignments from ~/.zshrc without executing it."""
    path = Path.home() / ".zshrc"
    if not path.exists():
        return
    for raw in path.read_text(errors="ignore").splitlines():
        line = raw.strip()
        if not line.startswith("export ") or "=" not in line:
            continue
        key, value = line[len("export ") :].split("=", 1)
        key = key.strip()
        if key in os.environ:
            continue
        try:
            parts = shlex.split(value, posix=True)
        except ValueError:
            continue
        if parts:
            os.environ[key] = parts[0]


def _allowed_users(raw: str | None) -> set[int]:
    users: set[int] = set()
    if not raw:
        return users
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if not part:
            continue
        try:
            users.add(int(part))
        except ValueError:
            raise ValueError(f"DISCORD_ALLOWED_USERS contains non-numeric id: {part!r}")
    return users


def load_settings() -> Settings:
    load_dotenv()
    _load_exports_from_zshrc()

    token = os.getenv("DISCORD_BOT_TOKEN") or os.getenv("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("Set DISCORD_BOT_TOKEN (or DISCORD_TOKEN) in ~/.zshrc or .env")

    wake_words = tuple(
        w.strip().lower()
        for w in os.getenv("WAKE_WORDS", "hermes,헤르메스,허미스").split(",")
        if w.strip()
    )
    auto_join_voice_channels = tuple(
        name.strip()
        for name in os.getenv("AUTO_JOIN_VOICE_CHANNELS", "일반,General,general").split(",")
        if name.strip()
    )
    transcript_channel_raw = os.getenv("TRANSCRIPT_CHANNEL_ID", "1497890694730219540").strip()
    transcript_channel_id = int(transcript_channel_raw) if transcript_channel_raw else None
    default_whisper_cpp_model = str(Path(__file__).resolve().parent.parent / "models" / "ggml-small-q5_1.bin")
    stt_engine = os.getenv("STT_ENGINE", "whisper_cpp")
    whisper_model = os.getenv(
        "WHISPER_CPP_MODEL" if stt_engine == "whisper_cpp" else "WHISPER_MODEL",
        default_whisper_cpp_model if stt_engine == "whisper_cpp" else "base",
    )
    return Settings(
        discord_token=token,
        allowed_users=_allowed_users(os.getenv("DISCORD_ALLOWED_USERS")),
        command_prefix=os.getenv("DISCORD_COMMAND_PREFIX", "!"),
        hermes_command=os.getenv("HERMES_COMMAND", "hermes chat -Q -q"),
        whisper_model=whisper_model,
        stt_engine=stt_engine,
        whisper_cpp_bin=os.getenv("WHISPER_CPP_BIN", "whisper-cli"),
        wake_words=wake_words,
        require_wake_word=os.getenv("REQUIRE_WAKE_WORD", "0").lower() in {"1", "true", "yes"},
        tts_voice=os.getenv("TTS_VOICE", "ko-KR-SunHiNeural"),
        auto_join_voice_channels=auto_join_voice_channels,
        startup_phrase=os.getenv("STARTUP_PHRASE", ""),
        transcript_channel_id=transcript_channel_id,
    )

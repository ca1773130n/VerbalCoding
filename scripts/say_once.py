from __future__ import annotations

import asyncio
import os
import sys

import discord

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.config import load_settings  # noqa: E402
from app.tts import TTS  # noqa: E402
from app.audio_discord import load_discord_opus  # noqa: E402


async def main() -> None:
    text = " ".join(sys.argv[1:]) or "야, 이번엔 짧게 말할게. 들리면 바로 알려줘."
    settings = load_settings()
    channel_id = int(os.getenv("VOICE_CHANNEL_ID", "1497882473143730292"))
    load_discord_opus()
    audio = await TTS(settings.tts_voice).synthesize_to_file(text)

    intents = discord.Intents.default()
    intents.voice_states = True
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        print(f"Logged in as {client.user}", flush=True)
        channel = client.get_channel(channel_id)
        if channel is None:
            channel = await client.fetch_channel(channel_id)
        print(f"Connecting to {channel}", flush=True)
        vc = await channel.connect()
        done = asyncio.Event()

        def after(error):
            if error:
                print(f"playback error: {error!r}", flush=True)
            client.loop.call_soon_threadsafe(done.set)

        print(f"Speaking: {text}", flush=True)
        vc.play(discord.FFmpegPCMAudio(str(audio)), after=after)
        await done.wait()
        print("Playback finished", flush=True)
        await asyncio.sleep(2)
        await vc.disconnect(force=True)
        await client.close()

    try:
        await client.start(settings.discord_token)
    finally:
        audio.unlink(missing_ok=True)


if __name__ == "__main__":
    asyncio.run(main())

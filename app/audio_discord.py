from __future__ import annotations

import asyncio
import logging
import os
import time
import wave
from pathlib import Path
from ctypes.util import find_library

import discord
from discord.ext import commands, voice_recv

from .agent import Agent
from .audio_utils import pcm_clip_ratio, pcm_rms_dbfs, pcm_zero_ratio
from .config import Settings

log = logging.getLogger(__name__)
_decoder_patch_applied = False


def patch_voice_recv_decoder_errors() -> None:
    """Skip isolated bad Opus packets instead of letting voice_recv reader die."""
    global _decoder_patch_applied
    if _decoder_patch_applied:
        return
    from discord.ext.voice_recv.opus import PacketDecoder
    from discord.ext.voice_recv.reader import UDPKeepAlive

    original = PacketDecoder._decode_packet

    def safe_decode_packet(self, packet):
        try:
            return original(self, packet)
        except discord.opus.OpusError as exc:
            log.debug("Skipping bad opus packet in built-in decoder ssrc=%s: %r", getattr(self, "ssrc", "?"), exc)
            return packet, b""

    def safe_udp_keepalive_run(self) -> None:
        # discord-ext-voice-recv can spin at 100% CPU if UDP sendto() fails
        # while the voice client still reports connected. Add a small backoff
        # on the exception path and use seconds, not the library's 5000 value.
        self.voice_client.wait_until_connected()
        delay = 5.0
        while not self._end_thread.is_set():
            vc = self.voice_client
            try:
                packet = self.counter.to_bytes(8, "big")
            except OverflowError:
                self.counter = 0
                continue
            try:
                vc._connection.socket.sendto(packet, (vc._connection.endpoint_ip, vc._connection.voice_port))
            except Exception as exc:
                log.debug("Error sending UDP keepalive; backing off: %s: %s", exc.__class__.__name__, exc)
                vc.wait_until_connected()
                if not vc.is_connected():
                    break
            else:
                self.counter += 1
            time.sleep(delay)

    PacketDecoder._decode_packet = safe_decode_packet
    UDPKeepAlive.run = safe_udp_keepalive_run
    _decoder_patch_applied = True


def load_discord_opus() -> None:
    """Load libopus explicitly for Discord voice receive/decode on macOS/Homebrew."""
    if discord.opus.is_loaded():
        return
    candidates = [
        find_library("opus"),
        "/opt/homebrew/opt/opus/lib/libopus.dylib",
        "/usr/local/opt/opus/lib/libopus.dylib",
        "libopus.so.0",
        "libopus.so",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            discord.opus.load_opus(candidate)
            log.info("Loaded opus library: %s", candidate)
            return
        except OSError:
            continue
    raise RuntimeError("Could not load libopus. Install it with `brew install opus`.")


class VoiceSink(voice_recv.AudioSink):
    def __init__(self, agent: Agent):
        super().__init__()
        self.agent = agent
        self._decoders: dict[int, discord.opus.Decoder] = {}
        self._packet_count = 0
        self._unknown_packet_count = 0
        self._dual_decode_saved = 0

    def wants_opus(self) -> bool:
        # Use discord-ext-voice-recv's built-in decoder/jitter buffer, but skip
        # fake/silence/PLC packets before they reach STT. Direct per-packet Opus
        # decoding produced distorted PCM on Discord's live stream.
        return False

    def write(self, user, data) -> None:
        if data is None:
            return
        self._packet_count += 1
        packet = getattr(data, "packet", None)
        ssrc = getattr(packet, "ssrc", None)
        if packet is None or not packet or getattr(packet, "is_silence", lambda: False)():
            return
        pcm = getattr(data, "pcm", b"")
        if user is None:
            self._unknown_packet_count += 1
            if self._unknown_packet_count in {1, 50, 200} or self._unknown_packet_count % 1000 == 0:
                msg = f"⚠️ 음성 packet은 들어오는데 Discord user 매핑이 안 됨. ssrc={ssrc}, count={self._unknown_packet_count}"
                log.warning(msg)
                if self.agent.loop and self.agent.loop.is_running():
                    asyncio.run_coroutine_threadsafe(self.agent.notify_text(msg), self.agent.loop)
            return
        if not pcm:
            return
        if len(pcm) < 3840 or len(pcm) % 3840 != 0:
            log.debug("drop malformed PCM frame user=%s bytes=%s", int(user.id), len(pcm))
            return
        self._save_dual_decode_debug(int(user.id), ssrc, getattr(data, "opus", None), pcm)
        clip_ratio = pcm_clip_ratio(pcm)
        zero_ratio = pcm_zero_ratio(pcm)
        loudness = pcm_rms_dbfs(pcm)
        if zero_ratio > 0.98:
            log.info(
                "drop near-silent/PLC PCM frame user=%s bytes=%s rms=%.1f dBFS clip=%.2f%% zero=%.2f%%",
                int(user.id),
                len(pcm),
                loudness,
                clip_ratio * 100,
                zero_ratio * 100,
            )
            return
        if clip_ratio > 0.01 or loudness > -3.0:
            # Do not drop clipped/loud frames here. Live Discord speech can clip
            # when the client gain is hot, and dropping those frames removes the
            # actual voiced content, leaving STT with broken fragments. Keep the
            # diagnostic log but pass the audio through so the utterance remains
            # contiguous; STT/VAD are better positioned to reject unusable audio.
            log.info(
                "pass clipped/loud PCM frame user=%s bytes=%s rms=%.1f dBFS clip=%.2f%% zero=%.2f%%",
                int(user.id),
                len(pcm),
                loudness,
                clip_ratio * 100,
                zero_ratio * 100,
            )

        self.agent.feed(int(user.id), pcm)

    def _save_dual_decode_debug(self, uid: int, ssrc: int | None, opus: bytes | None, builtin_pcm: bytes) -> None:
        """Compare voice_recv built-in PCM with our own persistent Opus decode.

        This is diagnostic only. If both versions are distorted, the problem is
        before/at Opus packet input. If direct decode is good while built-in PCM
        is bad, we can switch the live pipeline to the direct decoder.
        """
        debug_dir = os.getenv("DUAL_DECODE_DEBUG_DIR", "").strip()
        if not debug_dir or self._dual_decode_saved >= 40 or not opus or ssrc is None:
            return
        try:
            decoder = self._decoders.setdefault(int(ssrc), discord.opus.Decoder())
            direct_pcm = decoder.decode(opus, fec=False)
        except Exception as exc:
            log.info("direct opus debug decode failed user=%s ssrc=%s: %s", uid, ssrc, exc)
            return

        self._dual_decode_saved += 1
        path = Path(debug_dir).expanduser()
        path.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        base = path / f"dual-{stamp}-{uid}-{self._dual_decode_saved:03d}"

        def write48(name: str, pcm48: bytes) -> None:
            with wave.open(str(base.with_name(base.name + f"-{name}.wav")), "wb") as wav:
                wav.setnchannels(2)
                wav.setsampwidth(2)
                wav.setframerate(48000)
                wav.writeframes(pcm48)

        write48("builtin", builtin_pcm)
        write48("direct", direct_pcm)
        log.info(
            "dual decode debug user=%s ssrc=%s opus=%s builtin=%s direct=%s builtin_rms=%.1f direct_rms=%.1f builtin_clip=%.2f%% direct_clip=%.2f%%",
            uid,
            ssrc,
            len(opus),
            len(builtin_pcm),
            len(direct_pcm),
            pcm_rms_dbfs(builtin_pcm),
            pcm_rms_dbfs(direct_pcm),
            pcm_clip_ratio(builtin_pcm) * 100,
            pcm_clip_ratio(direct_pcm) * 100,
        )

    def cleanup(self) -> None:
        self._decoders.clear()


class DiscordAudio:
    def __init__(self, settings: Settings):
        load_discord_opus()
        patch_voice_recv_decoder_errors()
        intents = discord.Intents.default()
        intents.message_content = True
        intents.voice_states = True
        logging.getLogger("discord.ext.voice_recv.reader").setLevel(logging.WARNING)
        logging.getLogger("discord.ext.voice_recv.gateway").setLevel(logging.WARNING)
        logging.getLogger("discord.ext.voice_recv.opus").setLevel(logging.WARNING)
        self.bot = commands.Bot(command_prefix=settings.command_prefix, intents=intents)
        self.settings = settings
        self.agent = Agent(settings, self.play_file, self.send_transcript)
        self.vc: voice_recv.VoiceRecvClient | None = None
        self._register_commands()

    def _authorized(self, ctx: commands.Context) -> bool:
        return not self.settings.allowed_users or int(ctx.author.id) in self.settings.allowed_users

    def _register_commands(self) -> None:
        @self.bot.event
        async def on_ready():
            self.agent.bind_loop(asyncio.get_running_loop())
            self.agent.bind_bot_user_id(int(self.bot.user.id) if self.bot.user else None)
            log.info("Logged in as %s (%s)", self.bot.user, self.bot.user.id if self.bot.user else "?")
            await self.auto_join_default_voice_channel()
            if self.settings.startup_phrase and self.vc and self.vc.is_connected():
                asyncio.create_task(self.agent.speak_text(self.settings.startup_phrase))

        @self.bot.command(name="join")
        async def join(ctx: commands.Context):
            if not self._authorized(ctx):
                return await ctx.reply("이 봇을 쓸 권한이 없어.")
            if not getattr(ctx.author, "voice", None) or not ctx.author.voice.channel:
                return await ctx.reply("먼저 음성 채널에 들어가줘.")
            await self.connect_to_channel(ctx.author.voice.channel)
            await ctx.reply("들어왔어. 이제 전화하듯이 말하면 Hermes로 처리해서 음성으로 답할게.")

        @self.bot.command(name="leave")
        async def leave(ctx: commands.Context):
            if not self._authorized(ctx):
                return await ctx.reply("이 봇을 쓸 권한이 없어.")
            await self.agent.stop()
            if self.vc and self.vc.is_connected():
                await self.vc.disconnect(force=True)
                self.vc = None
            await ctx.reply("나갈게.")

        @self.bot.command(name="say")
        async def say(ctx: commands.Context, *, prompt: str):
            if not self._authorized(ctx):
                return await ctx.reply("이 봇을 쓸 권한이 없어.")
            await ctx.reply("말할게…")
            await self.agent.speak_text(prompt)

        @self.bot.command(name="ping")
        async def ping(ctx: commands.Context):
            await ctx.reply("pong")

    async def connect_to_channel(self, channel: discord.VoiceChannel) -> None:
        if self.vc and self.vc.is_connected():
            if self.vc.channel and self.vc.channel.id == channel.id:
                return
            await self.vc.move_to(channel)
        else:
            self.vc = await channel.connect(cls=voice_recv.VoiceRecvClient)
        if not self.vc.is_listening():
            self.vc.listen(VoiceSink(self.agent))
        log.info("Listening in voice channel %s / %s", channel.guild.name, channel.name)

    async def auto_join_default_voice_channel(self) -> None:
        if self.vc and self.vc.is_connected():
            return
        wanted = {name.lower() for name in self.settings.auto_join_voice_channels}
        for guild in self.bot.guilds:
            for channel in guild.voice_channels:
                if channel.name.lower() in wanted:
                    await self.connect_to_channel(channel)
                    return
        log.warning("No auto-join voice channel found. Wanted one of: %s", ", ".join(self.settings.auto_join_voice_channels))

    async def send_transcript(self, text: str) -> None:
        channel_id = self.settings.transcript_channel_id
        if not channel_id:
            log.info("transcript: %s", text)
            return
        channel = self.bot.get_channel(channel_id)
        if channel is None:
            try:
                channel = await self.bot.fetch_channel(channel_id)
            except Exception:
                log.exception("Could not fetch transcript channel %s", channel_id)
                return
        await channel.send(text)

    async def play_file(self, path: Path) -> None:
        if not self.vc or not self.vc.is_connected():
            log.warning("No connected voice client; cannot play %s", path)
            return
        while self.vc.is_playing():
            await asyncio.sleep(0.05)
        done = asyncio.Event()

        def after(error):
            if error:
                log.exception("Discord playback failed", exc_info=error)
            self.bot.loop.call_soon_threadsafe(done.set)

        self.vc.play(discord.FFmpegPCMAudio(str(path)), after=after)
        await done.wait()

    def run(self) -> None:
        self.bot.run(self.settings.discord_token)

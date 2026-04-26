from __future__ import annotations

import asyncio
import logging
import os
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path

from .audio_utils import pcm48k_stereo_to_16k_mono, pcm_duration_seconds, pcm_rms_dbfs
from .config import Settings
from .hermes import HermesClient
from .speaker import SpeakerManager
from .stt import STT
from .tts import TTS
from .vad import VAD
from .wakeword import WakeWord

log = logging.getLogger(__name__)


@dataclass
class UtteranceBuffer:
    sample_rate: int = 16000
    silence_ms: int = 900
    min_speech_ms: int = 1000
    max_utterance_ms: int = 30_000
    audio: bytearray = field(default_factory=bytearray)
    speech_ms: int = 0
    silence_seen_ms: int = 0

    @property
    def has_audio(self) -> bool:
        return bool(self.audio)

    def add(self, pcm16_16k: bytes, is_speech: bool) -> bytes | None:
        if not pcm16_16k:
            return None
        chunk_ms = int(pcm_duration_seconds(pcm16_16k, self.sample_rate) * 1000)
        if is_speech:
            self.audio.extend(pcm16_16k)
            self.speech_ms += chunk_ms
            self.silence_seen_ms = 0
        elif self.audio:
            self.silence_seen_ms += chunk_ms

        should_emit = self.audio and (
            self.silence_seen_ms >= self.silence_ms or self.speech_ms >= self.max_utterance_ms
        )
        if not should_emit:
            return None

        utterance = bytes(self.audio) if self.speech_ms >= self.min_speech_ms else None
        self.reset()
        return utterance

    def emit(self, force: bool = False) -> bytes | None:
        if not self.audio:
            return None
        if not force and self.speech_ms < self.min_speech_ms:
            return None
        utterance = bytes(self.audio) if self.speech_ms >= self.min_speech_ms else None
        self.reset()
        return utterance

    def reset(self) -> None:
        self.audio.clear()
        self.speech_ms = 0
        self.silence_seen_ms = 0


class Agent:
    def __init__(self, settings: Settings, audio_out, text_out=None):
        self.settings = settings
        self.audio_out = audio_out
        self.text_out = text_out
        self.stt = STT(
            settings.whisper_model,
            engine=settings.stt_engine,
            whisper_cpp_bin=settings.whisper_cpp_bin,
        )
        self.tts = TTS(settings.tts_voice)
        self.hermes = HermesClient(settings.hermes_command)
        self.vad = VAD()
        self.wake = WakeWord(settings.wake_words, settings.require_wake_word)
        self.spk = SpeakerManager()
        self.buffers: dict[int, UtteranceBuffer] = {}
        self.flush_tasks: dict[int, asyncio.Task] = {}
        self.audio_queues: dict[int, asyncio.Queue[bytes]] = {}
        self.audio_workers: dict[int, asyncio.Task] = {}
        self.stt_lock = asyncio.Lock()
        self.respond_lock = asyncio.Lock()
        self.loop: asyncio.AbstractEventLoop | None = None
        self._debug_pcm_frames_saved = 0
        self.bot_user_id: int | None = None
        self.speaking = False

    def bind_bot_user_id(self, bot_user_id: int | None) -> None:
        self.bot_user_id = int(bot_user_id) if bot_user_id else None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def feed(self, uid: int, discord_pcm48_stereo: bytes) -> None:
        if self.loop and self.loop.is_running():
            future = asyncio.run_coroutine_threadsafe(self.enqueue(uid, discord_pcm48_stereo), self.loop)
            future.add_done_callback(self._log_future_error)
        else:
            task = asyncio.create_task(self.enqueue(uid, discord_pcm48_stereo))
            task.add_done_callback(self._log_task_error)

    async def enqueue(self, uid: int, discord_pcm48_stereo: bytes) -> None:
        queue = self.audio_queues.get(uid)
        if queue is None:
            queue = asyncio.Queue(maxsize=300)
            self.audio_queues[uid] = queue
            worker = asyncio.create_task(self._consume_audio(uid, queue))
            worker.add_done_callback(self._log_task_error)
            self.audio_workers[uid] = worker
        try:
            queue.put_nowait(discord_pcm48_stereo)
        except asyncio.QueueFull:
            log.warning("drop voice frame because user queue is full uid=%s size=%s", uid, queue.qsize())

    async def _consume_audio(self, uid: int, queue: asyncio.Queue[bytes]) -> None:
        while True:
            frame = await queue.get()
            try:
                await self._process_ordered(uid, frame)
            finally:
                queue.task_done()

    @staticmethod
    def _log_future_error(future) -> None:
        try:
            future.result()
        except asyncio.CancelledError:
            return
        except Exception:
            log.exception("Voice processing task failed")

    @staticmethod
    def _log_task_error(task: asyncio.Task) -> None:
        try:
            task.result()
        except asyncio.CancelledError:
            return
        except Exception:
            log.exception("Voice processing task failed")

    async def process(self, uid: int, discord_pcm48_stereo: bytes) -> None:
        # Backwards-compatible direct path for tests; live Discord input should
        # go through enqueue() so frames are processed by one per-user consumer.
        await self._process_ordered(uid, discord_pcm48_stereo)

    async def _process_ordered(self, uid: int, discord_pcm48_stereo: bytes) -> None:
        if self.bot_user_id is not None and uid == self.bot_user_id:
            log.info("Ignoring bot self audio user=%s", uid)
            return
        if self.settings.allowed_users and uid not in self.settings.allowed_users:
            log.warning("Ignoring unauthorized voice user %s; allowed=%s", uid, sorted(self.settings.allowed_users))
            await self.notify_text(f"⚠️ 음성은 들어왔는데 allowlist 밖 user라 무시됨: <@{uid}>")
            return

        pcm16 = pcm48k_stereo_to_16k_mono(discord_pcm48_stereo)
        self._save_debug_pcm48(uid, discord_pcm48_stereo, pcm16)
        if not pcm16:
            return
        loudness = pcm_rms_dbfs(pcm16)
        is_speech = self.vad.is_speech(pcm16) and loudness >= -42.0
        if self.vad.is_speech(pcm16) and not is_speech:
            log.debug("treat low-rms VAD speech as silence user=%s rms=%.1f dBFS", uid, loudness)
        if is_speech:
            self.spk.update(uid)
            if not self.spk.is_active(uid):
                log.info("Ignoring non-active speaker user=%s active=%s", uid, self.spk.active)
                return
            if self.speaking:
                log.info("User %s interrupted while bot speaking; cancelling TTS/Hermes", uid)
                await self.hermes.cancel()
                await self.tts.stop()
                self.speaking = False
        buf = self.buffers.setdefault(uid, UtteranceBuffer())
        utterance = buf.add(pcm16, is_speech)
        if buf.has_audio:
            self._schedule_idle_flush(uid)
        if not utterance:
            return

        self._cancel_idle_flush(uid)
        await self._handle_utterance(uid, utterance)

    def _schedule_idle_flush(self, uid: int) -> None:
        self._cancel_idle_flush(uid)
        task = asyncio.create_task(self._flush_after_idle(uid))
        task.add_done_callback(self._log_task_error)
        self.flush_tasks[uid] = task

    def _save_debug_pcm48(self, uid: int, pcm48_stereo: bytes, pcm16_mono: bytes) -> None:
        debug_dir = os.getenv("PCM_DEBUG_DIR", "").strip()
        if not debug_dir or self._debug_pcm_frames_saved >= 80:
            return
        self._debug_pcm_frames_saved += 1
        path = Path(debug_dir).expanduser()
        path.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        base = path / f"frame-{stamp}-{uid}-{int(time.time() * 1000) % 1000:03d}"
        raw48 = base.with_name(base.name + "-48k-stereo.wav")
        wav16 = base.with_name(base.name + "-16k-mono.wav")
        with wave.open(str(raw48), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(48000)
            wav.writeframes(pcm48_stereo)
        with wave.open(str(wav16), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(pcm16_mono)

    def _cancel_idle_flush(self, uid: int) -> None:
        task = self.flush_tasks.pop(uid, None)
        if task and not task.done():
            task.cancel()

    async def _flush_after_idle(self, uid: int) -> None:
        buf = self.buffers.get(uid)
        delay = (buf.silence_ms if buf else 700) / 1000.0
        await asyncio.sleep(delay)
        buf = self.buffers.get(uid)
        if not buf:
            return
        utterance = buf.emit(force=True)
        if utterance:
            log.info("user %s utterance ended by receive idle timeout", uid)
            await self._handle_utterance(uid, utterance)

    async def _handle_utterance(self, uid: int, utterance: bytes) -> None:
        duration = pcm_duration_seconds(utterance, 16000)
        loudness = pcm_rms_dbfs(utterance)
        if duration < 1.2 or loudness < -38.0:
            log.info("skip low-signal utterance user=%s duration=%.2fs rms=%.1f dBFS", uid, duration, loudness)
            return
        if self.stt_lock.locked():
            log.info("drop utterance while STT is busy user=%s duration=%.2fs rms=%.1f dBFS", uid, duration, loudness)
            return

        async with self.stt_lock:
            try:
                text = await asyncio.wait_for(self.stt.transcribe(utterance), timeout=20)
            except asyncio.TimeoutError:
                log.warning("STT timeout user=%s duration=%.2fs rms=%.1f dBFS", uid, duration, loudness)
                await self.notify_text(f"⚠️ STT 시간초과: <@{uid}> {duration:.1f}초")
                return
            except Exception as exc:
                log.exception("STT failed user=%s duration=%.2fs rms=%.1f dBFS", uid, duration, loudness)
                await self.notify_text(f"⚠️ STT 실패: <@{uid}> {exc.__class__.__name__}")
                return
        if not text:
            log.info("user %s utterance produced empty transcript (%.2fs, %.1f dBFS)", uid, duration, loudness)
            return
        log.info("user %s said: %s", uid, text)
        await self.notify_text(f"📝 STT 결과 <@{uid}>: {text}")
        if not self.wake.accepts(text):
            log.info("wake word missing; ignored")
            await self.notify_text("wake word 없음: 응답은 안 함")
            return
        await self.respond(self.wake.strip(text))

    async def respond(self, text: str) -> None:
        async with self.respond_lock:
            answer = await self.hermes.ask(text)
            if not answer:
                answer = "응답이 비어 있어."
            log.info("Hermes answer: %s", answer[:300])
            await self.speak_text(answer)

    async def speak_text(self, text: str) -> None:
        self.speaking = True
        audio_file = await self.tts.synthesize_to_file(text)
        try:
            await self.audio_out(audio_file)
        finally:
            self.speaking = False
            try:
                audio_file.unlink(missing_ok=True)
            except Exception:
                pass

    async def notify_text(self, text: str) -> None:
        if not self.text_out:
            return
        try:
            await self.text_out(text)
        except Exception:
            log.exception("Failed to send transcript/debug text")

    async def stop(self) -> None:
        for task in list(self.audio_workers.values()):
            task.cancel()
        self.audio_workers.clear()
        self.audio_queues.clear()
        await self.hermes.cancel()
        await self.tts.stop()

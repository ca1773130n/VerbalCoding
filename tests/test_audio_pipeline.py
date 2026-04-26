import numpy as np

from app.audio_utils import pcm48k_stereo_to_16k_mono, pcm_duration_seconds, chunk_pcm16
from app.agent import UtteranceBuffer


def test_pcm48k_stereo_to_16k_mono_downsamples_and_mixes():
    # 60 ms at 48 kHz stereo: left=1000, right=3000 -> mono mean=2000.
    stereo = np.tile(np.array([1000, 3000], dtype=np.int16), 2880).tobytes()

    out = pcm48k_stereo_to_16k_mono(stereo)
    samples = np.frombuffer(out, dtype=np.int16)

    assert len(samples) == 960
    assert np.all(samples == 2000)


def test_pcm_duration_seconds_counts_16bit_samples():
    assert pcm_duration_seconds(b"\x00\x00" * 16000, sample_rate=16000) == 1.0


def test_chunk_pcm16_splits_exact_frame_sizes_and_drops_partial():
    pcm = b"\x01\x02" * 17
    chunks = list(chunk_pcm16(pcm, frame_ms=10, sample_rate=1000))
    assert chunks == [b"\x01\x02" * 10]


def test_utterance_buffer_emits_after_silence_with_minimum_speech():
    buf = UtteranceBuffer(sample_rate=16000, silence_ms=200, min_speech_ms=100)
    speech = b"\x01\x00" * 1600  # 100 ms
    silence = b"\x00\x00" * 3200  # 200 ms

    assert buf.add(speech, is_speech=True) is None
    emitted = buf.add(silence, is_speech=False)

    assert emitted == speech
    assert buf.has_audio is False

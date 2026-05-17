import inspect

from integrations.mossttsnano_mlx import synth
from integrations.mossttsnano_mlx.gpt2_mlx import MossTTSNanoMLXGenerator


def test_synth_parser_accepts_legacy_torch_infer_arg_but_native_mlx_uses_no_subprocess():
    args = synth.parse_args(
        [
            "--text",
            "테스트",
            "--output-audio-path",
            "/tmp/out.wav",
            "--torch-infer-script",
            "vendor/MOSS-TTS-Nano/infer.py",
        ]
    )
    assert args.torch_infer_script == "vendor/MOSS-TTS-Nano/infer.py"
    assert args.do_sample == 1
    source = inspect.getsource(synth.run_mlx)
    assert "subprocess" not in source
    assert "generator=mlx codec=torch" in source


def test_synth_installs_native_mlx_generation_hook():
    source = inspect.getsource(synth._install_mlx_generator)
    assert "MossTTSNanoMLXGenerator.from_torch_model" in source
    assert "model._generate_audio_token_ids_with_fallback" in source
    assert "generator.generate_audio_token_ids" in source
    assert "do_sample=bool(do_sample)" in source


def test_mlx_sampling_uses_candidate_only_text_tokens_and_top_k():
    logits = [[0.0, 1.0, 2.0, 3.0]]
    assert MossTTSNanoMLXGenerator._sample_np(
        logits,
        do_sample=False,
        temperature=1.0,
        top_k=None,
        top_p=None,
    ).tolist() == [3]
    sampled = MossTTSNanoMLXGenerator._sample_np(
        logits,
        do_sample=True,
        temperature=1.0,
        top_k=1,
        top_p=None,
    ).tolist()
    assert sampled == [3]

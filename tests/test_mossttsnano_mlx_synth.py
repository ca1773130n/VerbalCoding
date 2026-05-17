import inspect

from integrations.mossttsnano_mlx import synth


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
    source = inspect.getsource(synth.run_mlx)
    assert "subprocess" not in source
    assert "generator=mlx codec=torch" in source


def test_synth_installs_native_mlx_generation_hook():
    source = inspect.getsource(synth._install_mlx_generator)
    assert "MossTTSNanoMLXGenerator.from_torch_model" in source
    assert "model._generate_audio_token_ids_with_fallback" in source
    assert "generator.generate_audio_token_ids" in source

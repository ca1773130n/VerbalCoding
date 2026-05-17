import numpy as np
import pytest

from integrations.mossttsnano_mlx import gpt2_mlx
from integrations.mossttsnano_mlx.gpt2_mlx import TransformerConfig, _Transformer


pytestmark = pytest.mark.skipif(gpt2_mlx.mx is None, reason="mlx is not installed")


def _tiny_state_dict(prefix="transformer", hidden=4, layers=1, vocab=8):
    rng = np.random.default_rng(123)

    def weight(shape):
        return rng.normal(0.0, 0.05, size=shape).astype(np.float32)

    sd = {
        f"{prefix}.wte.weight": weight((vocab, hidden)),
        f"{prefix}.ln_f.weight": np.ones((hidden,), dtype=np.float32),
        f"{prefix}.ln_f.bias": np.zeros((hidden,), dtype=np.float32),
    }
    for i in range(layers):
        p = f"{prefix}.h.{i}"
        sd.update(
            {
                f"{p}.ln_1.weight": np.ones((hidden,), dtype=np.float32),
                f"{p}.ln_1.bias": np.zeros((hidden,), dtype=np.float32),
                f"{p}.attn.c_attn.weight": weight((3 * hidden, hidden)),
                f"{p}.attn.c_attn.bias": weight((3 * hidden,)),
                f"{p}.attn.c_proj.weight": weight((hidden, hidden)),
                f"{p}.attn.c_proj.bias": weight((hidden,)),
                f"{p}.ln_2.weight": np.ones((hidden,), dtype=np.float32),
                f"{p}.ln_2.bias": np.zeros((hidden,), dtype=np.float32),
                f"{p}.mlp.fc_in.weight": weight((4 * hidden, hidden)),
                f"{p}.mlp.fc_in.bias": weight((4 * hidden,)),
                f"{p}.mlp.fc_out.weight": weight((hidden, 4 * hidden)),
                f"{p}.mlp.fc_out.bias": weight((hidden,)),
            }
        )
    return sd


def test_transformer_kv_cache_matches_full_prefix_recompute():
    mx = gpt2_mlx.mx
    cfg = TransformerConfig(hidden_size=4, num_heads=2, num_layers=1, vocab_size=8, intermediate_size=16, layer_norm_eps=1e-5)
    transformer = _Transformer("transformer", cfg, _tiny_state_dict(), include_wte=True)
    inputs = mx.array(np.random.default_rng(7).normal(0, 0.1, size=(1, 4, 4)).astype(np.float32))
    full_mask = mx.ones((1, 4), dtype=mx.bool_)

    full = transformer(inputs, full_mask)
    prefill, cache = transformer(inputs[:, :3, :], full_mask[:, :3], use_cache=True)
    step, next_cache = transformer(inputs[:, 3:, :], full_mask, past_key_values=cache, use_cache=True)

    np.testing.assert_allclose(np.asarray(step), np.asarray(full[:, 3:, :]), rtol=1e-4, atol=1e-4)
    assert len(next_cache) == cfg.num_layers
    assert int(next_cache[0][0].shape[1]) == 4
    assert int(prefill.shape[1]) == 3

from __future__ import annotations

try:
    import mlx.core as mx
    import mlx.nn as nn
except Exception:  # pragma: no cover - import availability is checked by synth.py
    mx = None
    nn = None


if nn is not None:
    class RotaryEmbedding:
        def __init__(self, dim: int, base: float = 10000.0) -> None:
            if dim % 2:
                raise ValueError(f"RoPE dim must be even, got {dim}")
            self.dim = dim
            self.base = base
            self.inv_freq = 1.0 / (base ** (mx.arange(0, dim, 2, dtype=mx.float32) / dim))

        def __call__(self, positions):
            freqs = positions.astype(mx.float32)[..., None] * self.inv_freq
            cos = mx.repeat(mx.cos(freqs), 2, axis=-1)
            sin = mx.repeat(mx.sin(freqs), 2, axis=-1)
            return cos, sin


    def rotate_half(x):
        even = x[..., ::2]
        odd = x[..., 1::2]
        return mx.reshape(mx.stack([-odd, even], axis=-1), x.shape)


    def apply_rope(x, cos, sin):
        while len(cos.shape) < len(x.shape):
            cos = mx.expand_dims(cos, axis=-3)
            sin = mx.expand_dims(sin, axis=-3)
        return (x * cos) + (rotate_half(x) * sin)


    class GPT2MLP(nn.Module):
        def __init__(self, hidden_size: int, inner_size: int) -> None:
            super().__init__()
            self.fc_in = nn.Linear(hidden_size, inner_size)
            self.fc_out = nn.Linear(inner_size, hidden_size)

        def __call__(self, x):
            return self.fc_out(nn.gelu_approx(self.fc_in(x)))


    class GPT2Block(nn.Module):
        """Minimal GPT2/RoPE block skeleton for MOSS-TTS-Nano parity work."""

        def __init__(self, hidden_size: int = 768, num_heads: int = 12, inner_size: int = 3072, rope_base: float = 10000.0) -> None:
            super().__init__()
            if hidden_size % num_heads:
                raise ValueError("hidden_size must divide num_heads")
            self.hidden_size = hidden_size
            self.num_heads = num_heads
            self.head_dim = hidden_size // num_heads
            self.ln_1 = nn.LayerNorm(hidden_size, eps=1e-5)
            self.q_proj = nn.Linear(hidden_size, hidden_size)
            self.k_proj = nn.Linear(hidden_size, hidden_size)
            self.v_proj = nn.Linear(hidden_size, hidden_size)
            self.o_proj = nn.Linear(hidden_size, hidden_size)
            self.rope = RotaryEmbedding(self.head_dim, base=rope_base)
            self.ln_2 = nn.LayerNorm(hidden_size, eps=1e-5)
            self.mlp = GPT2MLP(hidden_size, inner_size)

        def _split(self, x):
            b, s, _ = x.shape
            return mx.reshape(x, (b, s, self.num_heads, self.head_dim))

        def _merge(self, x):
            b, s, _, _ = x.shape
            return mx.reshape(x, (b, s, self.hidden_size))

        def __call__(self, x, *, positions=None, cache=None):
            residual = x
            h = self.ln_1(x)
            q = self._split(self.q_proj(h))
            k = self._split(self.k_proj(h))
            v = self._split(self.v_proj(h))
            if positions is None:
                positions = mx.arange(x.shape[1])
            cos, sin = self.rope(positions)
            q = apply_rope(q, cos, sin)
            k = apply_rope(k, cos, sin)
            if cache is not None:
                past_k, past_v = cache
                k = mx.concatenate([past_k, k], axis=1)
                v = mx.concatenate([past_v, v], axis=1)
            q_t = mx.transpose(q, (0, 2, 1, 3))
            k_t = mx.transpose(k, (0, 2, 1, 3))
            v_t = mx.transpose(v, (0, 2, 1, 3))
            scale = self.head_dim ** -0.5
            scores = (q_t @ mx.transpose(k_t, (0, 1, 3, 2))) * scale
            q_len = q.shape[1]
            k_len = k.shape[1]
            q_pos = mx.arange(q_len) + max(k_len - q_len, 0)
            k_pos = mx.arange(k_len)
            mask = k_pos[None, :] <= q_pos[:, None]
            scores = mx.where(mask[None, None, :, :], scores, -1e9)
            attn = mx.softmax(scores, axis=-1)
            out = mx.transpose(attn @ v_t, (0, 2, 1, 3))
            x = residual + self.o_proj(self._merge(out))
            x = x + self.mlp(self.ln_2(x))
            return x, (k, v)
else:
    RotaryEmbedding = None
    GPT2Block = None

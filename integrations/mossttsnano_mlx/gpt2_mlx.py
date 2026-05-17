from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

try:
    import mlx.core as mx
except Exception:  # pragma: no cover - import availability is checked by synth.py
    mx = None


@dataclass(frozen=True)
class TransformerConfig:
    hidden_size: int
    num_heads: int
    num_layers: int
    vocab_size: int
    intermediate_size: int
    layer_norm_eps: float
    position_embedding_type: str = "rope"
    rope_base: float = 10000.0

    @property
    def head_dim(self) -> int:
        if self.hidden_size % self.num_heads:
            raise ValueError("hidden_size must divide num_heads")
        return self.hidden_size // self.num_heads


@dataclass(frozen=True)
class MossConfig:
    global_config: TransformerConfig
    local_config: TransformerConfig
    n_vq: int
    audio_codebook_sizes: tuple[int, ...]
    audio_pad_token_id: int
    audio_assistant_slot_token_id: int
    audio_end_token_id: int
    pad_token_id: int


def _torch_to_mx(value: Any):
    if mx is None:  # pragma: no cover
        raise RuntimeError("mlx is not available")
    if hasattr(value, "detach"):
        value = value.detach().cpu().numpy()
    return mx.array(np.asarray(value, dtype=np.float32))


def _np_int(value: Any) -> int:
    if hasattr(value, "item"):
        return int(value.item())
    return int(value)


def _gelu_new(x):
    # transformers ACT2FN['gelu_new'] / GPT-2 approximation.
    return 0.5 * x * (1.0 + mx.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * mx.power(x, 3))))


def _layer_norm(x, weight, bias, eps: float):
    mean = mx.mean(x, axis=-1, keepdims=True)
    var = mx.mean(mx.square(x - mean), axis=-1, keepdims=True)
    return ((x - mean) * mx.rsqrt(var + eps)) * weight + bias


def _linear(x, weight, bias=None):
    y = x @ mx.transpose(weight)
    if bias is not None:
        y = y + bias
    return y


def _embedding(weight, ids):
    return weight[ids]


def _rotate_half(x):
    even = x[..., ::2]
    odd = x[..., 1::2]
    return mx.reshape(mx.stack([-odd, even], axis=-1), x.shape)


def _rope(position_ids, head_dim: int, base: float, dtype):
    inv_freq = 1.0 / (base ** (mx.arange(0, head_dim, 2, dtype=mx.float32) / head_dim))
    freqs = mx.expand_dims(position_ids.astype(mx.float32), -1) * inv_freq
    cos = mx.expand_dims(mx.repeat(mx.cos(freqs), 2, axis=-1).astype(dtype), axis=2)
    sin = mx.expand_dims(mx.repeat(mx.sin(freqs), 2, axis=-1).astype(dtype), axis=2)
    return cos, sin


def _apply_rope(x, position_ids, cfg: TransformerConfig):
    cos, sin = _rope(position_ids, cfg.head_dim, cfg.rope_base, x.dtype)
    return (x * cos) + (_rotate_half(x) * sin)


def _causal_mask(attention_mask, query_length: int, key_length: int):
    query_positions = mx.arange(query_length) + max(key_length - query_length, 0)
    key_positions = mx.arange(key_length)
    causal = key_positions[None, :] <= query_positions[:, None]
    causal = mx.expand_dims(mx.expand_dims(causal, 0), 0)
    if attention_mask is None:
        return causal
    key_mask = mx.expand_dims(mx.expand_dims(attention_mask.astype(mx.bool_), 1), 1)
    return mx.logical_and(causal, key_mask)


class _Transformer:
    def __init__(self, prefix: str, cfg: TransformerConfig, sd: dict[str, Any], *, include_wte: bool) -> None:
        self.prefix = prefix
        self.cfg = cfg
        self.include_wte = include_wte
        if include_wte:
            self.wte = _torch_to_mx(sd[f"{prefix}.wte.weight"])
        self.ln_f_w = _torch_to_mx(sd[f"{prefix}.ln_f.weight"])
        self.ln_f_b = _torch_to_mx(sd[f"{prefix}.ln_f.bias"])
        self.layers: list[dict[str, Any]] = []
        for i in range(cfg.num_layers):
            p = f"{prefix}.h.{i}"
            qkv_w = _torch_to_mx(sd[f"{p}.attn.c_attn.weight"])
            qkv_b = _torch_to_mx(sd[f"{p}.attn.c_attn.bias"])
            h = cfg.hidden_size
            self.layers.append(
                {
                    "ln1_w": _torch_to_mx(sd[f"{p}.ln_1.weight"]),
                    "ln1_b": _torch_to_mx(sd[f"{p}.ln_1.bias"]),
                    "q_w": qkv_w[:h],
                    "q_b": qkv_b[:h],
                    "k_w": qkv_w[h : 2 * h],
                    "k_b": qkv_b[h : 2 * h],
                    "v_w": qkv_w[2 * h :],
                    "v_b": qkv_b[2 * h :],
                    "o_w": _torch_to_mx(sd[f"{p}.attn.c_proj.weight"]),
                    "o_b": _torch_to_mx(sd[f"{p}.attn.c_proj.bias"]),
                    "ln2_w": _torch_to_mx(sd[f"{p}.ln_2.weight"]),
                    "ln2_b": _torch_to_mx(sd[f"{p}.ln_2.bias"]),
                    "fc_in_w": _torch_to_mx(sd[f"{p}.mlp.fc_in.weight"]),
                    "fc_in_b": _torch_to_mx(sd[f"{p}.mlp.fc_in.bias"]),
                    "fc_out_w": _torch_to_mx(sd[f"{p}.mlp.fc_out.weight"]),
                    "fc_out_b": _torch_to_mx(sd[f"{p}.mlp.fc_out.bias"]),
                }
            )

    def __call__(self, inputs_embeds, attention_mask=None):
        x = inputs_embeds
        if attention_mask is None:
            attention_mask = mx.ones(x.shape[:2], dtype=mx.bool_)
        else:
            attention_mask = attention_mask.astype(mx.bool_)
        query_mask = attention_mask[:, -x.shape[1] :]
        position_ids = mx.cumsum(attention_mask.astype(mx.int32), axis=-1) - 1
        position_ids = mx.where(attention_mask, position_ids, 0)[:, -x.shape[1] :]
        x = x * mx.expand_dims(query_mask.astype(x.dtype), -1)
        for layer in self.layers:
            residual = x
            h = _layer_norm(x, layer["ln1_w"], layer["ln1_b"], self.cfg.layer_norm_eps)
            q = _linear(h, layer["q_w"], layer["q_b"])
            k = _linear(h, layer["k_w"], layer["k_b"])
            v = _linear(h, layer["v_w"], layer["v_b"])
            b, s, _ = q.shape
            q = mx.reshape(q, (b, s, self.cfg.num_heads, self.cfg.head_dim))
            k = mx.reshape(k, (b, s, self.cfg.num_heads, self.cfg.head_dim))
            v = mx.reshape(v, (b, s, self.cfg.num_heads, self.cfg.head_dim))
            if self.cfg.position_embedding_type == "rope":
                q = _apply_rope(q, position_ids, self.cfg)
                k = _apply_rope(k, position_ids, self.cfg)
            q_t = mx.transpose(q, (0, 2, 1, 3))
            k_t = mx.transpose(k, (0, 2, 1, 3))
            v_t = mx.transpose(v, (0, 2, 1, 3))
            scale = self.cfg.head_dim ** -0.5
            scores = (q_t @ mx.transpose(k_t, (0, 1, 3, 2))) * scale
            mask = _causal_mask(attention_mask, s, k.shape[1])
            scores = mx.where(mask, scores, mx.array(-3.4028235e38, dtype=scores.dtype))
            probs = mx.softmax(scores, axis=-1)
            attn = mx.transpose(probs @ v_t, (0, 2, 1, 3))
            attn = mx.reshape(attn, (b, s, self.cfg.hidden_size))
            x = residual + _linear(attn, layer["o_w"], layer["o_b"])
            mlp_in = _layer_norm(x, layer["ln2_w"], layer["ln2_b"], self.cfg.layer_norm_eps)
            mlp_hidden = _gelu_new(_linear(mlp_in, layer["fc_in_w"], layer["fc_in_b"]))
            x = x + _linear(mlp_hidden, layer["fc_out_w"], layer["fc_out_b"])
            x = x * mx.expand_dims(query_mask.astype(x.dtype), -1)
        x = _layer_norm(x, self.ln_f_w, self.ln_f_b, self.cfg.layer_norm_eps)
        return x * mx.expand_dims(query_mask.astype(x.dtype), -1)


class MossTTSNanoMLXGenerator:
    """MLX implementation of MOSS-TTS-Nano's global/local token generator.

    It intentionally keeps the audio tokenizer/codec in upstream PyTorch code. This
    class only replaces the autoregressive code generator, which is the part that
    was previously hard-coded to fall back to `infer.py`.
    """

    def __init__(self, config: MossConfig, sd: dict[str, Any]) -> None:
        if mx is None:  # pragma: no cover
            raise RuntimeError("mlx is not available")
        self.config = config
        self.global_transformer = _Transformer("transformer", config.global_config, sd, include_wte=True)
        self.local_transformer = _Transformer("local_transformer", config.local_config, sd, include_wte=False)
        self.audio_embeddings = [_torch_to_mx(sd[f"audio_embeddings.{i}.weight"]) for i in range(config.n_vq)]

    @classmethod
    def from_torch_model(cls, model: Any) -> "MossTTSNanoMLXGenerator":
        cfg = model.config
        g = cfg.gpt2_config
        hidden = int(getattr(g, "hidden_size", getattr(g, "n_embd", 768)))
        heads = int(getattr(g, "num_attention_heads", getattr(g, "n_head", 12)))
        layers = int(getattr(g, "num_hidden_layers", getattr(g, "n_layer", 12)))
        inter = int(getattr(g, "n_inner", None) or 4 * hidden)
        eps = float(getattr(g, "layer_norm_epsilon", 1e-5))
        pos = str(getattr(g, "position_embedding_type", "rope")).lower()
        rope_base = float(getattr(g, "rope_base", 10000.0))
        n_vq = int(cfg.n_vq)
        local_layers = int(cfg.local_transformer_layers)
        moss_cfg = MossConfig(
            global_config=TransformerConfig(hidden, heads, layers, int(g.vocab_size), inter, eps, pos, rope_base),
            local_config=TransformerConfig(hidden, heads, local_layers, int(g.vocab_size), inter, eps, pos, rope_base),
            n_vq=n_vq,
            audio_codebook_sizes=tuple(int(x) for x in cfg.audio_codebook_sizes),
            audio_pad_token_id=int(cfg.audio_pad_token_id),
            audio_assistant_slot_token_id=int(cfg.audio_assistant_slot_token_id),
            audio_end_token_id=int(cfg.audio_end_token_id),
            pad_token_id=int(cfg.pad_token_id),
        )
        return cls(moss_cfg, model.state_dict())

    def _build_inputs_embeds(self, input_ids):
        text_ids = input_ids[..., 0].astype(mx.int32)
        embeds = _embedding(self.global_transformer.wte, text_ids)
        for i, table in enumerate(self.audio_embeddings):
            channel_ids = input_ids[..., i + 1].astype(mx.int32)
            valid = channel_ids != self.config.audio_pad_token_id
            safe_ids = mx.where(valid, channel_ids, 0)
            audio = _embedding(table, safe_ids) * mx.expand_dims(valid.astype(embeds.dtype), -1)
            embeds = embeds + audio
        return embeds

    def _local_last_hidden(self, local_inputs):
        mask = mx.ones(local_inputs.shape[:2], dtype=mx.bool_)
        return self.local_transformer(local_inputs, mask)[:, -1, :]

    @staticmethod
    def _sample_np(
        logits: Any,
        *,
        do_sample: bool,
        temperature: float,
        top_k: int | None,
        top_p: float | None,
        previous_token_ids: np.ndarray | None = None,
        repetition_penalty: float = 1.0,
        rng: np.random.Generator | None = None,
    ) -> np.ndarray:
        scores = np.asarray(logits, dtype=np.float64).copy()
        if repetition_penalty <= 0:
            raise ValueError("repetition_penalty must be positive")
        if previous_token_ids is not None and repetition_penalty != 1.0:
            prev = np.asarray(previous_token_ids)
            if prev.ndim == 1:
                prev = prev[None, :]
            elif prev.ndim > 2:
                prev = prev.reshape(prev.shape[0], -1)
            for batch_index in range(scores.shape[0]):
                valid = prev[batch_index]
                valid = valid[(valid >= 0) & (valid < scores.shape[-1])]
                for token_id in np.unique(valid):
                    token_score = scores[batch_index, int(token_id)]
                    scores[batch_index, int(token_id)] = (
                        token_score * repetition_penalty if token_score < 0 else token_score / repetition_penalty
                    )
        if not do_sample:
            return np.argmax(scores, axis=-1).astype(np.int32)
        if temperature <= 0:
            raise ValueError("temperature must be positive when do_sample=True")
        scores = scores / float(temperature)
        if top_k is not None and top_k > 0:
            k = min(int(top_k), scores.shape[-1])
            threshold = np.partition(scores, scores.shape[-1] - k, axis=-1)[:, scores.shape[-1] - k][:, None]
            scores = np.where(scores < threshold, -np.inf, scores)
        if top_p is not None and 0.0 < float(top_p) < 1.0:
            order = np.argsort(-scores, axis=-1)
            sorted_scores = np.take_along_axis(scores, order, axis=-1)
            stable = sorted_scores - np.nanmax(sorted_scores, axis=-1, keepdims=True)
            probs = np.exp(stable)
            probs = probs / np.sum(probs, axis=-1, keepdims=True)
            cumsum = np.cumsum(probs, axis=-1)
            remove = cumsum > float(top_p)
            remove[:, 1:] = remove[:, :-1]
            remove[:, 0] = False
            sorted_scores = np.where(remove, -np.inf, sorted_scores)
            restored = np.full_like(scores, -np.inf)
            np.put_along_axis(restored, order, sorted_scores, axis=-1)
            scores = restored
        stable = scores - np.nanmax(scores, axis=-1, keepdims=True)
        probs = np.exp(stable)
        probs = probs / np.sum(probs, axis=-1, keepdims=True)
        rng = rng or np.random.default_rng()
        return np.array([rng.choice(scores.shape[-1], p=probs[i]) for i in range(scores.shape[0])], dtype=np.int32)

    def generate_audio_token_ids(
        self,
        prompt_input_ids: Any,
        attention_mask: Any,
        *,
        max_new_frames: int,
        effective_nq: int,
        do_sample: bool = True,
        text_temperature: float = 1.5,
        text_top_k: int | None = 50,
        text_top_p: float | None = 1.0,
        audio_temperature: float = 1.7,
        audio_top_k: int | None = 25,
        audio_top_p: float | None = 0.8,
        audio_repetition_penalty: float = 1.0,
        seed: int | None = None,
    ) -> np.ndarray:
        current = mx.array(np.asarray(prompt_input_ids.detach().cpu().numpy() if hasattr(prompt_input_ids, "detach") else prompt_input_ids), dtype=mx.int32)
        mask = mx.array(np.asarray(attention_mask.detach().cpu().numpy() if hasattr(attention_mask, "detach") else attention_mask), dtype=mx.bool_)
        batch = int(current.shape[0])
        frames: list[Any] = []
        finished = mx.zeros((batch,), dtype=mx.bool_)
        rng = np.random.default_rng(seed)
        candidate_ids = np.array([self.config.audio_assistant_slot_token_id, self.config.audio_end_token_id], dtype=np.int32)
        for _step in range(int(max_new_frames)):
            global_hidden_all = self.global_transformer(self._build_inputs_embeds(current), mask)
            global_hidden = global_hidden_all[:, -1:, :]
            text_hidden = self._local_last_hidden(global_hidden)
            text_logits = _linear(text_hidden, self.global_transformer.wte, None)
            mx.eval(text_logits)
            candidate_logits = np.asarray(text_logits)[:, candidate_ids]
            next_text_np = candidate_ids[self._sample_np(
                candidate_logits,
                do_sample=do_sample,
                temperature=text_temperature,
                top_k=text_top_k,
                top_p=text_top_p,
                rng=rng,
            )]
            next_text = mx.array(next_text_np, dtype=mx.int32)
            should_continue = mx.logical_and(next_text == self.config.audio_assistant_slot_token_id, mx.logical_not(finished))
            finished = mx.logical_or(finished, next_text == self.config.audio_end_token_id)
            if not bool(mx.any(should_continue).item()):
                break
            next_tokens = []
            current_local = _embedding(self.global_transformer.wte, next_text)
            local_inputs = global_hidden
            history_np = None if not frames else np.asarray(mx.stack(frames, axis=1))
            for channel_index in range(int(effective_nq)):
                local_inputs = mx.concatenate([local_inputs, mx.expand_dims(current_local, axis=1)], axis=1)
                channel_hidden = self._local_last_hidden(local_inputs)
                logits = _linear(channel_hidden, self.audio_embeddings[channel_index], None)
                mx.eval(logits)
                previous = None if history_np is None else history_np[:, :, channel_index]
                tok_np = self._sample_np(
                    np.asarray(logits),
                    do_sample=do_sample,
                    temperature=audio_temperature,
                    top_k=audio_top_k,
                    top_p=audio_top_p,
                    previous_token_ids=previous,
                    repetition_penalty=audio_repetition_penalty,
                    rng=rng,
                )
                tok = mx.array(tok_np, dtype=mx.int32)
                next_tokens.append(tok)
                current_local = _embedding(self.audio_embeddings[channel_index], tok)
            if int(effective_nq) < self.config.n_vq:
                pad = mx.full((batch, self.config.n_vq - int(effective_nq)), self.config.audio_pad_token_id, dtype=mx.int32)
                frame = mx.concatenate([mx.stack(next_tokens, axis=-1), pad], axis=-1)
            else:
                frame = mx.stack(next_tokens, axis=-1)
            frame = mx.where(mx.expand_dims(should_continue, -1), frame, self.config.audio_pad_token_id)
            frames.append(frame)
            row_text = mx.full((batch, 1, 1), self.config.audio_assistant_slot_token_id, dtype=mx.int32)
            row_audio = mx.expand_dims(frame, axis=1)
            row = mx.concatenate([row_text, row_audio], axis=-1)
            inactive_text = mx.full((batch, 1, 1), self.config.pad_token_id, dtype=mx.int32)
            inactive_audio = mx.full((batch, 1, self.config.n_vq), self.config.audio_pad_token_id, dtype=mx.int32)
            inactive_row = mx.concatenate([inactive_text, inactive_audio], axis=-1)
            row = mx.where(mx.reshape(should_continue, (batch, 1, 1)), row, inactive_row)
            current = mx.concatenate([current, row], axis=1)
            mask = mx.concatenate([mask, mx.expand_dims(should_continue, axis=1)], axis=1)
        if frames:
            out = mx.stack(frames, axis=1)
        else:
            out = mx.zeros((batch, 0, self.config.n_vq), dtype=mx.int32)
        mx.eval(out)
        return np.asarray(out)

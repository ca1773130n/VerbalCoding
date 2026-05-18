from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import numpy as np
import mlx.core as mx
import mlx.nn as nn
from mlx.utils import tree_unflatten
from mlx_lm.models.cache import KVCache
from mlx_lm.models.qwen2 import ModelArgs as Qwen2Args, TransformerBlock, create_attention_mask


@dataclass
class FireRedMLXArgs:
    text_vocab_size: int = 151936
    audio_vocab_size: int = 2051
    audio_num_codebooks: int = 16
    hidden_size: int = 1536
    backbone_layers: int = 28
    decoder_layers: int = 4
    num_attention_heads: int = 12
    num_key_value_heads: int = 2
    intermediate_size: int = 8960
    rms_norm_eps: float = 1e-6
    max_position_embeddings: int = 4096
    rope_theta: float = 1000000.0


def _qwen_args(num_layers: int, args: FireRedMLXArgs) -> Qwen2Args:
    return Qwen2Args(
        model_type="qwen2",
        hidden_size=args.hidden_size,
        num_hidden_layers=num_layers,
        intermediate_size=args.intermediate_size,
        num_attention_heads=args.num_attention_heads,
        num_key_value_heads=args.num_key_value_heads,
        rms_norm_eps=args.rms_norm_eps,
        vocab_size=args.text_vocab_size,
        max_position_embeddings=args.max_position_embeddings,
        rope_theta=args.rope_theta,
        tie_word_embeddings=True,
    )


class QwenStack(nn.Module):
    def __init__(self, num_layers: int, args: FireRedMLXArgs):
        super().__init__()
        qargs = _qwen_args(num_layers, args)
        self.layers = [TransformerBlock(qargs) for _ in range(num_layers)]
        self.norm = nn.RMSNorm(args.hidden_size, eps=args.rms_norm_eps)

    def __call__(self, h: mx.array, cache: Optional[list[Any]] = None) -> mx.array:
        if cache is None:
            cache = [None] * len(self.layers)
        mask = create_attention_mask(h, cache[0])
        for layer, c in zip(self.layers, cache):
            h = layer(h, mask, c)
        return self.norm(h)


class FireRedMLXLLM(nn.Module):
    def __init__(self, args: FireRedMLXArgs | None = None):
        super().__init__()
        self.args = args or FireRedMLXArgs()
        a = self.args
        self.backbone = QwenStack(a.backbone_layers, a)
        self.decoder = QwenStack(a.decoder_layers, a)
        self.text_embeddings = nn.Embedding(a.text_vocab_size, a.hidden_size)
        self.audio_embeddings = nn.Embedding(a.audio_vocab_size * a.audio_num_codebooks, a.hidden_size)
        self.projection = nn.Linear(a.hidden_size, a.hidden_size, bias=False)
        self.text_head = nn.Linear(a.hidden_size, a.text_vocab_size, bias=False)
        self.codebook0_head = nn.Linear(a.hidden_size, a.audio_vocab_size, bias=False)
        self.audio_head = mx.zeros((a.audio_num_codebooks - 1, a.hidden_size, a.audio_vocab_size))
        self.backbone_cache: list[KVCache] | None = None
        self.decoder_cache: list[KVCache] | None = None

    def reset_caches(self) -> None:
        self.backbone_cache = [KVCache() for _ in range(self.args.backbone_layers)]
        self.decoder_cache = [KVCache() for _ in range(self.args.decoder_layers)]

    def _embed_audio(self, codebook: int, tokens: mx.array) -> mx.array:
        return self.audio_embeddings(tokens + codebook * self.args.audio_vocab_size)

    def _embed_tokens(self, tokens: mx.array) -> mx.array:
        text_embeds = mx.expand_dims(self.text_embeddings(tokens[:, :, -1]), -2)
        offsets = self.args.audio_vocab_size * mx.arange(self.args.audio_num_codebooks)
        audio_tokens = tokens[:, :, :-1] + offsets
        flat = audio_tokens.reshape((-1,))
        audio_embeds = self.audio_embeddings(flat).reshape(
            (tokens.shape[0], tokens.shape[1], self.args.audio_num_codebooks, -1)
        )
        return mx.concatenate([audio_embeds, text_embeds], axis=-2)

    @staticmethod
    def _sample_topk(logits: mx.array, topk: int, temperature: float) -> mx.array:
        # Logits are tiny here (audio vocab ~2k). Move to CPU for robust sampling while
        # the rest of the heavy transformer math stays on MLX/Metal.
        arr = np.array(logits / temperature, dtype=np.float64)
        out = []
        for row in arr:
            k = min(topk, row.shape[-1])
            idx = np.argpartition(row, -k)[-k:]
            vals = row[idx]
            vals = vals - vals.max()
            probs = np.exp(vals)
            probs = probs / probs.sum()
            out.append(np.random.choice(idx, p=probs))
        return mx.array(np.array(out, dtype=np.int32).reshape((-1, 1)))

    def generate_frame(
        self,
        tokens: mx.array,
        tokens_mask: mx.array,
        temperature: float,
        topk: int,
    ) -> mx.array:
        embeds = self._embed_tokens(tokens)
        h = mx.sum(embeds * mx.expand_dims(tokens_mask, -1), axis=2)
        h = self.backbone(h, self.backbone_cache)
        last_h = h[:, -1, :]
        c0_logits = self.codebook0_head(last_h)
        c0_sample = self._sample_topk(c0_logits, topk, temperature)
        c0_embed = self._embed_audio(0, c0_sample)
        curr_h = mx.concatenate([mx.expand_dims(last_h, 1), c0_embed], axis=1)
        curr_sample = c0_sample

        # Decoder cache is per generated frame, matching the Torch implementation.
        self.decoder_cache = [KVCache() for _ in range(self.args.decoder_layers)]
        for i in range(1, self.args.audio_num_codebooks):
            decoder_h = self.decoder(self.projection(curr_h), self.decoder_cache)
            ci_logits = decoder_h[:, -1, :] @ self.audio_head[i - 1]
            ci_sample = self._sample_topk(ci_logits, 10, 0.75)
            ci_embed = self._embed_audio(i, ci_sample)
            curr_h = ci_embed
            curr_sample = mx.concatenate([curr_sample, ci_sample], axis=1)
        mx.eval(curr_sample)
        return curr_sample


def _map_qwen_key(prefix: str, key: str) -> str | None:
    if not key.startswith(prefix + "."):
        return None
    rest = key[len(prefix) + 1 :]
    rest = rest.replace("attn.output_proj.", "self_attn.o_proj.")
    if ".attn." in rest:
        rest = rest.replace(".attn.", ".self_attn.")
    rest = rest.replace("mlp.w1.", "mlp.gate_proj.")
    rest = rest.replace("mlp.w2.", "mlp.down_proj.")
    rest = rest.replace("mlp.w3.", "mlp.up_proj.")
    rest = rest.replace("sa_norm.scale", "input_layernorm.weight")
    rest = rest.replace("mlp_norm.scale", "post_attention_layernorm.weight")
    rest = rest.replace("norm.scale", "norm.weight")
    return rest


def load_firered_mlx_from_state_dict(state_dict: dict[str, Any]) -> FireRedMLXLLM:
    model = FireRedMLXLLM()
    flat: list[tuple[str, mx.array]] = []
    for key, value in state_dict.items():
        if hasattr(value, "detach"):
            value = value.detach().cpu().numpy()
        arr = mx.array(value)
        if key.startswith("backbone."):
            mapped = _map_qwen_key("backbone", key)
            if mapped:
                flat.append(("backbone." + mapped, arr))
        elif key.startswith("decoder."):
            mapped = _map_qwen_key("decoder", key)
            if mapped:
                flat.append(("decoder." + mapped, arr))
        elif key in {
            "text_embeddings.weight",
            "audio_embeddings.weight",
            "projection.weight",
            "text_head.weight",
            "codebook0_head.weight",
            "audio_head",
        }:
            flat.append((key, arr))
    model.update(tree_unflatten(flat))
    mx.eval(model.parameters())
    return model

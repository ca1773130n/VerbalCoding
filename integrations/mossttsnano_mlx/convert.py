from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np


@dataclass(frozen=True)
class LinearWeightPair:
    """A torch Linear state-dict pair converted to MLX orientation.

    PyTorch stores nn.Linear weights as [out_features, in_features]. MLX nn.Linear
    also exposes [out_features, in_features] when assigning via `update`, so this
    helper mostly exists to document and test the expected convention before the
    full converter lands.
    """

    weight: np.ndarray
    bias: np.ndarray | None = None


def torch_tensor_to_numpy(value: Any) -> np.ndarray:
    if hasattr(value, "detach"):
        value = value.detach().cpu().numpy()
    return np.asarray(value)


def convert_linear_weight(weight: Any, bias: Any | None = None) -> LinearWeightPair:
    w = torch_tensor_to_numpy(weight).astype(np.float32, copy=False)
    b = None if bias is None else torch_tensor_to_numpy(bias).astype(np.float32, copy=False)
    if w.ndim != 2:
        raise ValueError(f"linear weight must be rank 2, got shape={w.shape}")
    if b is not None and b.shape != (w.shape[0],):
        raise ValueError(f"linear bias shape {b.shape} does not match out_features={w.shape[0]}")
    return LinearWeightPair(weight=w, bias=b)


def split_qkv_packed(c_attn_weight: Any, c_attn_bias: Any | None, hidden_size: int) -> dict[str, LinearWeightPair]:
    """Split MOSS/GPT2 packed qkv projection weights.

    MOSS stores `attn.c_attn.weight` as [3*hidden, hidden] and bias as [3*hidden].
    Return q/k/v linear weights in the same [out, in] orientation expected by MLX.
    """

    w = torch_tensor_to_numpy(c_attn_weight).astype(np.float32, copy=False)
    b = None if c_attn_bias is None else torch_tensor_to_numpy(c_attn_bias).astype(np.float32, copy=False)
    expected = (3 * hidden_size, hidden_size)
    if w.shape != expected:
        raise ValueError(f"expected packed qkv weight shape {expected}, got {w.shape}")
    if b is not None and b.shape != (3 * hidden_size,):
        raise ValueError(f"expected packed qkv bias shape {(3 * hidden_size,)}, got {b.shape}")
    result = {}
    for idx, name in enumerate(("q", "k", "v")):
        start = idx * hidden_size
        end = (idx + 1) * hidden_size
        result[name] = LinearWeightPair(weight=w[start:end], bias=None if b is None else b[start:end])
    return result

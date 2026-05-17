import numpy as np
import pytest

from integrations.mossttsnano_mlx.convert import convert_linear_weight, split_qkv_packed


def test_convert_linear_weight_keeps_mlx_linear_orientation():
    weight = np.arange(12, dtype=np.float32).reshape(3, 4)
    bias = np.arange(3, dtype=np.float32)
    pair = convert_linear_weight(weight, bias)
    assert pair.weight.shape == (3, 4)
    assert pair.bias.shape == (3,)
    np.testing.assert_array_equal(pair.weight, weight)
    np.testing.assert_array_equal(pair.bias, bias)


def test_split_qkv_packed_weights():
    weight = np.arange(3 * 4 * 4, dtype=np.float32).reshape(12, 4)
    bias = np.arange(12, dtype=np.float32)
    parts = split_qkv_packed(weight, bias, hidden_size=4)
    assert set(parts) == {"q", "k", "v"}
    np.testing.assert_array_equal(parts["q"].weight, weight[0:4])
    np.testing.assert_array_equal(parts["k"].weight, weight[4:8])
    np.testing.assert_array_equal(parts["v"].weight, weight[8:12])
    np.testing.assert_array_equal(parts["v"].bias, bias[8:12])


def test_split_qkv_rejects_wrong_shape():
    with pytest.raises(ValueError):
        split_qkv_packed(np.zeros((11, 4), dtype=np.float32), None, hidden_size=4)

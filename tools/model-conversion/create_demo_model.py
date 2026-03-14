#!/usr/bin/env python3
"""
Create a tiny demo ONNX model for development/testing.
This produces a ~10KB model that accepts 224x224x3 images and outputs 2 classes.
It returns random-ish scores — NOT for production use.

Usage:
    python create_demo_model.py
    # Creates packages/extension/public/models/image-detector.onnx

Prerequisites:
    pip install onnx numpy
"""

from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper


def create_demo_model(output_path: Path):
    # Simple model: GlobalAveragePool -> Flatten -> Dense(2)
    input_size = 224
    channels = 3
    num_classes = 2

    # Input: NCHW float32
    X = helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, channels, input_size, input_size])
    Y = helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, num_classes])

    # Random weights for the dense layer
    rng = np.random.default_rng(42)
    W_data = rng.standard_normal((channels, num_classes)).astype(np.float32) * 0.1
    b_data = np.zeros(num_classes, dtype=np.float32)

    W = numpy_helper.from_array(W_data, name="dense_weight")
    b = numpy_helper.from_array(b_data, name="dense_bias")

    # Nodes
    gap = helper.make_node("GlobalAveragePool", ["input"], ["pooled"])
    flatten = helper.make_node("Flatten", ["pooled"], ["flat"], axis=1)
    dense = helper.make_node("MatMul", ["flat", "dense_weight"], ["pre_bias"])
    add_bias = helper.make_node("Add", ["pre_bias", "dense_bias"], ["output"])

    graph = helper.make_graph(
        [gap, flatten, dense, add_bias],
        "truthlens_demo",
        [X],
        [Y],
        initializer=[W, b],
    )

    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 17)])
    model.ir_version = 9

    onnx.checker.check_model(model)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, str(output_path))

    size_kb = output_path.stat().st_size / 1024
    print(f"Demo model created: {output_path} ({size_kb:.1f} KB)")
    print(f"Input: [1, {channels}, {input_size}, {input_size}] float32")
    print(f"Output: [1, {num_classes}] float32")
    print()
    print("WARNING: This is a random model for development only.")
    print("Run convert_image_model.py for a real detection model.")


if __name__ == "__main__":
    output = Path(__file__).resolve().parent.parent.parent / "packages" / "extension" / "src" / "public" / "models" / "image-detector.onnx"
    create_demo_model(output)

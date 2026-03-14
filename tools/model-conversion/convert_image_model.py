#!/usr/bin/env python3
"""
Convert a HuggingFace image classification model to ONNX with INT8 quantization.

Usage:
    # Default: converts a MobileNetV3-based AI image detector
    python convert_image_model.py

    # Custom model:
    python convert_image_model.py --model umm-maybe/AI-image-detector --output models/detector.onnx

    # With quantization:
    python convert_image_model.py --model umm-maybe/AI-image-detector --quantize int8

Prerequisites:
    pip install optimum[exporters] onnx onnxruntime
"""

import argparse
import sys
from pathlib import Path


def export_to_onnx(model_id: str, output_dir: Path, opset: int = 17):
    """Export HuggingFace model to ONNX format using Optimum."""
    from optimum.exporters.onnx import main_export

    print(f"Exporting {model_id} to ONNX (opset {opset})...")
    main_export(
        model_name_or_path=model_id,
        output=output_dir,
        opset=opset,
        task="image-classification",
    )
    print(f"ONNX model saved to {output_dir}")


def quantize_model(model_path: Path, output_path: Path, quant_type: str = "int8"):
    """Apply quantization to reduce model size."""
    from onnxruntime.quantization import quantize_dynamic, QuantType

    quant_map = {
        "int8": QuantType.QInt8,
        "uint8": QuantType.QUInt8,
    }

    if quant_type not in quant_map:
        print(f"Unknown quantization type: {quant_type}. Using int8.")
        quant_type = "int8"

    print(f"Quantizing with {quant_type}...")
    quantize_dynamic(
        model_input=str(model_path),
        model_output=str(output_path),
        weight_type=quant_map[quant_type],
    )

    original_size = model_path.stat().st_size / (1024 * 1024)
    quantized_size = output_path.stat().st_size / (1024 * 1024)
    print(f"Original: {original_size:.1f}MB -> Quantized: {quantized_size:.1f}MB")
    print(f"Reduction: {(1 - quantized_size / original_size) * 100:.0f}%")


def main():
    parser = argparse.ArgumentParser(description="Convert HF model to quantized ONNX")
    parser.add_argument(
        "--model",
        default="umm-maybe/AI-image-detector",
        help="HuggingFace model ID (default: umm-maybe/AI-image-detector)",
    )
    parser.add_argument(
        "--output",
        default="../../packages/models/onnx",
        help="Output directory for ONNX model",
    )
    parser.add_argument(
        "--quantize",
        choices=["none", "int8", "uint8"],
        default="int8",
        help="Quantization type (default: int8)",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=17,
        help="ONNX opset version (default: 17)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        export_to_onnx(args.model, output_dir, args.opset)
    except ImportError:
        print("Error: Required packages not installed.")
        print("Run: pip install optimum[exporters] onnx onnxruntime")
        sys.exit(1)

    model_path = output_dir / "model.onnx"
    if not model_path.exists():
        print(f"Error: Expected model at {model_path}")
        sys.exit(1)

    if args.quantize != "none":
        quantized_path = output_dir / "image-detector.onnx"
        quantize_model(model_path, quantized_path, args.quantize)
        print(f"\nFinal model: {quantized_path}")
        print("Copy this file to packages/extension/public/models/image-detector.onnx")
    else:
        final_path = output_dir / "image-detector.onnx"
        model_path.rename(final_path)
        print(f"\nFinal model: {final_path}")


if __name__ == "__main__":
    main()

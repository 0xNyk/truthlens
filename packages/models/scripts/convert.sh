#!/usr/bin/env bash
# Model conversion scripts for TruthLens
# Converts PyTorch/TF models to ONNX format with INT8 quantization
#
# Prerequisites:
#   pip install onnx onnxruntime optimum torch
#
# Usage:
#   ./convert.sh <model_path> <output_path>

set -euo pipefail

echo "TruthLens model conversion"
echo "========================="
echo ""
echo "This script will be expanded as models are added."
echo "Target format: ONNX with INT8 quantization (<50MB total)"
echo ""
echo "Planned models:"
echo "  - Image: MobileNetV3 / EfficientNet-B0 (~5MB INT8)"
echo "  - Text:  MobileBERT variant (~25MB INT8)"
echo ""
echo "See tools/model-conversion/ for detailed conversion pipelines."

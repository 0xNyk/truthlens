import type { ContentType, DetectionRequest, LayerResult, AIDetectionResult } from "../types.js";
import type { DetectionLayer } from "./index.js";

export interface ImageModelConfig {
  modelPath: string;
  inputSize: number;      // e.g. 224 for MobileNet/EfficientNet
  channels: 3;
  mean: [number, number, number];   // ImageNet normalization
  std: [number, number, number];
  labels: [string, string];         // [real_label, ai_label]
}

export const DEFAULT_IMAGE_MODEL_CONFIG: ImageModelConfig = {
  modelPath: "models/image-detector.onnx",
  inputSize: 224,
  channels: 3,
  mean: [0.485, 0.456, 0.406],  // ImageNet
  std: [0.229, 0.224, 0.225],
  labels: ["real", "ai_generated"],
};

/**
 * Preprocesses an image for inference: resize, normalize, convert to NCHW tensor.
 * Runs in the offscreen document where Canvas API is available.
 */
export function preprocessImage(
  imageData: ImageData,
  config: ImageModelConfig,
): Float32Array {
  const { inputSize, mean, std, channels } = config;
  const tensor = new Float32Array(1 * channels * inputSize * inputSize);

  // imageData is already resized to inputSize x inputSize by the caller
  const pixels = imageData.data; // RGBA Uint8ClampedArray

  for (let y = 0; y < inputSize; y++) {
    for (let x = 0; x < inputSize; x++) {
      const srcIdx = (y * inputSize + x) * 4; // RGBA
      for (let c = 0; c < channels; c++) {
        const dstIdx = c * inputSize * inputSize + y * inputSize + x; // NCHW
        // Normalize: (pixel/255 - mean) / std
        tensor[dstIdx] = (pixels[srcIdx + c] / 255 - mean[c]) / std[c];
      }
    }
  }

  return tensor;
}

/**
 * Applies softmax to raw logits to get probabilities.
 */
export function softmax(logits: Float32Array): Float32Array {
  const maxVal = Math.max(...logits);
  const exps = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i] - maxVal);
    sum += exps[i];
  }
  for (let i = 0; i < logits.length; i++) {
    exps[i] /= sum;
  }
  return exps;
}

/**
 * Image AI detection layer.
 * The actual ONNX inference is delegated to an InferenceBackend (offscreen document).
 */
export interface InferenceBackend {
  runImageInference(tensor: Float32Array, shape: number[]): Promise<Float32Array>;
  isReady(): boolean;
}

export class ImageDetectionLayer implements DetectionLayer {
  readonly name = "ai-detection";
  readonly supportedTypes: ContentType[] = ["image"];

  constructor(
    private readonly backend: InferenceBackend,
    private readonly config: ImageModelConfig = DEFAULT_IMAGE_MODEL_CONFIG,
  ) {}

  async detect(request: DetectionRequest): Promise<LayerResult<AIDetectionResult>> {
    if (!this.backend.isReady()) {
      return {
        layerName: this.name,
        score: 0.5,
        confidence: 0,
        details: { score: 0.5, model: "pending", details: "Model not loaded yet" },
      };
    }

    const imageData = await this.getImageData(request);
    const tensor = preprocessImage(imageData, this.config);
    const { inputSize, channels } = this.config;
    const shape = [1, channels, inputSize, inputSize];

    const output = await this.backend.runImageInference(tensor, shape);
    const probs = softmax(output);

    // probs[0] = real, probs[1] = ai_generated
    // Our score: 0 = likely AI, 1 = likely authentic
    const authenticityScore = probs[0];

    const details: AIDetectionResult = {
      score: authenticityScore,
      model: this.config.modelPath.split("/").pop() ?? "unknown",
      details: `Real: ${(probs[0] * 100).toFixed(1)}%, AI: ${(probs[1] * 100).toFixed(1)}%`,
    };

    return {
      layerName: this.name,
      score: authenticityScore,
      confidence: Math.abs(authenticityScore - 0.5) * 2, // distance from uncertain
      details,
    };
  }

  private async getImageData(request: DetectionRequest): Promise<ImageData> {
    // This runs in the offscreen document where OffscreenCanvas is available
    const blob =
      request.data instanceof ArrayBuffer
        ? new Blob([request.data])
        : await this.fetchImageBlob(request.url ?? "");

    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(this.config.inputSize, this.config.inputSize);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, this.config.inputSize, this.config.inputSize);
    bitmap.close();

    return ctx.getImageData(0, 0, this.config.inputSize, this.config.inputSize);
  }

  private async fetchImageBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    return response.blob();
  }
}

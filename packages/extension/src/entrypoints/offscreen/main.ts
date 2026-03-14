// Offscreen document for ONNX Runtime Web inference.
// Runs in a full document context (not a service worker) so it has:
// - No execution time limits
// - Access to OffscreenCanvas for image preprocessing
// - Full WASM/WebGPU support for ONNX Runtime

import * as ort from "onnxruntime-web";
import {
  preprocessImage,
  softmax,
  DEFAULT_IMAGE_MODEL_CONFIG,
  type ImageModelConfig,
} from "@truthlens/core";
import type {
  InferenceRequestMessage,
  InferenceResultMessage,
} from "@truthlens/core";

let session: ort.InferenceSession | null = null;
let modelLoading: Promise<ort.InferenceSession> | null = null;
const config: ImageModelConfig = DEFAULT_IMAGE_MODEL_CONFIG;

async function loadModel(): Promise<ort.InferenceSession> {
  if (session) return session;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    try {
      // Configure ONNX Runtime for WASM backend (most compatible in extensions)
      ort.env.wasm.numThreads = 1; // Single-threaded — extensions can't use SharedArrayBuffer
      ort.env.wasm.simd = true;

      const modelUrl = chrome.runtime.getURL(config.modelPath);
      const response = await fetch(modelUrl);
      const modelBuffer = await response.arrayBuffer();

      session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });

      console.log("[TruthLens] ONNX model loaded successfully");
      console.log("[TruthLens] Input names:", session.inputNames);
      console.log("[TruthLens] Output names:", session.outputNames);
      return session;
    } catch (err) {
      console.error("[TruthLens] Failed to load ONNX model:", err);
      modelLoading = null;
      throw err;
    }
  })();

  return modelLoading;
}

async function runInference(imageUrl: string): Promise<number[]> {
  const sess = await loadModel();

  // Fetch and decode the image
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // Resize to model input size using OffscreenCanvas
  const canvas = new OffscreenCanvas(config.inputSize, config.inputSize);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, config.inputSize, config.inputSize);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, config.inputSize, config.inputSize);
  const tensorData = preprocessImage(imageData, config);

  // Create ONNX tensor (NCHW format)
  const inputTensor = new ort.Tensor(
    "float32",
    tensorData,
    [1, config.channels, config.inputSize, config.inputSize],
  );

  // Run inference
  const inputName = sess.inputNames[0];
  const results = await sess.run({ [inputName]: inputTensor });

  // Get output logits
  const outputName = sess.outputNames[0];
  const outputData = results[outputName].data as Float32Array;

  // Apply softmax to get probabilities
  const probabilities = softmax(outputData);

  return Array.from(probabilities);
}

// Set up message listener
console.log("[TruthLens] Offscreen document ready for inference");

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    const msg = message as InferenceRequestMessage;

    if (msg.type === "INFERENCE_REQUEST") {
      runInference(msg.payload.imageUrl)
        .then((probabilities) => {
          sendResponse({
            type: "INFERENCE_RESULT",
            payload: {
              requestId: msg.payload.requestId,
              probabilities,
            },
          } satisfies InferenceResultMessage);
        })
        .catch((err) => {
          sendResponse({
            type: "INFERENCE_RESULT",
            payload: {
              requestId: msg.payload.requestId,
              probabilities: [0.5, 0.5],
              error: String(err),
            },
          } satisfies InferenceResultMessage);
        });

      return true; // keep channel open for async response
    }
  },
);

// Pre-load model on startup
loadModel().catch((err) =>
  console.warn("[TruthLens] Model pre-load failed (will retry on first request):", err),
);

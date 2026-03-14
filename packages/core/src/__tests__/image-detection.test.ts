import { describe, it, expect } from "vitest";
import {
  preprocessImage,
  softmax,
  DEFAULT_IMAGE_MODEL_CONFIG,
} from "../detection/image-detection.js";

describe("softmax", () => {
  it("converts logits to probabilities that sum to 1", () => {
    const logits = new Float32Array([2.0, 1.0, 0.1]);
    const probs = softmax(logits);

    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("highest logit gets highest probability", () => {
    const probs = softmax(new Float32Array([5.0, 1.0]));
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it("equal logits produce equal probabilities", () => {
    const probs = softmax(new Float32Array([1.0, 1.0]));
    expect(probs[0]).toBeCloseTo(0.5, 5);
    expect(probs[1]).toBeCloseTo(0.5, 5);
  });

  it("handles large logits without overflow", () => {
    const probs = softmax(new Float32Array([1000, 999]));
    expect(probs[0]).toBeGreaterThan(0);
    expect(probs[1]).toBeGreaterThan(0);
    expect(probs[0] + probs[1]).toBeCloseTo(1.0, 5);
  });

  it("handles negative logits", () => {
    const probs = softmax(new Float32Array([-1, -2, -3]));
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    expect(probs[0]).toBeGreaterThan(probs[1]);
    expect(probs[1]).toBeGreaterThan(probs[2]);
  });
});

describe("preprocessImage", () => {
  const config = DEFAULT_IMAGE_MODEL_CONFIG;

  function makeFakeImageData(
    width: number,
    height: number,
    fill: [number, number, number, number] = [128, 128, 128, 255],
  ): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = fill[3];
    }
    return { data, width, height, colorSpace: "srgb" } as ImageData;
  }

  it("produces tensor of correct shape", () => {
    const imageData = makeFakeImageData(config.inputSize, config.inputSize);
    const tensor = preprocessImage(imageData, config);

    expect(tensor.length).toBe(
      1 * config.channels * config.inputSize * config.inputSize,
    );
  });

  it("normalizes pixel values with ImageNet mean/std", () => {
    // All-black image: (0/255 - mean) / std
    const imageData = makeFakeImageData(config.inputSize, config.inputSize, [
      0, 0, 0, 255,
    ]);
    const tensor = preprocessImage(imageData, config);

    // First pixel of channel 0: (0/255 - 0.485) / 0.229
    const expected = (0 / 255 - config.mean[0]) / config.std[0];
    expect(tensor[0]).toBeCloseTo(expected, 4);
  });

  it("outputs NCHW format", () => {
    // Red image
    const imageData = makeFakeImageData(config.inputSize, config.inputSize, [
      255, 0, 0, 255,
    ]);
    const tensor = preprocessImage(imageData, config);

    const pixelsPerChannel = config.inputSize * config.inputSize;

    // Channel 0 (R) should have high normalized values
    const rVal = (255 / 255 - config.mean[0]) / config.std[0];
    expect(tensor[0]).toBeCloseTo(rVal, 4);

    // Channel 1 (G) should have low normalized values
    const gVal = (0 / 255 - config.mean[1]) / config.std[1];
    expect(tensor[pixelsPerChannel]).toBeCloseTo(gVal, 4);

    // Channel 2 (B) should have low normalized values
    const bVal = (0 / 255 - config.mean[2]) / config.std[2];
    expect(tensor[2 * pixelsPerChannel]).toBeCloseTo(bVal, 4);
  });
});

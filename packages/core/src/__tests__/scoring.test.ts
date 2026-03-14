import { describe, it, expect } from "vitest";
import {
  computeOverallScore,
  computeConfidence,
  determineVerdict,
  computeTruthScore,
  type LayerScores,
} from "../scoring.js";
import { SENSITIVITY_PRESETS } from "../config.js";

function makeLayerScores(overrides: Partial<LayerScores> = {}): LayerScores {
  return {
    aiDetection: { score: 0.5, model: "test", details: "test" },
    provenance: { hasC2PA: false, signers: [], trustLevel: "none" },
    watermark: { detected: false, provider: null },
    ...overrides,
  };
}

describe("computeOverallScore", () => {
  const weights = SENSITIVITY_PRESETS.medium.weights;

  it("returns neutral score when all layers are neutral", () => {
    const score = computeOverallScore(makeLayerScores(), weights);
    expect(score).toBeCloseTo(0.5, 1);
  });

  it("returns high score for authentic content with C2PA", () => {
    const layers = makeLayerScores({
      aiDetection: { score: 0.9, model: "test", details: "" },
      provenance: { hasC2PA: true, signers: ["Adobe"], trustLevel: "verified" },
    });
    const score = computeOverallScore(layers, weights);
    expect(score).toBeGreaterThan(0.8);
  });

  it("returns low score for AI-generated content with watermark", () => {
    const layers = makeLayerScores({
      aiDetection: { score: 0.1, model: "test", details: "" },
      watermark: { detected: true, provider: "DALL-E" },
    });
    const score = computeOverallScore(layers, weights);
    expect(score).toBeLessThan(0.3);
  });

  it("clamps score between 0 and 1", () => {
    const layers = makeLayerScores({
      aiDetection: { score: 0, model: "test", details: "" },
      watermark: { detected: true, provider: "test" },
    });
    const score = computeOverallScore(layers, weights);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("computeConfidence", () => {
  it("returns moderate confidence for neutral inputs", () => {
    const confidence = computeConfidence(makeLayerScores());
    expect(confidence).toBeCloseTo(0.5, 1);
  });

  it("increases confidence with strong AI detection signal", () => {
    const layers = makeLayerScores({
      aiDetection: { score: 0.95, model: "test", details: "" },
    });
    const confidence = computeConfidence(layers);
    expect(confidence).toBeGreaterThan(0.6);
  });

  it("increases confidence with C2PA verified provenance", () => {
    const layers = makeLayerScores({
      provenance: { hasC2PA: true, signers: ["Adobe"], trustLevel: "verified" },
    });
    const confidence = computeConfidence(layers);
    expect(confidence).toBeGreaterThan(0.8);
  });
});

describe("determineVerdict", () => {
  it("returns verified-origin when C2PA verified", () => {
    const layers = makeLayerScores({
      provenance: { hasC2PA: true, signers: ["Adobe"], trustLevel: "verified" },
    });
    const verdict = determineVerdict(0.9, layers, "medium");
    expect(verdict).toBe("verified-origin");
  });

  it("returns authentic for high overall scores", () => {
    const verdict = determineVerdict(0.85, makeLayerScores(), "medium");
    expect(verdict).toBe("authentic");
  });

  it("returns likely-ai for low overall scores", () => {
    const verdict = determineVerdict(0.2, makeLayerScores(), "medium");
    expect(verdict).toBe("likely-ai");
  });

  it("returns uncertain for mid-range scores", () => {
    const verdict = determineVerdict(0.5, makeLayerScores(), "medium");
    expect(verdict).toBe("uncertain");
  });

  it("respects sensitivity presets", () => {
    // High sensitivity has lower authentic threshold
    const verdictHigh = determineVerdict(0.65, makeLayerScores(), "high");
    const verdictLow = determineVerdict(0.65, makeLayerScores(), "low");
    expect(verdictHigh).toBe("authentic");
    expect(verdictLow).toBe("uncertain");
  });
});

describe("computeTruthScore", () => {
  it("returns complete TruthScore object", () => {
    const layers = makeLayerScores({
      aiDetection: { score: 0.8, model: "efficientnet", details: "high confidence" },
    });
    const result = computeTruthScore(layers);

    expect(result).toHaveProperty("overall");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("verdict");
    expect(result).toHaveProperty("layers");
    expect(result.layers.aiDetection.model).toBe("efficientnet");
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(1);
  });
});

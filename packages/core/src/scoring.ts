import type {
  TruthScore,
  Verdict,
  AIDetectionResult,
  ProvenanceResult,
  WatermarkResult,
} from "./types.js";
import { SENSITIVITY_PRESETS, type ScoringWeights } from "./config.js";

export interface LayerScores {
  aiDetection: AIDetectionResult;
  provenance: ProvenanceResult;
  watermark: WatermarkResult;
}

function provenanceScore(result: ProvenanceResult): number {
  if (result.hasC2PA && result.trustLevel === "verified") return 1.0;
  if (result.hasC2PA && result.trustLevel === "signed") return 0.7;
  return 0.5; // neutral — absence of C2PA doesn't imply AI
}

function watermarkScore(result: WatermarkResult): number {
  // Watermark detected = more likely AI-generated
  if (result.detected) return 0.15;
  return 0.5; // neutral — absence doesn't confirm authenticity
}

export function computeOverallScore(
  layers: LayerScores,
  weights: ScoringWeights,
): number {
  const ai = layers.aiDetection.score;
  const prov = provenanceScore(layers.provenance);
  const wm = watermarkScore(layers.watermark);

  const totalWeight = weights.aiDetection + weights.provenance + weights.watermark;
  const weighted =
    (ai * weights.aiDetection + prov * weights.provenance + wm * weights.watermark) /
    totalWeight;

  return Math.max(0, Math.min(1, weighted));
}

export function computeConfidence(layers: LayerScores): number {
  let confidence = 0.5;

  // High AI detection score in either direction increases confidence
  const aiDist = Math.abs(layers.aiDetection.score - 0.5);
  confidence += aiDist * 0.4;

  // C2PA presence strongly increases confidence
  if (layers.provenance.hasC2PA) {
    confidence += layers.provenance.trustLevel === "verified" ? 0.4 : 0.2;
  }

  // Watermark detection adds some confidence
  if (layers.watermark.detected) {
    confidence += 0.1;
  }

  return Math.max(0, Math.min(1, confidence));
}

export function determineVerdict(
  overall: number,
  layers: LayerScores,
  sensitivity: "low" | "medium" | "high" = "medium",
): Verdict {
  const { thresholds } = SENSITIVITY_PRESETS[sensitivity];

  // C2PA with verified trust anchor overrides everything
  if (layers.provenance.hasC2PA && layers.provenance.trustLevel === "verified") {
    return "verified-origin";
  }

  if (overall >= thresholds.authentic) return "authentic";
  if (overall <= thresholds.likelyAI) return "likely-ai";
  return "uncertain";
}

export function computeTruthScore(
  layers: LayerScores,
  sensitivity: "low" | "medium" | "high" = "medium",
): TruthScore {
  const weights = SENSITIVITY_PRESETS[sensitivity].weights;
  const overall = computeOverallScore(layers, weights);
  const confidence = computeConfidence(layers);
  const verdict = determineVerdict(overall, layers, sensitivity);

  return {
    overall,
    confidence,
    layers: {
      aiDetection: layers.aiDetection,
      provenance: layers.provenance,
      watermark: layers.watermark,
    },
    verdict,
  };
}

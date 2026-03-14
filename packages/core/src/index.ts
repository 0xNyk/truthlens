// Types
export type {
  ContentType,
  Verdict,
  AIDetectionResult,
  ProvenanceResult,
  WatermarkResult,
  TruthScore,
  DetectionRequest,
  LayerResult,
  ScanConfig,
  OverlayConfig,
} from "./types.js";

// Config
export {
  SENSITIVITY_PRESETS,
  DEFAULT_SCAN_CONFIG,
  DEFAULT_OVERLAY_CONFIG,
} from "./config.js";
export type { ScoringWeights, SensitivityPreset } from "./config.js";

// Scoring
export {
  computeOverallScore,
  computeConfidence,
  determineVerdict,
  computeTruthScore,
} from "./scoring.js";
export type { LayerScores } from "./scoring.js";

// Detection
export { DetectionPipeline } from "./detection/index.js";
export type { DetectionLayer } from "./detection/index.js";
export { ProvenanceLayer } from "./detection/provenance.js";
export {
  ImageDetectionLayer,
  preprocessImage,
  softmax,
  DEFAULT_IMAGE_MODEL_CONFIG,
} from "./detection/image-detection.js";
export type { ImageModelConfig, InferenceBackend } from "./detection/image-detection.js";
export {
  TextDetectionLayer,
  analyzeText,
  computeTextAuthenticityScore,
} from "./detection/text-detection.js";
export type { TextAnalysisResult } from "./detection/text-detection.js";
export { WatermarkDetectionLayer } from "./detection/watermark.js";

// Messages
export type {
  ScanRequestMessage,
  ScanResultMessage,
  InferenceRequestMessage,
  InferenceResultMessage,
  GetStateMessage,
  ToggleEnabledMessage,
  ExtensionState,
  BackgroundMessage,
  OffscreenMessage,
} from "./messages.js";

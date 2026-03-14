import type { ScanConfig, OverlayConfig } from "./types.js";

export interface ScoringWeights {
  aiDetection: number;
  provenance: number;
  watermark: number;
}

export interface SensitivityPreset {
  thresholds: { authentic: number; likelyAI: number };
  weights: ScoringWeights;
}

export const SENSITIVITY_PRESETS: Record<ScanConfig["sensitivity"], SensitivityPreset> = {
  low: {
    thresholds: { authentic: 0.85, likelyAI: 0.25 },
    weights: { aiDetection: 0.5, provenance: 0.35, watermark: 0.15 },
  },
  medium: {
    thresholds: { authentic: 0.7, likelyAI: 0.35 },
    weights: { aiDetection: 0.5, provenance: 0.35, watermark: 0.15 },
  },
  high: {
    thresholds: { authentic: 0.6, likelyAI: 0.45 },
    weights: { aiDetection: 0.5, provenance: 0.35, watermark: 0.15 },
  },
};

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  enabled: true,
  sensitivity: "medium",
  contentTypes: ["image", "text"],
  domainAllowlist: [],
  domainBlocklist: [],
};

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  showBadges: true,
  verbosity: "standard",
};

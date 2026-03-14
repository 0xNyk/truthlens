export type ContentType = "image" | "text" | "video" | "audio";

export type Verdict = "authentic" | "likely-ai" | "uncertain" | "verified-origin";

export interface AIDetectionResult {
  score: number;
  model: string;
  details: string;
}

export interface ProvenanceResult {
  hasC2PA: boolean;
  signers: string[];
  trustLevel: "verified" | "signed" | "none";
}

export interface WatermarkResult {
  detected: boolean;
  provider: string | null;
}

export interface TruthScore {
  overall: number;
  confidence: number;
  layers: {
    aiDetection: AIDetectionResult;
    provenance: ProvenanceResult;
    watermark: WatermarkResult;
  };
  verdict: Verdict;
}

export interface DetectionRequest {
  type: ContentType;
  data: ArrayBuffer | string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface LayerResult<T = unknown> {
  layerName: string;
  score: number;
  confidence: number;
  details: T;
}

export interface ScanConfig {
  enabled: boolean;
  sensitivity: "low" | "medium" | "high";
  contentTypes: ContentType[];
  domainAllowlist: string[];
  domainBlocklist: string[];
}

export interface OverlayConfig {
  showBadges: boolean;
  verbosity: "minimal" | "standard" | "detailed";
}

import type { ContentType, DetectionRequest, LayerResult, WatermarkResult } from "../types.js";
import type { DetectionLayer } from "./index.js";

/**
 * Watermark detection layer.
 *
 * Checks for known watermark patterns embedded by major AI providers:
 * - SynthID (Google): statistical patterns in text token probabilities
 * - C2PA watermarks: detected by the provenance layer (not here)
 * - Provider-specific metadata: EXIF, XMP, IPTC tags indicating AI origin
 *
 * This layer is supplementary — watermark absence does NOT mean content is real.
 * Many platforms strip metadata, and not all AI providers embed watermarks.
 */

// Known metadata keys that indicate AI-generated content
const AI_METADATA_PATTERNS: Array<{ key: string; pattern: RegExp; provider: string }> = [
  { key: "Software", pattern: /DALL[·-]?E/i, provider: "DALL-E" },
  { key: "Software", pattern: /Midjourney/i, provider: "Midjourney" },
  { key: "Software", pattern: /Stable\s*Diffusion/i, provider: "Stable Diffusion" },
  { key: "Software", pattern: /Adobe\s*Firefly/i, provider: "Adobe Firefly" },
  { key: "Software", pattern: /Flux/i, provider: "Flux" },
  { key: "Comment", pattern: /AI[- ]generated/i, provider: "Unknown AI" },
  { key: "ImageDescription", pattern: /generated\s+by\s+AI/i, provider: "Unknown AI" },
  { key: "UserComment", pattern: /AI[- ]generated/i, provider: "Unknown AI" },
  // Google SynthID marker in EXIF
  { key: "DigitalSourceType", pattern: /trainedAlgorithmicMedia/i, provider: "AI (IPTC)" },
  { key: "DigitalSourceType", pattern: /compositeWithTrainedAlgorithmicMedia/i, provider: "AI (IPTC)" },
];

// Known text watermark patterns (statistical detection)
// SynthID embeds imperceptible statistical biases in token selection
const SYNTHID_NGRAM_SIZE = 4;
const SYNTHID_DETECTION_THRESHOLD = 0.65;

/**
 * Detect SynthID-style text watermarks using n-gram frequency analysis.
 * SynthID biases the selection of token n-grams during generation.
 * We detect this by checking if certain n-gram patterns appear more
 * frequently than expected under a null (no-watermark) hypothesis.
 *
 * Reference: https://arxiv.org/abs/2310.06984
 */
function detectTextWatermark(text: string): { detected: boolean; score: number } {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 50) return { detected: false, score: 0 };

  // Simple hash-based n-gram grouping (approximation of SynthID detection)
  // Real SynthID uses specific hash functions tied to the model's vocabulary
  const ngramHashes: number[] = [];
  for (let i = 0; i <= words.length - SYNTHID_NGRAM_SIZE; i++) {
    const ngram = words.slice(i, i + SYNTHID_NGRAM_SIZE).join(" ");
    ngramHashes.push(simpleHash(ngram));
  }

  if (ngramHashes.length === 0) return { detected: false, score: 0 };

  // Check if hash distribution is biased (watermarked text has more
  // hashes in one half of the hash space than expected by chance)
  const greenCount = ngramHashes.filter((h) => h % 2 === 0).length;
  const ratio = greenCount / ngramHashes.length;

  // Under null hypothesis (no watermark), ratio should be ~0.5
  // Watermarked text would have ratio significantly > 0.5 or < 0.5
  const deviation = Math.abs(ratio - 0.5);
  const score = Math.min(1, deviation * 4); // amplify signal

  return {
    detected: score > SYNTHID_DETECTION_THRESHOLD,
    score,
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/**
 * Parse basic EXIF/metadata from image binary data.
 * Looks for ASCII strings matching known AI provider patterns.
 * This is a lightweight scan — not a full EXIF parser.
 */
function scanBinaryForMetadata(
  data: ArrayBuffer,
): { provider: string | null; found: boolean } {
  // Scan the first 64KB for ASCII metadata strings
  const scanLength = Math.min(data.byteLength, 65536);
  const bytes = new Uint8Array(data, 0, scanLength);

  // Extract printable ASCII sequences (length > 4)
  const asciiChunks: string[] = [];
  let current = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b < 127) {
      current += String.fromCharCode(b);
    } else {
      if (current.length > 4) {
        asciiChunks.push(current);
      }
      current = "";
    }
  }
  if (current.length > 4) asciiChunks.push(current);

  const fullText = asciiChunks.join(" ");

  for (const { pattern, provider } of AI_METADATA_PATTERNS) {
    if (pattern.test(fullText)) {
      return { provider, found: true };
    }
  }

  return { provider: null, found: false };
}

export class WatermarkDetectionLayer implements DetectionLayer {
  readonly name = "watermark";
  readonly supportedTypes: ContentType[] = ["image", "text"];

  async detect(request: DetectionRequest): Promise<LayerResult<WatermarkResult>> {
    if (request.type === "text") {
      return this.detectTextWatermarks(request);
    }
    return this.detectImageWatermarks(request);
  }

  private async detectTextWatermarks(
    request: DetectionRequest,
  ): Promise<LayerResult<WatermarkResult>> {
    const text =
      typeof request.data === "string"
        ? request.data
        : new TextDecoder().decode(request.data);

    const { detected, score } = detectTextWatermark(text);

    return {
      layerName: this.name,
      score: detected ? 0.2 : 0.5, // watermark detected = more likely AI
      confidence: score,
      details: {
        detected,
        provider: detected ? "SynthID-like" : null,
      },
    };
  }

  private async detectImageWatermarks(
    request: DetectionRequest,
  ): Promise<LayerResult<WatermarkResult>> {
    if (typeof request.data === "string") {
      // Can't scan text as binary metadata
      return this.noWatermarkResult();
    }

    const { provider, found } = scanBinaryForMetadata(request.data);

    return {
      layerName: this.name,
      score: found ? 0.15 : 0.5,
      confidence: found ? 0.8 : 0.2,
      details: {
        detected: found,
        provider,
      },
    };
  }

  private noWatermarkResult(): LayerResult<WatermarkResult> {
    return {
      layerName: this.name,
      score: 0.5,
      confidence: 0.1,
      details: { detected: false, provider: null },
    };
  }
}

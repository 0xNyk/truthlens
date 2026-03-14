import type { ContentType, DetectionRequest, LayerResult, AIDetectionResult } from "../types.js";
import type { DetectionLayer } from "./index.js";

/**
 * Statistical text analysis for AI-generated content detection.
 * Uses perplexity estimation, burstiness analysis, and n-gram patterns
 * to distinguish human-written from AI-generated text.
 *
 * This is a heuristic-based approach that runs entirely on-device
 * without requiring a neural network model. A MobileBERT-based
 * detector can be added later for higher accuracy.
 */

export interface TextAnalysisResult {
  perplexityScore: number;    // 0-1: low perplexity = more uniform = more AI-like
  burstinessScore: number;    // 0-1: low burstiness = more uniform = more AI-like
  repetitionScore: number;    // 0-1: high repetition of n-grams = more AI-like
  sentenceLengthVariance: number; // raw variance in sentence lengths
  vocabularyRichness: number; // type-token ratio
}

const MIN_TEXT_LENGTH = 100; // characters
const MIN_WORDS = 20;

/**
 * Tokenize text into words (simple whitespace + punctuation split).
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Split text into sentences.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Compute n-gram frequencies.
 */
function getNgrams(words: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(" ");
    ngrams.set(gram, (ngrams.get(gram) ?? 0) + 1);
  }
  return ngrams;
}

/**
 * Estimate perplexity-like score using character-level entropy.
 * AI text tends to have lower entropy (more predictable).
 * Returns 0-1: lower = more AI-like.
 */
function estimatePerplexity(text: string): number {
  const charFreq = new Map<string, number>();
  const total = text.length;

  for (const char of text.toLowerCase()) {
    charFreq.set(char, (charFreq.get(char) ?? 0) + 1);
  }

  // Shannon entropy
  let entropy = 0;
  for (const count of charFreq.values()) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  // English text typically has entropy ~4.0-4.5 bits/char
  // AI-generated text tends toward ~3.5-4.0
  // Normalize to 0-1 range (3.0 = very AI, 5.0 = very human)
  const normalized = Math.max(0, Math.min(1, (entropy - 3.0) / 2.0));
  return normalized;
}

/**
 * Measure burstiness — variance in word frequency patterns.
 * Human text has bursty word usage (words cluster); AI text is more uniform.
 * Returns 0-1: lower = more AI-like.
 */
function measureBurstiness(words: string[]): number {
  if (words.length < MIN_WORDS) return 0.5;

  // Compute inter-arrival distances for repeated words
  const lastSeen = new Map<string, number>();
  const distances: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prev = lastSeen.get(word);
    if (prev !== undefined) {
      distances.push(i - prev);
    }
    lastSeen.set(word, i);
  }

  if (distances.length < 5) return 0.5;

  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance =
    distances.reduce((sum, d) => sum + (d - mean) ** 2, 0) / distances.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  // Coefficient of variation > 1 = bursty (human), < 1 = regular (AI)
  // Normalize: cv of 0.5 = very AI, cv of 2.0 = very human
  return Math.max(0, Math.min(1, (cv - 0.5) / 1.5));
}

/**
 * Check for repetitive n-gram patterns.
 * AI text often has more repeated bi/trigrams.
 * Returns 0-1: higher = more repetitive = more AI-like.
 */
function measureRepetition(words: string[]): number {
  if (words.length < MIN_WORDS) return 0;

  const bigrams = getNgrams(words, 2);
  const trigrams = getNgrams(words, 3);

  // Count n-grams that appear more than expected
  let repeatedBigrams = 0;
  for (const count of bigrams.values()) {
    if (count > 2) repeatedBigrams++;
  }

  let repeatedTrigrams = 0;
  for (const count of trigrams.values()) {
    if (count > 1) repeatedTrigrams++;
  }

  const bigramRatio = bigrams.size > 0 ? repeatedBigrams / bigrams.size : 0;
  const trigramRatio = trigrams.size > 0 ? repeatedTrigrams / trigrams.size : 0;

  // Combine: higher ratio = more repetitive
  return Math.max(0, Math.min(1, (bigramRatio * 0.4 + trigramRatio * 0.6) * 5));
}

/**
 * Measure sentence length variance.
 * Human writing has more varied sentence lengths.
 */
function measureSentenceLengthVariance(sentences: string[]): number {
  if (sentences.length < 3) return 0.5;

  const lengths = sentences.map((s) => s.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  // CV > 0.6 = varied (human), < 0.3 = uniform (AI)
  return Math.max(0, Math.min(1, (cv - 0.2) / 0.6));
}

/**
 * Compute vocabulary richness (type-token ratio).
 * AI text tends to use a more limited vocabulary.
 */
function computeVocabularyRichness(words: string[]): number {
  if (words.length < MIN_WORDS) return 0.5;

  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;

  // TTR typically: 0.4-0.6 for longer texts
  // Normalize: 0.3 = very AI, 0.7 = very human
  return Math.max(0, Math.min(1, (ttr - 0.3) / 0.4));
}

export function analyzeText(text: string): TextAnalysisResult {
  const words = tokenize(text);
  const sentences = splitSentences(text);

  return {
    perplexityScore: estimatePerplexity(text),
    burstinessScore: measureBurstiness(words),
    repetitionScore: measureRepetition(words),
    sentenceLengthVariance: measureSentenceLengthVariance(sentences),
    vocabularyRichness: computeVocabularyRichness(words),
  };
}

/**
 * Combine analysis signals into a single authenticity score.
 * Returns 0-1: 0 = likely AI, 1 = likely authentic.
 */
export function computeTextAuthenticityScore(analysis: TextAnalysisResult): number {
  const weights = {
    perplexity: 0.25,
    burstiness: 0.25,
    repetition: 0.2,
    sentenceVariance: 0.15,
    vocabulary: 0.15,
  };

  const score =
    analysis.perplexityScore * weights.perplexity +
    analysis.burstinessScore * weights.burstiness +
    (1 - analysis.repetitionScore) * weights.repetition + // invert: high repetition = low authenticity
    analysis.sentenceLengthVariance * weights.sentenceVariance +
    analysis.vocabularyRichness * weights.vocabulary;

  return Math.max(0, Math.min(1, score));
}

export class TextDetectionLayer implements DetectionLayer {
  readonly name = "ai-detection";
  readonly supportedTypes: ContentType[] = ["text"];

  async detect(request: DetectionRequest): Promise<LayerResult<AIDetectionResult>> {
    const text = typeof request.data === "string"
      ? request.data
      : new TextDecoder().decode(request.data);

    if (text.length < MIN_TEXT_LENGTH) {
      return {
        layerName: this.name,
        score: 0.5,
        confidence: 0,
        details: {
          score: 0.5,
          model: "text-heuristic",
          details: "Text too short to analyze",
        },
      };
    }

    const analysis = analyzeText(text);
    const authenticityScore = computeTextAuthenticityScore(analysis);

    // Confidence increases with text length and signal strength
    const signalStrength = Math.abs(authenticityScore - 0.5) * 2;
    const lengthFactor = Math.min(1, text.length / 1000);
    const confidence = signalStrength * 0.6 + lengthFactor * 0.4;

    const details: AIDetectionResult = {
      score: authenticityScore,
      model: "text-heuristic-v1",
      details: [
        `Perplexity: ${(analysis.perplexityScore * 100).toFixed(0)}%`,
        `Burstiness: ${(analysis.burstinessScore * 100).toFixed(0)}%`,
        `Repetition: ${(analysis.repetitionScore * 100).toFixed(0)}%`,
      ].join(", "),
    };

    return {
      layerName: this.name,
      score: authenticityScore,
      confidence,
      details,
    };
  }
}

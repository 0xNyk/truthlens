import { describe, it, expect } from "vitest";
import {
  analyzeText,
  computeTextAuthenticityScore,
  TextDetectionLayer,
} from "../detection/text-detection.js";

// Sample texts for testing
const HUMAN_TEXT = `
I was walking down the street yesterday when I bumped into my old friend Sarah.
We hadn't seen each other in, what, maybe three years? She looked different — shorter
hair, new glasses, that kind of thing. We ducked into a coffee shop (one of those
trendy ones with exposed brick and too many ferns) and caught up for about an hour.
Her kid is starting kindergarten next fall, which... wow, time flies. She mentioned
she'd been thinking about switching careers, maybe going into UX design? I told her
about my disaster of a kitchen renovation. The contractor just vanished mid-project!
Anyway, it was really nice. We should do that more often, you know? Just run into
people and actually stop to talk instead of doing the awkward wave thing.
`;

const AI_TEXT = `
Artificial intelligence has emerged as a transformative technology that is reshaping
numerous industries across the global economy. The integration of machine learning
algorithms and natural language processing capabilities has enabled organizations
to optimize their operational processes and enhance decision-making frameworks.
Furthermore, the advancement of deep learning architectures has facilitated
significant improvements in computer vision, speech recognition, and automated
content generation. These technological developments have created unprecedented
opportunities for innovation while simultaneously raising important questions about
ethical considerations, data privacy, and the future of human employment in an
increasingly automated world. The implementation of responsible AI practices
remains a critical priority for stakeholders across both the public and private sectors.
`;

describe("analyzeText", () => {
  it("returns all analysis metrics", () => {
    const result = analyzeText(HUMAN_TEXT);
    expect(result).toHaveProperty("perplexityScore");
    expect(result).toHaveProperty("burstinessScore");
    expect(result).toHaveProperty("repetitionScore");
    expect(result).toHaveProperty("sentenceLengthVariance");
    expect(result).toHaveProperty("vocabularyRichness");
  });

  it("scores are within 0-1 range", () => {
    const result = analyzeText(AI_TEXT);
    expect(result.perplexityScore).toBeGreaterThanOrEqual(0);
    expect(result.perplexityScore).toBeLessThanOrEqual(1);
    expect(result.burstinessScore).toBeGreaterThanOrEqual(0);
    expect(result.burstinessScore).toBeLessThanOrEqual(1);
    expect(result.repetitionScore).toBeGreaterThanOrEqual(0);
    expect(result.repetitionScore).toBeLessThanOrEqual(1);
  });
});

describe("computeTextAuthenticityScore", () => {
  it("returns score between 0 and 1", () => {
    const analysis = analyzeText(HUMAN_TEXT);
    const score = computeTextAuthenticityScore(analysis);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("human text scores higher than AI text", () => {
    const humanScore = computeTextAuthenticityScore(analyzeText(HUMAN_TEXT));
    const aiScore = computeTextAuthenticityScore(analyzeText(AI_TEXT));
    // Human text should generally score higher (more authentic)
    expect(humanScore).toBeGreaterThan(aiScore);
  });
});

describe("TextDetectionLayer", () => {
  const layer = new TextDetectionLayer();

  it("has correct name and supported types", () => {
    expect(layer.name).toBe("ai-detection");
    expect(layer.supportedTypes).toContain("text");
  });

  it("returns neutral score for very short text", async () => {
    const result = await layer.detect({
      type: "text",
      data: "Too short",
    });
    expect(result.details.score).toBe(0.5);
    expect(result.confidence).toBe(0);
  });

  it("returns analysis results for sufficient text", async () => {
    const result = await layer.detect({
      type: "text",
      data: AI_TEXT,
    });
    expect(result.details.model).toBe("text-heuristic-v1");
    expect(result.details.score).toBeGreaterThanOrEqual(0);
    expect(result.details.score).toBeLessThanOrEqual(1);
    expect(result.details.details).toContain("Perplexity");
  });

  it("handles ArrayBuffer input", async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(AI_TEXT).buffer;
    const result = await layer.detect({
      type: "text",
      data: buffer as ArrayBuffer,
    });
    expect(result.details.model).toBe("text-heuristic-v1");
  });
});

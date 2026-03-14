import { describe, it, expect } from "vitest";
import { WatermarkDetectionLayer } from "../detection/watermark.js";

describe("WatermarkDetectionLayer", () => {
  const layer = new WatermarkDetectionLayer();

  it("has correct name and supported types", () => {
    expect(layer.name).toBe("watermark");
    expect(layer.supportedTypes).toContain("image");
    expect(layer.supportedTypes).toContain("text");
  });

  describe("image watermark detection", () => {
    it("detects DALL-E metadata in binary data", async () => {
      // Simulate EXIF data containing "DALL-E" string
      const fakeExif = "some binary header DALL-E 3 generated image more data";
      const encoder = new TextEncoder();
      const data = encoder.encode(fakeExif).buffer as ArrayBuffer;

      const result = await layer.detect({ type: "image", data });
      expect(result.details.detected).toBe(true);
      expect(result.details.provider).toBe("DALL-E");
    });

    it("detects Midjourney metadata", async () => {
      const fakeExif = "header data Midjourney v6 output trailing bytes";
      const encoder = new TextEncoder();
      const data = encoder.encode(fakeExif).buffer as ArrayBuffer;

      const result = await layer.detect({ type: "image", data });
      expect(result.details.detected).toBe(true);
      expect(result.details.provider).toBe("Midjourney");
    });

    it("detects Stable Diffusion metadata", async () => {
      const fakeExif = "exif block Software: Stable Diffusion XL end";
      const encoder = new TextEncoder();
      const data = encoder.encode(fakeExif).buffer as ArrayBuffer;

      const result = await layer.detect({ type: "image", data });
      expect(result.details.detected).toBe(true);
      expect(result.details.provider).toBe("Stable Diffusion");
    });

    it("detects IPTC DigitalSourceType for AI content", async () => {
      const fakeData = "metadata DigitalSourceType trainedAlgorithmicMedia end";
      const encoder = new TextEncoder();
      const data = encoder.encode(fakeData).buffer as ArrayBuffer;

      const result = await layer.detect({ type: "image", data });
      expect(result.details.detected).toBe(true);
      expect(result.details.provider).toBe("AI (IPTC)");
    });

    it("returns no watermark for clean binary data", async () => {
      // Random binary data with no AI metadata strings
      const data = new ArrayBuffer(1024);
      const view = new Uint8Array(data);
      for (let i = 0; i < view.length; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }

      const result = await layer.detect({ type: "image", data });
      expect(result.details.detected).toBe(false);
      expect(result.details.provider).toBeNull();
    });

    it("returns neutral score when no watermark found", async () => {
      const data = new ArrayBuffer(64);
      const result = await layer.detect({ type: "image", data });
      expect(result.score).toBe(0.5);
    });

    it("returns low score when watermark found (likely AI)", async () => {
      const fakeExif = "header DALL-E generated content";
      const encoder = new TextEncoder();
      const data = encoder.encode(fakeExif).buffer as ArrayBuffer;

      const result = await layer.detect({ type: "image", data });
      expect(result.score).toBeLessThan(0.3);
    });
  });

  describe("text watermark detection", () => {
    it("handles short text gracefully", async () => {
      const result = await layer.detect({
        type: "text",
        data: "Short text without watermarks",
      });
      expect(result.details.detected).toBe(false);
    });

    it("returns result for long text", async () => {
      const longText = "The quick brown fox jumps over the lazy dog. ".repeat(20);
      const result = await layer.detect({ type: "text", data: longText });
      expect(result.details).toHaveProperty("detected");
      expect(result.details).toHaveProperty("provider");
    });
  });
});

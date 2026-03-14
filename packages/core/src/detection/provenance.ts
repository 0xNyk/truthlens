import type { C2pa, C2paConfig } from "c2pa";
import type { Manifest } from "c2pa";
import type { ContentType, DetectionRequest, LayerResult, ProvenanceResult } from "../types.js";
import type { DetectionLayer } from "./index.js";

const KNOWN_TRUST_ANCHORS = new Set([
  "Adobe",
  "Google",
  "Samsung",
  "Leica",
  "Microsoft",
  "Nikon",
  "Sony",
  "Canon",
  "Qualcomm",
  "TikTok",
  "Truepic",
  "Witness",
]);

export class ProvenanceLayer implements DetectionLayer {
  readonly name = "provenance";
  readonly supportedTypes: ContentType[] = ["image", "video"];

  private c2paInstance: C2pa | null = null;
  private readonly c2paConfig: C2paConfig;

  constructor(config: C2paConfig) {
    this.c2paConfig = config;
  }

  private async getC2PA(): Promise<C2pa> {
    if (!this.c2paInstance) {
      const { createC2pa } = await import("c2pa");
      this.c2paInstance = await createC2pa(this.c2paConfig);
    }
    return this.c2paInstance;
  }

  async detect(request: DetectionRequest): Promise<LayerResult<ProvenanceResult>> {
    try {
      const c2pa = await this.getC2PA();

      // c2pa-js expects a Blob or File
      const blob =
        request.data instanceof ArrayBuffer
          ? new Blob([request.data])
          : new Blob([new TextEncoder().encode(request.data)]);

      const { manifestStore } = await c2pa.read(blob);

      if (!manifestStore?.activeManifest) {
        return this.noProvenanceResult();
      }

      const manifest = manifestStore.activeManifest;
      const signers = this.extractSigners(manifest);
      const trustLevel = this.evaluateTrust(signers);

      const details: ProvenanceResult = {
        hasC2PA: true,
        signers,
        trustLevel,
      };

      return {
        layerName: this.name,
        score: trustLevel === "verified" ? 1.0 : 0.7,
        confidence: trustLevel === "verified" ? 0.95 : 0.7,
        details,
      };
    } catch {
      return this.noProvenanceResult();
    }
  }

  private extractSigners(manifest: Manifest): string[] {
    const signers: string[] = [];
    if (manifest.signatureInfo?.issuer) {
      signers.push(manifest.signatureInfo.issuer);
    }
    return signers;
  }

  private evaluateTrust(signers: string[]): ProvenanceResult["trustLevel"] {
    for (const signer of signers) {
      for (const anchor of KNOWN_TRUST_ANCHORS) {
        if (signer.toLowerCase().includes(anchor.toLowerCase())) {
          return "verified";
        }
      }
    }
    return signers.length > 0 ? "signed" : "none";
  }

  private noProvenanceResult(): LayerResult<ProvenanceResult> {
    return {
      layerName: this.name,
      score: 0.5,
      confidence: 0.3,
      details: { hasC2PA: false, signers: [], trustLevel: "none" },
    };
  }
}

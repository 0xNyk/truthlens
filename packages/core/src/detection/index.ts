import type {
  ContentType,
  DetectionRequest,
  LayerResult,
  TruthScore,
} from "../types.js";
import { computeTruthScore, type LayerScores } from "../scoring.js";
import type { ScanConfig } from "../types.js";

export interface DetectionLayer {
  readonly name: string;
  readonly supportedTypes: ContentType[];
  detect(request: DetectionRequest): Promise<LayerResult>;
}

export class DetectionPipeline {
  private layers: DetectionLayer[] = [];

  addLayer(layer: DetectionLayer): void {
    this.layers.push(layer);
  }

  removeLayer(name: string): void {
    this.layers = this.layers.filter((l) => l.name !== name);
  }

  async detect(
    request: DetectionRequest,
    config?: Partial<ScanConfig>,
  ): Promise<TruthScore> {
    const applicableLayers = this.layers.filter((layer) =>
      layer.supportedTypes.includes(request.type),
    );

    const results = await Promise.allSettled(
      applicableLayers.map((layer) => layer.detect(request)),
    );

    const layerScores: LayerScores = {
      aiDetection: { score: 0.5, model: "none", details: "Not analyzed" },
      provenance: { hasC2PA: false, signers: [], trustLevel: "none" },
      watermark: { detected: false, provider: null },
    };

    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") continue;

      const layer = applicableLayers[i];
      const value = result.value;

      switch (layer.name) {
        case "ai-detection":
          layerScores.aiDetection = value.details as LayerScores["aiDetection"];
          break;
        case "provenance":
          layerScores.provenance = value.details as LayerScores["provenance"];
          break;
        case "watermark":
          layerScores.watermark = value.details as LayerScores["watermark"];
          break;
      }
    }

    return computeTruthScore(layerScores, config?.sensitivity ?? "medium");
  }
}

import type { JSX } from "preact";
import type { TruthScore } from "@truthlens/core";

export interface ScorePanelProps {
  score: TruthScore;
}

export function ScorePanel({ score }: ScorePanelProps): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: "white",
        color: "#111",
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        width: 260,
      }}
    >
      <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>TruthLens Analysis</h4>

      <Row label="Overall" value={`${Math.round(score.overall * 100)}%`} />
      <Row label="Confidence" value={`${Math.round(score.confidence * 100)}%`} />
      <Row label="Verdict" value={score.verdict.replace("-", " ")} />

      <hr style={{ margin: "8px 0", border: "none", borderTop: "1px solid #eee" }} />

      <Row
        label="AI Detection"
        value={`${Math.round(score.layers.aiDetection.score * 100)}%`}
      />
      <Row
        label="Provenance"
        value={score.layers.provenance.hasC2PA ? "C2PA found" : "None"}
      />
      <Row
        label="Watermark"
        value={score.layers.watermark.detected ? `Yes (${score.layers.watermark.provider})` : "None"}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

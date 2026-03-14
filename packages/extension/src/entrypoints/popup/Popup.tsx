import { useState, useEffect } from "preact/hooks";
import type { ExtensionState } from "@truthlens/core";

const VERDICT_COLORS = {
  authentic: "#22c55e",
  "likely-ai": "#ef4444",
  uncertain: "#eab308",
  "verified-origin": "#3b82f6",
} as const;

export function Popup() {
  const [state, setState] = useState<ExtensionState>({
    enabled: true,
    scanSummary: { imagesScanned: 0, imagesFlagged: 0, withProvenance: 0 },
    results: [],
  });

  useEffect(() => {
    browser.runtime
      .sendMessage({ type: "GET_STATE" })
      .then((response: ExtensionState) => {
        if (response?.scanSummary) {
          setState(response);
        }
      })
      .catch(console.error);
  }, []);

  const toggleEnabled = () => {
    browser.runtime
      .sendMessage({ type: "TOGGLE_ENABLED" })
      .then((response: { enabled: boolean }) => {
        setState((prev) => ({ ...prev, enabled: response.enabled }));
      })
      .catch(console.error);
  };

  const flaggedResults = state.results.filter(
    (r) => r.score.verdict !== "authentic",
  );

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 20 }}>TruthLens</div>
        <div style={{ flex: 1 }} />
        <button
          onClick={toggleEnabled}
          style={{
            padding: "4px 12px",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            background: state.enabled ? "#22c55e" : "#94a3b8",
            color: "white",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {state.enabled ? "ON" : "OFF"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <StatBox label="Scanned" value={state.scanSummary.imagesScanned} />
        <StatBox
          label="Flagged"
          value={state.scanSummary.imagesFlagged}
          color="#ef4444"
        />
        <StatBox
          label="Verified"
          value={state.scanSummary.withProvenance}
          color="#3b82f6"
        />
      </div>

      {flaggedResults.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {flaggedResults.map((r) => (
            <div
              key={r.elementId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid #f1f1f1",
                fontSize: 12,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    VERDICT_COLORS[r.score.verdict] ?? VERDICT_COLORS.uncertain,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.src ? new URL(r.src).pathname.split("/").pop() : r.elementId}
              </span>
              <span style={{ color: "#666" }}>
                {Math.round(r.score.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {flaggedResults.length === 0 && state.scanSummary.imagesScanned > 0 && (
        <p style={{ fontSize: 13, color: "#22c55e", textAlign: "center" }}>
          No suspicious content detected on this page.
        </p>
      )}

      {state.scanSummary.imagesScanned === 0 && (
        <p style={{ fontSize: 13, color: "#888", textAlign: "center" }}>
          No content scanned yet. Browse a page to start.
        </p>
      )}

      <p style={{ fontSize: 11, color: "#aaa", marginTop: 12, textAlign: "center" }}>
        All detection happens on your device.
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 8,
        borderRadius: 6,
        background: "#f8f9fa",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "#111" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#666" }}>{label}</div>
    </div>
  );
}

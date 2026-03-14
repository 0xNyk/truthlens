import type { TruthScore, Verdict } from "@truthlens/core";

export interface OverlayManager {
  attach(element: Element, score: TruthScore): void;
  update(element: Element, score: TruthScore): void;
  remove(element: Element): void;
}

const BADGE_COLORS: Record<Verdict, string> = {
  authentic: "#22c55e",
  "likely-ai": "#ef4444",
  uncertain: "#eab308",
  "verified-origin": "#3b82f6",
};

const BADGE_LABELS: Record<Verdict, string> = {
  authentic: "Authentic",
  "likely-ai": "Likely AI",
  uncertain: "Uncertain",
  "verified-origin": "Verified Origin",
};

function createRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "tl-row";

  const labelSpan = document.createElement("span");
  labelSpan.className = "tl-label";
  labelSpan.textContent = label;

  const valueSpan = document.createElement("span");
  valueSpan.textContent = value;

  row.appendChild(labelSpan);
  row.appendChild(valueSpan);
  return row;
}

export function createOverlayManager(): OverlayManager {
  const overlays = new WeakMap<Element, HTMLElement>();

  function createBadge(score: TruthScore): HTMLElement {
    const { verdict } = score;
    const host = document.createElement("div");
    host.className = "truthlens-overlay";
    const shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      .tl-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 4px;
        font: 600 11px/1.2 system-ui, sans-serif;
        color: white;
        background: ${BADGE_COLORS[verdict]};
        cursor: pointer;
        opacity: 0.9;
        transition: opacity 0.15s;
        pointer-events: auto;
        box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      }
      .tl-badge:hover { opacity: 1; }
      .tl-panel {
        display: none;
        position: absolute;
        top: 28px;
        right: 4px;
        width: 240px;
        padding: 12px;
        border-radius: 8px;
        background: white;
        color: #111;
        font: 13px/1.5 system-ui, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        z-index: 2147483647;
      }
      .tl-badge.expanded + .tl-panel { display: block; }
      .tl-panel h4 { margin: 0 0 8px; font-size: 14px; }
      .tl-row { display: flex; justify-content: space-between; margin: 4px 0; }
      .tl-label { color: #666; }
      .tl-divider { margin: 8px 0; border: none; border-top: 1px solid #eee; }
    `;

    const badge = document.createElement("div");
    badge.className = "tl-badge";
    badge.textContent = BADGE_LABELS[verdict];

    const panel = document.createElement("div");
    panel.className = "tl-panel";

    const heading = document.createElement("h4");
    heading.textContent = "TruthLens Analysis";
    panel.appendChild(heading);

    panel.appendChild(
      createRow("Verdict", BADGE_LABELS[verdict]),
    );
    panel.appendChild(
      createRow("Confidence", `${Math.round(score.confidence * 100)}%`),
    );
    panel.appendChild(
      createRow("Overall", `${Math.round(score.overall * 100)}%`),
    );

    const divider = document.createElement("hr");
    divider.className = "tl-divider";
    panel.appendChild(divider);

    panel.appendChild(
      createRow(
        "AI Detection",
        `${Math.round(score.layers.aiDetection.score * 100)}%`,
      ),
    );
    panel.appendChild(
      createRow(
        "Provenance",
        score.layers.provenance.hasC2PA
          ? `C2PA (${score.layers.provenance.trustLevel})`
          : "None",
      ),
    );
    panel.appendChild(
      createRow(
        "Watermark",
        score.layers.watermark.detected
          ? `${score.layers.watermark.provider ?? "Detected"}`
          : "None",
      ),
    );

    if (score.layers.aiDetection.details) {
      const detailRow = createRow("Details", score.layers.aiDetection.details);
      detailRow.style.fontSize = "11px";
      panel.appendChild(detailRow);
    }

    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      badge.classList.toggle("expanded");
    });

    shadow.appendChild(style);
    shadow.appendChild(badge);
    shadow.appendChild(panel);

    return host;
  }

  function attach(element: Element, score: TruthScore) {
    if (overlays.has(element)) return;

    const badge = createBadge(score);

    const parent = element.parentElement;
    if (parent) {
      const computedPos = getComputedStyle(parent).position;
      if (computedPos === "static") {
        (parent as HTMLElement).style.position = "relative";
      }
    }

    element.insertAdjacentElement("afterend", badge);
    overlays.set(element, badge);
  }

  function update(element: Element, score: TruthScore) {
    remove(element);
    attach(element, score);
  }

  function remove(element: Element) {
    const overlay = overlays.get(element);
    if (overlay) {
      overlay.remove();
      overlays.delete(element);
    }
  }

  return { attach, update, remove };
}

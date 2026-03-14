import type { JSX } from "preact";

export interface BadgeProps {
  verdict: "authentic" | "likely-ai" | "uncertain" | "verified-origin";
  onClick?: () => void;
}

const COLORS = {
  authentic: { bg: "#22c55e", label: "Authentic" },
  "likely-ai": { bg: "#ef4444", label: "Likely AI" },
  uncertain: { bg: "#eab308", label: "Uncertain" },
  "verified-origin": { bg: "#3b82f6", label: "Verified Origin" },
} as const;

export function Badge({ verdict, onClick }: BadgeProps): JSX.Element {
  const { bg, label } = COLORS[verdict];

  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 4,
        border: "none",
        fontSize: 11,
        fontWeight: 600,
        color: "white",
        background: bg,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

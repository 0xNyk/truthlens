import { useState, useEffect } from "preact/hooks";
import type { ScanConfig, OverlayConfig, ContentType } from "@truthlens/core";
import { DEFAULT_SCAN_CONFIG, DEFAULT_OVERLAY_CONFIG } from "@truthlens/core";

const STORAGE_KEY_SCAN = "truthlens_scan_config";
const STORAGE_KEY_OVERLAY = "truthlens_overlay_config";

async function loadConfig<T>(key: string, defaults: T): Promise<T> {
  const result = await browser.storage.local.get(key);
  return result[key] ? { ...defaults, ...result[key] } : defaults;
}

async function saveConfig<T>(key: string, config: T): Promise<void> {
  await browser.storage.local.set({ [key]: config });
}

export function Options() {
  const [scanConfig, setScanConfig] = useState<ScanConfig>(DEFAULT_SCAN_CONFIG);
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>(DEFAULT_OVERLAY_CONFIG);
  const [domainInput, setDomainInput] = useState("");
  const [listType, setListType] = useState<"allowlist" | "blocklist">("blocklist");
  const [saved, setSaved] = useState(false);
  const [modelCacheSize, setModelCacheSize] = useState("Calculating...");

  useEffect(() => {
    loadConfig(STORAGE_KEY_SCAN, DEFAULT_SCAN_CONFIG).then(setScanConfig);
    loadConfig(STORAGE_KEY_OVERLAY, DEFAULT_OVERLAY_CONFIG).then(setOverlayConfig);
    estimateModelCacheSize().then(setModelCacheSize);
  }, []);

  async function estimateModelCacheSize(): Promise<string> {
    try {
      const estimate = await navigator.storage.estimate();
      const usedMB = ((estimate.usage ?? 0) / (1024 * 1024)).toFixed(1);
      return `${usedMB} MB`;
    } catch {
      return "Unknown";
    }
  }

  function handleSave() {
    saveConfig(STORAGE_KEY_SCAN, scanConfig);
    saveConfig(STORAGE_KEY_OVERLAY, overlayConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggleContentType(type: ContentType) {
    setScanConfig((prev) => ({
      ...prev,
      contentTypes: prev.contentTypes.includes(type)
        ? prev.contentTypes.filter((t) => t !== type)
        : [...prev.contentTypes, type],
    }));
  }

  function addDomain() {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) return;

    setScanConfig((prev) => {
      const key = listType === "allowlist" ? "domainAllowlist" : "domainBlocklist";
      if (prev[key].includes(domain)) return prev;
      return { ...prev, [key]: [...prev[key], domain] };
    });
    setDomainInput("");
  }

  function removeDomain(domain: string, list: "allowlist" | "blocklist") {
    setScanConfig((prev) => {
      const key = list === "allowlist" ? "domainAllowlist" : "domainBlocklist";
      return { ...prev, [key]: prev[key].filter((d) => d !== domain) };
    });
  }

  const styles = {
    container: {
      maxWidth: 600,
      margin: "0 auto",
      padding: 24,
      fontFamily: "system-ui, sans-serif",
      color: "#111",
    },
    section: {
      marginBottom: 24,
      padding: 16,
      borderRadius: 8,
      background: "#f8f9fa",
      border: "1px solid #e9ecef",
    },
    h1: { fontSize: 22, margin: "0 0 4px", fontWeight: 700 as const },
    h2: { fontSize: 16, margin: "0 0 12px", fontWeight: 600 as const },
    label: {
      display: "flex" as const,
      alignItems: "center" as const,
      gap: 8,
      margin: "8px 0",
      fontSize: 14,
      cursor: "pointer" as const,
    },
    slider: { width: "100%" },
    input: {
      flex: 1,
      padding: "6px 10px",
      border: "1px solid #ccc",
      borderRadius: 4,
      fontSize: 14,
    },
    button: {
      padding: "6px 16px",
      border: "none",
      borderRadius: 4,
      background: "#111",
      color: "white",
      cursor: "pointer" as const,
      fontSize: 14,
    },
    tag: {
      display: "inline-flex" as const,
      alignItems: "center" as const,
      gap: 4,
      padding: "2px 8px",
      borderRadius: 12,
      background: "#e9ecef",
      fontSize: 12,
      margin: "2px 4px 2px 0",
    },
    removeBtn: {
      background: "none",
      border: "none",
      cursor: "pointer" as const,
      fontSize: 14,
      color: "#666",
      padding: 0,
    },
    privacy: {
      marginTop: 24,
      padding: 12,
      borderRadius: 8,
      background: "#e8f5e9",
      border: "1px solid #c8e6c9",
      fontSize: 13,
      lineHeight: 1.5,
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>TruthLens Settings</h1>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px" }}>
        Configure how TruthLens detects AI-generated content.
      </p>

      {/* Detection Sensitivity */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Detection Sensitivity</h2>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666" }}>
          <span>Conservative</span>
          <span>Balanced</span>
          <span>Aggressive</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          value={["low", "medium", "high"].indexOf(scanConfig.sensitivity)}
          onInput={(e) => {
            const val = Number((e.target as HTMLInputElement).value);
            const levels: ScanConfig["sensitivity"][] = ["low", "medium", "high"];
            setScanConfig((prev) => ({ ...prev, sensitivity: levels[val] }));
          }}
          style={styles.slider}
        />
        <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>
          {scanConfig.sensitivity === "low" && "Fewer alerts, higher confidence thresholds. Best for casual browsing."}
          {scanConfig.sensitivity === "medium" && "Balanced detection. Good for general use."}
          {scanConfig.sensitivity === "high" && "More alerts, catches more AI content but may have more false positives."}
        </p>
      </div>

      {/* Content Types */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Content Types to Scan</h2>
        {(["image", "text", "video"] as ContentType[]).map((type) => (
          <label key={type} style={styles.label}>
            <input
              type="checkbox"
              checked={scanConfig.contentTypes.includes(type)}
              onChange={() => toggleContentType(type)}
            />
            {type.charAt(0).toUpperCase() + type.slice(1)}s
            {type === "video" && (
              <span style={{ fontSize: 11, color: "#999" }}>(frame sampling, beta)</span>
            )}
          </label>
        ))}
      </div>

      {/* Overlay Settings */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Overlay Display</h2>
        <label style={styles.label}>
          <input
            type="checkbox"
            checked={overlayConfig.showBadges}
            onChange={() =>
              setOverlayConfig((prev) => ({
                ...prev,
                showBadges: !prev.showBadges,
              }))
            }
          />
          Show detection badges on content
        </label>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 13 }}>Verbosity: </span>
          {(["minimal", "standard", "detailed"] as OverlayConfig["verbosity"][]).map(
            (level) => (
              <label key={level} style={{ ...styles.label, display: "inline-flex", marginRight: 12 }}>
                <input
                  type="radio"
                  name="verbosity"
                  checked={overlayConfig.verbosity === level}
                  onChange={() =>
                    setOverlayConfig((prev) => ({ ...prev, verbosity: level }))
                  }
                />
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </label>
            ),
          )}
        </div>
      </div>

      {/* Domain Lists */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Domain Lists</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            value={listType}
            onChange={(e) =>
              setListType((e.target as HTMLSelectElement).value as "allowlist" | "blocklist")
            }
            style={{ ...styles.input, flex: "none", width: 120 }}
          >
            <option value="blocklist">Block</option>
            <option value="allowlist">Allow</option>
          </select>
          <input
            type="text"
            value={domainInput}
            onInput={(e) => setDomainInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && addDomain()}
            placeholder="example.com"
            style={styles.input}
          />
          <button onClick={addDomain} style={styles.button}>
            Add
          </button>
        </div>

        {scanConfig.domainBlocklist.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "#666" }}>Blocked: </span>
            {scanConfig.domainBlocklist.map((d) => (
              <span key={d} style={styles.tag}>
                {d}
                <button
                  style={styles.removeBtn}
                  onClick={() => removeDomain(d, "blocklist")}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}

        {scanConfig.domainAllowlist.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "#666" }}>Allowed: </span>
            {scanConfig.domainAllowlist.map((d) => (
              <span key={d} style={styles.tag}>
                {d}
                <button
                  style={styles.removeBtn}
                  onClick={() => removeDomain(d, "allowlist")}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Model Management */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Model Management</h2>
        <div style={{ fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>Cache size:</span>
            <span>{modelCacheSize}</span>
          </div>
          <p style={{ fontSize: 12, color: "#666", margin: "8px 0 0" }}>
            Models are downloaded on first use and cached locally.
            Detection models run entirely on your device.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        style={{
          ...styles.button,
          width: "100%",
          padding: "10px 16px",
          fontSize: 15,
          background: saved ? "#22c55e" : "#111",
        }}
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>

      {/* Privacy Notice */}
      <div style={styles.privacy}>
        <strong>Privacy:</strong> TruthLens processes all content directly on your
        device. No images, text, or browsing data is ever sent to external servers.
        Detection models run locally via WebAssembly. Your settings are stored in
        your browser's local storage only.
      </div>
    </div>
  );
}

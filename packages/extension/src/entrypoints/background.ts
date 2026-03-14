import type {
  ScanRequestMessage,
  InferenceResultMessage,
  ExtensionState,
  TruthScore,
  ScanConfig,
} from "@truthlens/core";
import {
  computeTruthScore,
  analyzeText,
  computeTextAuthenticityScore,
  DEFAULT_SCAN_CONFIG,
} from "@truthlens/core";

interface TabState {
  enabled: boolean;
  results: Map<string, { src: string | null; score: TruthScore }>;
}

const tabStates = new Map<number, TabState>();
let globalEnabled = true;
let scanConfig: ScanConfig = DEFAULT_SCAN_CONFIG;

// Load saved config
async function loadScanConfig(): Promise<void> {
  try {
    const result = await browser.storage.local.get("truthlens_scan_config");
    if (result.truthlens_scan_config) {
      scanConfig = { ...DEFAULT_SCAN_CONFIG, ...result.truthlens_scan_config };
    }
  } catch {
    // Use defaults
  }
}

function getTabState(tabId: number): TabState {
  let state = tabStates.get(tabId);
  if (!state) {
    state = { enabled: globalEnabled, results: new Map() };
    tabStates.set(tabId, state);
  }
  return state;
}

// Manage offscreen document lifecycle
let offscreenReady = false;

async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return;

  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT as chrome.runtime.ContextType],
  });

  if (contexts.length > 0) {
    offscreenReady = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL("offscreen.html"),
    reasons: [chrome.offscreen.Reason.WORKERS as chrome.offscreen.Reason],
    justification: "ONNX Runtime Web inference for AI content detection",
  });

  offscreenReady = true;
  console.log("[TruthLens] Offscreen document created");
}

async function requestInference(
  imageUrl: string,
  requestId: string,
): Promise<InferenceResultMessage["payload"]> {
  await ensureOffscreen();

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "INFERENCE_REQUEST",
        payload: { requestId, imageUrl },
      },
      (response: InferenceResultMessage) => {
        resolve(response?.payload ?? {
          requestId,
          probabilities: [0.5, 0.5],
          error: "No response from offscreen document",
        });
      },
    );
  });
}

function analyzeTextContent(text: string): TruthScore {
  const analysis = analyzeText(text);
  const authenticityScore = computeTextAuthenticityScore(analysis);

  return computeTruthScore(
    {
      aiDetection: {
        score: authenticityScore,
        model: "text-heuristic-v1",
        details: [
          `Perplexity: ${(analysis.perplexityScore * 100).toFixed(0)}%`,
          `Burstiness: ${(analysis.burstinessScore * 100).toFixed(0)}%`,
          `Repetition: ${(analysis.repetitionScore * 100).toFixed(0)}%`,
        ].join(", "),
      },
      provenance: { hasC2PA: false, signers: [], trustLevel: "none" },
      watermark: { detected: false, provider: null },
    },
    scanConfig.sensitivity,
  );
}

function isDomainAllowed(url: string | undefined): boolean {
  if (!url) return true;
  try {
    const hostname = new URL(url).hostname;

    // Blocklist takes priority
    if (scanConfig.domainBlocklist.some((d) => hostname.endsWith(d))) {
      return false;
    }

    // If allowlist is non-empty, only allow listed domains
    if (scanConfig.domainAllowlist.length > 0) {
      return scanConfig.domainAllowlist.some((d) => hostname.endsWith(d));
    }

    return true;
  } catch {
    return true;
  }
}

let requestCounter = 0;

export default defineBackground(() => {
  console.log("[TruthLens] Background service worker started");

  loadScanConfig();

  // Reload config when storage changes
  browser.storage.onChanged.addListener((changes) => {
    if (changes.truthlens_scan_config) {
      scanConfig = {
        ...DEFAULT_SCAN_CONFIG,
        ...changes.truthlens_scan_config.newValue,
      };
      console.log("[TruthLens] Config updated:", scanConfig.sensitivity);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") {
      tabStates.delete(tabId);
    }
  });

  browser.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      const msg = message as { type: string; payload?: unknown };
      const tabId = sender.tab?.id ?? -1;
      const tabUrl = sender.tab?.url;

      switch (msg.type) {
        case "SCAN_REQUEST": {
          const req = msg as ScanRequestMessage;
          const state = getTabState(tabId);

          if (!state.enabled || !isDomainAllowed(tabUrl)) {
            sendResponse(null);
            return true;
          }

          // Check if content type is enabled in config
          if (!scanConfig.contentTypes.includes(req.payload.contentType)) {
            sendResponse(null);
            return true;
          }

          const requestId = `req-${++requestCounter}`;

          if (req.payload.contentType === "image" && req.payload.src) {
            requestInference(req.payload.src, requestId)
              .then((inferenceResult) => {
                const probs = inferenceResult.probabilities;
                const score = computeTruthScore(
                  {
                    aiDetection: {
                      score: probs[0],
                      model: "image-detector",
                      details: `Real: ${(probs[0] * 100).toFixed(1)}%, AI: ${(probs[1] * 100).toFixed(1)}%`,
                    },
                    provenance: { hasC2PA: false, signers: [], trustLevel: "none" },
                    watermark: { detected: false, provider: null },
                  },
                  scanConfig.sensitivity,
                );

                state.results.set(req.payload.elementId, {
                  src: req.payload.src,
                  score,
                });

                sendResponse(score);
              })
              .catch(() => {
                sendResponse(null);
              });
          } else if (req.payload.contentType === "text" && req.payload.textContent) {
            try {
              const score = analyzeTextContent(req.payload.textContent);
              state.results.set(req.payload.elementId, {
                src: null,
                score,
              });
              sendResponse(score);
            } catch {
              sendResponse(null);
            }
          } else {
            sendResponse(null);
          }

          return true;
        }

        case "GET_STATE": {
          const state = getTabState(tabId);
          const results = Array.from(state.results.entries()).map(
            ([elementId, { src, score }]) => ({ elementId, src, score }),
          );

          const response: ExtensionState = {
            enabled: state.enabled,
            scanSummary: {
              imagesScanned: results.length,
              imagesFlagged: results.filter(
                (r) => r.score.verdict === "likely-ai",
              ).length,
              withProvenance: results.filter(
                (r) => r.score.layers.provenance.hasC2PA,
              ).length,
            },
            results,
          };

          sendResponse(response);
          return true;
        }

        case "TOGGLE_ENABLED": {
          const state = getTabState(tabId);
          state.enabled = !state.enabled;
          sendResponse({ enabled: state.enabled });
          return true;
        }

        default:
          sendResponse({ error: "Unknown message type" });
          return true;
      }
    },
  );
});

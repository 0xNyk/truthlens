import type { TruthScore, ContentType } from "./types.js";

// Content script → Background
export interface ScanRequestMessage {
  type: "SCAN_REQUEST";
  payload: {
    contentType: ContentType;
    src: string | null;
    textContent?: string;    // for text content type
    elementId: string;       // unique ID to correlate response with DOM element
  };
}

// Background → Content script (response)
export interface ScanResultMessage {
  type: "SCAN_RESULT";
  payload: {
    elementId: string;
    score: TruthScore;
  };
}

// Background → Offscreen
export interface InferenceRequestMessage {
  type: "INFERENCE_REQUEST";
  payload: {
    requestId: string;
    imageUrl: string;
  };
}

// Offscreen → Background (response)
export interface InferenceResultMessage {
  type: "INFERENCE_RESULT";
  payload: {
    requestId: string;
    probabilities: number[];
    error?: string;
  };
}

// Popup → Background
export interface GetStateMessage {
  type: "GET_STATE";
}

export interface ToggleEnabledMessage {
  type: "TOGGLE_ENABLED";
}

// Background → Popup (response)
export interface ExtensionState {
  enabled: boolean;
  scanSummary: {
    imagesScanned: number;
    imagesFlagged: number;
    withProvenance: number;
  };
  results: Array<{
    elementId: string;
    src: string | null;
    score: TruthScore;
  }>;
}

export type BackgroundMessage =
  | ScanRequestMessage
  | GetStateMessage
  | ToggleEnabledMessage;

export type OffscreenMessage =
  | InferenceRequestMessage;

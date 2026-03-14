import { createScanner } from "@/content/scanner";
import { createOverlayManager } from "@/content/overlay";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    console.log("[TruthLens] Content script loaded");

    const overlayManager = createOverlayManager();
    const scanner = createScanner(overlayManager);

    scanner.start();
  },
});

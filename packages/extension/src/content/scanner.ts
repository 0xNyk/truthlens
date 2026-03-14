import type { OverlayManager } from "./overlay";
import type { TruthScore, ContentType } from "@truthlens/core";

const MIN_TEXT_LENGTH = 100;
const MIN_IMAGE_SIZE = 64;

export interface Scanner {
  start(): void;
  stop(): void;
}

let elementIdCounter = 0;
const elementIdMap = new WeakMap<Element, string>();

function getElementId(el: Element): string {
  let id = elementIdMap.get(el);
  if (!id) {
    id = `tl-${++elementIdCounter}`;
    elementIdMap.set(el, id);
  }
  return id;
}

export function createScanner(overlayManager: OverlayManager): Scanner {
  const scannedElements = new WeakSet<Element>();
  let observer: MutationObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;

  function scanImages(root: ParentNode = document): HTMLImageElement[] {
    const images: HTMLImageElement[] = [];
    for (const img of root.querySelectorAll("img")) {
      if (
        !scannedElements.has(img) &&
        img.src &&
        !img.src.startsWith("data:") &&
        img.naturalWidth > MIN_IMAGE_SIZE
      ) {
        scannedElements.add(img);
        images.push(img);
      }
    }
    return images;
  }

  function scanTextBlocks(root: ParentNode = document): Element[] {
    const blocks: Element[] = [];
    const selectors =
      "article, [role='article'], .post, .comment, .entry-content, p";
    for (const el of root.querySelectorAll(selectors)) {
      const text = el.textContent?.trim() ?? "";
      if (!scannedElements.has(el) && text.length >= MIN_TEXT_LENGTH) {
        scannedElements.add(el);
        blocks.push(el);
      }
    }
    return blocks;
  }

  function scanVisible(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const el = entry.target;
      intersectionObserver?.unobserve(el);

      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => processElement(el));
      } else {
        setTimeout(() => processElement(el), 0);
      }
    }
  }

  function detectContentType(el: Element): ContentType {
    const tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "picture" || tag === "canvas") return "image";
    if (tag === "video") return "video";
    return "text";
  }

  function processElement(el: Element) {
    const contentType = detectContentType(el);
    const elementId = getElementId(el);
    const src =
      contentType === "image" ? (el as HTMLImageElement).src : null;
    const textContent =
      contentType === "text" ? (el.textContent?.trim() ?? null) : null;

    browser.runtime
      .sendMessage({
        type: "SCAN_REQUEST",
        payload: { contentType, src, textContent, elementId },
      })
      .then((result: TruthScore | null) => {
        if (result && result.verdict) {
          overlayManager.attach(el, result);
        }
      })
      .catch(() => {
        // Extension context invalidated or message failed — skip silently
      });
  }

  function scanPage() {
    intersectionObserver = new IntersectionObserver(scanVisible, {
      rootMargin: "200px",
      threshold: 0.1,
    });

    const images = scanImages();
    const textBlocks = scanTextBlocks();

    for (const el of [...images, ...textBlocks]) {
      intersectionObserver.observe(el);
    }
  }

  function start() {
    scanPage();

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            const images = scanImages(node);
            const textBlocks = scanTextBlocks(node);
            for (const el of [...images, ...textBlocks]) {
              intersectionObserver?.observe(el);
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stop() {
    observer?.disconnect();
    intersectionObserver?.disconnect();
    observer = null;
    intersectionObserver = null;
  }

  return { start, stop };
}

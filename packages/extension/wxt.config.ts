import { defineConfig } from "wxt";
import preact from "@preact/preset-vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  srcDir: "src",
  outDir: ".output",
  modules: [],
  manifest: {
    name: "TruthLens",
    description: "AI content authenticity detector — privacy-first, on-device",
    permissions: ["activeTab", "storage", "offscreen"],
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["models/*", "*.wasm"],
        matches: ["<all_urls>"],
      },
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    plugins: [
      preact(),
      viteStaticCopy({
        targets: [
          {
            // Copy ONNX Runtime WASM files to extension output
            src: "node_modules/onnxruntime-web/dist/*.wasm",
            dest: ".",
          },
        ],
      }),
    ],
    resolve: {
      alias: {
        react: "preact/compat",
        "react-dom": "preact/compat",
      },
    },
    optimizeDeps: {
      exclude: ["onnxruntime-web"],
    },
    build: {
      // Ensure WASM files are treated as assets
      assetsInlineLimit: 0,
    },
  }),
});

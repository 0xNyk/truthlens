# TruthLens

AI content authenticity detector — privacy-first browser extension.

## Architecture

Monorepo with pnpm workspaces:
- `packages/core` — shared TypeScript: types, scoring, detection engine, C2PA provenance
- `packages/models` — ONNX model files + conversion scripts
- `packages/extension` — Browser extension (wxt, Manifest V3, Preact)
- `packages/ui` — Shared Preact components
- `tools/` — Build scripts, benchmarks

## Commands

```sh
pnpm build              # Build all packages
pnpm dev                # Dev mode (extension with HMR)
pnpm test               # Run vitest tests
pnpm typecheck          # TypeScript type checking
pnpm lint               # oxlint
```

## Extension (wxt)

```sh
pnpm --filter @truthlens/extension dev          # Chrome dev
pnpm --filter @truthlens/extension dev:firefox   # Firefox dev
pnpm --filter @truthlens/extension build         # Production build
```

## Key Design Decisions

- **On-device only**: Zero network calls during detection. All inference via ONNX Runtime Web.
- **Three detection layers**: AI model detection, C2PA provenance, watermark detection
- **Shadow DOM overlays**: Style-isolated badges on detected content
- **Offscreen document**: Long-running ONNX inference to avoid service worker timeouts
- **Preact**: Chosen over React for minimal bundle size in extension context

## Testing

- vitest for unit tests (scoring, detection logic)
- Tests in `packages/core/src/__tests__/`

import { defineConfig } from "vitest/config";
import path from "node:path";

// A separate config for tests/live/**, deliberately NOT picked up by the
// main `npm test` / `npm run check`. These tests open a real WebSocket to
// a real relay (see file header comments) — they need network, they are
// slower, and a relay hiccup should never fail the normal test suite or
// CI. Run explicitly: `npx vitest run --config vitest.live.config.ts`.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/live/**/*.check.ts"],
    testTimeout: 20_000,
  },
});

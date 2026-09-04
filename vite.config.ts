/**
 * Builds vouchd as one classic-script HTML file that works when opened from
 * disk. Development remains Vite-served; production has no external build assets.
 */
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const ENTRY_SCRIPT = /\s*<script type="module" crossorigin src="[^"]+"><\/script>/;

function inlineClassicScript(): Plugin {
  return {
    name: "inline-classic-script",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = bundle["index.html"];
      const chunks = Object.values(bundle).filter((item) => item.type === "chunk");
      const otherAssets = Object.values(bundle).filter(
        (item) => item.type === "asset" && item.fileName !== "index.html",
      );
      if (
        html?.type !== "asset" ||
        typeof html.source !== "string" ||
        chunks.length !== 1 ||
        otherAssets.length !== 0 ||
        !ENTRY_SCRIPT.test(html.source)
      ) {
        throw new Error("single-file build requires one HTML asset and one JavaScript chunk");
      }
      const [chunk] = chunks;
      const code = chunk.code.replaceAll("</script", "<\\/script");
      html.source = html.source
        .replace(ENTRY_SCRIPT, "")
        // A callback keeps `$&` inside minified dependencies from becoming
        // String.replace's special "matched text" token.
        .replace("</body>", () => `<script>${code}</script>\n  </body>`);
      delete bundle[chunk.fileName];
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineClassicScript()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    rolldownOptions: { output: { format: "iife" } },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});

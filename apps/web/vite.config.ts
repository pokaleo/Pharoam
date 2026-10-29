import { existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readContentFiles } from "../../tooling/content/build-pack.ts";
import { brandDirectory } from "./src/build/brand.ts";
import { chunkGroup, chunkSizeLimit } from "./src/build/chunks.ts";
import { contentPack } from "./src/build/content-pack.ts";
import { contentSecurityPolicy } from "./src/build/csp.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  // Relative asset paths and hash URLs, so the app runs from any static host and folder (ADR-0008).
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    contentPack(() => readContentFiles(repoRoot)),
    chunkSizeLimit(),
  ],
  resolve: {
    // The Pharoam theme and artwork, or the neutral ones when brand/ is absent (LICENSING.md).
    alias: { "@brand": brandDirectory(repoRoot, existsSync) },
  },
  build: {
    outDir: path.join(repoRoot, "dist/web"),
    emptyOutDir: true,
    // Fonts and images stay files, so the content security policy needs no data: fonts.
    assetsInlineLimit: 0,
    // Libraries in named chunks that a returning browser keeps cached (src/build/chunks.ts).
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: chunkGroup }] } } },
  },
});

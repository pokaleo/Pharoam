import { existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { readContentFiles } from "../../tooling/content/build-pack.ts";
import { brandDirectory } from "./src/build/brand.ts";
import { aiChunkGroup, chunkGroup, chunkSizeLimit } from "./src/build/chunks.ts";
import { contentPack } from "./src/build/content-pack.ts";
import { contentSecurityPolicy } from "./src/build/csp.ts";
import { thirdPartyLicences } from "./src/build/licences.ts";

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
    // The notices the minified bundle no longer carries, beside the app (src/build/licences.ts).
    thirdPartyLicences({
      fontsDir: path.join(repoRoot, "fonts"),
      compiled: [
        {
          title: "Skill vocabulary (data/)",
          files: [path.join(repoRoot, "data/NOTICE"), path.join(repoRoot, "data/LICENSE")],
        },
        {
          title: "Pathways (content/)",
          files: [path.join(repoRoot, "content/NOTICE"), path.join(repoRoot, "content/LICENSE")],
        },
      ],
    }),
  ],
  resolve: {
    alias: [
      // The Pharoam theme and artwork, or the neutral ones when brand/ is absent (LICENSING.md).
      { find: "@brand", replacement: brandDirectory(repoRoot, existsSync) },
      // LangChain's tracing package, replaced so no tracing code ships (hard rule 7, src/ai/langsmith-stand-in.ts).
      {
        find: /^langsmith(?:\/.*)?$/,
        replacement: path.join(import.meta.dirname, "src/ai/langsmith-stand-in.ts"),
      },
    ],
  },
  build: {
    outDir: path.join(repoRoot, "dist/web"),
    emptyOutDir: true,
    // Fonts and images stay files, so the content security policy needs no data: fonts.
    assetsInlineLimit: 0,
    // Libraries in named chunks that a returning browser keeps cached; the AI libraries take only their own code, so
    // nothing the app loads at start ends up in them (src/build/chunks.ts).
    rolldownOptions: {
      output: {
        // Modules start in the order the source imports them, whatever chunk they land in; Rolldown asks for this
        // when a group doesn't take its dependencies, as the AI group doesn't.
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [{ name: aiChunkGroup, includeDependenciesRecursively: false }, { name: chunkGroup }],
        },
      },
    },
  },
});

import { describe, expect, it } from "vitest";
import { CHUNK_LIMIT, chunkGroup, oversizedChunks } from "./chunks.ts";

const dep = (name: string, file = "index.js"): string =>
  `/repo/node_modules/.pnpm/${name.replace("/", "+")}@1.0.0/node_modules/${name}/dist/${file}`;

describe("chunkGroup", () => {
  it("puts React in its own chunk", () => {
    expect(chunkGroup(dep("react"))).toBe("react");
    expect(chunkGroup(dep("react-dom", "client.js"))).toBe("react");
    expect(chunkGroup(dep("scheduler"))).toBe("react");
  });

  it("groups the routing and data libraries", () => {
    expect(chunkGroup(dep("@tanstack/react-router"))).toBe("tanstack");
    expect(chunkGroup(dep("@tanstack/router-core"))).toBe("tanstack");
    expect(chunkGroup(dep("@tanstack/react-query"))).toBe("tanstack");
  });

  it("groups translation, validation and the Markdown renderer", () => {
    expect(chunkGroup(dep("i18next"))).toBe("i18n");
    expect(chunkGroup(dep("react-i18next"))).toBe("i18n");
    expect(chunkGroup(dep("zod", "v4/core/core.js"))).toBe("records");
    expect(chunkGroup(dep("yaml"))).toBe("records");
    expect(chunkGroup(dep("@noble/hashes", "sha2.js"))).toBe("records");
    expect(chunkGroup(dep("react-markdown"))).toBe("markdown");
    expect(chunkGroup(dep("micromark-core-commonmark"))).toBe("markdown");
    expect(chunkGroup(dep("hast-util-sanitize"))).toBe("markdown");
  });

  it("leaves the app's own code and the core where Vite puts them", () => {
    expect(chunkGroup("/repo/apps/web/src/app.tsx")).toBeNull();
    expect(chunkGroup("/repo/packages/core/src/core-service.ts")).toBeNull();
  });
});

describe("oversizedChunks", () => {
  it("names each chunk over the limit, with its size", () => {
    const bundle = {
      "assets/index.js": { type: "chunk" as const, code: "x".repeat(CHUNK_LIMIT + 1) },
      "assets/react.js": { type: "chunk" as const, code: "x".repeat(CHUNK_LIMIT) },
      "assets/font.woff2": { type: "asset" as const },
    };
    expect(oversizedChunks(bundle)).toEqual([`assets/index.js (${String(CHUNK_LIMIT + 1)} bytes)`]);
  });

  it("measures bytes, not characters", () => {
    const bundle = { "assets/a.js": { type: "chunk" as const, code: "é".repeat(CHUNK_LIMIT / 2 + 1) } };
    expect(oversizedChunks(bundle)).toHaveLength(1);
  });
});

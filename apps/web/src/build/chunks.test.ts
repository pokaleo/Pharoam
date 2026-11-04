import { describe, expect, it } from "vitest";
import { AI_CHUNK_LIMIT, aiChunkGroup, CHUNK_LIMIT, chunkGroup, oversizedChunks } from "./chunks.ts";

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

  it("leaves the AI libraries to their own groups, which take none of the app's code (spike S1)", () => {
    expect(chunkGroup(dep("@langchain/core", "dist/messages/index.js"))).toBeNull();
    expect(chunkGroup(dep("@anthropic-ai/sdk", "client.js"))).toBeNull();
    expect(chunkGroup(dep("openai", "client.js"))).toBeNull();
  });

  it("leaves the app's own code and the core where Vite puts them", () => {
    expect(chunkGroup("/repo/apps/web/src/app.tsx")).toBeNull();
    expect(chunkGroup("/repo/packages/core/src/core-service.ts")).toBeNull();
  });
});

describe("aiChunkGroup", () => {
  it("puts the AI libraries in chunks of their own, one per provider (spike S1)", () => {
    expect(aiChunkGroup(dep("@langchain/core", "dist/messages/index.js"))).toBe("ai-langchain");
    expect(aiChunkGroup(dep("@langchain/anthropic"))).toBe("ai-anthropic");
    expect(aiChunkGroup(dep("@anthropic-ai/sdk", "client.js"))).toBe("ai-anthropic");
    expect(aiChunkGroup(dep("@langchain/openai"))).toBe("ai-openai");
    expect(aiChunkGroup(dep("openai", "client.js"))).toBe("ai-openai");
  });

  it("leaves everything else, including libraries the AI code shares with the app", () => {
    expect(aiChunkGroup(dep("zod", "v4/core/util.js"))).toBeNull();
    expect(aiChunkGroup(dep("react"))).toBeNull();
    expect(aiChunkGroup("/repo/apps/web/src/app.tsx")).toBeNull();
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

  it("lets the AI chunks, loaded only once a model is set up, weigh up to their own limit (spike S1)", () => {
    const bundle = {
      "assets/ai-anthropic-AbC123.js": { type: "chunk" as const, code: "x".repeat(AI_CHUNK_LIMIT) },
      "assets/ai-openai-Xy9.js": { type: "chunk" as const, code: "x".repeat(AI_CHUNK_LIMIT + 1) },
      "assets/main-ai-helper.js": { type: "chunk" as const, code: "x".repeat(CHUNK_LIMIT + 1) },
    };
    expect(oversizedChunks(bundle)).toEqual([
      `assets/ai-openai-Xy9.js (${String(AI_CHUNK_LIMIT + 1)} bytes)`,
      `assets/main-ai-helper.js (${String(CHUNK_LIMIT + 1)} bytes)`,
    ]);
  });

  it("measures bytes, not characters", () => {
    const bundle = { "assets/a.js": { type: "chunk" as const, code: "é".repeat(CHUNK_LIMIT / 2 + 1) } };
    expect(oversizedChunks(bundle)).toHaveLength(1);
  });
});

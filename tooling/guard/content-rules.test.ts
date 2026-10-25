import { describe, expect, it } from "vitest";
import { checkContent } from "./content-rules.ts";

const rules = (path: string, content: string) => checkContent(path, content).map((v) => v.rule);

describe("content rules (AGENTS.md hard rules)", () => {
  describe("HR7: no telemetry, analytics or LangSmith", () => {
    it.each([
      'import posthog from "posthog-js";',
      'import * as Sentry from "@sentry/react";',
      'import { track } from "@vercel/analytics";',
      'const mixpanel = require("mixpanel-browser");',
      'const ls = await import("langsmith");',
      'import { Client } from "langsmith/client";',
      'export { init } from "@amplitude/analytics-browser";',
    ])("rejects %s", (code) => {
      expect(rules("apps/web/src/app.ts", code)).toContain("HR7-telemetry");
    });

    it("allows ordinary imports", () => {
      expect(rules("apps/web/src/app.ts", 'import { z } from "zod";\nimport React from "react";')).toEqual(
        [],
      );
    });

    it("does not match look-alike names", () => {
      expect(rules("apps/web/src/app.ts", 'import { sentryLike } from "./sentry-like";')).toEqual([]);
    });

    it("rejects telemetry packages declared in package.json", () => {
      const pkg = JSON.stringify({ dependencies: { "posthog-js": "1.0.0" } });
      expect(rules("apps/web/package.json", pkg)).toContain("HR7-telemetry");
    });

    it("allows a package.json without telemetry", () => {
      const pkg = JSON.stringify({ dependencies: { zod: "4.0.0" }, devDependencies: { vitest: "5.0.0" } });
      expect(rules("apps/web/package.json", pkg)).toEqual([]);
    });

    it.each([
      "LANGSMITH_TRACING=true",
      "LANGCHAIN_TRACING_V2=true",
      'process.env.LANGSMITH_TRACING = "true";',
      "LANGSMITH_API_KEY=lsv2_abc",
    ])("rejects enabling LangSmith: %s", (text) => {
      expect(rules(".env.example", text)).toContain("HR7-langsmith");
    });

    it("rejects third-party scripts in HTML", () => {
      const html = '<html><head><script src="https://cdn.example.com/x.js"></script></head></html>';
      expect(rules("apps/web/index.html", html)).toContain("HR7-third-party-script");
    });

    it("allows the app's own scripts in HTML", () => {
      const html = '<script type="module" src="/src/main.tsx"></script>';
      expect(rules("apps/web/index.html", html)).toEqual([]);
    });
  });

  describe("HR10: sanitised Markdown, no raw HTML", () => {
    it("rejects dangerouslySetInnerHTML", () => {
      expect(rules("apps/web/src/x.tsx", "<div dangerouslySetInnerHTML={{ __html: md }} />")).toContain(
        "HR10-raw-html",
      );
    });

    it("rejects rehype-raw", () => {
      expect(rules("apps/web/src/md.tsx", 'import rehypeRaw from "rehype-raw";')).toContain("HR10-raw-html");
    });
  });

  describe("TypeScript only (ADR-0002)", () => {
    it.each([
      "eslint.config.js",
      "tooling/x.mjs",
      "scripts/y.cjs",
      "apps/web/src/a.jsx",
      "tooling/guard/x.js",
    ])("rejects %s", (path) => {
      expect(rules(path, "export {};")).toContain("TS-only");
    });

    it.each(["eslint.config.ts", "apps/web/src/a.tsx", ".husky/pre-commit", "docs/x.md", "api.json"])(
      "allows %s",
      (path) => {
        expect(rules(path, "export {};")).toEqual([]);
      },
    );
  });

  it("explains each violation", () => {
    const [violation] = checkContent("apps/web/src/a.ts", 'import "posthog-js";');
    expect(violation?.message).toMatch(/telemetry/i);
  });

  it("skips the guard's own sources, which must name what they forbid", () => {
    expect(checkContent("tooling/guard/deny-list.ts", 'import "posthog-js"; LANGSMITH_TRACING=true')).toEqual(
      [],
    );
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brandDirectory, BRAND_FILES } from "./brand.ts";

const REPO = path.resolve(import.meta.dirname, "../../../..");
const NEUTRAL = path.join(REPO, "apps/web/src/theme/neutral");

// The custom properties a stylesheet defines, such as `--ink`.
function definedProperties(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name ?? ""));
}

describe("brandDirectory", () => {
  it("uses brand/ when it holds every brand file the app needs", () => {
    expect(brandDirectory(REPO, () => true)).toBe(path.join(REPO, "brand"));
  });

  it("falls back to the neutral theme without brand/, so forks build without the Pharoam brand", () => {
    expect(brandDirectory(REPO, () => false)).toBe(NEUTRAL);
  });

  it("falls back when brand/ is missing any file, rather than failing the build halfway", () => {
    const missing = path.join(REPO, "brand", "wordmark.svg");
    expect(brandDirectory(REPO, (file) => file !== missing)).toBe(NEUTRAL);
  });
});

describe("the neutral theme", () => {
  it.each(BRAND_FILES)("provides %s, as brand/ does", (file) => {
    expect(() => readFileSync(path.join(NEUTRAL, file))).not.toThrow();
  });

  it("defines every custom property the Pharoam tokens define, so components look whole without brand/", () => {
    const pharoam = definedProperties(readFileSync(path.join(REPO, "brand/tokens.css"), "utf8"));
    const neutral = definedProperties(readFileSync(path.join(NEUTRAL, "tokens.css"), "utf8"));
    expect([...pharoam].filter((name) => !neutral.has(name))).toEqual([]);
  });
});

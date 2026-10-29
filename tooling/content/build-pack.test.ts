import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileContentPack, ContentPack, pathwaySummaries } from "../../packages/core/src/index.ts";
import { buildPack, readContentFiles } from "./build-pack.ts";

const repoRoot = path.join(import.meta.dirname, "..", "..");

// A copy of the repository's content in a temporary folder, so a test can break it safely.
function contentCopy(): string {
  const root = mkdtempSync(path.join(tmpdir(), "pharoam-pack-"));
  cpSync(path.join(repoRoot, "data"), path.join(root, "data"), { recursive: true });
  cpSync(path.join(repoRoot, "content"), path.join(root, "content"), { recursive: true });
  return root;
}

describe("building the built-in content pack (AD16)", () => {
  it("reads every content record, but not READMEs", () => {
    const paths = readContentFiles(repoRoot).map((file) => file.path);
    expect(paths).toContain("content/pack.md");
    expect(paths).toContain("data/levels.md");
    expect(paths).toContain("content/pathways/frontend-engineer.md");
    expect(paths.filter((p) => p.endsWith("README.md"))).toEqual([]);
  });

  it("builds the pack from the repository's content into a versioned file", () => {
    const out = mkdtempSync(path.join(tmpdir(), "pharoam-dist-"));
    const built = buildPack(repoRoot, out);
    if (!built.ok) throw new Error(JSON.stringify(built.error.problems, null, 2));
    expect(built.value.file).toBe(path.join(out, "pharoam-core-0.1.0.json"));
    const pack = ContentPack.parse(JSON.parse(readFileSync(built.value.file, "utf8")));
    expect(pack.skills.length).toBeGreaterThanOrEqual(200);
    expect(pack.pathways.map((p) => p.slug)).toEqual([
      "applied-ai-engineer",
      "backend-engineer",
      "frontend-engineer",
      "ml-engineer",
    ]);
    expect(pack.manifest.contents.skills).toHaveLength(pack.skills.length);
  });

  it("fails on invalid content, names the file, and writes nothing", () => {
    const root = contentCopy();
    writeFileSync(
      path.join(root, "data", "skills", "python.md"),
      "---\nschema: skill/1\nslug: python\n---\n",
    );
    const out = mkdtempSync(path.join(tmpdir(), "pharoam-dist-"));
    const built = buildPack(root, out);
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.problems.map((p) => p.path)).toContain("data/skills/python.md");
    expect(existsSync(path.join(out, "pharoam-core-0.1.0.json"))).toBe(false);
  });

  it("offers the 4 built-in pathways, each with a summary and a review (MVP S10.1, S10.2)", () => {
    const pack = compileContentPack(readContentFiles(repoRoot));
    if (!pack.ok) throw new Error(JSON.stringify(pack.error.problems, null, 2));
    const pathways = pathwaySummaries(pack.value);
    expect(pathways.map((p) => p.title)).toEqual([
      "Applied AI engineer",
      "Backend engineer",
      "Frontend engineer",
      "Machine-learning engineer",
    ]);
    for (const pathway of pathways) {
      expect(pathway.summary.length).toBeGreaterThan(0);
      expect(pathway.review.by.length).toBeGreaterThan(0);
    }
  });
});

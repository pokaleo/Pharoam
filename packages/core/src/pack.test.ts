import { describe, expect, it } from "vitest";
import { PACK_FILE, PATHWAY_FILE, SKILL_FILE } from "./__fixtures__/content-records.ts";
import { compileContentPack, ContentPack } from "./pack.ts";

const LEVELS_FILE = `---
schema: levels/1
levels:
  0: { name: Aware, description: Knows what it is. }
  1: { name: Beginner, description: Has used it with help. }
  2: { name: Working, description: Uses it alone. }
  3: { name: Proficient, description: Uses it well on complex work. }
  4: { name: Expert, description: Shapes how others use it. }
---
`;

const skill = (slug: string, extra = ""): string =>
  `---\nschema: skill/1\nslug: ${slug}\nname: ${slug}\ndomain: Test\norigin: { source: Pharoam, licence: MIT }\n${extra}---\n`;

// The pathway example requires python, pytorch and docker, and lists sql as transferable.
const VALID = [
  { path: "content/pack.md", text: PACK_FILE },
  { path: "data/levels.md", text: LEVELS_FILE },
  { path: "data/skills/python.md", text: SKILL_FILE },
  { path: "data/skills/pytorch.md", text: skill("pytorch", "relations: { implies: [python] }\n") },
  { path: "data/skills/docker.md", text: skill("docker") },
  { path: "data/skills/sql.md", text: skill("sql") },
  { path: "data/skills/django.md", text: skill("django") },
  { path: "data/skills/pandas.md", text: skill("pandas") },
  { path: "content/pathways/ml-engineer.md", text: PATHWAY_FILE },
];

function problems(
  files: readonly { path: string; text: string }[],
): readonly { path: string; message: string }[] {
  const result = compileContentPack(files);
  return result.ok ? [] : result.error.problems;
}

describe("compiling a content pack (AD16)", () => {
  it("compiles the skills, level scale and pathways, sorted, with the manifest's contents filled in", () => {
    const result = compileContentPack(VALID);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const pack = result.value;
    expect(pack.format).toBe("pharoam-pack/1");
    expect(pack.skills.map((s) => s.slug)).toEqual([
      "django",
      "docker",
      "pandas",
      "python",
      "pytorch",
      "sql",
    ]);
    expect(pack.pathways.map((p) => p.slug)).toEqual(["ml-engineer"]);
    expect(pack.levels.levels["2"].name).toBe("Working");
    expect(pack.manifest).toMatchObject({
      name: "pharoam-core",
      version: "0.1.0",
      contents: {
        skills: ["django", "docker", "pandas", "python", "pytorch", "sql"],
        pathways: ["ml-engineer"],
      },
    });
  });

  it("produces a pack that reads back as the same pack, as packs loaded at runtime are", () => {
    const result = compileContentPack(VALID);
    if (!result.ok) throw new Error("not compiled");
    const roundTripped: unknown = JSON.parse(JSON.stringify(result.value));
    expect(ContentPack.parse(roundTripped)).toEqual(result.value);
  });

  it("gives the same output whatever order the files come in", () => {
    const forwards = compileContentPack(VALID);
    const backwards = compileContentPack(VALID.toReversed());
    expect(JSON.stringify(backwards)).toBe(JSON.stringify(forwards));
  });

  it("reports every problem, with where it is, instead of stopping at the first", () => {
    const broken = [
      ...VALID.filter((f) => f.path !== "data/skills/docker.md"),
      { path: "data/skills/broken.md", text: "---\nslug: x\nslug: y\n---\n" },
      { path: "data/skills/no-domain.md", text: skill("no-domain").replace("domain: Test\n", "") },
      { path: "data/skills/mystery.md", text: "---\nschema: recipe/1\n---\n" },
      { path: "data/skills/python2.md", text: SKILL_FILE },
      { path: "data/skills/needs-rust.md", text: skill("needs-rust", "relations: { implies: [rust] }\n") },
    ];
    const found = problems(broken);
    expect(found.map((p) => p.path)).toEqual([
      "content/pathways/ml-engineer.md",
      "data/skills/broken.md",
      "data/skills/mystery.md",
      "data/skills/needs-rust.md",
      "data/skills/no-domain.md",
      "data/skills/python2.md",
    ]);
    expect(found.map((p) => p.message)).toEqual([
      "Requires the unknown skill docker.",
      "Isn't a record file: invalid-yaml.",
      "Has an unknown schema: recipe/1.",
      "Relates to the unknown skill rust.",
      "Has an invalid field: domain.",
      "Repeats the skill python, also in data/skills/python.md.",
    ]);
  });

  it("needs exactly one manifest and one level scale", () => {
    const withoutManifest = VALID.filter((f) => f.path !== "content/pack.md");
    expect(problems(withoutManifest)).toEqual([{ path: "", message: "Has no pack manifest (pack/1)." }]);
    const twoScales = [...VALID, { path: "data/levels2.md", text: LEVELS_FILE }];
    expect(problems(twoScales)).toEqual([
      { path: "data/levels2.md", message: "Repeats the level scale, also in data/levels.md." },
    ]);
  });

  it("reports repeated pathways and manifests, and unknown replacements and transferable skills", () => {
    const files = [
      ...VALID.filter((f) => f.path !== "data/skills/sql.md" && f.path !== "data/levels.md"),
      { path: "content/pack2.md", text: PACK_FILE },
      { path: "content/pathways/ml-engineer2.md", text: PATHWAY_FILE },
      { path: "data/skills/old.md", text: skill("old", "status: deprecated\nreplaced_by: newer\n") },
    ];
    expect(problems(files)).toEqual([
      { path: "", message: "Has no level scale (levels/1)." },
      { path: "content/pack2.md", message: "Repeats the pack manifest, also in content/pack.md." },
      { path: "content/pathways/ml-engineer.md", message: "Lists the unknown transferable skill sql." },
      {
        path: "content/pathways/ml-engineer2.md",
        message: "Repeats the pathway ml-engineer, also in content/pathways/ml-engineer.md.",
      },
      { path: "data/skills/old.md", message: "Is replaced by the unknown skill newer." },
    ]);
  });

  it("refuses a pathway that hasn't been reviewed (PRD I3)", () => {
    const unreviewed = VALID.map((f) =>
      f.path.startsWith("content/pathways/")
        ? { ...f, text: PATHWAY_FILE.replace(/review:[\s\S]*?ai:\n/, "ai:\n") }
        : f,
    );
    expect(problems(unreviewed)).toEqual([
      { path: "content/pathways/ml-engineer.md", message: "Has an invalid field: review." },
    ]);
  });
});

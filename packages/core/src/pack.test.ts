import { describe, expect, it } from "vitest";
import { LEVELS_FILE, PACK_FILE, PATHWAY_FILE, SKILL_FILE } from "./__fixtures__/content-records.ts";
import { compileContentPack, ContentPack } from "./pack.ts";

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

// A multiple-choice item for the question bank (MVP S20.1).
const item = (slug: string, skill: string, level: number, extra = ""): string =>
  `---\nschema: assessment-item/1\nslug: ${slug}\nskills: [${skill}]\nlevel: ${String(level)}\nformat: mcq\nprompt: Which is it?\noptions: [a, b, c]\nanswer: 1\nexplanation: Because b.\norigin: { source: Pharoam content, licence: CC-BY-SA-4.0 }\n${extra}---\n`;
const REVIEWED = "review: { by: The Pharoam founder, at: 2026-11-14 }\n";

describe("compiling the question bank (MVP S20)", () => {
  it("compiles reviewed items sorted by slug, and counts them in the manifest (S20.2, S20.3)", () => {
    const result = compileContentPack([
      ...VALID,
      { path: "content/items/sql/sql-2-b.md", text: item("sql-2-b", "sql", 2, REVIEWED) },
      { path: "content/items/sql/sql-2-a.md", text: item("sql-2-a", "sql", 2, REVIEWED) },
    ]);
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.value.items.map((one) => one.slug)).toEqual(["sql-2-a", "sql-2-b"]);
    expect(result.value.manifest.contents.items).toBe(2);
    expect(ContentPack.safeParse(result.value).success).toBe(true);
  });

  it("compiles a pack with no items, as before the bank", () => {
    const result = compileContentPack(VALID);
    expect(result.ok && result.value.items).toEqual([]);
    expect(result.ok && result.value.manifest.contents.items).toBe(0);
  });

  it("refuses an item that is invalid, unreviewed, for an unknown skill, or repeated (S20.1)", () => {
    expect(
      problems([
        ...VALID,
        {
          path: "content/items/sql/bad.md",
          text: item("sql-2-a", "sql", 2, REVIEWED).replace("answer: 1", "answer: 7"),
        },
        { path: "content/items/sql/unreviewed.md", text: item("sql-2-b", "sql", 2) },
        { path: "content/items/cobol/cobol-1-a.md", text: item("cobol-1-a", "cobol", 1, REVIEWED) },
        { path: "content/items/sql/again.md", text: item("sql-2-c", "sql", 2, REVIEWED) },
        { path: "content/items/sql/twice.md", text: item("sql-2-c", "sql", 2, REVIEWED) },
      ]),
    ).toEqual([
      { path: "content/items/cobol/cobol-1-a.md", message: "Tests the unknown skill cobol." },
      { path: "content/items/sql/bad.md", message: "Has an invalid field: answer." },
      {
        path: "content/items/sql/twice.md",
        message: "Repeats the item sql-2-c, also in content/items/sql/again.md.",
      },
      { path: "content/items/sql/unreviewed.md", message: "Has an invalid field: review." },
    ]);
  });

  describe("the question bank's rules (review findings)", () => {
    it("compiles an open item, and refuses an unknown format", () => {
      const open = item("sql-3-plan", "sql", 3, REVIEWED)
        .replace("format: mcq", "format: open")
        .replace("options: [a, b, c]\nanswer: 1\nexplanation: Because b.\n", "rubric: Names the index.\n");
      const result = compileContentPack([...VALID, { path: "content/items/sql/sql-3-plan.md", text: open }]);
      expect(result.ok && result.value.items.map((one) => one.format)).toEqual(["open"]);
      expect(
        problems([
          ...VALID,
          { path: "content/items/sql/odd.md", text: open.replace("format: open", "format: essay") },
        ]),
      ).toEqual([{ path: "content/items/sql/odd.md", message: "Has an invalid field: format." }]);
    });

    it("refuses an item kept in another skill's folder, since a diagnostic draws it for its first skill", () => {
      expect(
        problems([
          ...VALID,
          { path: "content/items/python/sql-2-a.md", text: item("sql-2-a", "sql", 2, REVIEWED) },
        ]),
      ).toEqual([
        {
          path: "content/items/python/sql-2-a.md",
          message: "Is in the folder for python, but tests sql first.",
        },
      ]);
    });

    it("refuses text below an item's top block, which the pack wouldn't keep", () => {
      expect(
        problems([
          ...VALID,
          { path: "content/items/sql/sql-2-a.md", text: `${item("sql-2-a", "sql", 2, REVIEWED)}\nA note.\n` },
        ]),
      ).toEqual([
        {
          path: "content/items/sql/sql-2-a.md",
          message: "Has text below its top block, which the pack doesn't keep; put it in the prompt.",
        },
      ]);
    });

    it("refuses an item that tests a deprecated skill", () => {
      const deprecated = skill("mysql5", "status: deprecated\nreplaced_by: sql\n");
      expect(
        problems([
          ...VALID,
          { path: "data/skills/mysql5.md", text: deprecated },
          { path: "content/items/mysql5/mysql5-1-a.md", text: item("mysql5-1-a", "mysql5", 1, REVIEWED) },
        ]),
      ).toEqual([
        {
          path: "content/items/mysql5/mysql5-1-a.md",
          message: "Tests the deprecated skill mysql5; use sql.",
        },
      ]);
    });

    it("loads a pack built before the question bank, and refuses one whose count doesn't match its items", () => {
      const compiled = compileContentPack(VALID);
      if (!compiled.ok) throw new Error("Invalid example.");
      const older: Record<string, unknown> = { ...compiled.value };
      delete older.items;
      const olderManifest = { ...compiled.value.manifest, contents: { skills: [], pathways: [] } };
      expect(ContentPack.safeParse({ ...older, manifest: olderManifest }).success).toBe(true);
      const claimed = {
        ...compiled.value.manifest,
        contents: { ...compiled.value.manifest.contents, items: 40 },
      };
      expect(ContentPack.safeParse({ ...compiled.value, manifest: claimed }).success).toBe(false);
    });
  });
});

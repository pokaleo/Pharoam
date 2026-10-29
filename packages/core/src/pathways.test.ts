import { describe, expect, it } from "vitest";
import { LEVELS_FILE, PACK_FILE, PATHWAY_FILE, SKILL_FILE } from "./__fixtures__/content-records.ts";
import { compileContentPack, type ContentPack } from "./pack.ts";
import { pathwayDetail, pathwaySummaries } from "./pathways.ts";

const skill = (slug: string, name: string): string =>
  `---\nschema: skill/1\nslug: ${slug}\nname: ${name}\ndomain: Test\norigin: { source: Pharoam, licence: MIT }\n---\n`;

// A second pathway, written by hand, so the list shows both kinds.
const HAND_WRITTEN = `---
schema: pathway/1
slug: data-analyst
title: Data analyst
summary: Turns data into answers.
requirements:
  - skill: sql
    level: 2
    importance: core
    sources:
      - title: A survey of data analyst job adverts
review:
  by: A reviewer
  at: 2026-10-25
---
`;

function pack(): ContentPack {
  const compiled = compileContentPack([
    {
      path: "content/pack.md",
      text: PACK_FILE.replace("pathways: [ml-engineer]", "pathways: [data-analyst, ml-engineer]"),
    },
    { path: "data/levels.md", text: LEVELS_FILE },
    { path: "data/skills/python.md", text: SKILL_FILE },
    { path: "data/skills/pytorch.md", text: skill("pytorch", "PyTorch") },
    { path: "data/skills/docker.md", text: skill("docker", "Docker") },
    { path: "data/skills/sql.md", text: skill("sql", "SQL") },
    { path: "data/skills/django.md", text: skill("django", "Django") },
    { path: "data/skills/pandas.md", text: skill("pandas", "pandas") },
    { path: "content/pathways/ml-engineer.md", text: PATHWAY_FILE },
    { path: "content/pathways/data-analyst.md", text: HAND_WRITTEN },
  ]);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.error.problems));
  return compiled.value;
}

describe("the list of pathways (MVP S10.1)", () => {
  it("lists every pathway with its summary, who reviewed it and whether AI drafted it", () => {
    expect(pathwaySummaries(pack())).toEqual([
      {
        slug: "data-analyst",
        title: "Data analyst",
        summary: "Turns data into answers.",
        review: { by: "A reviewer", at: "2026-10-25" },
        ai: null,
      },
      {
        slug: "ml-engineer",
        title: "Machine-learning engineer",
        summary: "Builds, ships and runs machine-learning systems in production.",
        review: { by: "The Pharoam founder", at: "2026-10-27" },
        ai: { task: "draft-pathway@1", model: "anthropic/claude-sonnet-5-5", at: "2026-10-26T10:00:00Z" },
      },
    ]);
  });
});

describe("one pathway (MVP S10.2, S10.3)", () => {
  it("shows each requirement with its skill, level, core or helpful, and sources", () => {
    const detail = pathwayDetail(pack(), "ml-engineer");
    expect(detail?.requirements).toEqual([
      {
        skill: "python",
        name: "Python",
        level: 3,
        levelName: "Proficient",
        importance: "core",
        sources: [
          {
            title: "Survey of machine-learning engineer job adverts, 2026",
            url: "https://example.com/ml-engineer-adverts-2026",
            accessed: "2026-10-20",
          },
        ],
      },
      {
        skill: "pytorch",
        name: "PyTorch",
        level: 3,
        levelName: "Proficient",
        importance: "core",
        sources: [{ title: "Survey of machine-learning engineer job adverts, 2026" }],
      },
      {
        skill: "docker",
        name: "Docker",
        level: 2,
        levelName: "Working",
        importance: "helpful",
        sources: [{ title: "Survey of machine-learning engineer job adverts, 2026" }],
      },
    ]);
  });

  it("shows who reviewed it and when, and that AI drafted it", () => {
    expect(pathwayDetail(pack(), "ml-engineer")).toMatchObject({
      title: "Machine-learning engineer",
      review: { by: "The Pharoam founder", at: "2026-10-27" },
      ai: { task: "draft-pathway@1", model: "anthropic/claude-sonnet-5-5" },
    });
    expect(pathwayDetail(pack(), "data-analyst")?.ai).toBeNull();
  });

  it("names the skills that carry over, and keeps the rest of the pathway", () => {
    const detail = pathwayDetail(pack(), "ml-engineer");
    expect(detail?.transferable).toEqual([
      { skill: "python", name: "Python" },
      { skill: "sql", name: "SQL" },
    ]);
    expect(detail).toMatchObject({
      prerequisites: ["Comfortable with linear algebra and probability."],
      uncertainties: ["Demand for specialised roles shifts quickly as tooling changes."],
      investment: { time: { min: 6, max: 18, unit: "months" }, cost: { currency: "GBP", region: "GB" } },
    });
  });

  it("is nothing for a pathway the pack doesn't have", () => {
    expect(pathwayDetail(pack(), "astronaut")).toBeUndefined();
  });
});

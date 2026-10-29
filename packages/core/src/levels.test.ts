import { describe, expect, it } from "vitest";
import { levelDescriptions } from "./levels.ts";
import { LevelScale } from "./schemas/levels.ts";
import { SkillEntry } from "./schemas/skill.ts";

const SCALE = LevelScale.parse({
  schema: "levels/1",
  levels: {
    0: { name: "None", description: "Hasn't used it." },
    1: { name: "Aware", description: "Knows what it is." },
    2: { name: "Working", description: "Uses it with help." },
    3: { name: "Practitioner", description: "Uses it on their own." },
    4: { name: "Expert", description: "Leads others with it." },
  },
});

const ENTRY = {
  schema: "skill/1",
  slug: "python",
  name: "Python",
  domain: "Programming languages",
  origin: { source: "MIND Tech Ontology", licence: "MIT" },
};

const PYTHON = SkillEntry.parse({
  ...ENTRY,
  levels: {
    0: "Has never written Python.",
    1: "Reads simple scripts.",
    2: "Writes small scripts with help.",
    3: "Builds and tests packages.",
    4: "Designs large Python systems.",
  },
});

describe("describing each level when recording one (MVP S6.3)", () => {
  it("shows the shared description of each level for a skill without its own", () => {
    expect(levelDescriptions(SCALE, SkillEntry.parse(ENTRY))).toEqual([
      { level: 0, name: "None", description: "Hasn't used it.", specific: false },
      { level: 1, name: "Aware", description: "Knows what it is.", specific: false },
      { level: 2, name: "Working", description: "Uses it with help.", specific: false },
      { level: 3, name: "Practitioner", description: "Uses it on their own.", specific: false },
      { level: 4, name: "Expert", description: "Leads others with it.", specific: false },
    ]);
  });

  it("shows the skill's own description where it has one, keeping the shared names", () => {
    expect(levelDescriptions(SCALE, PYTHON)[3]).toEqual({
      level: 3,
      name: "Practitioner",
      description: "Builds and tests packages.",
      specific: true,
    });
  });

  it("shows the shared descriptions for a skill not in the vocabulary", () => {
    expect(levelDescriptions(SCALE, undefined).map((level) => level.specific)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

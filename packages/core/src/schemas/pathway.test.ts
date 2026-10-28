import { describe, expect, it } from "vitest";
import { PATHWAY_FILE } from "../__fixtures__/content-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { PathwayRecord } from "./pathway.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

const SOURCE = { title: "Job advert survey, 2026" };
const MINIMAL = {
  schema: "pathway/1",
  slug: "frontend-engineer",
  title: "Frontend engineer",
  summary: "Builds the parts of web apps people use.",
  requirements: [{ skill: "javascript", level: 3, importance: "core", sources: [SOURCE] }],
  review: { by: "The Pharoam founder", at: "2026-10-27" },
};

describe("pathway", () => {
  it("validates the example", () => {
    const pathway = PathwayRecord.parse(top(PATHWAY_FILE));
    expect(pathway.requirements.map((r) => [r.skill, r.level, r.importance])).toEqual([
      ["python", 3, "core"],
      ["pytorch", 3, "core"],
      ["docker", 2, "helpful"],
    ]);
    expect(pathway.ai?.task).toBe("draft-pathway@1");
    expect(pathway.investment?.cost).toMatchObject({ min: 0, max: 3000, currency: "GBP" });
  });

  it("needs only a summary, sourced requirements and a review (MVP §3)", () => {
    expect(PathwayRecord.parse(MINIMAL)).toMatchObject({ ...MINIMAL, ai: null, transferable: [] });
  });

  it("gives every requirement a source (PRD I2)", () => {
    const requirements = [{ skill: "javascript", level: 3, importance: "core", sources: [] }];
    expect(PathwayRecord.safeParse({ ...MINIMAL, requirements }).success).toBe(false);
  });

  it("names each requirement's skill once, from the inventory (MVP S8.3)", () => {
    const requirement = MINIMAL.requirements[0];
    expect(PathwayRecord.safeParse({ ...MINIMAL, requirements: [requirement, requirement] }).success).toBe(
      false,
    );
    const custom = { ...requirement, skill: "custom-kdb-q" };
    expect(PathwayRecord.safeParse({ ...MINIMAL, requirements: [custom] }).success).toBe(false);
  });

  it("is reviewed before it ships (PRD I3)", () => {
    expect(PathwayRecord.safeParse({ ...MINIMAL, review: undefined }).success).toBe(false);
  });

  it("gives investment as a sourced range, low to high", () => {
    const time = { min: 12, max: 6, unit: "months", sources: [SOURCE] };
    expect(PathwayRecord.safeParse({ ...MINIMAL, investment: { time } }).error?.issues).toEqual([
      expect.objectContaining({ path: ["investment", "time", "max"] }),
    ]);
    const unsourced = { min: 6, max: 12, unit: "months", sources: [] };
    expect(PathwayRecord.safeParse({ ...MINIMAL, investment: { time: unsourced } }).success).toBe(false);
  });
});

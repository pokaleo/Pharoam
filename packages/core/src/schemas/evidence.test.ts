import { z } from "zod";
import { describe, expect, it } from "vitest";
import { EVIDENCE_FILE } from "../__fixtures__/profile-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { EvidenceRecord } from "./evidence.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

const MINIMAL = {
  schema: "evidence/1",
  id: "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d",
  created: "2026-10-24T14:02:11Z",
  kind: "project",
  title: "Shell history search",
};

describe("evidence record", () => {
  it("validates the example", () => {
    const record = EvidenceRecord.parse(top(EVIDENCE_FILE));
    expect(record).toMatchObject({
      kind: "job",
      title: "Backend Engineer",
      start: "2022-09",
      end: "2024-08",
    });
    expect(record["ai-skill-links"]).toEqual([
      {
        skill: "postgres",
        task: "link-skills@1",
        model: "anthropic/claude-sonnet-5-5",
        at: "2026-10-24T14:05:00Z",
        confirmed_by_user: "2026-10-24T14:06:00Z",
      },
    ]);
  });

  it("fills in what a hand-made record leaves out", () => {
    expect(EvidenceRecord.parse(MINIMAL)).toEqual({
      ...MINIMAL,
      ai: null,
      links: [],
      skills: [],
      "ai-skill-links": [],
      attachments: [],
      source: "manual",
    });
  });

  it("carries no level, except a diagnostic's transcript of what it found (Charter R4)", () => {
    // Every kind but assessment, whose record holds each item's level and the result, while the level that counts
    // is held only by its observation.
    const schema = z.toJSONSchema(EvidenceRecord, { io: "input" }) as {
      anyOf?: unknown[];
      oneOf?: unknown[];
    };
    const kinds = schema.oneOf ?? schema.anyOf ?? [];
    const others = kinds.filter((kind) => !JSON.stringify(kind).includes('"const":"assessment"'));
    expect(others).toHaveLength(kinds.length - 1);
    expect(JSON.stringify(others)).not.toMatch(/"level"/);
    expect(EvidenceRecord.parse({ ...MINIMAL, level: 3 })).not.toHaveProperty("level");
    expect(EvidenceRecord.parse({ ...MINIMAL, kind: "assessment", level: 3 })).not.toHaveProperty("level");
  });

  it.each([
    "degree",
    "module",
    "certificate",
    "job",
    "project",
    "repository",
    "publication",
    "reflection",
    "assessment",
    "other",
  ])("accepts the kind %s", (kind) => {
    expect(EvidenceRecord.safeParse({ ...MINIMAL, kind }).success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(EvidenceRecord.safeParse({ ...MINIMAL, kind: "hobby" }).success).toBe(false);
  });

  it("keeps each kind's extra fields", () => {
    expect(
      EvidenceRecord.parse({ ...MINIMAL, kind: "module", course_code: "6CCS3", credits: 15, grade: 72 }),
    ).toMatchObject({ course_code: "6CCS3", credits: 15, grade: "72" });
    expect(
      EvidenceRecord.parse({
        ...MINIMAL,
        kind: "certificate",
        issuer: "AWS",
        credential_id: 12345,
        expires: "2029-01",
      }),
    ).toMatchObject({ issuer: "AWS", credential_id: "12345", expires: "2029-01" });
    expect(
      EvidenceRecord.parse({
        ...MINIMAL,
        kind: "repository",
        url: "https://github.com/a/b",
        role: "Maintainer",
      }),
    ).toMatchObject({ url: "https://github.com/a/b", role: "Maintainer" });
  });

  it("requires a title", () => {
    expect(EvidenceRecord.safeParse({ ...MINIMAL, title: "" }).success).toBe(false);
    expect(EvidenceRecord.safeParse({ ...MINIMAL, title: undefined }).success).toBe(false);
  });

  it("explains an end before the start next to the end (MVP S4.4)", () => {
    const result = EvidenceRecord.safeParse({ ...MINIMAL, start: "2024-09", end: "2023" });
    expect(result.error?.issues).toEqual([expect.objectContaining({ path: ["end"] })]);
    expect(EvidenceRecord.safeParse({ ...MINIMAL, start: "2024-09", end: "2024" }).success).toBe(true);
  });

  it("only takes http and https links (hard rule 10)", () => {
    expect(EvidenceRecord.safeParse({ ...MINIMAL, links: ["javascript:alert(1)"] }).success).toBe(false);
  });

  it("only lists an AI skill link once the person confirmed it (PRD B6)", () => {
    const link = { skill: "python", task: "link-skills@1", model: "m/1", at: "2026-10-24T14:05:00Z" };
    expect(EvidenceRecord.safeParse({ ...MINIMAL, "ai-skill-links": [link] }).success).toBe(false);
  });

  it("names skills by inventory slug (data model §9)", () => {
    expect(EvidenceRecord.safeParse({ ...MINIMAL, skills: ["Python"] }).success).toBe(false);
  });
});

describe("a diagnostic's assessment evidence (data model §7, MVP S19.5)", () => {
  const ASSESSMENT = {
    ...MINIMAL,
    kind: "assessment",
    title: "SQL diagnostic",
    date: "2026-11-15",
    skills: ["sql"],
    diagnostic: { type: "question-bank", skill: "sql", start: 2 },
    steps: [
      { item: "sql-2-a", level: 2, answer: 1, correct: true },
      { item: "sql-3-a", level: 3, answer: 0, correct: false },
    ],
    result: 2,
    rule: "two-right-to-settle@1",
    integrity: `sha256-c1:${"a".repeat(64)}`,
  };

  it("keeps the diagnostic, each step, the result, the rule and its fingerprint", () => {
    expect(EvidenceRecord.parse(ASSESSMENT)).toMatchObject({
      diagnostic: ASSESSMENT.diagnostic,
      steps: ASSESSMENT.steps,
      result: 2,
      rule: "two-right-to-settle@1",
      integrity: ASSESSMENT.integrity,
    });
  });

  it("still reads an assessment written by hand, without a diagnostic", () => {
    expect(EvidenceRecord.safeParse({ ...MINIMAL, kind: "assessment" }).success).toBe(true);
  });

  it("refuses a result off the scale, an unknown kind of diagnostic, or a step without its marking", () => {
    expect(EvidenceRecord.safeParse({ ...ASSESSMENT, result: 5 }).success).toBe(false);
    expect(
      EvidenceRecord.safeParse({ ...ASSESSMENT, diagnostic: { ...ASSESSMENT.diagnostic, type: "quiz" } })
        .success,
    ).toBe(false);
    expect(
      EvidenceRecord.safeParse({ ...ASSESSMENT, steps: [{ item: "sql-2-a", level: 2, answer: 1 }] }).success,
    ).toBe(false);
  });
});

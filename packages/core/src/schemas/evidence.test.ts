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

  it("carries no level (Charter R4)", () => {
    const schema = JSON.stringify(z.toJSONSchema(EvidenceRecord, { io: "input" }));
    expect(schema).not.toMatch(/"level"/);
    expect(EvidenceRecord.parse({ ...MINIMAL, level: 3 })).not.toHaveProperty("level");
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

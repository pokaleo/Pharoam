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

  it("refuses an AI-led step in a question-bank diagnostic", () => {
    expect(EvidenceRecord.safeParse({ ...ASSESSMENT, steps: [BANK_STEP] }).success).toBe(false);
  });
});

const AI = (task: string, at: string) => ({ task, model: "anthropic/claude-sonnet-5-5", at });
const CHOSEN = {
  chosen: AI("write-diagnostic-item@1", "2026-11-23T10:01:00Z"),
  why: "Probes joins, which the evidence names but doesn't show.",
};
const BANK_STEP = {
  source: "bank",
  item: "sql-2-a",
  format: "mcq",
  level: 2,
  prompt: "Which join keeps unmatched rows?",
  options: ["INNER JOIN", "LEFT JOIN"],
  ...CHOSEN,
  answer: 1,
  correct: true,
};
const WRITTEN_STEP = {
  source: "written",
  format: "open",
  level: 3,
  prompt: "Rank each customer's orders by date.",
  rubric: "Uses ROW_NUMBER() or RANK() partitioned by customer and ordered by date.",
  ...CHOSEN,
  answer: "SELECT ROW_NUMBER() OVER (ORDER BY date) FROM orders",
  correct: false,
  reasons: "Orders by date but doesn't partition by customer.",
  marked: AI("mark-diagnostic-answer@1", "2026-11-23T10:03:00Z"),
};
const SECOND_BANK_STEP = { ...BANK_STEP, item: "sql-2-b", prompt: "Which clause filters groups?" };
const SENT = `sha256:${"b".repeat(64)}`;

describe("an AI-led diagnostic's assessment evidence (data model §7, MVP S23.4)", () => {
  const AI_LED = {
    ...MINIMAL,
    kind: "assessment",
    title: "SQL diagnostic",
    date: "2026-11-23",
    skills: ["sql"],
    ai: AI("explain-diagnostic@1", "2026-11-23T10:09:00Z"),
    diagnostic: { type: "ai-led", skill: "sql", start: 2 },
    steps: [BANK_STEP, WRITTEN_STEP, SECOND_BANK_STEP],
    result: 2,
    rule: "two-right-to-settle@1",
    considered: {
      evidence: [{ evidence: "0192f3a1-0000-7000-8000-000000000001", sent: SENT }],
      claims: ["0192f3a1-0000-7000-8000-000000000002"],
      earlier: [],
    },
    explanation: {
      showed: "Joins are solid; window functions weren't.",
      comparison: "Lower than the level 4 you claimed.",
      reasons: ["The reporting work may have used a tool that wrote the queries."],
      next_step: "Practise window functions with a ranking task.",
    },
    integrity: `sha256-c1:${"a".repeat(64)}`,
  };
  // An AI-led record with only these steps, none settling a level, so its result is 0.
  const only = (...steps: readonly unknown[]) => ({ ...AI_LED, steps, result: 0 });
  const parses = (record: unknown) => EvidenceRecord.safeParse(record).success;
  const issues = (record: unknown) => JSON.stringify(EvidenceRecord.safeParse(record).error?.issues ?? []);
  const without = (step: Readonly<Record<string, unknown>>, field: string) =>
    Object.fromEntries(Object.entries(step).filter(([key]) => key !== field));

  it("keeps every item in full, each answer, its marking and reasons, what it considered and the explanation", () => {
    const record = EvidenceRecord.parse(AI_LED);
    expect(record).toMatchObject({
      steps: AI_LED.steps,
      considered: AI_LED.considered,
      explanation: AI_LED.explanation,
      ai: AI_LED.ai,
    });
  });

  it("labels each model's output with its task and model: the item it chose or wrote, the marking and the explanation", () => {
    expect(parses(only(without(WRITTEN_STEP, "chosen")))).toBe(false);
    expect(parses(only(without(BANK_STEP, "chosen")))).toBe(false);
    expect(parses(only(without(BANK_STEP, "why")))).toBe(false);
    expect(parses(only(without(WRITTEN_STEP, "marked")))).toBe(false);
    expect(parses(only(without(WRITTEN_STEP, "reasons")))).toBe(false);
    expect(parses(only(without(WRITTEN_STEP, "rubric")))).toBe(false);
    expect(parses({ ...AI_LED, ai: null })).toBe(false);
    expect(parses({ ...AI_LED, explanation: undefined })).toBe(false);
  });

  it("names a reused bank item by its slug, and never a written one", () => {
    const bankOpen = { ...WRITTEN_STEP, source: "bank", item: "sql-3-open" };
    expect(parses(only(bankOpen))).toBe(true);
    expect(parses(only(without(bankOpen, "item")))).toBe(false);
    expect(parses(only({ ...WRITTEN_STEP, item: "sql-3-open" }))).toBe(false);
  });

  it("asks each bank item once (S23.2)", () => {
    expect(parses(only(BANK_STEP, { ...BANK_STEP, correct: false, answer: 0 }))).toBe(false);
  });

  it("refuses a multiple-choice item the model wrote, or one carrying a model's marking (S23.2)", () => {
    expect(parses(only(without({ ...BANK_STEP, source: "written" }, "item")))).toBe(false);
    expect(parses(only({ ...BANK_STEP, reasons: "Looks right." }))).toBe(false);
    expect(parses(only({ ...BANK_STEP, marked: WRITTEN_STEP.marked }))).toBe(false);
    expect(parses(only({ ...BANK_STEP, rubric: "Any." }))).toBe(false);
  });

  it("refuses a multiple-choice answer that isn't one of the options shown", () => {
    expect(parses(only({ ...BANK_STEP, answer: 2 }))).toBe(false);
  });

  it("refuses a question-bank step, which doesn't hold its item in full, in an AI-led diagnostic", () => {
    expect(parses(only({ item: "sql-2-a", level: 2, answer: 1, correct: true }))).toBe(false);
  });

  it("says what is wrong with a broken AI-led step, rather than reading it as a question bank's", () => {
    expect(issues(only({ ...BANK_STEP, options: ["only one"] }))).toContain('"options"');
    const bankOpen = { ...without(WRITTEN_STEP, "marked"), source: "bank", item: "sql-3-open", answer: 3 };
    expect(
      parses({ ...AI_LED, diagnostic: { ...AI_LED.diagnostic, type: "question-bank" }, steps: [bankOpen] }),
    ).toBe(false);
  });

  it("gives the level the published rule gives from the markings, and nothing else (S23.3)", () => {
    expect(parses({ ...AI_LED, result: 4 })).toBe(false);
    expect(parses({ ...AI_LED, result: undefined })).toBe(false);
    expect(parses({ ...AI_LED, rule: "anything@1" })).toBe(false);
    expect(parses({ ...AI_LED, rule: undefined })).toBe(false);
  });

  it("is dated and fingerprinted, as every diagnostic's record is (PRD E6)", () => {
    expect(parses({ ...AI_LED, date: undefined })).toBe(false);
    expect(parses({ ...AI_LED, integrity: undefined })).toBe(false);
  });

  it("keeps a fingerprint of what it sent about each piece of evidence, as a scan does (S16.10)", () => {
    const considered = { ...AI_LED.considered, evidence: ["0192f3a1-0000-7000-8000-000000000001"] };
    expect(parses({ ...AI_LED, considered })).toBe(false);
  });

  it("takes at most three possible reasons, and reads no score (hard rule 9)", () => {
    const reasons = ["a", "b", "c", "d"];
    expect(parses({ ...AI_LED, explanation: { ...AI_LED.explanation, reasons } })).toBe(false);
    const scored = { ...AI_LED.explanation, confidence: 0.7 };
    expect(EvidenceRecord.parse({ ...AI_LED, explanation: scored })).not.toHaveProperty(
      "explanation.confidence",
    );
  });

  it("keeps an AI-led diagnostic's fields out of a question bank's record", () => {
    const bank = {
      ...AI_LED,
      ai: null,
      diagnostic: { type: "question-bank", skill: "sql", start: 2 },
      steps: [{ item: "sql-2-a", level: 2, answer: 1, correct: true }],
      result: 0,
    };
    expect(parses({ ...bank, explanation: undefined, considered: undefined })).toBe(true);
    expect(parses({ ...bank, considered: undefined })).toBe(false);
    expect(parses({ ...bank, explanation: undefined })).toBe(false);
  });
});

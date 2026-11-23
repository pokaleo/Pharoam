import { describe, expect, it } from "vitest";
import { parseProfileRecord } from "./profile-record.ts";
import { SessionRecord } from "./session.ts";

const AI = {
  task: "suggest-skill-links@1",
  model: "anthropic/claude-sonnet-5-5",
  at: "2026-11-06T10:00:00Z",
};
const SENT = `sha256:${"a".repeat(64)}`;
const EVIDENCE = "0192f3a1-0000-7000-8000-000000000002";

const LINK = {
  id: "0192f3a1-0000-7000-8000-000000000031",
  kind: "skill-link",
  evidence: EVIDENCE,
  read: SENT,
  skill: "python",
  explanation: "Built the payments API in Python.",
  ai: AI,
};

const LEVEL = {
  id: "0192f3a1-0000-7000-8000-000000000032",
  kind: "skill-level",
  skill: "python",
  level: 3,
  explanation: "Led a rewrite in Python.",
  limits: "Judged from two records only.",
  evidence: [EVIDENCE],
  read: [{ evidence: EVIDENCE, sent: SENT }],
  ai: { ...AI, task: "judge-skill-level@1" },
};

const SESSION = {
  schema: "session/1",
  id: "0192f3a1-0000-7000-8000-000000000030",
  created: "2026-11-06T10:00:00Z",
  updated: "2026-11-06T10:01:00Z",
  workflow: "evidence-scan@1",
  scan: "skill-links",
  status: "in-progress",
  suggestions: [LINK],
};

describe("the session record (data model §10, MVP S16.4)", () => {
  it("is a profile record holding a scan's suggestions, each with its ai block", () => {
    const read = parseProfileRecord(SESSION);
    expect(read.ok && read.value).toMatchObject({
      schema: "session/1",
      suggestions: [LINK],
      already: [],
      set_aside: [],
    });
  });

  it("holds suggested levels with the evidence they cite and every record they were sent", () => {
    expect(SessionRecord.safeParse({ ...SESSION, scan: "skill-levels", suggestions: [LEVEL] }).success).toBe(
      true,
    );
  });

  it("records each decision once made, with its time", () => {
    const decided = { ...LINK, decision: "accepted", decided_at: "2026-11-06T10:05:00Z" };
    expect(SessionRecord.safeParse({ ...SESSION, suggestions: [decided] }).success).toBe(true);
    expect(
      SessionRecord.safeParse({ ...SESSION, suggestions: [{ ...LINK, decision: "skipped" }] }).success,
    ).toBe(false);
  });

  it("lists suggestions that would change nothing as already so, and calls that failed as set aside (S16.5, S16.11)", () => {
    const read = SessionRecord.safeParse({
      ...SESSION,
      already: [{ kind: "skill-link", evidence: EVIDENCE, skill: "sql" }],
      set_aside: [{ evidence: EVIDENCE, reason: "unreachable" }],
    });
    expect(read.success).toBe(true);
  });

  it("carries no confidence or score (hard rule 9)", () => {
    const read = SessionRecord.parse({ ...SESSION, suggestions: [{ ...LINK, confidence: 0.9 }] });
    expect(read.suggestions[0]).not.toHaveProperty("confidence");
  });

  it("refuses a level suggestion that cites nothing, or a scan of another kind", () => {
    expect(
      SessionRecord.safeParse({ ...SESSION, scan: "skill-levels", suggestions: [{ ...LEVEL, evidence: [] }] })
        .success,
    ).toBe(false);
    expect(SessionRecord.safeParse({ ...SESSION, scan: "everything" }).success).toBe(false);
  });
});

describe("a diagnostic's session (data model §10, MVP S19.6)", () => {
  const DIAGNOSTIC = {
    schema: "session/1",
    id: "0192f3a1-0000-7000-8000-000000000050",
    created: "2026-11-15T10:00:00Z",
    workflow: "question-bank@1",
    status: "in-progress",
    diagnostic: { skill: "sql", start: 2, rule: "two-right-to-settle@1" },
    steps: [{ item: "sql-2-a", level: 2, answer: 1, correct: true }],
    next: "sql-3-b",
  };

  it("holds the diagnostic, each question asked and answered, and the question posed now", () => {
    expect(SessionRecord.parse(DIAGNOSTIC)).toMatchObject({
      diagnostic: DIAGNOSTIC.diagnostic,
      steps: DIAGNOSTIC.steps,
      next: "sql-3-b",
      suggestions: [],
    });
  });

  it("needs a diagnostic for a diagnostic's workflow, and a scan for a scan's", () => {
    expect(SessionRecord.safeParse({ ...DIAGNOSTIC, diagnostic: undefined }).success).toBe(false);
    expect(SessionRecord.safeParse({ ...SESSION, scan: undefined }).success).toBe(false);
  });
});

describe("an AI-led diagnostic's session (data model §10, MVP S23.5)", () => {
  const AI = (task: string) => ({
    task,
    model: "anthropic/claude-sonnet-5-5",
    at: "2026-11-23T10:01:00Z",
  });
  const CHOSEN = {
    chosen: AI("write-diagnostic-item@1"),
    why: "Probes what the evidence names but doesn't show.",
  };
  const ASKED = {
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
  const POSED = {
    source: "written",
    format: "practical",
    level: 3,
    prompt: "Write a query ranking each customer's orders by date.",
    rubric: "Partitions by customer and orders by date.",
    ...CHOSEN,
  };
  const EXPLANATION = {
    showed: "Joins are solid.",
    comparison: "As you claimed.",
    reasons: [],
    next_step: "Try a window function.",
    ai: AI("explain-diagnostic@1"),
  };
  const AI_LED = {
    schema: "session/1",
    id: "0192f3a1-0000-7000-8000-000000000060",
    created: "2026-11-23T10:00:00Z",
    workflow: "ai-led-diagnostic@1",
    status: "in-progress",
    diagnostic: {
      skill: "sql",
      start: 2,
      rule: "two-right-to-settle@1",
      model: "anthropic/claude-sonnet-5-5",
    },
    considered: {
      evidence: [{ evidence: "0192f3a1-0000-7000-8000-000000000001", sent: `sha256:${"b".repeat(64)}` }],
      claims: [],
      earlier: [],
    },
    steps: [ASKED],
    posed: POSED,
    answer: "SELECT RANK() OVER (PARTITION BY customer ORDER BY date) FROM orders",
  };
  const ENDED = { ...AI_LED, posed: undefined, answer: undefined, explanation: EXPLANATION };
  const parses = (record: unknown) => SessionRecord.safeParse(record).success;

  it("holds every question in full, the question posed now, and an answer waiting to be marked", () => {
    expect(SessionRecord.parse(AI_LED)).toMatchObject({
      diagnostic: AI_LED.diagnostic,
      steps: [ASKED],
      posed: POSED,
      answer: AI_LED.answer,
      considered: AI_LED.considered,
    });
  });

  it("names the model chosen at the start, so a resumed session goes on with it (S23.1, S23.5)", () => {
    expect(parses({ ...AI_LED, diagnostic: { ...AI_LED.diagnostic, model: undefined } })).toBe(false);
  });

  it("holds the explanation, with its task and model, once the session has one", () => {
    expect(SessionRecord.parse(ENDED)).toMatchObject({ explanation: EXPLANATION });
  });

  it("needs its diagnostic, and AI-led steps only", () => {
    expect(parses({ ...AI_LED, diagnostic: undefined })).toBe(false);
    expect(parses({ ...AI_LED, steps: [{ item: "sql-2-a", level: 2, answer: 1, correct: true }] })).toBe(
      false,
    );
  });

  it("keeps a question-bank session to its own steps and fields", () => {
    const bank = {
      schema: "session/1",
      id: "0192f3a1-0000-7000-8000-000000000050",
      created: "2026-11-15T10:00:00Z",
      workflow: "question-bank@1",
      status: "in-progress",
      diagnostic: { skill: "sql", start: 2, rule: "two-right-to-settle@1" },
    };
    expect(parses(bank)).toBe(true);
    expect(parses({ ...bank, steps: [ASKED] })).toBe(false);
    expect(parses({ ...bank, posed: POSED })).toBe(false);
    expect(parses({ ...bank, answer: "LEFT JOIN" })).toBe(false);
    expect(parses({ ...bank, considered: AI_LED.considered })).toBe(false);
    expect(parses({ ...bank, explanation: EXPLANATION })).toBe(false);
    expect(parses({ ...bank, diagnostic: AI_LED.diagnostic })).toBe(false);
  });

  it("refuses a written question without its rubric, or a multiple-choice one the model wrote", () => {
    expect(parses({ ...AI_LED, posed: { ...POSED, rubric: undefined } })).toBe(false);
    const mcq = { ...POSED, format: "mcq", options: ["a", "b"], rubric: undefined };
    expect(parses({ ...AI_LED, posed: mcq })).toBe(false);
  });

  it("names a posed bank item by its slug, never a written one, and never one the session already asked", () => {
    expect(parses({ ...AI_LED, posed: { ...POSED, source: "bank" } })).toBe(false);
    expect(parses({ ...AI_LED, posed: { ...POSED, item: "sql-3-a" } })).toBe(false);
    const again = { ...ASKED, answer: undefined, correct: undefined };
    expect(parses({ ...AI_LED, posed: again, answer: undefined })).toBe(false);
  });

  it("is always in one state it can resume from (S23.5)", () => {
    // An answer waits only for a posed question marked by a model; a multiple-choice answer is marked at once.
    expect(parses({ ...AI_LED, posed: undefined })).toBe(false);
    const mcq = { ...ASKED, item: "sql-2-b", answer: undefined, correct: undefined };
    expect(parses({ ...AI_LED, posed: mcq })).toBe(false);
    expect(parses({ ...AI_LED, answer: undefined, posed: mcq })).toBe(true);
    // A question-bank slug isn't how it poses; the explanation comes once nothing is posed.
    expect(parses({ ...AI_LED, next: "sql-3-b" })).toBe(false);
    expect(parses({ ...AI_LED, explanation: EXPLANATION })).toBe(false);
    expect(parses({ ...AI_LED, answer: undefined, explanation: EXPLANATION })).toBe(false);
    // Its result's ID is chosen once it is explained, and a completed session has both.
    expect(parses({ ...ENDED, assessment: "0192f3a1-0000-7000-8000-000000000070" })).toBe(true);
    expect(parses({ ...AI_LED, assessment: "0192f3a1-0000-7000-8000-000000000070" })).toBe(false);
    expect(parses({ ...ENDED, status: "completed" })).toBe(false);
  });
});

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

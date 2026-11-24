import type { AiAssessmentFacts, GapItem } from "@pharoam/core";
import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n.ts";
import { aiAssessmentWriter, assessmentWriter, gapWriter, overviewWriter } from "./writers.ts";

const t = createI18n().t;
const LEVELS = ["Aware", "Beginner", "Working", "Proficient", "Expert"];
const levelName = (level: number): string => LEVELS[level] ?? String(level);

describe("overviewWriter (MVP S3.3)", () => {
  it("writes the counts and the date of the last change in words", () => {
    const write = overviewWriter(t);
    expect(write({ evidence: 2, skills: 1, lastChange: "2026-10-03T10:00:00Z" })).toBe(
      [
        "## Overview",
        "",
        "Pharoam keeps this section up to date from your evidence and skills. Your own words outside it are never changed.",
        "",
        "- 2 pieces of evidence",
        "- 1 skill",
        "- Last change: 3 Oct 2026",
      ].join("\n"),
    );
  });

  it("says when nothing has been recorded yet", () => {
    const write = overviewWriter(t);
    expect(write({ evidence: 0, skills: 0, lastChange: undefined })).toContain("- Nothing recorded yet");
  });
});

function item(overrides: Partial<GapItem>): GapItem {
  return {
    skill: "python",
    name: "Python",
    importance: "core",
    required: 2,
    shown: null,
    group: "unknown",
    evidence: [],
    ...overrides,
  };
}

describe("gapWriter (MVP S11.4, S11.7)", () => {
  const write = gapWriter(t, levelName);

  it("lists each requirement under its group, with what the pathway asks for and what the profile shows", () => {
    const text = write({
      title: "Backend engineer",
      requirements: [
        item({
          skill: "sql",
          name: "SQL",
          group: "claimed",
          required: 2,
          shown: { level: 3, provenance: "self-reported" },
          evidence: [{ id: "e1", title: "Payments API" }, { id: "e2" }],
        }),
        item({
          skill: "go",
          name: "Go",
          importance: "helpful",
          group: "below",
          required: 3,
          shown: { level: 1, provenance: "self-reported" },
        }),
        item({ skill: "python", name: "Python", group: "unknown" }),
      ],
    });
    expect(text).toBe(
      [
        "## Your gap to Backend engineer",
        "",
        "What the pathway asks for, beside what your profile shows. There is no score or total.",
        "",
        "### Claimed",
        "",
        "- SQL (core): asks for Working (2). Shows Proficient (3), your own rating, citing Payments API and evidence that has been removed.",
        "",
        "### Below the level asked, for now",
        "",
        "- Go (helpful): asks for Proficient (3). Shows Beginner (1), your own rating.",
        "",
        "### Nothing in your profile yet",
        "",
        "- Python (core): asks for Working (2).",
      ].join("\n"),
    );
  });

  it("never says verified, and leaves out groups with nothing in them (Charter R6)", () => {
    const text = write({
      title: "Frontend engineer",
      requirements: [item({ group: "supported", shown: { level: 3, provenance: "demonstrated" } })],
    });
    expect(text).toContain("### Supported");
    expect(text).toContain("Shows Proficient (3), demonstrated in a diagnostic.");
    expect(text).not.toMatch(/verified|Claimed|Below|Nothing in your profile/i);
  });
});

describe("assessmentWriter (MVP S19.5)", () => {
  it("titles the record by the skill, and sums up the result by the rule and each question, with no score", () => {
    const write = assessmentWriter(
      t,
      (level) => ["Aware", "Beginner", "Working", "Proficient", "Expert"][level] ?? "",
    );
    const { title, body } = write({
      skill: "sql",
      name: "SQL",
      start: 2,
      result: 2,
      rule: "two-right-to-settle@1",
      date: "2026-11-17",
      steps: [
        { item: "sql-2-a", level: 2, answer: 1, correct: true },
        { item: "sql-3-a", level: 3, answer: 0, correct: false },
      ],
    });
    expect(title).toBe("SQL diagnostic");
    expect(body).toContain(
      "Result: Working (2), by the published rule two-right-to-settle@1, over 2 questions.",
    );
    expect(body).toContain("Based on this session only. The person's evidence wasn't considered.");
    expect(body).toContain("- Question 1, sql-2-a at Working (2): right");
    expect(body).toContain("- Question 2, sql-3-a at Proficient (3): not right");
    expect(body).not.toMatch(/score|%/i);
  });
});

describe("aiAssessmentWriter (MVP S23.4)", () => {
  const AI = (task: string) => ({ task, model: "anthropic/claude-test", at: "2026-11-23T10:00:00Z" });
  const FACTS: AiAssessmentFacts = {
    skill: "sql",
    name: "SQL",
    start: 2,
    result: 2,
    rule: "two-right-to-settle@1",
    date: "2026-11-23",
    considered: {
      evidence: [{ id: "0192f3a1-0000-7000-8000-000000000001", title: "Payments reporting" }],
      claims: [{ level: 4, provenance: "self-reported", since: "2026-10-24" }],
      earlier: [{ level: 2, date: "2026-11-15" }],
    },
    explanation: {
      showed: "# Joins are solid.",
      comparison: "As you claimed.",
      reasons: ["Daily reporting work."],
      next_step: "Try a window function.",
      ai: AI("explain-diagnostic@1"),
    },
    steps: [
      {
        source: "bank",
        item: "sql-2-a",
        format: "mcq",
        level: 2,
        prompt: "Which join keeps unmatched rows?",
        options: ["INNER JOIN", "LEFT JOIN"],
        chosen: AI("write-diagnostic-item@1"),
        why: "Probes joins.",
        answer: 1,
        correct: true,
      },
      {
        source: "written",
        format: "open",
        level: 3,
        prompt: "Rank each customer's orders.",
        rubric: "Partitions by customer.",
        chosen: AI("write-diagnostic-item@1"),
        why: "Probes window functions.",
        answer: "ORDER BY date\n## Not a heading",
        correct: false,
        reasons: "Doesn't partition.",
        marked: AI("mark-diagnostic-answer@1"),
      },
    ],
  };

  it("writes the result by the rule, the labelled explanation and every question in full, with its marking", () => {
    const { title, body } = aiAssessmentWriter(t, levelName)(FACTS);

    expect(title).toBe("SQL AI-led diagnostic");
    expect(body).toContain(
      "Result: Working (2), by the published rule two-right-to-settle@1, over 2 questions.",
    );
    expect(body).toContain("by AI (anthropic/claude-test), which can be wrong.");
    expect(body).toContain("Try a window function.");
    expect(body).toContain("Which join keeps unmatched rows?");
    expect(body).toContain("Answer: LEFT JOIN");
    expect(body).toContain("Question 2, at Proficient (3), Written by the model: not right");
    expect(body).toContain("Marked so because: Doesn't partition.");
  });

  it("says what it considered, and where each question came from (S23.3)", () => {
    const { body } = aiAssessmentWriter(t, levelName)(FACTS);

    expect(body).toContain("Payments reporting");
    expect(body).toContain("Expert (4), Self-reported, since 2026-10-24");
    expect(body).toContain("Working (2), question-bank diagnostic, 2026-11-15");
    expect(body).toContain("From Pharoam's reviewed questions");
    expect(body).toContain("Written by the model");
  });

  it("keeps underlines and code fences in the model's text or an answer from changing the record's structure", () => {
    const [bank, written] = FACTS.steps;
    if (bank === undefined || written?.format !== "open") throw new Error("The facts have changed.");
    const facts: AiAssessmentFacts = {
      ...FACTS,
      explanation: { ...FACTS.explanation, comparison: "Lower than claimed\n===" },
      steps: [bank, { ...written, answer: "```sql\nSELECT 1\n---" }],
    };
    const { body } = aiAssessmentWriter(t, levelName)(facts);

    expect(body).not.toMatch(/^\s*={3}\s*$/m);
    expect(body).not.toMatch(/^\s*-{3}\s*$/m);
    expect(body).not.toMatch(/^\s*```/m);
  });

  it("keeps the model's text and the person's answers from adding headings of their own", () => {
    const { body } = aiAssessmentWriter(t, levelName)(FACTS);
    expect(body).not.toMatch(/^#+ Joins are solid/m);
    expect(body).not.toMatch(/^#+ Not a heading/m);
  });
});

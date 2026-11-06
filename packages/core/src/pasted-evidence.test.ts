import { describe, expect, it } from "vitest";
import { ORIGINAL_INPUT, isSameEvidence, pastedEvidence } from "./pasted-evidence.ts";
import { printRecordFile } from "./record-file.ts";

const ID = "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d";
const NOW = "2026-11-06T10:01:00Z";
const AI = { task: "normalise-evidence@1", model: "anthropic/claude-sonnet-5-5", at: "2026-11-06T10:00:00Z" };
const DISCLAIMER = "AI-generated from your pasted text and confirmed by you. AI can make mistakes.";
const FORM = {
  kind: "job",
  title: "Backend Engineer",
  organisation: "Example Co",
  start: "2022-09",
  end: "2024-08",
  description: "Built the payments API.",
} as const;

describe("evidence made from pasted text (MVP S15.5)", () => {
  it("is labelled as AI-made, confirmed by the person, from pasted text, with the original kept", () => {
    const file = pastedEvidence(FORM, ID, NOW, { ai: AI, disclaimer: DISCLAIMER, keepOriginal: true });
    expect(file.ok && printRecordFile(file.value)).toBe(
      [
        "---",
        "schema: evidence/1",
        `id: ${ID}`,
        `created: ${NOW}`,
        `updated: ${NOW}`,
        "ai:",
        "  task: normalise-evidence@1",
        "  model: anthropic/claude-sonnet-5-5",
        "  at: 2026-11-06T10:00:00Z",
        `  confirmed_by_user: ${NOW}`,
        "kind: job",
        "title: Backend Engineer",
        "organisation: Example Co",
        "start: 2022-09",
        "end: 2024-08",
        "source: paste",
        "attachments:",
        `  - ${ORIGINAL_INPUT}`,
        `original_input: ${ORIGINAL_INPUT}`,
        "---",
        `> ⚠️ ${DISCLAIMER}`,
        "",
        "Built the payments API.",
        "",
      ].join("\n"),
    );
  });

  it("keeps no original when the person chose to discard it", () => {
    const file = pastedEvidence(FORM, ID, NOW, { ai: AI, disclaimer: DISCLAIMER, keepOriginal: false });
    expect(file.ok && file.value.top).not.toHaveProperty("original_input");
    expect(file.ok && file.value.top).not.toHaveProperty("attachments");
  });

  it("carries the disclaimer even with no description", () => {
    const file = pastedEvidence({ kind: "other", title: "BSc Computer Science" }, ID, NOW, {
      ai: AI,
      disclaimer: DISCLAIMER,
      keepOriginal: false,
    });
    expect(file.ok && file.value.body).toBe(`> ⚠️ ${DISCLAIMER}\n`);
  });

  it("reports the fields to fix, as the form does", () => {
    const file = pastedEvidence({ ...FORM, start: "Sept 2022" }, ID, NOW, {
      ai: AI,
      disclaimer: DISCLAIMER,
      keepOriginal: true,
    });
    expect(file.ok ? null : file.error.kind).toBe("invalid");
  });
});

describe("telling when pasted evidence looks like evidence already there (MVP S15.4)", () => {
  it("matches the same kind, title and organisation, ignoring case and spacing", () => {
    expect(
      isSameEvidence(FORM, { kind: "job", title: "  backend engineer ", organisation: "EXAMPLE CO" }),
    ).toBe(true);
  });

  it("doesn't match another kind, title or organisation", () => {
    expect(isSameEvidence(FORM, { ...FORM, kind: "project" })).toBe(false);
    expect(isSameEvidence(FORM, { ...FORM, title: "Frontend Engineer" })).toBe(false);
    expect(isSameEvidence(FORM, { ...FORM, organisation: "Other Co" })).toBe(false);
    expect(isSameEvidence(FORM, { kind: "job", title: "Backend Engineer" })).toBe(false);
  });

  it("matches two records with no organisation", () => {
    const course = { kind: "module", title: "Databases" } as const;
    expect(isSameEvidence(course, { kind: "module", title: "databases" })).toBe(true);
  });
});

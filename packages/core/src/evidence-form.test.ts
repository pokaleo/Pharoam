import { describe, expect, it } from "vitest";
import {
  EVIDENCE_FORM_KINDS,
  evidenceDraft,
  evidenceFormFields,
  type EvidenceForm,
  type EvidenceFormKind,
} from "./evidence-form.ts";
import { parseRecordFile, printRecordFile } from "./record-file.ts";
import { parseProfileRecord } from "./schemas/profile-record.ts";

const ID = "01a186fe-adc0-7707-8707-070707070707";
const NOW = "2026-10-29T09:30:00Z";

const COMMON = ["title", "organisation", "date", "start", "end", "links", "skills", "description"];

// A valid value for every field any kind's form shows.
const FILLED = {
  title: "Payments API",
  organisation: "Example Co",
  date: "2024-09-30",
  start: "2022-09",
  end: "2024-08",
  links: ["https://example.com/payments-api"],
  skills: ["python", "postgres"],
  description: "Built the refunds service.\n",
  role: "Backend engineer",
  course_code: "COMP0001",
  credits: 15,
  grade: "First",
  issuer: "Example Cloud",
  credential_id: "ABC-123",
  expires: "2027-01",
} as const;

function draft(form: EvidenceForm): ReturnType<typeof evidenceDraft> {
  return evidenceDraft(form, ID, NOW);
}

describe("the evidence form's fields (MVP S4.1)", () => {
  it("offers the five kinds of the MVP", () => {
    expect(EVIDENCE_FORM_KINDS).toEqual(["project", "job", "module", "certificate", "other"]);
  });

  it.each([
    ["project", ["role"]],
    ["job", ["role"]],
    ["module", ["course_code", "credits", "grade"]],
    ["certificate", ["issuer", "credential_id", "expires"]],
    ["other", ["role"]],
  ] as const)("shows the common fields plus a %s's own", (kind, extra) => {
    expect(evidenceFormFields(kind)).toEqual([...COMMON, ...extra]);
  });

  it.each(EVIDENCE_FORM_KINDS)("stores every field a %s's form shows", (kind: EvidenceFormKind) => {
    const result = draft({ kind, ...FILLED });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const stored = new Set([
      ...Object.keys(result.value.top),
      ...(result.value.body === "" ? [] : ["description"]),
    ]);
    for (const field of evidenceFormFields(kind)) expect(stored).toContain(field);
  });
});

describe("drafting an evidence record from the form", () => {
  it("is the record as it will be stored, made by hand (MVP S4.3)", () => {
    const result = draft({
      kind: "job",
      title: "Backend Engineer",
      organisation: "Example Co",
      start: "2022-09",
    });
    expect(result.ok && result.value.top).toEqual({
      schema: "evidence/1",
      id: ID,
      created: NOW,
      updated: NOW,
      ai: null,
      kind: "job",
      title: "Backend Engineer",
      organisation: "Example Co",
      start: "2022-09",
      source: "manual",
    });
    expect(result.ok && result.value.body).toBe("");
  });

  it("puts the description in the body, ending with a line break", () => {
    const result = draft({ kind: "project", title: "Payments API", description: "Built **refunds**." });
    expect(result.ok && result.value.body).toBe("Built **refunds**.\n");
  });

  it("leaves out empty answers and fields of other kinds", () => {
    const result = draft({
      kind: "job",
      title: "Backend Engineer",
      organisation: "",
      links: ["", "https://example.com/"],
      skills: [],
      issuer: "Example Cloud",
      description: "",
    });
    expect(result.ok && Object.keys(result.value.top)).toEqual([
      "schema",
      "id",
      "created",
      "updated",
      "ai",
      "kind",
      "title",
      "links",
      "source",
    ]);
  });

  it("lists tagged skills by slug (MVP S4.6)", () => {
    const result = draft({ kind: "project", title: "Payments API", skills: ["python", "postgres"] });
    expect(result.ok && printRecordFile(result.value)).toContain("skills:\n  - python\n  - postgres\n");
  });

  it("stores links, and HTML typed into text as text (MVP S4.5, hard rule 10)", () => {
    const html = '<script>alert("x")</script> & <b>bold</b>';
    const result = draft({
      kind: "other",
      title: html,
      links: ["https://example.com/a?b=1&c=2"],
      description: html,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const reread = parseRecordFile(printRecordFile(result.value));
    expect(reread.ok && reread.value.top.title).toBe(html);
    expect(reread.ok && reread.value.top.links).toEqual(["https://example.com/a?b=1&c=2"]);
    expect(reread.ok && reread.value.body).toBe(`${html}\n`);
    expect(reread.ok && parseProfileRecord(reread.value.top).ok).toBe(true);
  });

  it.each([
    ["a missing title", { title: "" }, ["title"]],
    ["a blank title", { title: "   " }, ["title"]],
    ["a date that doesn't exist", { start: "2024-02-30" }, ["start"]],
    ["a month that doesn't exist", { date: "2024-13" }, ["date"]],
    ["an end before the start", { start: "2024-09", end: "2023" }, ["end"]],
    ["a link that isn't a web page", { links: ["javascript:alert(1)"] }, ["links", 0]],
    ["a skill that isn't a slug", { skills: ["Python 3"] }, ["skills", 0]],
  ] as const)("says which field to fix for %s (MVP S4.4)", (_case, change, path) => {
    const result = draft({ kind: "project", title: "Payments API", ...change });
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    const issues =
      !result.ok && result.error.error.kind === "invalid-fields" ? result.error.error.issues : [];
    expect(issues.map((issue) => issue.path)).toContainEqual(path);
  });
});

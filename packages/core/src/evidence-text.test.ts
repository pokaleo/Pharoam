import { describe, expect, it } from "vitest";
import { evidenceText, sentFingerprint } from "./evidence-text.ts";
import { EvidenceRecord } from "./schemas/evidence.ts";

const record = (top: Readonly<Record<string, unknown>>) =>
  EvidenceRecord.parse({
    schema: "evidence/1",
    id: "0192f3a1-0000-7000-8000-000000000002",
    created: "2026-10-02T09:00:00Z",
    ...top,
  });

describe("evidence as a scan sends it (MVP S16.1, S16.2)", () => {
  it("gives the fields the person wrote, then what they did, and nothing else", () => {
    const job = record({
      kind: "job",
      title: "Backend Engineer",
      organisation: "Example Co",
      start: "2022-09",
      end: "2024-08",
      role: "Tech lead",
      links: ["https://example.com/payments"],
      skills: ["python"],
      source: "paste",
    });
    expect(evidenceText(job, "Built the payments API.\n")).toBe(
      [
        "Kind: job",
        "Title: Backend Engineer",
        "Organisation: Example Co",
        "When: 2022-09 to 2024-08",
        "Role: Tech lead",
        "Links: https://example.com/payments",
        "",
        "Built the payments API.",
      ].join("\n"),
    );
  });

  it("gives a module's and a certificate's own fields", () => {
    expect(evidenceText(record({ kind: "module", title: "Databases", credits: 15, grade: "68" }), "")).toBe(
      "Kind: module\nTitle: Databases\nCredits: 15\nGrade: 68",
    );
    expect(
      evidenceText(
        record({ kind: "certificate", title: "Data Analytics", issuer: "Coursera", date: "2024-03" }),
        "",
      ),
    ).toBe("Kind: certificate\nTitle: Data Analytics\nWhen: 2024-03\nIssuer: Coursera");
  });

  it("gives a repository's own address", () => {
    expect(
      evidenceText(record({ kind: "repository", title: "pharoam", url: "https://example.com/pharoam" }), ""),
    ).toBe("Kind: repository\nTitle: pharoam\nURL: https://example.com/pharoam");
  });

  it("leaves out the AI disclaimer at the top of a body, which isn't the person's", () => {
    const text = evidenceText(
      record({ kind: "project", title: "Shell search" }),
      "> ⚠️ AI-generated from your pasted text and confirmed by you. AI can make mistakes.\n\nA small tool.\n",
    );
    expect(text).toBe("Kind: project\nTitle: Shell search\n\nA small tool.");
  });
});

describe("a fingerprint of what was sent (MVP S16.10)", () => {
  it("is the same for the same text, and changes with any change", () => {
    const sent = sentFingerprint("Kind: job\nTitle: Backend Engineer");
    expect(sent).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(sentFingerprint("Kind: job\nTitle: Backend Engineer")).toBe(sent);
    expect(sentFingerprint("Kind: job\nTitle: Backend engineer")).not.toBe(sent);
  });
});

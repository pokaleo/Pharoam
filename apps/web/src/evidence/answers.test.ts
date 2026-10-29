import { createRecordFile } from "@pharoam/core";
import { describe, expect, it } from "vitest";
import { answersOf, evidenceFormFrom, fieldErrorsOf, NO_ANSWERS } from "./answers.ts";

describe("evidenceFormFrom", () => {
  it("turns the answers into the core's evidence form, links one per line", () => {
    const read = evidenceFormFrom({
      ...NO_ANSWERS,
      kind: "module",
      text: { title: " Databases ", credits: "15" },
      links: "https://a.example\n https://b.example ",
      skills: ["sql"],
      description: "Joins.",
    });
    expect("form" in read && read.form).toMatchObject({
      kind: "module",
      title: "Databases",
      credits: 15,
      links: ["https://a.example", "https://b.example"],
      skills: ["sql"],
      description: "Joins.",
    });
  });

  it("asks for credits as a number", () => {
    expect(evidenceFormFrom({ ...NO_ANSWERS, kind: "module", text: { credits: "fifteen" } })).toEqual({
      errors: { credits: "credits" },
    });
    expect(evidenceFormFrom({ ...NO_ANSWERS, kind: "module", text: { credits: "-1" } })).toEqual({
      errors: { credits: "credits" },
    });
  });

  it("leaves credits out when none are given", () => {
    const read = evidenceFormFrom({ ...NO_ANSWERS, text: { title: "X" } });
    expect("form" in read && "credits" in read.form).toBe(false);
  });
});

describe("answersOf (MVP S5.1)", () => {
  it("fills the form from stored evidence, with the body as what the person did", () => {
    const file = createRecordFile(
      {
        schema: "evidence/1",
        id: "0192f3a1-0000-7000-8000-000000000002",
        created: "2026-10-02T09:00:00Z",
        kind: "certificate",
        title: "Cloud practitioner",
        issuer: "Example",
        links: ["https://example.com/cert"],
      },
      "Passed first time.\n",
    );
    expect(answersOf(file)).toEqual({
      kind: "certificate",
      text: { title: "Cloud practitioner", issuer: "Example" },
      links: "https://example.com/cert",
      skills: [],
      description: "Passed first time.\n",
    });
  });

  it("doesn't fill the form for kinds it doesn't edit, such as a degree", () => {
    const file = createRecordFile(
      {
        schema: "evidence/1",
        id: "0192f3a1-0000-7000-8000-000000000002",
        created: "2026-10-02T09:00:00Z",
        kind: "degree",
        title: "BSc",
      },
      "",
    );
    expect(answersOf(file)).toBeUndefined();
  });
});

describe("fieldErrorsOf (MVP S4.4)", () => {
  const invalid = (issues: { path: (string | number)[]; code: string }[]) => ({
    kind: "invalid" as const,
    error: { kind: "invalid-fields" as const, issues: issues.map((issue) => ({ ...issue, message: "" })) },
  });

  it("names the problem with each field, the first one only", () => {
    expect(
      fieldErrorsOf(
        invalid([
          { path: ["title"], code: "invalid_type" },
          { path: ["start"], code: "invalid_format" },
          { path: ["end"], code: "custom" },
          { path: ["links", 0], code: "invalid_format" },
          { path: ["links", 1], code: "invalid_format" },
          { path: ["credits"], code: "too_small" },
          { path: ["grade"], code: "invalid_format" },
        ]),
      ),
    ).toEqual({
      title: "title",
      start: "date",
      end: "endBeforeStart",
      links: "links",
      credits: "credits",
      grade: "text",
    });
  });

  it("ignores problems with fields the form doesn't have", () => {
    expect(fieldErrorsOf(invalid([{ path: ["schema"], code: "invalid_value" }]))).toEqual({});
  });
});

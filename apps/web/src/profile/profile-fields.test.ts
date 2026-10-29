import { describe, expect, it } from "vitest";
import { isStage, profileFieldsOf, withHiddenFocus } from "./profile-fields.ts";

function form(entries: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

describe("profileFieldsOf", () => {
  it("reads the answers, trimmed, leaving out those not given", () => {
    expect(
      profileFieldsOf(
        form([
          ["headline", "  Backend developer "],
          ["stage", "working"],
          ["field", "Fintech"],
          ["region", "GB"],
          ["pathways", "ml-engineer"],
          ["pathways", "backend-engineer"],
        ]),
      ),
    ).toEqual({
      headline: "Backend developer",
      situation: { stage: "working", field: "Fintech" },
      region: "GB",
      focus: { pathways: ["ml-engineer", "backend-engineer"] },
    });
    expect(
      profileFieldsOf(
        form([
          ["headline", " "],
          ["stage", ""],
          ["region", ""],
        ]),
      ),
    ).toEqual({});
  });

  it("keeps the field of work only with a stage, where pharoam.md stores it", () => {
    expect(profileFieldsOf(form([["field", "Fintech"]]))).toEqual({});
    expect(profileFieldsOf(form([["stage", "studying"]]))).toEqual({ situation: { stage: "studying" } });
  });
});

describe("withHiddenFocus", () => {
  const shown = ["backend-engineer", "ml-engineer"];

  it("keeps the focus the form can't show: pathways from other packs, and skills (hard rule 3)", () => {
    const current = { pathways: ["backend-engineer", "data-engineer"], skills: ["python"] };
    expect(withHiddenFocus({ focus: { pathways: ["ml-engineer"] } }, current, shown)).toEqual({
      focus: { pathways: ["ml-engineer", "data-engineer"], skills: ["python"] },
    });
  });

  it("removes the focus when nothing is left in it", () => {
    expect(
      withHiddenFocus({ headline: "Hi" }, { pathways: ["backend-engineer"], skills: [] }, shown),
    ).toEqual({
      headline: "Hi",
    });
  });
});

describe("isStage", () => {
  it("knows the four stages and nothing else", () => {
    expect(["studying", "working", "between-roles", "changing-career"].every(isStage)).toBe(true);
    expect(isStage("retired")).toBe(false);
  });
});

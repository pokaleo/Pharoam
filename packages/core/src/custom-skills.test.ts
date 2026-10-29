import { describe, expect, it } from "vitest";
import { customSkillSlug, isCustomSkill } from "./custom-skills.ts";
import { SLUG_PATTERN } from "./ids.ts";

describe("a custom skill's slug (MVP S8.1)", () => {
  it("starts with custom- and is made from the name", () => {
    expect(customSkillSlug("KDB+/q")).toBe("custom-kdb-q");
    expect(customSkillSlug("  Café Läte Art ")).toBe("custom-cafe-late-art");
  });

  it("fits the slug pattern, however long the name", () => {
    const slug = customSkillSlug("Very long skill name ".repeat(10));
    expect(slug).toMatch(SLUG_PATTERN);
    // Room is left for a short ID, in case the slug is taken.
    expect(slug?.length).toBeLessThanOrEqual(64 - 9);
  });

  it("is nothing for a name without letters or digits the slug can hold", () => {
    expect(customSkillSlug("日本語")).toBeUndefined();
    expect(customSkillSlug(" -- ")).toBeUndefined();
  });
});

describe("telling a custom skill apart (MVP S8.2)", () => {
  it("is a slug starting with custom-", () => {
    expect(isCustomSkill("custom-kdb-q")).toBe(true);
    expect(isCustomSkill("python")).toBe(false);
    expect(isCustomSkill("customer-service")).toBe(false);
  });
});

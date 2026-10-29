import { describe, expect, it } from "vitest";
import { loadContentPack } from "./content.ts";

describe("loadContentPack (AD5, AD16)", () => {
  it("loads the built-in pack, checked against its schema", async () => {
    const pack = await loadContentPack();
    expect(pack.format).toBe("pharoam-pack/1");
    expect(pack.pathways.map((pathway) => pathway.slug)).toEqual([
      "applied-ai-engineer",
      "backend-engineer",
      "frontend-engineer",
      "ml-engineer",
    ]);
    expect(Object.values(pack.levels.levels).map((level) => level.name)).toEqual([
      "Aware",
      "Beginner",
      "Working",
      "Proficient",
      "Expert",
    ]);
    expect(pack.skills.length).toBeGreaterThan(200);
  });
});

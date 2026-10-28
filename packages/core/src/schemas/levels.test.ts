import { describe, expect, it } from "vitest";
import { LevelScale } from "./levels.ts";

const LEVELS = {
  0: { name: "Aware", description: "Knows what it is." },
  1: { name: "Beginner", description: "Has used it with help." },
  2: { name: "Working", description: "Uses it alone for everyday work." },
  3: { name: "Proficient", description: "Uses it well on complex work." },
  4: { name: "Expert", description: "Shapes how others use it." },
};

describe("the shared level scale", () => {
  it("names and describes levels 0 to 4 (Charter P14, MVP S6.3)", () => {
    expect(LevelScale.parse({ schema: "levels/1", levels: LEVELS }).levels["2"]).toEqual(LEVELS[2]);
  });

  it("describes every level", () => {
    const four = Object.fromEntries(Object.entries(LEVELS).filter(([level]) => level !== "4"));
    expect(LevelScale.safeParse({ schema: "levels/1", levels: four }).success).toBe(false);
    expect(
      LevelScale.safeParse({ schema: "levels/1", levels: { ...LEVELS, 2: { name: "Working" } } }).success,
    ).toBe(false);
  });
});

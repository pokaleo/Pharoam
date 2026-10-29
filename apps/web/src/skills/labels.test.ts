import { describe, expect, it } from "vitest";
import { loadContentPack } from "../content.ts";
import { createI18n } from "../i18n.ts";
import { dayName, levelName, sourceName } from "./labels.ts";

const { t } = createI18n();

describe("levelName", () => {
  it("names a level from the shared scale, or shows the number when there is no such level", async () => {
    const pack = await loadContentPack();
    expect(levelName(pack, 2)).toBe("Working");
    expect(levelName(pack, 9)).toBe("9");
    expect(levelName(undefined, 3)).toBe("3");
  });
});

describe("sourceName", () => {
  it("uses the design system's fixed words for the four sources", () => {
    expect(sourceName(t, "self-reported")).toBe("Self-reported");
    expect(sourceName(t, "ai-judged")).toBe("AI judgement");
    expect(sourceName(t, "demonstrated")).toBe("Demonstrated");
    expect(sourceName(t, "ai-correlated")).toBe("AI correlated");
  });
});

describe("dayName", () => {
  it("writes a calendar date in words, as that day wherever the person is", () => {
    expect(dayName(t, "2026-10-03")).toBe("3 Oct 2026");
  });

  it("writes a time as the day it fell", () => {
    expect(dayName(t, "2026-10-03T12:00:00Z")).toBe("3 Oct 2026");
  });
});

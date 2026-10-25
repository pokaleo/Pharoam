import { describe, expect, it } from "vitest";
import { isUnlocked, parseMinutes, unlockFileContent } from "./unlock.ts";

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const MINUTE = 60_000;

describe("unlocking enforcement edits for a while", () => {
  it("is locked when there is no unlock file", () => {
    expect(isUnlocked(undefined, NOW)).toBe(false);
  });

  it("is unlocked until the expiry written in the file", () => {
    const content = unlockFileContent(30, NOW);
    expect(isUnlocked(content, NOW + 29 * MINUTE)).toBe(true);
    expect(isUnlocked(content, NOW + 30 * MINUTE)).toBe(false);
  });

  it.each(["", "soon", "-5", "NaN"])("treats unreadable content as locked: %j", (content) => {
    expect(isUnlocked(content, NOW)).toBe(false);
  });
});

describe("the minutes argument", () => {
  it.each([
    ["30", 30],
    ["0", 0],
    ["240", 240],
  ])("accepts %s", (arg, minutes) => {
    expect(parseMinutes(arg)).toEqual({ ok: true, minutes });
  });

  it.each([undefined, "", "abc", "1.5", "-1", "241"])("rejects %j with a reason", (arg) => {
    const result = parseMinutes(arg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/minutes/i);
  });
});

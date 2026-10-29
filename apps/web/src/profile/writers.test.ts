import type { GapItem } from "@pharoam/core";
import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n.ts";
import { gapWriter, overviewWriter } from "./writers.ts";

const t = createI18n().t;
const LEVELS = ["Aware", "Beginner", "Working", "Proficient", "Expert"];
const levelName = (level: number): string => LEVELS[level] ?? String(level);

describe("overviewWriter (MVP S3.3)", () => {
  it("writes the counts and the date of the last change in words", () => {
    const write = overviewWriter(t);
    expect(write({ evidence: 2, skills: 1, lastChange: "2026-10-03T10:00:00Z" })).toBe(
      [
        "## Overview",
        "",
        "Pharoam keeps this section up to date from your evidence and skills. Your own words outside it are never changed.",
        "",
        "- 2 pieces of evidence",
        "- 1 skill",
        "- Last change: 3 Oct 2026",
      ].join("\n"),
    );
  });

  it("says when nothing has been recorded yet", () => {
    const write = overviewWriter(t);
    expect(write({ evidence: 0, skills: 0, lastChange: undefined })).toContain("- Nothing recorded yet");
  });
});

function item(overrides: Partial<GapItem>): GapItem {
  return {
    skill: "python",
    name: "Python",
    importance: "core",
    required: 2,
    shown: null,
    group: "unknown",
    evidence: [],
    ...overrides,
  };
}

describe("gapWriter (MVP S11.4, S11.7)", () => {
  const write = gapWriter(t, levelName);

  it("lists each requirement under its group, with what the pathway asks for and what the profile shows", () => {
    const text = write({
      title: "Backend engineer",
      requirements: [
        item({
          skill: "sql",
          name: "SQL",
          group: "claimed",
          required: 2,
          shown: { level: 3, provenance: "self-reported" },
          evidence: [{ id: "e1", title: "Payments API" }, { id: "e2" }],
        }),
        item({
          skill: "go",
          name: "Go",
          importance: "helpful",
          group: "below",
          required: 3,
          shown: { level: 1, provenance: "self-reported" },
        }),
        item({ skill: "python", name: "Python", group: "unknown" }),
      ],
    });
    expect(text).toBe(
      [
        "## Your gap to Backend engineer",
        "",
        "What the pathway asks for, beside what your profile shows. There is no score or total.",
        "",
        "### Claimed",
        "",
        "- SQL (core): asks for Working (2). Shows Proficient (3), your own rating, citing Payments API and evidence that has been removed.",
        "",
        "### Below the level asked, for now",
        "",
        "- Go (helpful): asks for Proficient (3). Shows Beginner (1), your own rating.",
        "",
        "### Nothing in your profile yet",
        "",
        "- Python (core): asks for Working (2).",
      ].join("\n"),
    );
  });

  it("never says verified, and leaves out groups with nothing in them (Charter R6)", () => {
    const text = write({
      title: "Frontend engineer",
      requirements: [item({ group: "supported", shown: { level: 3, provenance: "demonstrated" } })],
    });
    expect(text).toContain("### Supported");
    expect(text).toContain("Shows Proficient (3), demonstrated in a diagnostic.");
    expect(text).not.toMatch(/verified|Claimed|Below|Nothing in your profile/i);
  });
});

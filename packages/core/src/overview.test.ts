import { describe, expect, it } from "vitest";
import { overviewFacts, withOverview } from "./overview.ts";
import { parseProfileRecord, type ProfileRecord } from "./schemas/profile-record.ts";

const START = "<!-- pharoam:overview -->";
const END = "<!-- /pharoam:overview -->";

function record(top: Readonly<Record<string, unknown>>): ProfileRecord {
  const result = parseProfileRecord(top);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

const PROFILE = record({
  schema: "pharoam/1",
  id: "0192f3a1-0000-7000-8000-000000000001",
  created: "2026-12-01T00:00:00Z",
});

function evidence(id: string, created: string, updated?: string): ProfileRecord {
  const top = { schema: "evidence/1", id, created, kind: "project", title: "Payments API" };
  return record(updated === undefined ? top : { ...top, updated });
}

function skill(
  id: string,
  created: string,
  entries: readonly Readonly<Record<string, unknown>>[],
): ProfileRecord {
  return record({ schema: "skill-record/1", id, created, skill: "python", entries });
}

describe("the overview's facts (MVP S3.3)", () => {
  it("counts evidence and skill records, and nothing else", () => {
    const records = [
      PROFILE,
      evidence("0192f3a1-0000-7000-8000-000000000002", "2026-10-01T10:00:00Z"),
      evidence("0192f3a1-0000-7000-8000-000000000003", "2026-10-02T10:00:00Z"),
      skill("0192f3a1-0000-7000-8000-000000000004", "2026-10-03T10:00:00Z", []),
    ];
    expect(overviewFacts(records)).toEqual({ evidence: 2, skills: 1, lastChange: "2026-10-03T10:00:00Z" });
  });

  it("dates the last change by the latest edit, observation or review, comparing times across zones", () => {
    const records = [
      evidence("0192f3a1-0000-7000-8000-000000000002", "2026-10-01T10:00:00Z", "2026-10-29T01:00:00Z"),
      skill("0192f3a1-0000-7000-8000-000000000004", "2026-10-03T10:00:00Z", [
        {
          id: "0192f3a1-0000-7000-8000-000000000005",
          level: 2,
          provenance: "self-reported",
          // 01:30 on 29 October in UTC, so later than the evidence's edit despite the earlier date.
          observed_at: "2026-10-28T23:30:00-02:00",
        },
        {
          id: "0192f3a1-0000-7000-8000-000000000006",
          target: "0192f3a1-0000-7000-8000-000000000005",
          decision: "retract",
          reviewed_at: "2026-10-29T01:15:00Z",
        },
      ]),
    ];
    expect(overviewFacts(records).lastChange).toBe("2026-10-28T23:30:00-02:00");
  });

  it("has no last change without evidence or skills", () => {
    expect(overviewFacts([PROFILE])).toEqual({ evidence: 0, skills: 0, lastChange: undefined });
  });
});

describe("the overview section (MVP S3.2)", () => {
  const section = (overview: string): string => `${START}\n${overview}${END}\n`;

  it("is added after the person's own text, separated by a blank line", () => {
    expect(withOverview("About me.\n", "New.\n")).toEqual({
      ok: true,
      value: `About me.\n\n${section("New.\n")}`,
    });
    expect(withOverview("About me.", "New.\n")).toEqual({
      ok: true,
      value: `About me.\n\n${section("New.\n")}`,
    });
    expect(withOverview("About me.\n\n", "New.\n")).toEqual({
      ok: true,
      value: `About me.\n\n${section("New.\n")}`,
    });
  });

  it("is the whole body when there is no text of the person's own", () => {
    expect(withOverview("", "New.\n")).toEqual({ ok: true, value: section("New.\n") });
  });

  it("ends the overview with a line break, so the end marker has its own line", () => {
    expect(withOverview("", "New.")).toEqual({ ok: true, value: section("New.\n") });
  });

  it("replaces only what is between the markers, keeping every other byte", () => {
    const before = "About me.\r\n\r\n  Indented, with trailing space \r\n";
    const after = "\r\nMore of my own words, after the overview.";
    const body = `${before}${START}\r\nOld overview.\r\n${END}${after}`;
    expect(withOverview(body, "New.\n")).toEqual({
      ok: true,
      value: `${before}${START}\nNew.\n${END}${after}`,
    });
  });

  it.each([
    ["only a start marker", `About me.\n${START}\nOld.\n`],
    ["only an end marker", `About me.\nOld.\n${END}\n`],
    ["the end before the start", `${END}\nOld.\n${START}\n`],
    ["two sections", `${START}\nOne.\n${END}\n${START}\nTwo.\n${END}\n`],
  ])("is left alone, and reported, with %s", (_case, body) => {
    expect(withOverview(body, "New.\n")).toEqual({ ok: false, error: { kind: "overview-markers" } });
  });
});

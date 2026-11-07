import { describe, expect, it } from "vitest";
import { NoteRecord } from "./note.ts";
import { parseProfileRecord } from "./profile-record.ts";

const NOTE = {
  schema: "note/1",
  id: "0192f3a1-0000-7000-8000-000000000040",
  created: "2026-11-07T10:05:00Z",
  ai: {
    task: "explain-gap@1",
    model: "anthropic/claude-sonnet-5-5",
    at: "2026-11-07T10:00:00Z",
    confirmed_by_user: "2026-11-07T10:05:00Z",
  },
  pathway: "pharoam-core@0.1.0:ml-engineer",
  gap_updated: "2026-11-07T09:58:00Z",
};

describe("the note record (data model §10, MVP S18.4)", () => {
  it("is a profile record: an accepted explanation of a gap, with its pathway pinned and the gap's time", () => {
    const read = parseProfileRecord(NOTE);
    expect(read.ok && read.value).toEqual(NOTE);
  });

  it("needs its ai block, confirmed by the person, since only an accepted explanation is kept (hard rule 6)", () => {
    expect(NoteRecord.safeParse({ ...NOTE, ai: null }).success).toBe(false);
    const unconfirmed = { ...NOTE.ai, confirmed_by_user: undefined };
    expect(NoteRecord.safeParse({ ...NOTE, ai: unconfirmed }).success).toBe(false);
  });

  it("comes from a gap's explanation, in any version of the task", () => {
    expect(NoteRecord.safeParse({ ...NOTE, ai: { ...NOTE.ai, task: "explain-gap@2" } }).success).toBe(true);
    expect(NoteRecord.safeParse({ ...NOTE, ai: { ...NOTE.ai, task: "judge-skill-level@1" } }).success).toBe(
      false,
    );
  });

  it("pins the pathway to a pack version, and needs the time of the gap it explained", () => {
    expect(NoteRecord.safeParse({ ...NOTE, pathway: "ml-engineer" }).success).toBe(false);
    expect(NoteRecord.safeParse({ ...NOTE, gap_updated: undefined }).success).toBe(false);
  });

  it("carries no score (Charter R1)", () => {
    expect(NoteRecord.parse({ ...NOTE, score: 62 })).not.toHaveProperty("score");
  });
});

import { z } from "zod";
import { describe, expect, it } from "vitest";
import { EVIDENCE_FILE, GAP_FILE, PHAROAM_FILE, SKILL_RECORD_FILE } from "../__fixtures__/profile-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { PROFILE_RECORD_SCHEMAS, parseProfileRecord } from "./profile-record.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

describe("profile records", () => {
  it.each([
    ["pharoam/1", PHAROAM_FILE],
    ["evidence/1", EVIDENCE_FILE],
    ["skill-record/1", SKILL_RECORD_FILE],
    ["gap/1", GAP_FILE],
  ])("reads a %s file", (schema, text) => {
    const result = parseProfileRecord(top(text));
    expect(result.ok && result.value.schema).toBe(schema);
  });

  it.each([undefined, 7, "", "evidence", "evidence/one", "skill/1", "aspiration/1"])(
    "reports a schema of %j as unknown",
    (schema) => {
      expect(parseProfileRecord({ ...top(EVIDENCE_FILE), schema })).toEqual({
        ok: false,
        error: { kind: "unknown-schema", schema },
      });
    },
  );

  it("reports a version this Pharoam can't read", () => {
    expect(parseProfileRecord({ ...top(EVIDENCE_FILE), schema: "evidence/2" })).toEqual({
      ok: false,
      error: { kind: "unsupported-version", type: "evidence", version: 2 },
    });
  });

  it("lists each invalid field with where it is", () => {
    const result = parseProfileRecord({ ...top(EVIDENCE_FILE), title: "", skills: ["Python"] });
    expect(result.ok ? [] : result.error).toEqual({
      kind: "invalid-fields",
      issues: [
        expect.objectContaining({ path: ["title"], code: "invalid_format" }),
        expect.objectContaining({ path: ["skills", 0], code: "invalid_format" }),
      ],
    });
  });

  it("has no confidence, score, percentage or ranking anywhere (hard rule 9)", () => {
    for (const schema of Object.values(PROFILE_RECORD_SCHEMAS)) {
      expect(JSON.stringify(z.toJSONSchema(schema, { io: "input" }))).not.toMatch(
        /"[^"]*(confidence|score|percent|rank|total)[^"]*":/i,
      );
    }
  });
});

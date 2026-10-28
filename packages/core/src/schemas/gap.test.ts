import { describe, expect, it } from "vitest";
import { GAP_FILE } from "../__fixtures__/profile-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { GapRecord } from "./gap.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

describe("gap record", () => {
  it("validates the example", () => {
    const record = GapRecord.parse(top(GAP_FILE));
    expect(record.pathway).toBe("pharoam-core@0.1.0:ml-engineer");
    expect(record.requirements.map((r) => r.group)).toEqual(["claimed", "below", "unknown"]);
    expect(record.requirements[2]).toEqual({
      skill: "mlops",
      required: 2,
      shown: null,
      group: "unknown",
      evidence: [],
    });
  });

  it("pins the pathway to a pack version", () => {
    const record = top(GAP_FILE);
    for (const pathway of ["ml-engineer", "pharoam-core:ml-engineer", "pharoam-core@:ml-engineer"]) {
      expect(GapRecord.safeParse({ ...record, pathway }).success).toBe(false);
    }
  });

  it("only knows the four groups (PRD F3)", () => {
    const record = top(GAP_FILE);
    const requirement = { skill: "python", required: 3, shown: null, group: "verified" };
    expect(GapRecord.safeParse({ ...record, requirements: [requirement] }).success).toBe(false);
  });
});

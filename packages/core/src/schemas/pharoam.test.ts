import { z } from "zod";
import { describe, expect, it } from "vitest";
import { PHAROAM_FILE } from "../__fixtures__/profile-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { PharoamRecord } from "./pharoam.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

// Every property name in a JSON Schema, at any depth.
function propertyNames(schema: unknown): string[] {
  if (typeof schema !== "object" || schema === null) return [];
  const entries: [string, unknown][] = Object.entries(schema);
  return entries.flatMap(([key, value]) => {
    if (key !== "properties" || typeof value !== "object" || value === null) return propertyNames(value);
    const properties: [string, unknown][] = Object.entries(value);
    return properties.flatMap(([name, property]) => [name, ...propertyNames(property)]);
  });
}

const MINIMAL = {
  schema: "pharoam/1",
  id: "0192f3a1-0000-7000-8000-000000000001",
  created: "2026-10-24T14:02:11Z",
};

describe("pharoam record", () => {
  it("validates the example", () => {
    expect(PharoamRecord.parse(top(PHAROAM_FILE))).toMatchObject({
      headline: "Backend engineer moving into machine learning",
      situation: { stage: "changing-career", field: "Software engineering" },
      region: "GB",
      focus: { pathways: ["ml-engineer"], skills: ["python", "pytorch"] },
    });
  });

  it("needs only the common fields, as written when a profile is created (MVP S1.1)", () => {
    expect(PharoamRecord.parse(MINIMAL)).toEqual({ ...MINIMAL, ai: null });
  });

  it("has no field for a name, photo, contact details or exact location (hard rule 8)", () => {
    const names = propertyNames(z.toJSONSchema(PharoamRecord, { io: "input" }));
    expect(names).toContain("headline");
    for (const name of names) {
      expect(name).not.toMatch(
        /name|photo|picture|email|phone|contact|address|city|postcode|location|birth/i,
      );
    }
  });

  it("leaves a hand-written name out of the record it reads", () => {
    expect(PharoamRecord.parse({ ...MINIMAL, name: "Ada" })).not.toHaveProperty("name");
  });

  it.each(["United Kingdom", "gb", "GBR"])(
    "takes the region as a two-letter country code, not %j",
    (region) => {
      expect(PharoamRecord.safeParse({ ...MINIMAL, region }).success).toBe(false);
    },
  );

  it("only knows the four situations", () => {
    expect(PharoamRecord.safeParse({ ...MINIMAL, situation: { stage: "retired" } }).success).toBe(false);
  });
});

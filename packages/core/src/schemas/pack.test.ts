import { describe, expect, it } from "vitest";
import { PACK_FILE } from "../__fixtures__/content-records.ts";
import { parseRecordFile } from "../record-file.ts";
import { PackManifest } from "./pack.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

describe("pack manifest", () => {
  it("validates the example", () => {
    expect(PackManifest.parse(top(PACK_FILE))).toMatchObject({
      name: "pharoam-core",
      version: "0.1.0",
      min_app_version: "0.1.0",
      contents: { skills: ["python", "pytorch", "docker", "sql"], pathways: ["ml-engineer"] },
      translations: ["en"],
    });
  });

  it.each(["1", "1.0", "v1.0.0", "1.0.0.0"])("takes versions as semantic versions, not %j", (version) => {
    expect(PackManifest.safeParse({ ...top(PACK_FILE), version }).success).toBe(false);
  });

  it("lists at least one licence, so the app can show it (ADR-0005)", () => {
    expect(PackManifest.safeParse({ ...top(PACK_FILE), licences: [] }).success).toBe(false);
  });

  it("names each licence by its SPDX identifier", () => {
    const licences = [{ source: "Pharoam content", licence: "CC BY-SA 4.0" }];
    expect(PackManifest.safeParse({ ...top(PACK_FILE), licences }).success).toBe(false);
  });
});

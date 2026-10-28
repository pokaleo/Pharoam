import { describe, expect, it } from "vitest";
import { publishedJsonSchemas } from "./published.ts";

describe("published JSON Schemas", () => {
  const schemas = publishedJsonSchemas();

  it("publishes one schema per record type and format version", () => {
    expect(Object.keys(schemas)).toEqual([
      "pharoam-1.schema.json",
      "evidence-1.schema.json",
      "skill-record-1.schema.json",
      "gap-1.schema.json",
      "skill-1.schema.json",
      "pathway-1.schema.json",
      "pack-1.schema.json",
    ]);
  });

  it("describes each as a JSON Schema 2020-12 document with a title", () => {
    expect(schemas["evidence-1.schema.json"]).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Pharoam evidence record, format 1",
    });
  });

  it("describes the file as written, before Pharoam fills in defaults", () => {
    const evidence = JSON.stringify(schemas["evidence-1.schema.json"]);
    expect(evidence).toContain('"const":"evidence/1"');
    // `ai` may be left out of a hand-made file, so it isn't required.
    expect(schemas["pharoam-1.schema.json"]).toMatchObject({ required: ["schema", "id", "created"] });
  });

  it("allows fields Pharoam doesn't know, as Pharoam does (MVP S12.4)", () => {
    expect(JSON.stringify(schemas)).not.toContain('"additionalProperties":false');
  });
});

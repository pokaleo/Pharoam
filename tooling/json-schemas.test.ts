import { readdirSync } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import { publishedJsonSchemas } from "../packages/core/src/index.ts";

// The JSON Schemas in schemas/ are generated from the Zod schemas and must match them (ADR-0007, ENGINEERING §9).
// After changing a schema, regenerate them with `pnpm test -u`.
const schemasDir = path.join(import.meta.dirname, "..", "schemas");
const schemas = publishedJsonSchemas();

describe("published JSON Schemas", () => {
  it.each(Object.keys(schemas))("schemas/%s matches the Zod schema", async (file) => {
    const target = path.join(schemasDir, file);
    const options = await resolveConfig(target);
    const text = await format(JSON.stringify(schemas[file]), { ...options, filepath: target });
    await expect(text).toMatchFileSnapshot(target);
  });

  it("has no schema file that no record type produces", () => {
    const files = readdirSync(schemasDir).filter((file) => file.endsWith(".schema.json"));
    expect(files.toSorted()).toEqual(Object.keys(schemas).toSorted());
  });
});

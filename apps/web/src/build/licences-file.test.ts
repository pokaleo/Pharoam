import { describe, expect, it } from "vitest";
import { LICENCES_FILE } from "./licences-file.ts";

describe("LICENCES_FILE", () => {
  it("is a plain-text file at the top of the built app, so any browser shows it", () => {
    expect(LICENCES_FILE).toMatch(/^[\w-]+\.txt$/);
  });
});

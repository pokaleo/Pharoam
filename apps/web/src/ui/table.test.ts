import { describe, expect, it } from "vitest";
import { TABLE } from "./table.ts";

describe("TABLE", () => {
  it("draws tables with rules and alignment only: grey sentence-case headers, soft row rules, no bands", () => {
    expect(TABLE.head).toContain("text-ink-2");
    expect(TABLE.head).not.toContain("uppercase");
    expect(TABLE.cell).toContain("border-line-soft");
    expect(TABLE.cell).toContain("h-(--row)");
    expect(TABLE.rowHead).toContain("font-semibold");
  });
});

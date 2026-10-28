import { describe, expect, it } from "vitest";
import { err, ok } from "./result.ts";

describe("Result", () => {
  it("wraps a value", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("wraps an expected failure", () => {
    expect(err({ kind: "conflict" })).toEqual({ ok: false, error: { kind: "conflict" } });
  });
});

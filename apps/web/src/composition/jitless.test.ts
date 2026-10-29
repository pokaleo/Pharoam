import { describe, expect, it } from "vitest";
import { globalConfig } from "zod/v4/core";

describe("jitless (security §4)", () => {
  it("turns off Zod's compiled validators, which the content security policy refuses", async () => {
    await import("./jitless.ts");
    expect(globalConfig.jitless).toBe(true);
  });
});

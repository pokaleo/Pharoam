import { describe, expect, it } from "vitest";
import { modelName } from "./provider.ts";

describe("modelName (data model §5)", () => {
  it("records the provider with the model, so the ai block says where the answer came from", () => {
    expect(modelName({ id: "anthropic" }, "claude-sonnet-5-5")).toBe("anthropic/claude-sonnet-5-5");
  });
});

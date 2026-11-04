import { describe, expect, it } from "vitest";
import { modelName, providerErrorFrom } from "./provider.ts";

describe("modelName (data model §5)", () => {
  it("records the provider with the model, so the ai block says where the answer came from", () => {
    expect(modelName({ id: "anthropic" }, "claude-sonnet-5-5")).toBe("anthropic/claude-sonnet-5-5");
  });
});

describe("providerErrorFrom (MVP S13.3)", () => {
  it.each([
    [{ status: 401, message: "invalid x-api-key" }, { kind: "unauthorised" }],
    [{ status: 403, message: "forbidden" }, { kind: "unauthorised" }],
    [{ status: 429, message: "slow down" }, { kind: "rate-limited" }],
    [
      { status: 404, message: "model: nope" },
      { kind: "failed", message: "404: model: nope" },
    ],
    [
      { status: 529, message: "Overloaded" },
      { kind: "failed", message: "529: Overloaded" },
    ],
  ])("turns an error with HTTP status %o into a kind the app can explain", (error, expected) => {
    expect(providerErrorFrom(error)).toEqual(expected);
  });

  it.each([
    ["the browser's network error", new TypeError("Failed to fetch")],
    [
      "an SDK connection error",
      Object.assign(new Error("Connection error."), { name: "APIConnectionError" }),
    ],
    [
      "an SDK error wrapping the network error",
      Object.assign(new Error("Connection error."), { cause: new TypeError("Failed to fetch") }),
    ],
  ])("says the provider can't be reached for %s", (_, error) => {
    expect(providerErrorFrom(error)).toEqual({ kind: "unreachable" });
  });

  it("keeps the message of anything else, so it can be shown as it came", () => {
    expect(providerErrorFrom(new Error("Something odd"))).toEqual({
      kind: "failed",
      message: "Something odd",
    });
    expect(providerErrorFrom("not an error")).toEqual({ kind: "failed", message: "not an error" });
  });
});

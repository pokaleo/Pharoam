import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n.ts";
import { providerProblem, setAsideReason, taskProblem } from "./problems.ts";

const { t } = createI18n();

describe("why an AI call didn't work, in plain words (MVP S13.3, S15.6)", () => {
  it("names the provider for each of its problems", () => {
    expect(providerProblem(t, { kind: "unauthorised" }, "Anthropic")).toBe(
      "Anthropic refused the key. Check it and try again.",
    );
    for (const error of [
      { kind: "rate-limited" },
      { kind: "unreachable" },
      { kind: "refused", reason: "Too long." },
      { kind: "failed", message: "500: Oops" },
    ] as const) {
      expect(providerProblem(t, error, "Anthropic")).toContain("Anthropic");
    }
  });

  it("says when the answer wasn't in the shape asked for", () => {
    expect(taskProblem(t, { kind: "invalid-answer", issues: ["records: Required"] }, "Anthropic")).toBe(
      "The model answered, but not in the shape Pharoam needs. Try a model that can call tools.",
    );
    expect(taskProblem(t, { kind: "provider", error: { kind: "unauthorised" } }, "OpenAI")).toContain(
      "OpenAI",
    );
  });

  it("says why a scan set a record or skill aside, in plain words, whatever the kind", () => {
    expect(setAsideReason(t, "unreachable")).toBe("the provider couldn't be reached");
    expect(setAsideReason(t, "invalid-answer")).toBe("the answer wasn't in the shape asked for");
    expect(setAsideReason(t, "a-kind-from-a-later-version")).toBe("something went wrong");
  });
});

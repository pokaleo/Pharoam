import { describe, expect, it } from "vitest";
import {
  Client,
  convertPromptToAnthropic,
  convertPromptToOpenAI,
  convertToDottedOrderFormat,
  getCurrentRunTree,
  isRunTree,
  isTraceableFunction,
  RunTree,
} from "./langsmith-stand-in.ts";

describe("the langsmith stand-in (hard rule 7, spike S1)", () => {
  it("tells LangChain there is never a trace, so it runs without tracing", () => {
    expect(getCurrentRunTree()).toBeUndefined();
    expect(isRunTree()).toBe(false);
    expect(isTraceableFunction()).toBe(false);
  });

  it("holds the context LangChain keeps for each step, as the real package does with tracing off", () => {
    const run = new RunTree({ name: "<runnable_lambda>", tracingEnabled: false });

    expect(run.name).toBe("<runnable_lambda>");
    expect(run.extra).toEqual({});
  });

  it("refuses anything only tracing or the prompt hub would use, so such a path fails loudly", () => {
    expect(() => new Client()).toThrow(/tracing/i);
    expect(() => convertToDottedOrderFormat()).toThrow(/tracing/i);
    expect(() => convertPromptToAnthropic()).toThrow(/hub/i);
    expect(() => convertPromptToOpenAI()).toThrow(/hub/i);
  });
});

/**
 * Stands in for the `langsmith` package in the built app, so no tracing code ships.
 *
 * @remarks `@langchain/core` imports `langsmith` for tracing, which Pharoam never uses (hard rule 7, ADR-0012). The
 * Vite config points every `langsmith` import here (spike S1): about 230 KB less to download, and no tracing code
 * that a setting could switch on. LangChain asks only whether there is a current trace and whether a function is
 * traceable, and the answer is always no; with tracing off it still keeps each step's context in a `RunTree`,
 * which here only holds it. Anything only tracing or the prompt hub would use throws, so such a path fails loudly.
 * @packageDocumentation
 */

const NO_TRACING = "Pharoam has no LangSmith tracing (hard rule 7).";
const NO_HUB =
  "Pharoam doesn't load prompts from the LangSmith hub; every prompt is a registered task (ADR-0004).";

/**
 * Says there is no current trace.
 *
 * @returns Always `undefined`, whatever LangChain passes.
 */
export function getCurrentRunTree(): RunTree | undefined {
  return undefined;
}

/**
 * Says a value is never a trace.
 *
 * @returns Always `false`, whatever LangChain passes.
 */
export function isRunTree(): false {
  return false;
}

/**
 * Says a function is never traceable.
 *
 * @returns Always `false`, whatever LangChain passes.
 */
export function isTraceableFunction(): false {
  return false;
}

/**
 * Refuses, since only tracing orders trace runs.
 *
 * @throws Error always: there is no tracing.
 */
export function convertToDottedOrderFormat(): never {
  throw new Error(NO_TRACING);
}

/**
 * Refuses, since prompts never come from the hub.
 *
 * @throws Error always: every prompt is a registered task.
 */
export function convertPromptToAnthropic(): never {
  throw new Error(NO_HUB);
}

/**
 * Refuses, since prompts never come from the hub.
 *
 * @throws Error always: every prompt is a registered task.
 */
export function convertPromptToOpenAI(): never {
  throw new Error(NO_HUB);
}

/** The context LangChain keeps for one step of a chain; with no tracing, nothing is ever sent anywhere. */
export class RunTree {
  /** The step's name, as LangChain gives it. */
  readonly name: string | undefined;
  /** What LangChain stores for the step, such as the configuration its child steps inherit. */
  extra: Record<PropertyKey, unknown> = {};

  /**
   * Holds a step's context.
   *
   * @param config - What LangChain describes the step with; only its name is kept.
   */
  constructor(config?: { readonly name?: string; readonly [setting: string]: unknown }) {
    this.name = config?.name;
  }
}

/** A tracing client, which can't be made. */
export class Client {
  /** Always `false`: there is no tracing to send to. */
  readonly tracing = false;

  /**
   * Refuses to make a tracing client.
   *
   * @throws Error always: there is no tracing.
   */
  constructor() {
    throw new Error(NO_TRACING);
  }
}

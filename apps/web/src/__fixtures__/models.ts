// A model for tests that answers the AI tasks, and a way to set it up as a person would.
import { err, ok, type ModelRequest, type ProviderError } from "@pharoam/core";
import { fakeProvider } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { LoadProvider } from "../ai/providers.ts";

/** How the test model answers. */
export interface ScanAnswers {
  /** The skills it suggests for a record, by a word in the record's title; none for any other record. */
  readonly links?: Readonly<Record<string, readonly string[]>>;
  /** The level it judges any skill at. */
  readonly level?: number;
  /** What it answers when asked to read pasted text. */
  readonly pasted?: unknown;
  /** What it answers when asked to explain a gap. */
  readonly gap?: unknown;
  /** A failure for records whose title has this word. */
  readonly failFor?: { readonly word: string; readonly error: ProviderError };
  /** Throws, as a broken adapter would, for records whose title has this word. */
  readonly throwFor?: string;
  /** Holds back the answer for records whose title has this word until the test lets it go. */
  readonly holdFor?: { readonly word: string; readonly until: Promise<void> };
  /** Fails this many calls first, as an unreachable provider would, then answers. */
  readonly failFirst?: number;
  /** How it takes an AI-led diagnostic: writing open questions rather than choosing bank items, and marking. */
  readonly diagnostic?: { readonly written?: boolean; readonly right?: boolean };
}

/** The open question the test model writes in an AI-led diagnostic, and its rubric. */
export const WRITTEN = { prompt: "Explain what a LEFT JOIN keeps.", rubric: "Keeps rows with no match." };

/** What the test model says an AI-led diagnostic showed. */
export const DIAGNOSTIC_EXPLANATION = {
  showed: "Joins are solid; window functions weren't asked.",
  comparison: "As you claimed.",
  reasons: ["The reporting work used joins every day."],
  next_step: "Try ranking rows with a window function.",
};

// The test model's answer for one of the AI-led diagnostic's tasks, or nothing for any other task.
function diagnosticAnswer(request: ModelRequest, answers: ScanAnswers): unknown {
  const how = answers.diagnostic ?? {};
  if (request.output.name === "explain-diagnostic") return DIAGNOSTIC_EXPLANATION;
  if (request.output.name === "mark-diagnostic-answer")
    return {
      level: Number(/Mark at level (\d)/.exec(request.system)?.[1]),
      correct: how.right ?? true,
      reasons: how.right === false ? "Says nothing of unmatched rows." : "Says unmatched rows are kept.",
    };
  if (request.output.name !== "write-diagnostic-item") return undefined;
  const offered = /^- (\S+) \(mcq\)/m.exec(request.system)?.[1];
  // A new question each time, as the task refuses one the session already asked.
  const asked = request.prompt.split('<data kind="question">').length - 1;
  const prompt = asked === 0 ? WRITTEN.prompt : `${WRITTEN.prompt} (${String(asked + 1)})`;
  return how.written === true || offered === undefined
    ? { source: "written", format: "open", ...WRITTEN, prompt, why: "The evidence names joins but shows none." }
    : { source: "bank", bank: offered, why: "Probes joins, which the evidence names." };
}

/** What the test model says a gap might mean, unless a test says otherwise. */
export const GAP_ANSWER = {
  meaning: "Your SQL is a start; most of the pathway isn't in your profile yet.",
  starts: [{ skill: "python", why: "It is core, and nothing in your profile shows it yet." }],
};

/**
 * A provider loader whose model answers the scan's tasks as the test decides, keeping every request sent.
 *
 * @param answers - How it answers.
 * @returns The loader, and the requests sent so far.
 */
export function scanModel(answers: ScanAnswers = {}): { load: LoadProvider; sent: ModelRequest[] } {
  const sent: ModelRequest[] = [];
  let failures = answers.failFirst ?? 0;
  const answer = (request: ModelRequest) => {
    if (failures > 0) {
      failures--;
      return err({ kind: "unreachable" as const });
    }
    if (answers.failFor !== undefined && request.prompt.includes(answers.failFor.word))
      return err(answers.failFor.error);
    if (request.output.name === "check-model") return ok({ ready: true });
    if (request.output.name === "normalise-evidence") return ok(answers.pasted ?? { records: [] });
    if (request.output.name === "explain-gap") return ok(answers.gap ?? GAP_ANSWER);
    const diagnostic = diagnosticAnswer(request, answers);
    if (diagnostic !== undefined) return ok(diagnostic);
    if (request.output.name === "judge-skill-level")
      return ok({
        level: answers.level ?? 3,
        explanation: "Built and ran a Python API.",
        limits: "Judged from one record only.",
        evidence: ["E1"],
      });
    const word = Object.keys(answers.links ?? {}).find((one) => request.prompt.includes(one));
    const skills = word === undefined ? [] : (answers.links?.[word] ?? []);
    return ok({ links: skills.map((skill) => ({ skill, explanation: `The record shows ${skill}.` })) });
  };
  const load: LoadProvider = () => {
    const provider = fakeProvider(answer);
    return Promise.resolve({
      ...provider,
      id: "anthropic",
      listModels: () => Promise.resolve(ok([])),
      complete: async (request, options) => {
        sent.push(request);
        if (answers.throwFor !== undefined && request.prompt.includes(answers.throwFor))
          throw new Error("The adapter broke.");
        const held = answers.holdFor;
        if (held !== undefined && request.prompt.includes(held.word)) await held.until;
        return provider.complete(request, options);
      },
    });
  };
  return { load, sent };
}

/**
 * Sets up the test model in Settings, as a person would: Anthropic, a key, and a model ID typed in.
 *
 * @param user - The test's user.
 */
export async function setUpModel(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole("link", { name: "Settings" }));
  await user.click(await screen.findByRole("radio", { name: "Anthropic" }));
  await user.type(screen.getByLabelText("API key"), "sk-ant-test");
  await user.type(screen.getByLabelText("Or type a model ID"), "claude-test");
  await user.click(screen.getByRole("button", { name: "Use this model" }));
  await screen.findByText("Using claude-test from Anthropic.");
}

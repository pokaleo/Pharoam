// A model for tests that answers the evidence scan's tasks, and a way to set it up as a person would.
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
  /** A failure for records whose title has this word. */
  readonly failFor?: { readonly word: string; readonly error: ProviderError };
  /** Throws, as a broken adapter would, for records whose title has this word. */
  readonly throwFor?: string;
  /** Holds back the answer for records whose title has this word until the test lets it go. */
  readonly holdFor?: { readonly word: string; readonly until: Promise<void> };
}

/**
 * A provider loader whose model answers the scan's tasks as the test decides, keeping every request sent.
 *
 * @param answers - How it answers.
 * @returns The loader, and the requests sent so far.
 */
export function scanModel(answers: ScanAnswers = {}): { load: LoadProvider; sent: ModelRequest[] } {
  const sent: ModelRequest[] = [];
  const answer = (request: ModelRequest) => {
    if (answers.failFor !== undefined && request.prompt.includes(answers.failFor.word))
      return err(answers.failFor.error);
    if (request.output.name === "check-model") return ok({ ready: true });
    if (request.output.name === "normalise-evidence") return ok(answers.pasted ?? { records: [] });
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

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { err, ok } from "../result.ts";
import { fakeProvider } from "../testing/fake-provider.ts";
import { runTask } from "./run-task.ts";
import { defineTask, prepareCall } from "./task.ts";

const tag = defineTask({
  name: "tag-text",
  version: 2,
  input: z.object({ text: z.string() }),
  output: z.object({ tags: z.array(z.string()).max(3) }),
  instructions: () => "Suggest up to three tags.",
  data: ({ text }) => [{ kind: "pasted-text", text }],
});

const now = (): Date => new Date("2026-11-04T10:00:00.000Z");

describe("runTask (ADR-0004, PRD D6, MVP S17.1)", () => {
  it("returns the checked answer with its ai block, and a call record of exactly what was sent", async () => {
    const provider = fakeProvider(() => ok({ tags: ["python", "apis"] }));

    const answer = await runTask(provider, tag, { text: "I built an API in Python." }, { model: "m-1", now });

    expect(answer).toEqual({
      ok: true,
      value: {
        output: { tags: ["python", "apis"] },
        ai: { task: "tag-text@2", model: "fake/m-1", at: "2026-11-04T10:00:00.000Z" },
        call: {
          task: "tag-text@2",
          model: "fake/m-1",
          at: "2026-11-04T10:00:00.000Z",
          sent: prepareCall(tag, { text: "I built an API in Python." }).request,
          outcome: "answered",
        },
      },
    });
    expect(provider.requests).toEqual([
      { request: prepareCall(tag, { text: "I built an API in Python." }).request, model: "m-1" },
    ]);
  });

  it("rejects an answer that doesn't match the task's output schema, and records that it did", async () => {
    const provider = fakeProvider(() => ok({ tags: ["a", "b", "c", "d"], level: 4 }));

    const answer = await runTask(provider, tag, { text: "x" }, { model: "m-1", now });

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.reason.kind).toBe("invalid-answer");
    expect(answer.error.call.outcome).toBe("rejected");
    expect("output" in answer.error).toBe(false);
  });

  it("reports a provider failure as it came, with a call record of what was sent", async () => {
    const provider = fakeProvider(() => err({ kind: "unauthorised" }));

    const answer = await runTask(provider, tag, { text: "x" }, { model: "m-1", now });

    expect(answer).toMatchObject({
      ok: false,
      error: {
        reason: { kind: "provider", error: { kind: "unauthorised" } },
        call: { task: "tag-text@2", outcome: "failed", sent: prepareCall(tag, { text: "x" }).request },
      },
    });
  });
});

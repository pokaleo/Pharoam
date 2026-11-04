import { describe, expect, it } from "vitest";
import { ok } from "../../result.ts";
import { fakeProvider } from "../../testing/fake-provider.ts";
import { runTask } from "../run-task.ts";
import { prepareCall } from "../task.ts";
import { checkModel } from "./check-model.ts";

const now = (): Date => new Date("2026-11-04T10:00:00.000Z");

describe("checkModel (MVP S13.3)", () => {
  it("sends none of the person's material, so a test call can't leak anything", () => {
    const call = prepareCall(checkModel, {});

    expect(call.parts).toEqual([]);
    expect(call.request.prompt).not.toBe("");
    expect(call.request.prompt).not.toMatch(/<data/);
  });

  it("passes when the model answers in the requested shape", async () => {
    const answer = await runTask(
      fakeProvider(() => ok({ ready: true })),
      checkModel,
      {},
      { model: "m", now },
    );

    expect(answer.ok).toBe(true);
  });

  it("fails when the model can't answer in the requested shape", async () => {
    const answer = await runTask(
      fakeProvider(() => ok("Sure! I'm ready.")),
      checkModel,
      {},
      { model: "m", now },
    );

    expect(answer).toMatchObject({ ok: false, error: { reason: { kind: "invalid-answer" } } });
  });
});

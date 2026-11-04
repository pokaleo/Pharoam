import { describe, expect, it } from "vitest";
import { ok } from "../result.ts";
import { fakeProvider } from "./fake-provider.ts";

const request = { system: "s", prompt: "p", output: { name: "t", schema: {} } };

describe("fakeProvider", () => {
  it("answers with what the test decides and keeps every request, so tests check what was sent", async () => {
    const provider = fakeProvider(({ prompt }) => ok({ echoed: prompt }));

    expect(await provider.complete(request, { model: "m" })).toEqual(ok({ echoed: "p" }));
    expect(provider.requests).toEqual([{ request, model: "m" }]);
    expect(provider.id).toBe("fake");
  });

  it("lists the models it was given", async () => {
    const provider = fakeProvider(() => ok({}), [{ id: "m-1", name: "Model one" }]);

    expect(await provider.listModels()).toEqual(ok([{ id: "m-1", name: "Model one" }]));
  });
});

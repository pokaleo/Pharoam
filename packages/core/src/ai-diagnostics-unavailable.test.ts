import { describe, expect, it, vi } from "vitest";
import { LEVELS_FILE, PACK_FILE, PATHWAY_FILE, SKILL_FILE } from "./__fixtures__/content-records.ts";
import { compileContentPack } from "./pack.ts";
import { ok } from "./result.ts";
import { fakeProvider } from "./testing/fake-provider.ts";
import { createMemoryConnector } from "./testing/memory-connector.ts";

// The graph's code is fetched only when a diagnostic runs; here, as when offline or after a redeploy, it can't be.
vi.mock("./ai/ai-led-diagnostic.ts", () => {
  throw new Error("Failed to fetch dynamically imported module.");
});

const skill = (slug: string, name: string): string =>
  `---\nschema: skill/1\nslug: ${slug}\nname: ${name}\ndomain: Test\norigin: { source: Pharoam, licence: MIT }\n---\n`;

describe("an AI-led diagnostic whose code can't be loaded (MVP S23)", () => {
  it("says so as an expected failure, writing nothing", async () => {
    const { createCoreService } = await import("./core-service.ts");
    const compiled = compileContentPack([
      { path: "content/pack.md", text: PACK_FILE },
      { path: "data/levels.md", text: LEVELS_FILE },
      { path: "data/skills/python.md", text: SKILL_FILE },
      { path: "data/skills/pytorch.md", text: skill("pytorch", "PyTorch") },
      { path: "data/skills/docker.md", text: skill("docker", "Docker") },
      { path: "data/skills/sql.md", text: skill("sql", "SQL") },
      { path: "data/skills/django.md", text: skill("django", "Django") },
      { path: "data/skills/pandas.md", text: skill("pandas", "pandas") },
      { path: "content/pathways/ml-engineer.md", text: PATHWAY_FILE },
    ]);
    if (!compiled.ok) throw new Error("No pack.");
    const storage = createMemoryConnector();
    const service = createCoreService({
      storage: storage.connector,
      ids: { now: () => Date.UTC(2026, 10, 23, 10, 0, 0), fillRandom: (bytes: Uint8Array) => bytes.fill(7) },
      overview: () => "",
      content: compiled.value,
      gapSummary: () => "",
    });
    await service.open();
    const provider = fakeProvider(() => ok({}));
    const started = await service.startAiDiagnostic("sql", provider, "m");
    if (!started.ok) throw new Error(started.error.kind);
    const before = storage.text(started.value.location);

    const turned = await service.aiDiagnosticTurn(started.value.location, {}, provider, {
      writer: () => ({ title: "", body: "" }),
      onCall: () => undefined,
    });

    expect(turned).toEqual({ ok: false, error: { kind: "unavailable" } });
    expect(storage.text(started.value.location)).toBe(before);
  });
});

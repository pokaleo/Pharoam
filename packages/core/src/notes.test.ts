import { describe, expect, it } from "vitest";
import { examplePack } from "./__fixtures__/content-records.ts";
import { createCoreService, type CoreService } from "./core-service.ts";
import { noteText } from "./notes.ts";
import { parseRecordFile } from "./record-file.ts";
import { createMemoryConnector, type MemoryConnector } from "./testing/memory-connector.ts";

const A = "0192f3a1-0000-7000-8000-00000000000a";
const EVIDENCE = `---\nschema: evidence/1\nid: ${A}\ncreated: 2026-10-02T09:00:00Z\nkind: job\ntitle: Backend Engineer\nskills: [python]\n---\nBuilt the payments API.\n`;
const AI = { task: "explain-gap@1", model: "anthropic/claude-sonnet-5-5", at: "2026-11-07T10:00:00Z" };
const DISCLAIMER = "AI-generated and accepted by you. AI can make mistakes.";
const TEXT = "Python is close.\n\n## Places to start\n\n- **Python**: one level to go.";

async function profile(): Promise<{
  service: CoreService;
  storage: MemoryConnector;
  clock: { now: number };
}> {
  const clock = { now: Date.UTC(2026, 10, 7, 10, 0, 0) };
  const storage = createMemoryConnector({ "evidence/a.md": EVIDENCE });
  const service = createCoreService({
    storage: storage.connector,
    ids: { now: () => clock.now, fillRandom: (bytes: Uint8Array) => bytes.fill(7) },
    overview: () => "",
    content: examplePack(),
    // As the app's summary does, it names the evidence each level cites.
    gapSummary: ({ requirements }) =>
      requirements.flatMap(({ evidence }) => evidence.map(({ title }) => `- ${title ?? ""}`)).join("\n"),
  });
  await service.open();
  await service.recordLevel({ skill: "python", level: 2, evidence: [A] });
  return { service, storage, clock };
}

const later = (clock: { now: number }, minutes: number): void => {
  clock.now += minutes * 60_000;
};

describe("preparing a gap's explanation (MVP S18.1)", () => {
  it("sends the gap and the titles of the evidence its levels cite, writing nothing when the gap is up to date", async () => {
    const { service, storage } = await profile();
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    const writes = storage.writes();

    const prepared = await service.explainGapCall("ml-engineer");

    if (!prepared.ok) throw new Error(prepared.error.kind);
    expect(prepared.value).toMatchObject({
      pathway: "pharoam-core@0.1.0:ml-engineer",
      gapUpdated: explored.value.updated,
      gap: { updated: explored.value.updated },
      call: { task: "explain-gap@1" },
    });
    expect(prepared.value.call.parts).toHaveLength(1);
    expect(prepared.value.call.parts[0]?.text).toContain(
      'Requirement: python\nLevel: 2, self-reported\nGroup: below\nEvidence its level cites: "Backend Engineer"',
    );
    expect(prepared.value.call.request.system).toContain("Machine-learning engineer");
    expect(storage.writes()).toBe(writes);
  });

  it("brings the stored gap up to date first, so the note keeps the time of the gap it explains", async () => {
    const { service, storage, clock } = await profile();
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    // The evidence is renamed in another app, and the profile read again: the stored gap still has the old title.
    await storage.putOutside("evidence/a.md", EVIDENCE.replace("Backend Engineer", "Payments Engineer"));
    await service.open();
    later(clock, 10);

    const prepared = await service.explainGapCall("ml-engineer");

    if (!prepared.ok) throw new Error(prepared.error.kind);
    expect(prepared.value.call.parts[0]?.text).toContain('"Payments Engineer"');
    expect(prepared.value.gapUpdated).toBe("2026-11-07T10:10:00Z");
    expect(prepared.value.gap.updated).toBe(prepared.value.gapUpdated);
  });

  it("stores a gap not yet stored, and refuses a pathway the pack doesn't have", async () => {
    const { service } = await profile();
    const prepared = await service.explainGapCall("ml-engineer");
    expect(prepared.ok && prepared.value.gapUpdated).toBe("2026-11-07T10:00:00Z");
    expect(await service.explainGapCall("astronaut")).toEqual({
      ok: false,
      error: { kind: "unknown-pathway", pathway: "astronaut" },
    });
  });

  it("refuses when the stored gap can't be brought up to date, as when it changed outside Pharoam (hard rule 3)", async () => {
    const { service, storage } = await profile();
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    await storage.putOutside(
      explored.value.location,
      `${storage.text(explored.value.location) ?? ""}\nMine.\n`,
    );
    await service.recordLevel({ skill: "docker", level: 1 });

    const prepared = await service.explainGapCall("ml-engineer");

    expect(prepared.ok ? null : prepared.error.kind).toBe("conflict");
  });

  it("leaves out the title of cited evidence that was deleted, since it is gone", async () => {
    const { service } = await profile();
    await service.exploreGap("ml-engineer");
    const deleted = await service.deleteEvidence("evidence/a.md");
    if (!deleted.ok) throw new Error(deleted.error.kind);

    const prepared = await service.explainGapCall("ml-engineer");

    if (!prepared.ok) throw new Error(prepared.error.kind);
    expect(prepared.value.call.parts[0]?.text).toContain(
      "Requirement: python\nLevel: 2, self-reported\nGroup: below\n\n",
    );
  });
});

describe("accepting a gap's explanation as a note (MVP S18.3, S18.4)", () => {
  it("writes a note to notes/, with its ai block, the pathway pinned and the gap's time, and the disclaimer first", async () => {
    const { service, storage, clock } = await profile();
    const prepared = await service.explainGapCall("ml-engineer");
    if (!prepared.ok) throw new Error(prepared.error.kind);
    later(clock, 5);
    const before = service.records().map((r) => [r.location, storage.text(r.location)] as const);

    const saved = await service.saveGapNote(
      { pathway: prepared.value.pathway, gapUpdated: prepared.value.gapUpdated, ai: AI },
      TEXT,
      DISCLAIMER,
    );

    if (!saved.ok) throw new Error(saved.error.kind);
    expect(parseRecordFile(storage.text(saved.value.location) ?? "")).toMatchObject({
      ok: true,
      value: {
        top: {
          schema: "note/1",
          created: "2026-11-07T10:05:00Z",
          ai: { ...AI, confirmed_by_user: "2026-11-07T10:05:00Z" },
          pathway: "pharoam-core@0.1.0:ml-engineer",
          gap_updated: prepared.value.gapUpdated,
        },
        body: `> ⚠️ ${DISCLAIMER}\n\n${TEXT}\n`,
      },
    });
    // It changes no level and no gap (S18.2).
    expect(before.every(([location, text]) => storage.text(location) === text)).toBe(true);
  });

  it("writes nothing for an explanation edited down to nothing", async () => {
    const { service, storage } = await profile();
    await service.exploreGap("ml-engineer");
    const writes = storage.writes();
    const saved = await service.saveGapNote(
      { pathway: "pharoam-core@0.1.0:ml-engineer", gapUpdated: "2026-11-07T10:00:00Z", ai: AI },
      " \n ",
      DISCLAIMER,
    );
    expect(saved).toEqual({ ok: false, error: { kind: "empty-note" } });
    expect(storage.writes()).toBe(writes);
  });

  it("keeps only an explanation of a gap, with its disclaimer", async () => {
    const { service } = await profile();
    await service.exploreGap("ml-engineer");
    const gap = { pathway: "pharoam-core@0.1.0:ml-engineer", gapUpdated: "2026-11-07T10:00:00Z", ai: AI };
    const other = await service.saveGapNote(
      { ...gap, ai: { ...AI, task: "judge-skill-level@1" } },
      TEXT,
      DISCLAIMER,
    );
    expect(other.ok ? null : other.error.kind).toBe("invalid");
    await expect(service.saveGapNote(gap, TEXT, " ")).rejects.toThrow();
  });

  it("never rewrites a note: asking again writes a new one", async () => {
    const { service, storage, clock } = await profile();
    await service.exploreGap("ml-engineer");
    const gap = { pathway: "pharoam-core@0.1.0:ml-engineer", gapUpdated: "2026-11-07T10:00:00Z", ai: AI };
    const first = await service.saveGapNote(gap, "First.", DISCLAIMER);
    if (!first.ok) throw new Error(first.error.kind);
    const written = storage.text(first.value.location);
    later(clock, 1);

    const second = await service.saveGapNote(gap, "Second.", DISCLAIMER);

    if (!second.ok) throw new Error(second.error.kind);
    expect(second.value.location).not.toBe(first.value.location);
    expect(storage.text(first.value.location)).toBe(written);
  });
});

describe("the latest note on a gap (MVP S18.5)", () => {
  it("is the newest note for the pathway, its text without the disclaimer", async () => {
    const { service, clock } = await profile();
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    expect(service.latestGapNote("ml-engineer")).toBeUndefined();
    const gap = { pathway: "pharoam-core@0.1.0:ml-engineer", gapUpdated: explored.value.updated, ai: AI };
    await service.saveGapNote(gap, "Older.", DISCLAIMER);
    later(clock, 1);
    const newer = await service.saveGapNote(gap, TEXT, DISCLAIMER);
    if (!newer.ok) throw new Error(newer.error.kind);
    await service.saveGapNote(
      { ...gap, pathway: "pharoam-core@0.1.0:data-engineer" },
      "Elsewhere.",
      DISCLAIMER,
    );
    await service.saveGapNote(
      { ...gap, pathway: "another-pack@2.0.0:ml-engineer" },
      "Elsewhere.",
      DISCLAIMER,
    );

    expect(service.latestGapNote("ml-engineer")).toEqual({
      id: newer.value.record.id,
      location: newer.value.location,
      created: "2026-11-07T10:01:00Z",
      ai: { ...AI, confirmed_by_user: "2026-11-07T10:01:00Z" },
      text: TEXT,
      outOfDate: false,
    });
  });

  it("says so when the gap has changed since the one it explained", async () => {
    const { service, clock } = await profile();
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    await service.saveGapNote(
      { pathway: "pharoam-core@0.1.0:ml-engineer", gapUpdated: explored.value.updated, ai: AI },
      TEXT,
      DISCLAIMER,
    );
    later(clock, 10);

    await service.recordLevel({ skill: "docker", level: 2 });

    expect(service.latestGapNote("ml-engineer")?.outOfDate).toBe(true);
  });

  it("is out of date when the gap couldn't be brought up to date after a change", async () => {
    const { service, storage } = await profile();
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    await service.saveGapNote(
      { pathway: "pharoam-core@0.1.0:ml-engineer", gapUpdated: explored.value.updated, ai: AI },
      TEXT,
      DISCLAIMER,
    );
    await storage.putOutside(
      explored.value.location,
      `${storage.text(explored.value.location) ?? ""}\nMine.\n`,
    );

    await service.recordLevel({ skill: "docker", level: 1 });

    expect(service.gapProblem("ml-engineer")?.kind).toBe("conflict");
    expect(service.latestGapNote("ml-engineer")?.outOfDate).toBe(true);
  });

  it("reads a gap's time written as an offset as the same moment", async () => {
    const { service } = await profile();
    await service.exploreGap("ml-engineer");
    await service.saveGapNote(
      { pathway: "pharoam-core@0.1.0:ml-engineer", gapUpdated: "2026-11-07T10:00:00+00:00", ai: AI },
      TEXT,
      DISCLAIMER,
    );
    expect(service.latestGapNote("ml-engineer")?.outOfDate).toBe(false);
  });

  it("keeps a note's text as written when it has no disclaimer, as when edited outside Pharoam", async () => {
    const storage = createMemoryConnector({
      "notes/mine.md": `---\nschema: note/1\nid: 0192f3a1-0000-7000-8000-000000000040\ncreated: 2026-11-07T10:05:00Z\nai: { task: explain-gap@1, model: m, at: 2026-11-07T10:00:00Z, confirmed_by_user: 2026-11-07T10:05:00Z }\npathway: pharoam-core@0.1.0:ml-engineer\ngap_updated: 2026-11-07T09:00:00Z\n---\n> A quote of my own.\n\nMy words.\n`,
    });
    const service = createCoreService({
      storage: storage.connector,
      ids: { now: () => Date.UTC(2026, 10, 7, 11), fillRandom: (bytes: Uint8Array) => bytes.fill(7) },
      overview: () => "",
      content: examplePack(),
      gapSummary: () => "",
    });
    await service.open();
    expect(service.latestGapNote("ml-engineer")).toMatchObject({
      text: "> A quote of my own.\n\nMy words.",
      outOfDate: true,
    });
  });
});

describe("a note's text (MVP S18.5)", () => {
  it("leaves out the disclaimer Pharoam wrote, however an editor saved its sign, and keeps the rest as written", () => {
    expect(noteText(`> ⚠️ ${DISCLAIMER}\n\n    code first\nthen text\n`)).toBe("    code first\nthen text");
    expect(noteText(`\n> ⚠ ${DISCLAIMER}\n> carried on\n\nMy words.\n`)).toBe("My words.");
    expect(noteText(`> ⚠️ ${DISCLAIMER}`)).toBe("");
    expect(noteText("> A quote of my own.\n\nMy words.\n")).toBe("> A quote of my own.\n\nMy words.");
  });
});

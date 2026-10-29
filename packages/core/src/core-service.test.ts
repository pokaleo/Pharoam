import { describe, expect, it } from "vitest";
import { EVIDENCE_FILE, PHAROAM_FILE } from "./__fixtures__/profile-records.ts";
import { createCoreService, type CoreService, type NewProfile } from "./core-service.ts";
import type { IdSource } from "./ids.ts";
import { sealEntry } from "./integrity.ts";
import { createMemoryConnector, type MemoryConnector } from "./testing/memory-connector.ts";
import {
  createRecordFile,
  parseRecordFile,
  printRecordFile,
  withTopField,
  type RecordFile,
} from "./record-file.ts";

// A fixed clock and randomness, so profile IDs and times are known in advance.
const IDS: IdSource = { now: () => Date.UTC(2026, 9, 29, 9, 30, 0), fillRandom: (bytes) => bytes.fill(7) };

function file(text: string): RecordFile {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value;
}

async function opened(files: Readonly<Record<string, string>>): Promise<{
  service: CoreService;
  storage: MemoryConnector;
}> {
  const storage = createMemoryConnector(files);
  const service = createCoreService({ storage: storage.connector, ids: IDS });
  const result = await service.open();
  if (!result.ok) throw new Error(result.error.kind);
  return { service, storage };
}

// Evidence with a field Pharoam doesn't know and a comment, to check both survive a save.
const EVIDENCE_WITH_EXTRAS = EVIDENCE_FILE.replace(
  "source: manual",
  "source: manual\nmy_rating: 5 # my own note",
);

const ENTRY = {
  id: "0192f3a1-0000-7000-8000-000000000011",
  level: 3,
  provenance: "self-reported",
  observed_at: "2026-10-01T10:00:00Z",
};

function skillFile(entries: readonly Readonly<Record<string, unknown>>[]): string {
  const top = {
    schema: "skill-record/1",
    id: "0192f3a1-0000-7000-8000-000000000010",
    created: "2026-10-01T10:00:00Z",
    skill: "python",
    entries,
  };
  return printRecordFile(createRecordFile(top, ""));
}

describe("opening a profile", () => {
  it("lists every valid record and writes nothing (MVP S2.1)", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE, "evidence/a.md": EVIDENCE_FILE });
    expect(service.records().map((r) => r.record.schema)).toEqual(["pharoam/1", "evidence/1"]);
    expect(service.needsAttention()).toEqual([]);
    expect(storage.writes()).toBe(0);
  });

  it("puts invalid records under Needs attention and leaves them out of the records (MVP S12.2)", async () => {
    const { service } = await opened({
      "pharoam.md": PHAROAM_FILE,
      "evidence/broken-yaml.md": "---\ntitle: One\ntitle: Two\n---\n",
      "evidence/missing-title.md": EVIDENCE_FILE.replace("title: Backend Engineer\n", ""),
      "notes/plain.md": "# Just a note\n",
    });
    expect(service.records().map((r) => r.location)).toEqual(["pharoam.md"]);
    expect(service.needsAttention()).toMatchObject([
      {
        location: "evidence/broken-yaml.md",
        problem: { kind: "unreadable", error: { kind: "invalid-yaml" } },
      },
      {
        location: "evidence/missing-title.md",
        problem: { kind: "invalid", error: { kind: "invalid-fields" } },
      },
      { location: "notes/plain.md", problem: { kind: "unreadable", error: { kind: "no-top-block" } } },
    ]);
    expect(service.needsAttention()).toHaveLength(3);
  });

  it("puts a file that isn't text under Needs attention", async () => {
    const storage = createMemoryConnector({ "evidence/latin1.md": "x" });
    const service = createCoreService({
      ids: IDS,
      storage: {
        ...storage.connector,
        read: () =>
          Promise.resolve({ ok: false, error: { kind: "unreadable", error: { kind: "not-utf8" } } }),
      },
    });
    await service.open();
    expect(service.needsAttention()).toEqual([
      { location: "evidence/latin1.md", problem: { kind: "unreadable", error: { kind: "not-utf8" } } },
    ]);
  });

  it("keeps only the first of two records with the same ID, and says which", async () => {
    const { service } = await opened({ "evidence/a.md": EVIDENCE_FILE, "evidence/a-copy.md": EVIDENCE_FILE });
    expect(service.records().map((r) => r.location)).toEqual(["evidence/a.md"]);
    expect(service.needsAttention()).toEqual([
      {
        location: "evidence/a-copy.md",
        problem: {
          kind: "duplicate-id",
          id: "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d",
          keptAt: "evidence/a.md",
        },
      },
    ]);
  });

  it("finds a record by its ID", async () => {
    const { service } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    expect(service.find("0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d")?.location).toBe("evidence/a.md");
    expect(service.find("0192f3a1-0000-7000-8000-000000000099")).toBeUndefined();
  });

  it("labels skill entries edited outside Pharoam, and still uses them (MVP S12.3)", async () => {
    const sealed = sealEntry(ENTRY);
    if (!sealed.ok) throw new Error("not sealed");
    const edited = { ...sealed.value, level: 4 };
    const { service } = await opened({ "skills/python.md": skillFile([sealed.value, edited, ENTRY]) });
    const [skill] = service.records();
    expect(skill?.record.schema).toBe("skill-record/1");
    expect(skill?.entryIntegrity).toEqual([
      { kind: "intact" },
      { kind: "edited-outside", reason: "changed" },
      { kind: "edited-outside", reason: "no-fingerprint" },
    ]);
  });

  it("reports storage it can't reach", async () => {
    const storage = createMemoryConnector({ "pharoam.md": PHAROAM_FILE });
    storage.loseAccess();
    const result = await createCoreService({ storage: storage.connector, ids: IDS }).open();
    expect(result).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "Access to the storage was lost." },
    });
  });

  it("finds the profile's pharoam.md", async () => {
    const { service } = await opened({ "pharoam.md": PHAROAM_FILE, "evidence/a.md": EVIDENCE_FILE });
    expect(service.profile()?.location).toBe("pharoam.md");
  });

  it("has no profile in storage without pharoam.md, so one can be created there (MVP S2.3)", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    expect(service.profile()).toBeUndefined();
    expect(await service.createProfile({ headline: "Engineer" })).toMatchObject({ ok: true });
    expect(service.profile()?.record).toMatchObject({ schema: "pharoam/1", headline: "Engineer" });
    expect(await storage.readOutside("evidence/a.md")).toBe(EVIDENCE_FILE);
  });
});

describe("closing a profile (MVP S2.4)", () => {
  it("forgets every record read, and those under Needs attention", async () => {
    const { service, storage } = await opened({
      "pharoam.md": PHAROAM_FILE,
      "evidence/a.md": EVIDENCE_FILE,
      "notes/plain.md": "# Just a note\n",
    });
    service.close();
    expect(service.records()).toEqual([]);
    expect(service.needsAttention()).toEqual([]);
    expect(service.profile()).toBeUndefined();
    expect(service.find("0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d")).toBeUndefined();
    expect(storage.writes()).toBe(0);
  });

  it("can't save a change to a record read before closing", async () => {
    const { service } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    service.close();
    expect(await service.update("evidence/a.md", file(EVIDENCE_FILE))).toEqual({
      ok: false,
      error: { kind: "not-found", location: "evidence/a.md" },
    });
  });
});

describe("saving a record", () => {
  it("writes the change with the version it read, keeping what Pharoam doesn't know (MVP S5.1)", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_WITH_EXTRAS });
    const changed = withTopField(file(EVIDENCE_WITH_EXTRAS), "title", "Senior Backend Engineer");
    const result = await service.update("evidence/a.md", changed);
    expect(result.ok).toBe(true);
    expect(storage.text("evidence/a.md")).toBe(
      EVIDENCE_WITH_EXTRAS.replace("title: Backend Engineer", "title: Senior Backend Engineer"),
    );
    expect(service.find("0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d")?.record).toMatchObject({
      title: "Senior Backend Engineer",
    });
  });

  it("returns a conflict, and writes nothing, after an outside change (AD10, MVP S12.1)", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    const outside = EVIDENCE_FILE.replace("Built and ran", "Designed and ran");
    await storage.putOutside("evidence/a.md", outside);

    const result = await service.update("evidence/a.md", withTopField(file(EVIDENCE_FILE), "title", "Mine"));
    expect(result).toEqual({ ok: false, error: { kind: "conflict", location: "evidence/a.md" } });
    expect(storage.text("evidence/a.md")).toBe(outside);
    expect(service.find("0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d")?.record).toMatchObject({
      title: "Backend Engineer",
    });
  });

  it("never rewrites a record under Needs attention (hard rule 3)", async () => {
    const broken = EVIDENCE_FILE.replace("title: Backend Engineer\n", "");
    const { service, storage } = await opened({ "evidence/a.md": broken });
    const result = await service.update("evidence/a.md", file(EVIDENCE_FILE));
    expect(result).toEqual({ ok: false, error: { kind: "needs-attention", location: "evidence/a.md" } });
    expect(storage.writes()).toBe(0);
  });

  it("writes nothing that fails validation", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    const result = await service.update("evidence/a.md", withTopField(file(EVIDENCE_FILE), "title", ""));
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
  });

  it("reports a record deleted outside Pharoam since it was read", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    await storage.removeOutside("evidence/a.md");
    const result = await service.update("evidence/a.md", withTopField(file(EVIDENCE_FILE), "title", "Mine"));
    expect(result).toEqual({ ok: false, error: { kind: "not-found", location: "evidence/a.md" } });
    expect(storage.text("evidence/a.md") !== undefined).toBe(false);
  });

  it("refuses to update a record it hasn't read", async () => {
    const { service } = await opened({});
    expect(await service.update("evidence/a.md", file(EVIDENCE_FILE))).toEqual({
      ok: false,
      error: { kind: "not-found", location: "evidence/a.md" },
    });
  });

  it("creates a new record and lists it", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    const result = await service.create(file(EVIDENCE_FILE));
    expect(result).toMatchObject({
      ok: true,
      value: { location: "evidence/0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d.md" },
    });
    expect(service.records()).toHaveLength(2);
    expect(storage.writes()).toBe(1);
  });

  it("refuses to create a record whose ID is taken", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    expect(await service.create(file(EVIDENCE_FILE))).toEqual({
      ok: false,
      error: { kind: "duplicate-id", id: "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d", keptAt: "evidence/a.md" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("never creates a record over a file already at its location", async () => {
    const location = "evidence/0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d.md";
    const { service, storage } = await opened({ [location]: "# Not a record\n" });
    expect(await service.create(file(EVIDENCE_FILE))).toEqual({
      ok: false,
      error: { kind: "exists", location },
    });
    expect(storage.text(location)).toBe("# Not a record\n");
  });

  it("refuses to change a record's ID", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    const moved = withTopField(file(EVIDENCE_FILE), "id", "0192f3a1-0000-7000-8000-000000000099");
    expect(await service.update("evidence/a.md", moved)).toEqual({
      ok: false,
      error: { kind: "id-changed", location: "evidence/a.md" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("reports storage it can't reach when creating", async () => {
    const { service, storage } = await opened({});
    storage.loseAccess();
    expect(await service.create(file(EVIDENCE_FILE))).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "Access to the storage was lost." },
    });
    expect(service.records()).toEqual([]);
  });

  it("reports storage it can't reach when saving", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    storage.loseAccess();
    const result = await service.update("evidence/a.md", withTopField(file(EVIDENCE_FILE), "title", "Mine"));
    expect(result).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "Access to the storage was lost." },
    });
  });
});

describe("creating a profile (MVP S1)", () => {
  const PROFILE: NewProfile = {
    headline: "Backend engineer moving into machine learning",
    situation: { stage: "changing-career", field: "Software engineering" },
    region: "GB",
    focus: { pathways: ["ml-engineer"], skills: ["python"] },
  };

  it("writes pharoam.md with its schema, a UUIDv7 ID and the time it was created, and prepares the storage (S1.1)", async () => {
    const { service, storage } = await opened({});
    const result = await service.createProfile({});
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.file.top).toEqual({
      schema: "pharoam/1",
      id: expect.stringMatching(/^01a186fe-adc0-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) as unknown,
      created: "2026-10-29T09:30:00Z",
      ai: null,
    });
    expect(storage.text(result.value.location)).toBe(printRecordFile(result.value.file));
    expect(storage.initialisations()).toBe(1);
    expect(service.records()).toEqual([result.value]);
  });

  it("saves the headline, situation, country and focus, in that order (S1.2)", async () => {
    const { service } = await opened({});
    const result = await service.createProfile(PROFILE);
    expect(result.ok && Object.keys(result.value.file.top)).toEqual([
      "schema",
      "id",
      "created",
      "ai",
      "headline",
      "situation",
      "region",
      "focus",
    ]);
    expect(result.ok && result.value.record).toMatchObject(PROFILE);
  });

  it("never writes a name, photo or contact details, even if given them (hard rule 8)", async () => {
    const { service, storage } = await opened({});
    const withPersonalData = { ...PROFILE, name: "Ada", email: "ada@example.com", photo: "ada.png" };
    const result = await service.createProfile(withPersonalData);
    const text = result.ok ? storage.text(result.value.location) : "";
    expect(text).not.toMatch(/Ada|example\.com|ada\.png|name|email|photo/);
  });

  it("writes nothing that fails validation", async () => {
    const { service, storage } = await opened({});
    const result = await service.createProfile({ ...PROFILE, region: "United Kingdom" });
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
    expect(storage.initialisations()).toBe(0);
  });

  it("changes no file already in the storage (S1.3)", async () => {
    const files = { "notes/todo.md": "# My own notes\n", "evidence/a.md": EVIDENCE_FILE };
    const { service, storage } = await opened(files);
    expect((await service.createProfile(PROFILE)).ok).toBe(true);
    for (const [location, text] of Object.entries(files)) expect(storage.text(location)).toBe(text);
  });

  it("refuses to create a second profile", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    expect(await service.createProfile(PROFILE)).toEqual({
      ok: false,
      error: { kind: "profile-exists", location: "pharoam.md" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("writes nothing, and says why, without permission (S1.4)", async () => {
    const { service, storage } = await opened({});
    storage.loseAccess();
    expect(await service.createProfile(PROFILE)).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "Access to the storage was lost." },
    });
    expect(storage.writes()).toBe(0);
  });
});

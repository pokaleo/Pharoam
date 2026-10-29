import { describe, expect, it } from "vitest";
import { examplePack } from "./__fixtures__/content-records.ts";
import { EVIDENCE_FILE, PHAROAM_FILE } from "./__fixtures__/profile-records.ts";
import { createCoreService, type CoreService, type ProfileFields } from "./core-service.ts";
import type { GapWriter } from "./gaps.ts";
import type { OverviewWriter } from "./overview.ts";
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

// A stand-in for the app's translated overview.
const OVERVIEW: OverviewWriter = (facts) =>
  `## Overview\n\nEvidence: ${String(facts.evidence)}. Skills: ${String(facts.skills)}. Last change: ${facts.lastChange ?? "none"}.\n`;

// A stand-in for the app's translated gap summary.
const GAP_SUMMARY: GapWriter = (gap) =>
  `# ${gap.title}\n\n${gap.requirements.map((r) => `- ${r.name}: ${r.group}`).join("\n")}\n`;

const OPTIONS = { ids: IDS, overview: OVERVIEW, content: examplePack(), gapSummary: GAP_SUMMARY };

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
  const service = createCoreService({ ...OPTIONS, storage: storage.connector });
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
      ...OPTIONS,
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
    const result = await createCoreService({ ...OPTIONS, storage: storage.connector }).open();
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
    // The evidence, then the overview in pharoam.md (MVP S3.3).
    expect(storage.writes()).toBe(2);
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
  const PROFILE: ProfileFields = {
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
      updated: "2026-10-29T09:30:00Z",
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
      "updated",
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

describe("editing the profile (MVP S3.1)", () => {
  const NOW = "2026-10-29T09:30:00Z";
  const CURRENT: ProfileFields = {
    headline: "Backend engineer moving into machine learning",
    situation: { stage: "changing-career", field: "Software engineering" },
    region: "GB",
    focus: { pathways: ["ml-engineer"], skills: ["python", "pytorch"] },
  };

  it("saves the headline, situation, country and focus, and changes the updated time", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    const result = await service.updateProfile({ ...CURRENT, headline: "ML engineer", region: "IE" });
    expect(result.ok && result.value.record).toMatchObject({ headline: "ML engineer", region: "IE" });
    // Only the changed fields' lines change; preferences and the person's own text are kept.
    expect(storage.text("pharoam.md")).toBe(
      PHAROAM_FILE.replace("updated: 2026-10-25T09:30:00Z", `updated: ${NOW}`)
        .replace("headline: Backend engineer moving into machine learning", "headline: ML engineer")
        .replace("region: GB", "region: IE"),
    );
  });

  it("removes the fields left out", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    expect((await service.updateProfile({ headline: "ML engineer" })).ok).toBe(true);
    expect(storage.text("pharoam.md")).not.toMatch(/situation:|region:|focus:/);
    expect(storage.text("pharoam.md")).toContain("preferences:");
  });

  it("never writes a name, photo or contact details, even if given them (hard rule 8)", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    const withPersonalData = { ...CURRENT, name: "Ada", email: "ada@example.com" };
    await service.updateProfile(withPersonalData);
    expect(storage.text("pharoam.md")).not.toMatch(/Ada|example\.com|name|email/);
  });

  it("writes nothing that fails validation", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    const result = await service.updateProfile({ ...CURRENT, region: "United Kingdom" });
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
  });

  it("returns a conflict, and writes nothing, after an outside change (AD10)", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    await storage.putOutside("pharoam.md", PHAROAM_FILE.replace("About me", "My edit"));
    expect(await service.updateProfile(CURRENT)).toEqual({
      ok: false,
      error: { kind: "conflict", location: "pharoam.md" },
    });
    expect(storage.text("pharoam.md")).toContain("My edit");
  });

  it("needs a profile to edit", async () => {
    const { service } = await opened({});
    expect(await service.updateProfile(CURRENT)).toEqual({ ok: false, error: { kind: "no-profile" } });
  });
});

describe("the overview in pharoam.md (MVP S3.2, S3.3)", () => {
  const OWN_TEXT = "About me, in my own words.\n";
  const overview = (evidence: number, skills: number, lastChange: string): string =>
    `<!-- pharoam:overview -->\n## Overview\n\nEvidence: ${String(evidence)}. Skills: ${String(skills)}. Last change: ${lastChange}.\n<!-- /pharoam:overview -->\n`;

  it("is regenerated when evidence is added, after the person's own text (S3.3)", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    expect((await service.create(file(EVIDENCE_FILE))).ok).toBe(true);
    const text = storage.text("pharoam.md") ?? "";
    expect(text).toBe(
      PHAROAM_FILE.replace("updated: 2026-10-25T09:30:00Z", "updated: 2026-10-29T09:30:00Z").replace(
        OWN_TEXT,
        `${OWN_TEXT}\n${overview(1, 0, "2026-10-24T14:02:11Z")}`,
      ),
    );
    expect(service.profile()?.file.body).toBe(`${OWN_TEXT}\n${overview(1, 0, "2026-10-24T14:02:11Z")}`);
    expect(service.overviewProblem()).toBeUndefined();
  });

  it("is regenerated when skills change, changing only its own section (S3.2, S3.3)", async () => {
    const after = "\nMore of my own words, after the overview.  \n";
    const body = `${OWN_TEXT}\n${overview(0, 0, "none")}${after}`;
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE.replace(OWN_TEXT, body) });
    expect((await service.create(file(skillFile([ENTRY])))).ok).toBe(true);
    const text = storage.text("pharoam.md") ?? "";
    expect(text.slice(text.indexOf("---\n", 4) + 4)).toBe(
      `${OWN_TEXT}\n${overview(0, 1, "2026-10-01T10:00:00Z")}${after}`,
    );
  });

  it("is regenerated when evidence is edited", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE, "evidence/a.md": EVIDENCE_FILE });
    const edited = withTopField(file(EVIDENCE_FILE), "updated", "2026-10-28T08:00:00Z");
    expect((await service.update("evidence/a.md", edited)).ok).toBe(true);
    expect(storage.text("pharoam.md")).toContain(overview(1, 0, "2026-10-28T08:00:00Z"));
  });

  it("isn't written again when nothing in it changed", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE, "evidence/a.md": EVIDENCE_FILE });
    expect((await service.refreshOverview()).ok).toBe(true);
    const writes = storage.writes();
    expect((await service.refreshOverview()).ok).toBe(true);
    expect(storage.writes()).toBe(writes);
  });

  it("leaves pharoam.md alone, and says why, when its markers are broken", async () => {
    const broken = PHAROAM_FILE.replace(OWN_TEXT, `${OWN_TEXT}<!-- pharoam:overview -->\nOld.\n`);
    const { service, storage } = await opened({ "pharoam.md": broken });
    expect((await service.create(file(EVIDENCE_FILE))).ok).toBe(true);
    expect(storage.text("pharoam.md")).toBe(broken);
    expect(service.overviewProblem()).toEqual({ kind: "overview-markers", location: "pharoam.md" });
    expect(await service.refreshOverview()).toEqual({
      ok: false,
      error: { kind: "overview-markers", location: "pharoam.md" },
    });
  });

  it("forgets an earlier problem once the overview is brought up to date", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    await storage.putOutside("pharoam.md", PHAROAM_FILE.replace("About me", "My edit"));
    expect((await service.create(file(EVIDENCE_FILE))).ok).toBe(true);
    expect(service.overviewProblem()).toEqual({ kind: "conflict", location: "pharoam.md" });
    expect((await service.open()).ok).toBe(true);
    expect((await service.refreshOverview()).ok).toBe(true);
    expect(service.overviewProblem()).toBeUndefined();
  });

  it("isn't needed without a profile", async () => {
    const { service, storage } = await opened({});
    expect((await service.create(file(EVIDENCE_FILE))).ok).toBe(true);
    expect(storage.writes()).toBe(1);
    expect(service.overviewProblem()).toBeUndefined();
    expect(await service.refreshOverview()).toEqual({ ok: false, error: { kind: "no-profile" } });
  });
});

describe("recording evidence with a form (MVP S4)", () => {
  it("drafts a preview exactly as it will be stored, writing nothing until confirmed (S4.2, S4.3)", async () => {
    const { service, storage } = await opened({});
    const draft = service.draftEvidence({ kind: "project", title: "Payments API", skills: ["python"] });
    if (!draft.ok) throw new Error(draft.error.kind);
    expect(draft.value.top).toMatchObject({
      schema: "evidence/1",
      id: expect.stringMatching(/^01a186fe-adc0-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) as unknown,
      created: "2026-10-29T09:30:00Z",
      ai: null,
      source: "manual",
    });
    expect(storage.writes()).toBe(0);
    const created = await service.create(draft.value);
    expect(created.ok && storage.text(created.value.location)).toBe(printRecordFile(draft.value));
  });

  it("explains a form that can't be stored, and writes nothing (S4.4)", async () => {
    const { service, storage } = await opened({});
    const draft = service.draftEvidence({ kind: "project", title: "" });
    expect(draft.ok ? null : draft.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
  });
});

describe("editing and deleting evidence (MVP S5)", () => {
  const FORM = {
    kind: "job",
    title: "Senior Backend Engineer",
    organisation: "Example Co",
    start: "2022-09",
    end: "2024-08",
    links: ["https://example.com/payments-api"],
    skills: ["python", "postgres"],
    description: "Built and ran the payments API.\n",
  } as const;
  const EVIDENCE_ID = "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d";
  const CITING = skillFile([{ ...ENTRY, evidence: [EVIDENCE_ID] }]);

  it("rewrites the file with the same ID, a new updated time and unknown fields kept (S5.1)", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_WITH_EXTRAS });
    const result = await service.editEvidence("evidence/a.md", FORM);
    expect(result.ok && result.value.record).toMatchObject({
      id: EVIDENCE_ID,
      title: "Senior Backend Engineer",
    });
    expect(storage.text("evidence/a.md")).toBe(
      EVIDENCE_WITH_EXTRAS.replace("updated: 2026-10-24T14:02:11Z", "updated: 2026-10-29T09:30:00Z").replace(
        "title: Backend Engineer",
        "title: Senior Backend Engineer",
      ),
    );
  });

  it("reports the fields to fix, and writes nothing", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    const result = await service.editEvidence("evidence/a.md", { ...FORM, title: "" });
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
  });

  it("returns a conflict, and writes nothing, after an outside change (AD10)", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    await storage.putOutside("evidence/a.md", EVIDENCE_FILE.replace("Built", "I built"));
    expect(await service.editEvidence("evidence/a.md", FORM)).toEqual({
      ok: false,
      error: { kind: "conflict", location: "evidence/a.md" },
    });
    expect(storage.text("evidence/a.md")).toContain("I built");
  });

  it("edits only evidence, and never the record of a diagnostic (data model §4)", async () => {
    const assessment = EVIDENCE_FILE.replace("kind: job", "kind: assessment");
    const { service, storage } = await opened({ "skills/python.md": CITING, "evidence/x.md": assessment });
    for (const location of ["skills/python.md", "evidence/x.md"]) {
      expect(await service.editEvidence(location, FORM)).toEqual({
        ok: false,
        error: { kind: "not-editable", location },
      });
    }
    expect(await service.editEvidence("evidence/missing.md", FORM)).toEqual({
      ok: false,
      error: { kind: "not-found", location: "evidence/missing.md" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("never rewrites evidence under Needs attention (hard rule 3)", async () => {
    const broken = EVIDENCE_FILE.replace("title: Backend Engineer\n", "");
    const { service, storage } = await opened({ "evidence/broken.md": broken });
    expect(await service.editEvidence("evidence/broken.md", FORM)).toEqual({
      ok: false,
      error: { kind: "needs-attention", location: "evidence/broken.md" },
    });
    expect(storage.text("evidence/broken.md")).toBe(broken);
  });

  it("says which observations refer to evidence before it is deleted (S5.3)", async () => {
    const { service } = await opened({ "evidence/a.md": EVIDENCE_FILE, "skills/python.md": CITING });
    expect(service.evidenceReferences(EVIDENCE_ID)).toEqual([
      { location: "skills/python.md", skill: "python", observation: ENTRY.id },
    ]);
    expect(service.evidenceReferences("0192f3a1-0000-7000-8000-000000000099")).toEqual([]);
  });

  it("removes the file, and observations citing it still load, showing it as removed (S5.2)", async () => {
    const { service, storage } = await opened({
      "pharoam.md": PHAROAM_FILE,
      "evidence/a.md": EVIDENCE_FILE,
      "skills/python.md": CITING,
    });
    expect(await service.deleteEvidence("evidence/a.md")).toEqual({ ok: true, value: undefined });
    expect(storage.text("evidence/a.md")).toBeUndefined();
    expect(service.find(EVIDENCE_ID)).toBeUndefined();
    expect(service.records().map((r) => r.location)).toEqual(["pharoam.md", "skills/python.md"]);
    expect((await service.open()).ok).toBe(true);
    expect(service.needsAttention()).toEqual([]);
    expect(service.records().map((r) => r.location)).toEqual(["pharoam.md", "skills/python.md"]);
  });

  it("brings the overview up to date after a deletion", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE, "evidence/a.md": EVIDENCE_FILE });
    await service.deleteEvidence("evidence/a.md");
    expect(storage.text("pharoam.md")).toContain("Evidence: 0. Skills: 0. Last change: none.");
  });

  it("deletes nothing changed outside Pharoam since it was read (AD10)", async () => {
    const { service, storage } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    await storage.putOutside("evidence/a.md", EVIDENCE_FILE.replace("Built", "I built"));
    expect(await service.deleteEvidence("evidence/a.md")).toEqual({
      ok: false,
      error: { kind: "conflict", location: "evidence/a.md" },
    });
    expect(storage.text("evidence/a.md")).toContain("I built");
  });

  it("never deletes a record under Needs attention, or one that isn't evidence (hard rules 3, 4)", async () => {
    const broken = EVIDENCE_FILE.replace("title: Backend Engineer\n", "");
    const { service, storage } = await opened({ "evidence/broken.md": broken, "skills/python.md": CITING });
    expect(await service.deleteEvidence("evidence/broken.md")).toEqual({
      ok: false,
      error: { kind: "needs-attention", location: "evidence/broken.md" },
    });
    expect(await service.deleteEvidence("skills/python.md")).toEqual({
      ok: false,
      error: { kind: "not-evidence", location: "skills/python.md" },
    });
    expect(await service.deleteEvidence("evidence/missing.md")).toEqual({
      ok: false,
      error: { kind: "not-found", location: "evidence/missing.md" },
    });
    expect(storage.text("evidence/broken.md")).toBe(broken);
    expect(storage.text("skills/python.md")).toBe(CITING);
  });
});

describe("saying what I can do (MVP S6)", () => {
  const EVIDENCE_ID = "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d";
  const NEW_ID = /^01a186fe-adc0-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  function sealed(entry: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const result = sealEntry(entry);
    if (!result.ok) throw new Error("not sealed");
    return result.value;
  }

  it("starts the skill's record with a self-reported observation (S6.1, S6.4)", async () => {
    const { service, storage } = await opened({});
    const result = await service.recordLevel({ skill: "python", level: 3 });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.file.top).toEqual({
      schema: "skill-record/1",
      id: expect.stringMatching(NEW_ID) as unknown,
      created: "2026-10-29T09:30:00Z",
      ai: null,
      skill: "python",
      entries: [
        {
          id: expect.stringMatching(NEW_ID) as unknown,
          level: 3,
          provenance: "self-reported",
          observed_at: "2026-10-29T09:30:00Z",
          integrity: expect.stringMatching(/^sha256-c1:[0-9a-f]{64}$/) as unknown,
        },
      ],
      proficiency: {
        shown: {
          level: 3,
          provenance: "self-reported",
          since: "2026-10-29",
          observation: expect.stringMatching(NEW_ID) as unknown,
        },
        "by-source": { "self-reported": { level: 3, since: "2026-10-29" } },
      },
    });
    expect(result.value.entryIntegrity).toEqual([{ kind: "intact" }]);
    expect(storage.text(result.value.location)).toBe(printRecordFile(result.value.file));
  });

  it("appends to the skill's record, leaving existing entries byte for byte (S6.1, S6.4)", async () => {
    const existing = skillFile([sealed(ENTRY)]);
    const { service, storage } = await opened({ "skills/python.md": existing });
    const result = await service.recordLevel({ skill: "python", level: 4 });
    expect(result.ok && result.value.location).toBe("skills/python.md");
    const text = storage.text("skills/python.md") ?? "";
    expect(text.startsWith(existing.slice(0, existing.lastIndexOf("---\n")))).toBe(true);
    expect(result.ok && result.value.entryIntegrity).toEqual([{ kind: "intact" }, { kind: "intact" }]);
    expect(result.ok && result.value.record).toMatchObject({
      entries: [{ level: 3 }, { level: 4, provenance: "self-reported" }],
    });
  });

  it("lists the evidence cited, and is still self-reported (S6.2)", async () => {
    const { service } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    const result = await service.recordLevel({ skill: "python", level: 3, evidence: [EVIDENCE_ID] });
    expect(result.ok && result.value.record).toMatchObject({
      entries: [{ provenance: "self-reported", evidence: [EVIDENCE_ID] }],
    });
  });

  it("offers no choice of provenance (S6.5)", async () => {
    const { service } = await opened({});
    const claimed = { skill: "python", level: 4, provenance: "demonstrated" };
    const result = await service.recordLevel(claimed);
    expect(result.ok && result.value.record).toMatchObject({ entries: [{ provenance: "self-reported" }] });
  });

  it("refuses evidence that isn't in the profile, and writes nothing", async () => {
    const { service, storage } = await opened({ "pharoam.md": PHAROAM_FILE });
    const missing = "0192f3a1-0000-7000-8000-000000000099";
    expect(await service.recordLevel({ skill: "python", level: 3, evidence: [missing] })).toEqual({
      ok: false,
      error: { kind: "unknown-evidence", id: missing },
    });
    expect(storage.writes()).toBe(0);
  });

  it.each([5, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses level %s, and writes nothing",
    async (level) => {
      const { service, storage } = await opened({});
      const result = await service.recordLevel({ skill: "python", level });
      expect(result.ok ? null : result.error.kind).toBe("invalid");
      expect(storage.writes()).toBe(0);
    },
  );

  it("refuses a skill that isn't a slug, and writes nothing", async () => {
    const { service, storage } = await opened({});
    const result = await service.recordLevel({ skill: "Python 3", level: 2 });
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
  });

  it("never writes over a skill record under Needs attention (hard rule 3)", async () => {
    const broken = "---\nschema: skill-record/1\nskill: python\n---\n";
    const { service, storage } = await opened({ "skill-record/broken.md": broken });
    await service.recordLevel({ skill: "python", level: 3 });
    expect(storage.text("skill-record/broken.md")).toBe(broken);
  });
});

describe("correcting or retracting a level (MVP S7)", () => {
  const OLD = "0192f3a1-0000-7000-8000-000000000011";
  const NEW_ID = /^01a186fe-adc0-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  function sealedEntry(entry: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    const result = sealEntry(entry);
    if (!result.ok) throw new Error("not sealed");
    return result.value;
  }

  const HISTORY = skillFile([sealedEntry(ENTRY)]);
  const before = HISTORY.slice(0, HISTORY.lastIndexOf("---\n"));

  it("appends a correction that supersedes the old observation, leaving it unchanged (S7.1)", async () => {
    const { service, storage } = await opened({ "skills/python.md": HISTORY });
    const result = await service.correctLevel(OLD, { level: 2 });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.record).toMatchObject({
      entries: [
        { id: OLD, level: 3 },
        {
          id: expect.stringMatching(NEW_ID) as unknown,
          level: 2,
          provenance: "self-reported",
          observed_at: "2026-10-29T09:30:00Z",
          supersedes: OLD,
        },
      ],
    });
    expect(storage.text("skills/python.md")?.startsWith(before)).toBe(true);
    expect(result.value.entryIntegrity).toEqual([{ kind: "intact" }, { kind: "intact" }]);
  });

  it("appends a retraction, and the observation stops counting (S7.2)", async () => {
    const { service, storage } = await opened({ "skills/python.md": HISTORY });
    const result = await service.retractLevel(OLD, "I rated this too high.");
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.record).toMatchObject({
      entries: [
        { id: OLD },
        {
          id: expect.stringMatching(NEW_ID) as unknown,
          target: OLD,
          decision: "retract",
          reviewed_at: "2026-10-29T09:30:00Z",
          note: "I rated this too high.",
        },
      ],
    });
    expect(storage.text("skills/python.md")?.startsWith(before)).toBe(true);
    expect(service.skillHistory("python")).toMatchObject([
      { kind: "review" },
      { kind: "observation", status: "retracted", shown: false },
    ]);
  });

  it("shows the history newest first, marking the shown level (S7.3)", async () => {
    const { service } = await opened({ "skills/python.md": HISTORY });
    await service.correctLevel(OLD, { level: 2 });
    expect(service.skillHistory("python")).toMatchObject([
      { kind: "observation", entry: { level: 2 }, status: "counts", shown: true },
      { kind: "observation", entry: { id: OLD }, status: "superseded", shown: false },
    ]);
    expect(service.skillHistory("rust")).toEqual([]);
  });

  it("corrects only the person's own current levels", async () => {
    const tested = { ...ENTRY, id: "0192f3a1-0000-7000-8000-000000000012", provenance: "demonstrated" };
    const assessed = { ...tested, assessment: "0192f3a1-0000-7000-8000-000000000090" };
    const corrected = { ...ENTRY, id: "0192f3a1-0000-7000-8000-000000000013", supersedes: OLD };
    const retracted = {
      id: "0192f3a1-0000-7000-8000-000000000014",
      target: corrected.id,
      decision: "retract",
    };
    const file = skillFile([
      sealedEntry(ENTRY),
      sealedEntry(assessed),
      sealedEntry(corrected),
      sealedEntry({ ...retracted, reviewed_at: "2026-10-02T10:00:00Z" }),
    ]);
    const { service, storage } = await opened({ "skills/python.md": file });
    for (const [observation, reason] of [
      [assessed.id, "not-self-reported"],
      [OLD, "superseded"],
      [corrected.id, "retracted"],
    ] as const) {
      expect(await service.correctLevel(observation, { level: 1 })).toEqual({
        ok: false,
        error: { kind: "not-correctable", observation, reason },
      });
    }
    expect(await service.retractLevel(corrected.id)).toEqual({
      ok: false,
      error: { kind: "not-correctable", observation: corrected.id, reason: "retracted" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("can retract any observation, including a tested one", async () => {
    const tested = {
      ...ENTRY,
      provenance: "demonstrated",
      assessment: "0192f3a1-0000-7000-8000-000000000090",
    };
    const { service } = await opened({ "skills/python.md": skillFile([sealedEntry(tested)]) });
    expect((await service.retractLevel(OLD)).ok).toBe(true);
  });

  it("finds no observation that isn't in the profile, and writes nothing", async () => {
    const { service, storage } = await opened({ "skills/python.md": HISTORY });
    const missing = "0192f3a1-0000-7000-8000-000000000099";
    expect(await service.correctLevel(missing, { level: 1 })).toEqual({
      ok: false,
      error: { kind: "no-observation", id: missing },
    });
    expect(await service.retractLevel(missing)).toEqual({
      ok: false,
      error: { kind: "no-observation", id: missing },
    });
    expect(storage.writes()).toBe(0);
  });

  it("refuses a correction citing evidence that isn't in the profile, and writes nothing", async () => {
    const { service, storage } = await opened({ "skills/python.md": HISTORY });
    const missing = "0192f3a1-0000-7000-8000-000000000099";
    expect(await service.correctLevel(OLD, { level: 2, evidence: [missing] })).toEqual({
      ok: false,
      error: { kind: "unknown-evidence", id: missing },
    });
    expect(storage.writes()).toBe(0);
  });

  it("refuses a corrected level outside 0–4, and writes nothing", async () => {
    const { service, storage } = await opened({ "skills/python.md": HISTORY });
    const result = await service.correctLevel(OLD, { level: 7 });
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
  });
});

describe("adding a skill the vocabulary is missing (MVP S8)", () => {
  const NEW_ID = /^01a186fe-adc0-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("starts a skill record whose slug starts with custom-, holding the name and description (S8.1)", async () => {
    const { service, storage } = await opened({});
    const result = await service.addCustomSkill({ name: "KDB+/q", description: "Time-series queries." });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.file.top).toEqual({
      schema: "skill-record/1",
      id: expect.stringMatching(NEW_ID) as unknown,
      created: "2026-10-29T09:30:00Z",
      ai: null,
      skill: "custom-kdb-q",
      name: "KDB+/q",
      description: "Time-series queries.",
    });
    expect(storage.text(result.value.location)).toBe(printRecordFile(result.value.file));
  });

  it("keeps the name as typed, trimmed, and leaves out an empty description", async () => {
    const { service } = await opened({});
    const result = await service.addCustomSkill({ name: "  Latte art ", description: "" });
    expect(result.ok && result.value.file.top).toMatchObject({
      skill: "custom-latte-art",
      name: "Latte art",
    });
    expect(result.ok && "description" in result.value.file.top).toBe(false);
  });

  it("works like any other skill in observations (S8.2)", async () => {
    const { service } = await opened({});
    await service.addCustomSkill({ name: "KDB+/q" });
    const rated = await service.recordLevel({ skill: "custom-kdb-q", level: 2 });
    expect(rated.ok && rated.value.record).toMatchObject({
      skill: "custom-kdb-q",
      name: "KDB+/q",
      entries: [{ level: 2, provenance: "self-reported" }],
    });
    expect(service.skillHistory("custom-kdb-q")).toMatchObject([{ kind: "observation", shown: true }]);
  });

  it("refuses a name it already has, and writes nothing more", async () => {
    const { service, storage } = await opened({});
    const first = await service.addCustomSkill({ name: "KDB+/q" });
    expect(await service.addCustomSkill({ name: "kdb+/Q " })).toEqual({
      ok: false,
      error: { kind: "skill-exists", skill: "custom-kdb-q", location: first.ok && first.value.location },
    });
    expect(storage.writes()).toBe(1);
  });

  it("gives a different skill whose slug is taken its own, with a short ID", async () => {
    const { service } = await opened({});
    await service.addCustomSkill({ name: "C++" });
    const second = await service.addCustomSkill({ name: "C#" });
    expect(second.ok && second.value.record).toMatchObject({
      skill: expect.stringMatching(/^custom-c-[0-9a-f]{8}$/) as unknown,
      name: "C#",
    });
  });

  it("uses a short ID for a name the slug can't spell", async () => {
    const { service } = await opened({});
    const result = await service.addCustomSkill({ name: "日本語" });
    expect(result.ok && result.value.record).toMatchObject({
      skill: expect.stringMatching(/^custom-[0-9a-f]{8}$/) as unknown,
      name: "日本語",
    });
  });

  it("refuses a blank name, and writes nothing", async () => {
    const { service, storage } = await opened({});
    const result = await service.addCustomSkill({ name: "   " });
    expect(result.ok ? null : result.error.kind).toBe("invalid");
    expect(storage.writes()).toBe(0);
  });
});

describe("seeing what I can do (MVP S9)", () => {
  it("writes the proficiency summary when a level is recorded (S9.2)", async () => {
    const { service, storage } = await opened({});
    const result = await service.recordLevel({ skill: "python", level: 3 });
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.record).toMatchObject({
      proficiency: {
        shown: { level: 3, provenance: "self-reported", since: "2026-10-29" },
        "by-source": { "self-reported": { level: 3, since: "2026-10-29" } },
      },
    });
    expect(storage.text(result.value.location)).toContain("proficiency:\n  shown:\n    level: 3\n");
  });

  it("regenerates it when a level is corrected or retracted", async () => {
    const { service } = await opened({});
    const first = await service.recordLevel({ skill: "python", level: 3 });
    if (!first.ok || first.value.record.schema !== "skill-record/1") throw new Error("not recorded");
    const old = first.value.record.entries[0]?.id ?? "";
    const corrected = await service.correctLevel(old, { level: 2 });
    expect(corrected.ok && corrected.value.record).toMatchObject({ proficiency: { shown: { level: 2 } } });
    const latest =
      corrected.ok && corrected.value.record.schema === "skill-record/1" ? corrected.value.record : undefined;
    const retracted = await service.retractLevel(latest?.entries[1]?.id ?? "");
    // Nothing counts any more, so there is no summary to show.
    expect(retracted.ok && retracted.value.file.top.proficiency).toBeUndefined();
  });

  it("replaces a summary that doesn't match the history when the file is saved", async () => {
    const hand = skillFile([ENTRY]).replace(
      "entries:",
      "proficiency:\n  shown: { level: 4, provenance: self-reported, since: 2026-10-01, observation: 0192f3a1-0000-7000-8000-000000000011 }\nentries:",
    );
    const { service } = await opened({ "skills/python.md": hand });
    const current = service.find("0192f3a1-0000-7000-8000-000000000010");
    if (current === undefined) throw new Error("not loaded");
    const saved = await service.update(current.location, current.file);
    expect(saved.ok && saved.value.record).toMatchObject({ proficiency: { shown: { level: 3 } } });
  });

  it("leaves a summary that is up to date exactly as written", async () => {
    const { service, storage } = await opened({});
    const first = await service.recordLevel({ skill: "python", level: 3 });
    if (!first.ok) throw new Error(first.error.kind);
    const before = storage.text(first.value.location);
    const saved = await service.update(first.value.location, first.value.file);
    expect(saved.ok && storage.text(first.value.location)).toBe(before);
  });

  it("lists the person's skills with their shown levels, narrowed by a filter (S9.1, S9.3)", async () => {
    const { service } = await opened({});
    await service.recordLevel({ skill: "python", level: 3 });
    await service.addCustomSkill({ name: "KDB+/q" });
    expect(service.skillView([]).map((item) => [item.skill, item.shown?.level])).toEqual([
      ["custom-kdb-q", undefined],
      ["python", 3],
    ]);
    expect(service.skillView([], { query: "kdb" }).map((item) => item.skill)).toEqual(["custom-kdb-q"]);
  });
});

describe("seeing my gap to a pathway (MVP S11)", () => {
  const NEW_ID = /^01a186fe-adc0-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("stores the gap in a gap record, pinned to the pathway's version, with a readable summary (S11.4)", async () => {
    const { service, storage } = await opened({});
    const result = await service.exploreGap("ml-engineer");
    if (!result.ok) throw new Error(result.error.kind);
    const stored = storage.text(result.value.location) ?? "";
    expect(parseRecordFile(stored)).toMatchObject({
      ok: true,
      value: {
        top: {
          schema: "gap/1",
          id: expect.stringMatching(NEW_ID) as unknown,
          created: "2026-10-29T09:30:00Z",
          updated: "2026-10-29T09:30:00Z",
          ai: null,
          pathway: "pharoam-core@0.1.0:ml-engineer",
          requirements: [
            { skill: "python", required: 3, shown: null, group: "unknown" },
            { skill: "pytorch", required: 3, shown: null, group: "unknown" },
            { skill: "docker", required: 2, shown: null, group: "unknown" },
          ],
        },
        body: "# Machine-learning engineer\n\n- Python: unknown\n- PyTorch: unknown\n- Docker: unknown\n",
      },
    });
  });

  it("shows each requirement's group, shown level and source, and the pathway (S11.1, S11.2, S11.6)", async () => {
    const { service } = await opened({ "evidence/a.md": EVIDENCE_FILE });
    await service.recordLevel({
      skill: "python",
      level: 3,
      evidence: ["0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d"],
    });
    await service.recordLevel({ skill: "pytorch", level: 1 });
    const result = await service.exploreGap("ml-engineer");
    if (!result.ok) throw new Error(result.error.kind);
    expect(result.value.pathway).toMatchObject({ slug: "ml-engineer", title: "Machine-learning engineer" });
    expect(result.value.updated).toBe("2026-10-29T09:30:00Z");
    expect(result.value.requirements).toEqual([
      {
        skill: "python",
        name: "Python",
        importance: "core",
        required: 3,
        shown: { level: 3, provenance: "self-reported" },
        group: "claimed",
        evidence: [{ id: "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d", title: "Backend Engineer" }],
      },
      {
        skill: "pytorch",
        name: "PyTorch",
        importance: "core",
        required: 3,
        shown: { level: 1, provenance: "self-reported" },
        group: "below",
        evidence: [],
      },
      {
        skill: "docker",
        name: "Docker",
        importance: "helpful",
        required: 2,
        shown: null,
        group: "unknown",
        evidence: [],
      },
    ]);
    expect(service.find(result.value.id)?.record).toMatchObject({
      requirements: [{ group: "claimed", evidence: ["0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d"] }, {}, {}],
    });
  });

  it("regenerates a stored gap when my observations change (S11.5)", async () => {
    const { service, storage } = await opened({});
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    await service.recordLevel({ skill: "docker", level: 2 });
    expect(storage.text(explored.value.location)).toContain("- Docker: claimed");
    expect(service.find(explored.value.id)?.record).toMatchObject({
      requirements: [{}, {}, { skill: "docker", shown: { level: 2 }, group: "claimed" }],
    });
    expect(service.gapProblem("ml-engineer")).toBeUndefined();
  });

  it("writes nothing when the stored gap is already up to date, and reuses the stored record", async () => {
    const { service, storage } = await opened({});
    const first = await service.exploreGap("ml-engineer");
    const writes = storage.writes();
    const again = await service.exploreGap("ml-engineer");
    expect(again.ok && first.ok && again.value.location).toBe(first.ok && first.value.location);
    expect(storage.writes()).toBe(writes);
  });

  it("refuses a pathway the content doesn't have, and writes nothing", async () => {
    const { service, storage } = await opened({});
    expect(await service.exploreGap("astronaut")).toEqual({
      ok: false,
      error: { kind: "unknown-pathway", pathway: "astronaut" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("never overwrites a gap edited outside Pharoam, and says why it couldn't regenerate it", async () => {
    const { service, storage } = await opened({});
    const explored = await service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    const edited = `${storage.text(explored.value.location) ?? ""}My notes.\n`;
    await storage.putOutside(explored.value.location, edited);
    await service.recordLevel({ skill: "docker", level: 2 });
    expect(storage.text(explored.value.location)).toBe(edited);
    expect(service.gapProblem("ml-engineer")).toEqual({
      kind: "conflict",
      location: explored.value.location,
    });
  });

  it("ends the summary with a newline, as Markdown files do", async () => {
    const storage = createMemoryConnector({});
    const service = createCoreService({
      ...OPTIONS,
      storage: storage.connector,
      gapSummary: () => "Summary",
    });
    await service.open();
    const result = await service.exploreGap("ml-engineer");
    expect(result.ok && storage.text(result.value.location)?.endsWith("---\nSummary\n")).toBe(true);
  });

  it("shows when a gap without an updated time was created", async () => {
    const first = await opened({});
    const explored = await first.service.exploreGap("ml-engineer");
    if (!explored.ok) throw new Error(explored.error.kind);
    const text = (first.storage.text(explored.value.location) ?? "").replace(/^updated: .*\n/m, "");
    const { service, storage } = await opened({ [explored.value.location]: text });
    const again = await service.exploreGap("ml-engineer");
    expect(again.ok && again.value.updated).toBe("2026-10-29T09:30:00Z");
    expect(storage.writes()).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { examplePack } from "./__fixtures__/content-records.ts";
import type { ModelRequest } from "./ai/provider.ts";
import type { CallRecord } from "./ai/run-task.ts";
import { createCoreService, type CoreService } from "./core-service.ts";
import { err, ok } from "./result.ts";
import { fakeProvider } from "./testing/fake-provider.ts";
import { createMemoryConnector, type MemoryConnector } from "./testing/memory-connector.ts";

const A = "0192f3a1-0000-7000-8000-00000000000a";
const B = "0192f3a1-0000-7000-8000-00000000000b";

const evidence = (id: string, kind: string, title: string, skills: string, body: string): string =>
  `---\nschema: evidence/1\nid: ${id}\ncreated: 2026-10-02T09:00:00Z\nkind: ${kind}\ntitle: ${title}\nskills: [${skills}]\n---\n${body}\n`;

const FILES = {
  "evidence/a.md": evidence(A, "job", "Backend Engineer", "python", "Built and ran the payments API."),
  "evidence/b.md": evidence(B, "project", "Shell history search", "", "A small tool."),
  "evidence/x.md": evidence(
    "0192f3a1-0000-7000-8000-00000000000c",
    "assessment",
    "Python diagnostic",
    "python",
    "Marked by rule.",
  ),
};

const OPTIONS = {
  ids: { now: () => Date.UTC(2026, 10, 6, 10, 0, 0), fillRandom: (bytes: Uint8Array) => bytes.fill(7) },
  overview: () => "",
  content: examplePack(),
  gapSummary: () => "",
};
const RUN = { model: "m", now: () => new Date("2026-11-06T10:00:00Z") };

async function profile(files: Readonly<Record<string, string>> = FILES): Promise<{
  service: CoreService;
  storage: MemoryConnector;
}> {
  const storage = createMemoryConnector(files);
  const service = createCoreService({ ...OPTIONS, storage: storage.connector });
  await service.open();
  return { service, storage };
}

// A model that answers each task as these tests need, and keeps every request.
function model(level = 3) {
  const sent: ModelRequest[] = [];
  const provider = fakeProvider((request) => {
    sent.push(request);
    if (request.output.name === "judge-skill-level")
      return ok({ level, explanation: "Ran a Python API.", limits: "One record only.", evidence: ["E1"] });
    if (request.prompt.includes("Backend Engineer"))
      return ok({
        links: [
          { skill: "python", explanation: "Built it in Python." },
          { skill: "sql", explanation: "Ran its database." },
          { skill: "cobol", explanation: "Not on any list." },
        ],
      });
    return ok({ links: [{ skill: "django", explanation: "Used Django." }] });
  });
  return { provider, sent };
}

// The python skill record's text, wherever the storage put it.
const pythonText = (service: CoreService, storage: MemoryConnector): string => {
  const found = service
    .records()
    .find((r) => r.record.schema === "skill-record/1" && r.record.skill === "python");
  return storage.text(found?.location ?? "") ?? "";
};

const session = (service: CoreService) => {
  const found = service.records().find((r) => r.record.schema === "session/1");
  if (found?.record.schema !== "session/1") throw new Error("No session.");
  return { location: found.location, record: found.record };
};

describe("preparing an evidence scan (MVP S16.1, S16.2)", () => {
  it("prepares one call per record, sending that record only, and writes nothing", async () => {
    const { service, storage } = await profile();
    const calls = service.linkScan([
      A,
      B,
      "0192f3a1-0000-7000-8000-00000000000c",
      "0192f3a1-0000-7000-8000-0000000000ff",
    ]);
    expect(calls.map((c) => c.kind === "skill-links" && c.evidence)).toEqual([A, B]);
    expect(calls[0]?.call.parts[0]?.text).toBe(
      "Kind: job\nTitle: Backend Engineer\n\nBuilt and ran the payments API.",
    );
    expect(calls[0]?.call.request.prompt).not.toContain("Shell history");
    expect(storage.writes()).toBe(0);
  });

  it("judges a skill from its linked evidence only, and only skills with some", async () => {
    const { service } = await profile();
    expect(service.judgeableSkills()).toEqual(["python"]);
    const [call] = service.levelScan(["python", "sql"]);
    expect(service.levelScan(["sql"])).toEqual([]);
    expect(call?.call.parts.map((p) => p.kind)).toEqual(["skill", "evidence"]);
    expect(call?.call.parts[1]?.text).toContain("Backend Engineer");
    expect(call?.call.parts[0]?.text).toContain("Builds and maintains production Python code");
  });
});

describe("running a scan into a review session (MVP S16.4, S16.5, S16.11)", () => {
  it("writes a session of its own with each suggestion and its ai block, and no link yet", async () => {
    const { service, storage } = await profile();
    const { provider } = model();

    const ran = await service.runScan(service.linkScan([A]), provider, RUN);

    expect(ran.ok).toBe(true);
    const { record } = session(service);
    expect(record).toMatchObject({ workflow: "evidence-scan@1", scan: "skill-links", status: "in-progress" });
    expect(record.suggestions).toMatchObject([
      {
        kind: "skill-link",
        evidence: A,
        skill: "sql",
        explanation: "Ran its database.",
        ai: { task: "suggest-skill-links@1", model: "fake/m" },
      },
    ]);
    // Already linked, so listed as already so; a skill on no list is dropped.
    expect(record.already).toEqual([{ kind: "skill-link", evidence: A, skill: "python" }]);
    expect(storage.text("evidence/a.md")).toBe(FILES["evidence/a.md"]);
  });

  it("reports every call it makes, with its record, for the activity log (MVP S17.1)", async () => {
    const { service } = await profile();
    const calls: CallRecord[] = [];

    await service.runScan(service.linkScan([A, B]), model().provider, {
      ...RUN,
      onCall: (call) => calls.push(call),
    });

    expect(calls.map((call) => [call.task, call.outcome])).toEqual([
      ["suggest-skill-links@1", "answered"],
      ["suggest-skill-links@1", "answered"],
    ]);
    expect(calls[0]?.sent.prompt).toContain("Backend Engineer");
  });

  it("sets aside a record whose call fails, and carries on with the rest", async () => {
    const { service } = await profile();
    const provider = fakeProvider((request: ModelRequest) =>
      request.prompt.includes("Backend Engineer")
        ? err({ kind: "unreachable" })
        : ok({ links: [{ skill: "django", explanation: "Used Django." }] }),
    );

    await service.runScan(service.linkScan([A, B]), provider, RUN);

    const { record } = session(service);
    expect(record.set_aside).toEqual([{ evidence: A, reason: "unreachable" }]);
    expect(record.suggestions.map((s) => s.skill)).toEqual(["django"]);
  });

  it("shows its progress, and stops between calls when asked, keeping what finished", async () => {
    const { service } = await profile();
    const { provider, sent } = model();
    const progress: string[] = [];
    let stop = false;

    await service.runScan(service.linkScan([A, B]), provider, {
      ...RUN,
      onProgress: (done, total) => {
        progress.push(`${String(done)}/${String(total)}`);
        stop = true;
      },
      stopped: () => stop,
    });

    expect(sent).toHaveLength(1);
    expect(progress).toEqual(["1/2"]);
    expect(session(service).record.suggestions.map((s) => s.skill)).toEqual(["sql"]);
  });

  it("lists a judged level equal to the shown one as already so", async () => {
    const level = `---\nschema: skill-record/1\nid: 0192f3a1-0000-7000-8000-000000000020\ncreated: 2026-10-01T10:00:00Z\nskill: python\nentries:\n  - id: 0192f3a1-0000-7000-8000-000000000021\n    level: 3\n    provenance: self-reported\n    observed_at: 2026-10-01T10:00:00Z\n---\n`;
    const { service } = await profile({ ...FILES, "skills/python.md": level });

    await service.runScan(service.levelScan(["python"]), model(3).provider, RUN);

    const { record } = session(service);
    expect(record.suggestions).toEqual([]);
    expect(record.already).toEqual([{ kind: "skill-level", skill: "python", level: 3 }]);
    expect(record.status).toBe("completed");
  });
});

describe("deciding suggestions (MVP S16.6–S16.10, S16.14)", () => {
  async function scanned(scan: "links" | "levels" = "links") {
    const found = await profile();
    const calls = scan === "links" ? found.service.linkScan([A, B]) : found.service.levelScan(["python"]);
    await found.service.runScan(calls, model().provider, RUN);
    return found;
  }

  it("lists pending suggestions from every session", async () => {
    const { service } = await scanned();
    await service.runScan(service.levelScan(["python"]), model().provider, RUN);
    expect(
      service.reviewItems().map((item) => [item.suggestion.kind, item.suggestion.skill, item.stale]),
    ).toEqual([
      ["skill-link", "sql", false],
      ["skill-link", "django", false],
      ["skill-level", "python", false],
    ]);
  });

  it("accepts a link: adds the skill to the evidence, and lists it under ai-skill-links (S16.8)", async () => {
    const { service, storage } = await scanned();
    const [sql] = service.reviewItems();
    if (sql === undefined) throw new Error("No suggestion.");

    const decided = await service.decideSuggestions([sql], "accept");

    expect(decided).toEqual({ decided: [sql.suggestion.id], refused: [] });
    const text = storage.text("evidence/a.md") ?? "";
    expect(text).toContain("skills:\n  - python\n  - sql\n");
    expect(text).toContain(
      "ai-skill-links:\n  - skill: sql\n    task: suggest-skill-links@1\n    model: fake/m\n    at: 2026-11-06T10:00:00Z\n    confirmed_by_user: 2026-11-06T10:00:00Z\n",
    );
    expect(session(service).record.suggestions[0]).toMatchObject({
      decision: "accepted",
      decided_at: "2026-11-06T10:00:00Z",
    });
  });

  it("accepts a level: appends an ai-judged observation citing its evidence, which is then shown (S16.9)", async () => {
    const { service, storage } = await scanned("levels");
    const [python] = service.reviewItems();
    if (python === undefined) throw new Error("No suggestion.");

    await service.decideSuggestions([python], "accept");

    const text = pythonText(service, storage);
    expect(text).toContain("provenance: ai-judged");
    expect(text).toContain(`evidence:\n      - ${A}`);
    expect(text).toContain("limits: One record only.");
    expect(text).toContain("confirmed_by_user: 2026-11-06T10:00:00Z");
    expect(service.skillView(examplePack().skills)[0]).toMatchObject({
      skill: "python",
      shown: { level: 3, provenance: "ai-judged" },
    });
  });

  it("discards: drops it and writes nothing else; skipping leaves it pending (S16.7)", async () => {
    const { service, storage } = await scanned();
    const [sql, django] = service.reviewItems();
    if (sql === undefined || django === undefined) throw new Error("No suggestions.");

    await service.decideSuggestions([sql], "discard");

    expect(storage.text("evidence/a.md")).toBe(FILES["evidence/a.md"]);
    expect(session(service).record.suggestions[0]).toMatchObject({ decision: "discarded" });
    expect(service.reviewItems().map((item) => item.suggestion.id)).toEqual([django.suggestion.id]);
  });

  it("can't accept a suggestion whose evidence changed after the scan read it (S16.10)", async () => {
    const { service, storage } = await scanned();
    await service.editEvidence("evidence/a.md", {
      kind: "job",
      title: "Backend Engineer",
      skills: ["python"],
      description: "Built, ran and scaled the payments API.",
    });
    const [sql] = service.reviewItems();
    if (sql === undefined) throw new Error("No suggestion.");
    expect(sql.stale).toBe(true);

    const decided = await service.decideSuggestions([sql], "accept");

    expect(decided).toEqual({ decided: [], refused: [{ id: sql.suggestion.id, reason: "stale" }] });
    expect(storage.text("evidence/a.md")).not.toContain("sql");
  });

  it("adjusts a level: records the person's own level instead, and drops the suggestion (S16.7)", async () => {
    const { service, storage } = await scanned("levels");
    const [python] = service.reviewItems();
    if (python === undefined) throw new Error("No suggestion.");

    await service.adjustSuggestion(python, 2);

    const text = pythonText(service, storage);
    expect(text).toContain("provenance: self-reported");
    expect(text).not.toContain("ai-judged");
    expect(session(service).record.suggestions[0]).toMatchObject({ decision: "adjusted" });
  });

  it("completes the session when nothing is pending, and keeps it until the person deletes it (S16.14)", async () => {
    const { service, storage } = await scanned();
    await service.decideSuggestions(service.reviewItems(), "discard");
    const { location, record } = session(service);
    expect(record.status).toBe("completed");

    expect(await service.deleteSession(location)).toEqual({ ok: true, value: undefined });
    expect(storage.text(location)).toBeUndefined();
    expect(service.records().some((r) => r.record.schema === "session/1")).toBe(false);
  });

  it("offers to ask AI again once an accepted level's linked evidence changes, never judging on its own (S16.12)", async () => {
    const { service } = await scanned("levels");
    await service.decideSuggestions(service.reviewItems(), "accept");
    expect(service.levelOutOfDate("python")).toBe(false);

    await service.editEvidence("evidence/b.md", {
      kind: "project",
      title: "Shell history search",
      skills: ["python"],
    });

    expect(service.levelOutOfDate("python")).toBe(true);
    expect(service.levelOutOfDate("sql")).toBe(false);
  });

  it("refuses a suggestion already decided, or in no session, and adjusts only a pending level", async () => {
    const { service } = await scanned();
    const [sql] = service.reviewItems();
    if (sql === undefined) throw new Error("No suggestion.");
    await service.decideSuggestions([sql], "discard");

    expect(await service.decideSuggestions([sql, { ...sql, session: "sessions/gone.md" }], "accept")).toEqual(
      {
        decided: [],
        refused: [
          { id: sql.suggestion.id, reason: "not-pending" },
          { id: sql.suggestion.id, reason: "not-pending" },
        ],
      },
    );
    expect(await service.adjustSuggestion(sql, 2)).toEqual({
      ok: false,
      error: { kind: "not-pending", id: sql.suggestion.id },
    });
  });

  it("deletes only a session, and nothing changed outside since it was read (AD10)", async () => {
    const { service, storage } = await scanned();
    const { location } = session(service);
    expect(await service.deleteSession("evidence/a.md")).toEqual({
      ok: false,
      error: { kind: "not-found", location: "evidence/a.md" },
    });
    await storage.putOutside(location, (storage.text(location) ?? "").replace("in-progress", "abandoned"));
    expect(await service.deleteSession(location)).toEqual({
      ok: false,
      error: { kind: "conflict", location },
    });
    expect(storage.text(location)).toContain("abandoned");
  });
});

describe("a scan with nothing to do", () => {
  it("writes no session", async () => {
    const { service, storage } = await profile();
    expect(await service.runScan([], model().provider, RUN)).toEqual({
      ok: false,
      error: { kind: "nothing-to-scan" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("completes a session stopped before anything was found", async () => {
    const { service } = await profile();
    await service.runScan(service.linkScan([A, B]), model().provider, { ...RUN, stopped: () => true });
    expect(session(service).record).toMatchObject({ status: "completed", suggestions: [] });
  });
});

describe("deciding safely (review findings)", () => {
  async function levels() {
    const found = await profile();
    await found.service.runScan(found.service.levelScan(["python"]), model().provider, RUN);
    return found;
  }

  const ids = (service: CoreService, storage: MemoryConnector): string[] =>
    [...pythonText(service, storage).matchAll(/^ {2}- id: (\S+)$/gm)].map((m) => m[1] ?? "");

  it("writes an accepted level once, even when the session's own write fails and the person tries again", async () => {
    const { service, storage } = await levels();
    const [python] = service.reviewItems();
    if (python === undefined) throw new Error("No suggestion.");
    const { location } = session(service);
    await storage.putOutside(
      location,
      (storage.text(location) ?? "").replace("status: in-progress", "status: in-progress # synced"),
    );

    const first = await service.decideSuggestions([python], "accept");
    expect(first.failed).toMatchObject({
      id: python.suggestion.id,
      error: { kind: "conflict" },
    });
    await service.resolveConflict(location, "theirs");
    const [again] = service.reviewItems();
    if (again === undefined) throw new Error("No suggestion.");
    await service.decideSuggestions([again], "accept");

    expect(ids(service, storage)).toEqual([python.suggestion.id]);
  });

  it("applies a suggestion given twice in one call once", async () => {
    const { service, storage } = await levels();
    const [python] = service.reviewItems();
    if (python === undefined) throw new Error("No suggestion.");

    const decided = await service.decideSuggestions([python, python], "accept");

    expect(decided.decided).toEqual([python.suggestion.id]);
    expect(ids(service, storage)).toEqual([python.suggestion.id]);
  });

  it("keeps decisions made on a session while its scan is still running", async () => {
    const { service } = await profile();
    let deciding: Promise<unknown> = Promise.resolve();
    const answers = fakeProvider((request: ModelRequest) =>
      request.prompt.includes("Shell history")
        ? ok({ links: [{ skill: "django", explanation: "Used Django." }] })
        : ok({ links: [{ skill: "sql", explanation: "Ran its database." }] }),
    );
    // The second call answers only once the person's decision on the first suggestion is written.
    const provider = {
      ...answers,
      complete: async (request: ModelRequest, options: { readonly model: string }) => {
        if (request.prompt.includes("Shell history")) await deciding;
        return answers.complete(request, options);
      },
    };

    await service.runScan(service.linkScan([A, B]), provider, {
      ...RUN,
      onProgress: (done) => {
        if (done === 1) deciding = service.decideSuggestions(service.reviewItems(), "accept");
      },
    });

    expect(session(service).record.suggestions.map((s) => [s.skill, s.decision])).toEqual([
      ["sql", "accepted"],
      ["django", undefined],
    ]);
  });

  it("can't accept a level once the skill's linked evidence changed, as when a link was accepted since", async () => {
    const { service } = await profile();
    await service.runScan(service.levelScan(["python"]), model().provider, RUN);
    await service.editEvidence("evidence/b.md", {
      kind: "project",
      title: "Shell history search",
      skills: ["python"],
    });

    const [python] = service.reviewItems();
    expect(python?.stale).toBe(true);
  });

  it("lists pending suggestions oldest session first, leaving out abandoned sessions", async () => {
    const later = createMemoryConnector(FILES);
    let clock = Date.UTC(2026, 10, 6, 10, 0, 0);
    const service = createCoreService({
      ...OPTIONS,
      ids: { now: () => (clock += 60_000), fillRandom: (bytes: Uint8Array) => bytes.fill(7) },
      storage: later.connector,
    });
    await service.open();
    await service.runScan(service.linkScan([B]), model().provider, RUN);
    await service.runScan(service.linkScan([A]), model().provider, RUN);
    // Listed by storage in another order: the newer session first.
    const sessions = service.records().filter((r) => r.record.schema === "session/1");
    expect(sessions).toHaveLength(2);
    const reopened = createCoreService({
      ...OPTIONS,
      storage: {
        ...later.connector,
        list: async () => {
          const listed = await later.connector.list();
          return listed.ok ? ok([...listed.value].reverse()) : listed;
        },
      },
    });
    await reopened.open();
    expect(reopened.reviewItems().map((item) => item.suggestion.skill)).toEqual(["django", "sql"]);

    const oldest = sessions[0];
    if (oldest === undefined) throw new Error("No session.");
    await later.putOutside(
      oldest.location,
      (later.text(oldest.location) ?? "").replace("status: in-progress", "status: abandoned"),
    );
    await reopened.open();
    expect(reopened.reviewItems().map((item) => item.suggestion.skill)).toEqual(["sql"]);
  });

  it("offers to ask again once a record its level rests on is unlinked, even after its session is deleted", async () => {
    const { service } = await profile();
    await service.runScan(service.levelScan(["python"]), model().provider, RUN);
    await service.decideSuggestions(service.reviewItems(), "accept");
    await service.deleteSession(session(service).location);
    expect(service.levelOutOfDate("python")).toBe(false);

    await service.editEvidence("evidence/a.md", { kind: "job", title: "Backend Engineer", skills: ["sql"] });

    expect(service.levelOutOfDate("python")).toBe(true);
  });

  it("refuses a scan mixing link and level calls", async () => {
    const { service, storage } = await profile();
    const mixed = [...service.linkScan([A]), ...service.levelScan(["python"])];
    expect(await service.runScan(mixed, model().provider, RUN)).toEqual({
      ok: false,
      error: { kind: "mixed-scan" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("never writes a level citing evidence the scan didn't read, from a session changed outside Pharoam", async () => {
    const { service, storage } = await levels();
    const { location } = session(service);
    await storage.putOutside(
      location,
      (storage.text(location) ?? "").replace(`evidence:\n      - ${A}`, `evidence:\n      - ${B}`),
    );
    await service.open();
    const [python] = service.reviewItems();
    if (python === undefined) throw new Error("No suggestion.");

    const decided = await service.decideSuggestions([python], "accept");

    expect(decided.refused).toEqual([{ id: python.suggestion.id, reason: "stale" }]);
    expect(pythonText(service, storage)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { LEVELS_FILE, PACK_FILE, PATHWAY_FILE, SKILL_FILE } from "./__fixtures__/content-records.ts";
import type { AiLedTurn } from "./ai/ai-led-diagnostic.ts";
import type { ModelRequest } from "./ai/provider.ts";
import type { CallRecord } from "./ai/run-task.ts";
import { createCoreService, type AiAssessmentWriter, type CoreService } from "./core-service.ts";
import { AI_LED_WORKFLOW } from "./diagnostic.ts";
import { compileContentPack, type ContentPack } from "./pack.ts";
import { err, ok } from "./result.ts";
import { fakeProvider } from "./testing/fake-provider.ts";
import { createMemoryConnector, type MemoryConnector } from "./testing/memory-connector.ts";

const skill = (slug: string, name: string): string =>
  `---\nschema: skill/1\nslug: ${slug}\nname: ${name}\ndomain: Test\norigin: { source: Pharoam, licence: MIT }\n---\n`;

// Two SQL items at each level, the right answer always option 1.
const item = (level: number, part: string): string =>
  `---\nschema: assessment-item/1\nslug: sql-${String(level)}-${part}\nskills: [sql]\nlevel: ${String(level)}\nformat: mcq\nprompt: Which is it at ${String(level)}?\noptions: [a, b, c]\nanswer: 1\nexplanation: Because b.\norigin: { source: Pharoam content, licence: CC-BY-SA-4.0 }\nreview: { by: The Pharoam founder, at: 2026-11-15 }\n---\n`;

// The content pack; with `retired`, SQL is deprecated in favour of Django, as a later pack might do.
function pack({ retired = false } = {}): ContentPack {
  const sql = retired
    ? skill("sql", "SQL").replace("---\n", "---\nstatus: deprecated\nreplaced_by: django\n")
    : skill("sql", "SQL");
  const compiled = compileContentPack([
    { path: "content/pack.md", text: PACK_FILE },
    { path: "data/levels.md", text: LEVELS_FILE },
    { path: "data/skills/python.md", text: SKILL_FILE },
    { path: "data/skills/pytorch.md", text: skill("pytorch", "PyTorch") },
    { path: "data/skills/docker.md", text: skill("docker", "Docker") },
    { path: "data/skills/sql.md", text: sql },
    { path: "data/skills/django.md", text: skill("django", "Django") },
    { path: "data/skills/pandas.md", text: skill("pandas", "pandas") },
    { path: "content/pathways/ml-engineer.md", text: PATHWAY_FILE },
    // A pack can't hold items testing a deprecated skill, so a pack retiring SQL has none.
    ...(retired ? [] : [0, 1, 2, 3, 4]).flatMap((level) =>
      ["a", "b"].map((part) => ({
        path: `content/items/sql/sql-${String(level)}-${part}.md`,
        text: item(level, part),
      })),
    ),
  ]);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.error.problems));
  return compiled.value;
}

const EVIDENCE_ID = "0192f3a1-0000-7000-8000-000000000001";
const EVIDENCE = [
  "---",
  "schema: evidence/1",
  `id: ${EVIDENCE_ID}`,
  "created: 2026-11-01T10:00:00Z",
  "kind: project",
  "title: Payments reporting",
  "skills: [sql]",
  "---",
  "Wrote the reporting queries.",
  "",
].join("\n");

const WRITER: AiAssessmentWriter = (facts) => ({
  title: `${facts.name} AI-led diagnostic`,
  body: `Result: ${String(facts.result)} by ${facts.rule}. ${facts.explanation.showed}`,
});

const EXPLANATION = {
  showed: "Joins are solid.",
  comparison: "As you claimed.",
  reasons: [],
  next_step: "Try a window function.",
};

interface Behaviour {
  /** Writes an open question rather than choosing a bank item. */
  readonly open?: boolean;
  /** Fails every call, as when the provider can't be reached. */
  readonly fail?: boolean;
  /** Answers only once this settles, so a test can act while a call is in flight. */
  readonly gate?: Promise<void>;
}

// A model that picks the first bank item offered (or writes an open question), marks right, and explains.
function model(id = "fake", behaviour: Behaviour = {}) {
  const provider = fakeProvider((request: ModelRequest) => {
    if (behaviour.fail === true) return err({ kind: "unreachable", message: "offline" });
    if (request.output.name === "explain-diagnostic") return ok(EXPLANATION);
    if (request.output.name === "mark-diagnostic-answer") {
      const level = /Mark at level (\d)/.exec(request.system)?.[1];
      return ok({ level: Number(level), correct: true, reasons: "Partitions by customer." });
    }
    if (behaviour.open === true)
      return ok({
        source: "written",
        format: "open",
        prompt: "Rank each customer's orders by date.",
        rubric: "Partitions by customer.",
        why: "The evidence names reports but shows no ranking.",
      });
    const offered = /- (sql-\d-[ab]) \(mcq\)/.exec(request.system)?.[1];
    return ok({ source: "bank", bank: offered, why: "Probes joins." });
  });
  const { gate } = behaviour;
  return {
    ...provider,
    id,
    complete: async (...args: Parameters<typeof provider.complete>) => {
      if (gate !== undefined) await gate;
      return provider.complete(...args);
    },
  };
}

async function profile(
  files: Readonly<Record<string, string>> = { "evidence/payments.md": EVIDENCE },
): Promise<{
  service: CoreService;
  storage: MemoryConnector;
}> {
  const storage = createMemoryConnector(files);
  const service = await open(storage);
  return { service, storage };
}

async function open(storage: MemoryConnector, content = pack()): Promise<CoreService> {
  const service = createCoreService({
    storage: storage.connector,
    ids: { now: () => Date.UTC(2026, 10, 23, 10, 0, 0), fillRandom: (bytes: Uint8Array) => bytes.fill(7) },
    overview: () => "",
    content,
    gapSummary: () => "",
  });
  await service.open();
  return service;
}

const session = (service: CoreService, location: string) => {
  const found = service.records().find((r) => r.location === location);
  if (found?.record.schema !== "session/1") throw new Error("No session.");
  return found.record;
};

const NOW = { writer: WRITER, onCall: () => undefined };

// Takes one turn and fails the test on an error.
async function take(
  service: CoreService,
  location: string,
  turn: AiLedTurn,
  provider = model(),
  calls: CallRecord[] = [],
) {
  const taken = await service.aiDiagnosticTurn(location, turn, provider, {
    ...NOW,
    onCall: (call) => calls.push(call),
  });
  if (!taken.ok) throw new Error(taken.error.kind);
  return taken.value;
}

// Approves the call the last turn paused to show.
async function approveShown(
  service: CoreService,
  location: string,
  provider = model(),
  calls: CallRecord[] = [],
) {
  const shown = await take(service, location, {}, provider, calls);
  if (shown.pause.kind !== "approve") throw new Error(`Paused for ${shown.pause.kind}.`);
  return take(
    service,
    location,
    { approve: { call: shown.pause.call, model: shown.pause.model } },
    provider,
    calls,
  );
}

describe("starting an AI-led diagnostic (MVP S23.1, S23.2)", () => {
  it("starts at the shown level with the model chosen, noting what it will send, and sends nothing yet", async () => {
    const { service } = await profile();
    await service.recordLevel({ skill: "sql", level: 3 });
    const provider = model();

    const started = await service.startAiDiagnostic("sql", provider, "m");

    expect(provider.requests).toEqual([]);
    if (!started.ok) throw new Error(started.error.kind);
    expect(started.value).toMatchObject({
      skill: "sql",
      start: 3,
      model: "fake/m",
      asked: 0,
      finishing: false,
    });
    const record = session(service, started.value.location);
    expect(record).toMatchObject({
      workflow: AI_LED_WORKFLOW,
      status: "in-progress",
      diagnostic: { skill: "sql", start: 3, rule: "two-right-to-settle@1", model: "fake/m" },
      steps: [],
    });
    expect(record.considered?.evidence.map((one) => one.evidence)).toEqual([EVIDENCE_ID]);
    expect(record.considered?.evidence[0]?.sent).toMatch(/^sha256:[0-9a-f]{64}$/);
    const claimed = service.records().find((r) => r.record.schema === "skill-record/1")?.record;
    expect(record.considered?.claims).toEqual(
      claimed?.schema === "skill-record/1" ? claimed.entries.map((entry) => entry.id) : [],
    );
  });

  it("starts at level 2 when no level is shown, and resumes the one in progress rather than starting another", async () => {
    const { service } = await profile();
    const first = await service.startAiDiagnostic("sql", model(), "m");
    const again = await service.startAiDiagnostic("sql", model(), "m");

    expect(first.ok && first.value.start).toBe(2);
    expect(again.ok && first.ok && again.value.location).toBe(first.ok ? first.value.location : "");
    expect(service.aiDiagnosticInProgress("sql")?.location).toBe(first.ok ? first.value.location : "");
  });

  it("tests only skills in Pharoam's vocabulary", async () => {
    const { service } = await profile();
    expect(await service.startAiDiagnostic("custom-kdb-q", model(), "m")).toEqual({
      ok: false,
      error: { kind: "not-covered", skill: "custom-kdb-q" },
    });
  });
});

describe("taking an AI-led diagnostic (MVP S23.1–S23.5)", () => {
  it("shows each call before sending it, then saves the question chosen to the session and logs the call", async () => {
    const { service, storage } = await profile();
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    const { location } = started.value;
    const before = storage.text(location);
    const provider = model();
    const calls: CallRecord[] = [];

    const shown = await take(service, location, {}, provider, calls);
    expect(shown.pause.kind).toBe("approve");
    expect(provider.requests).toEqual([]);
    expect(storage.text(location)).toBe(before);

    const asked = await approveShown(service, location, provider, calls);
    expect(provider.requests).toHaveLength(1);
    expect(calls.map((call) => call.task)).toEqual(["write-diagnostic-item@1"]);
    expect(asked.pause).toMatchObject({ kind: "answer", posed: { item: "sql-2-a", level: 2 } });
    expect(session(service, location).posed).toMatchObject({ item: "sql-2-a", chosen: { model: "fake/m" } });
  });

  it("resumes after a reload from the session record alone, at the same question (S23.5)", async () => {
    const { service, storage } = await profile();
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    const asked = await approveShown(service, started.value.location);

    const reloaded = await open(storage);
    const provider = model();
    const resumed = await take(reloaded, started.value.location, {}, provider);

    expect(resumed.pause).toEqual(asked.pause);
    expect(provider.requests).toEqual([]);
  });

  it("goes on only with the model chosen at the start", async () => {
    const { service } = await profile();
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    const other = model("cloud");

    const turned = await service.aiDiagnosticTurn(started.value.location, {}, other, NOW);

    expect(turned).toEqual({ ok: false, error: { kind: "other-model", model: "fake/m" } });
    expect(other.requests).toEqual([]);
  });

  it("stops when evidence it considered has changed since it started, rather than send something else", async () => {
    const { service, storage } = await profile();
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    await storage.putOutside(
      "evidence/payments.md",
      EVIDENCE.replace("reporting queries", "billing queries"),
    );
    const reloaded = await open(storage);

    const turned = await reloaded.aiDiagnosticTurn(started.value.location, {}, model(), NOW);

    expect(turned).toEqual({
      ok: false,
      error: { kind: "material-changed", location: started.value.location },
    });
  });

  it("passes on why an answer wasn't taken", async () => {
    const { service } = await profile();
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);

    const turned = await service.aiDiagnosticTurn(started.value.location, { answer: 1 }, model(), NOW);

    expect(turned).toEqual({ ok: false, error: { kind: "nothing-posed" } });
  });

  it("can be abandoned, keeping its session and writing no result", async () => {
    const { service } = await profile();
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    await approveShown(service, started.value.location);

    expect(await service.abandonDiagnostic(started.value.location)).toEqual({ ok: true, value: undefined });
    expect(session(service, started.value.location).status).toBe("abandoned");
    expect(service.aiDiagnosticInProgress("sql")).toBeUndefined();
    expect(await service.aiDiagnosticTurn(started.value.location, {}, model(), NOW)).toEqual({
      ok: false,
      error: { kind: "not-in-progress", location: started.value.location },
    });
  });
});

describe("ending an AI-led diagnostic (MVP S23.3, S23.4)", () => {
  it("writes its assessment evidence and an ai-correlated observation once explained, with no acceptance step", async () => {
    const { service } = await profile();
    await service.recordLevel({ skill: "sql", level: 4 });
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    const { location } = started.value;

    // Two right answers at level 4 settle it there.
    for (let question = 0; question < 2; question++) {
      await approveShown(service, location);
      await take(service, location, { answer: 1 });
    }
    const ended = await approveShown(service, location);

    expect(ended.pause).toEqual({ kind: "explained", result: 4 });
    const outcome = ended.outcome;
    if (outcome === undefined) throw new Error("No outcome.");
    expect(outcome.result).toBe(4);
    // What it considered, in words, for the result and its record (S23.3).
    expect(outcome.considered).toEqual({
      evidence: [{ id: EVIDENCE_ID, title: "Payments reporting" }],
      claims: [{ level: 4, provenance: "self-reported", since: "2026-11-23" }],
      earlier: [],
    });
    const evidence = outcome.evidence.record;
    expect(evidence).toMatchObject({
      schema: "evidence/1",
      kind: "assessment",
      title: "SQL AI-led diagnostic",
      diagnostic: { type: "ai-led", skill: "sql", start: 4 },
      result: 4,
      rule: "two-right-to-settle@1",
      explanation: EXPLANATION,
      ai: { task: "explain-diagnostic@1", model: "fake/m" },
      considered: { evidence: [{ evidence: EVIDENCE_ID }] },
    });
    // Every item in full, with the call that chose it and why (S23.4).
    expect(evidence.schema === "evidence/1" && evidence.kind === "assessment" && evidence.steps).toEqual(
      outcome.steps,
    );
    expect(outcome.steps).toHaveLength(2);
    expect(outcome.steps[0]).toMatchObject({
      prompt: "Which is it at 4?",
      options: ["a", "b", "c"],
      chosen: { task: "write-diagnostic-item@1" },
      why: "Probes joins.",
    });
    expect(service.find(evidence.id)?.recordIntegrity).toEqual({ kind: "intact" });
    const sql = service.records().find((r) => r.record.schema === "skill-record/1");
    if (sql?.record.schema !== "skill-record/1") throw new Error("No skill record.");
    expect(sql.record.entries.at(-1)).toMatchObject({
      provenance: "ai-correlated",
      level: 4,
      assessment: evidence.id,
      ai: { task: "explain-diagnostic@1" },
    });
    expect(session(service, location).status).toBe("completed");
    expect(service.aiDiagnosticInProgress("sql")).toBeUndefined();
  });
});

describe("what an AI-led diagnostic considers, and finishing after a failed write", () => {
  const AI = (task: string) => `{ task: ${task}, model: fake/m, at: 2026-11-23T10:00:00Z }`;
  const step = (part: string) =>
    `  - { source: bank, item: sql-4-${part}, format: mcq, level: 4, prompt: Which is it at 4?, options: [a, b, c], chosen: ${AI("write-diagnostic-item@1")}, why: Probes joins., answer: 1, correct: true }`;
  const RESULT_ID = "0192f3a1-0000-7000-8000-000000000099";
  // A diagnostic explained, whose result's ID was chosen but whose result was never written.
  const FINISHING = [
    "---",
    "schema: session/1",
    "id: 0192f3a1-0000-7000-8000-000000000098",
    "created: 2026-11-23T09:00:00Z",
    "workflow: ai-led-diagnostic@1",
    "status: in-progress",
    "diagnostic: { skill: sql, start: 4, rule: two-right-to-settle@1, model: fake/m }",
    "considered: { evidence: [], claims: [], earlier: [] }",
    "steps:",
    step("a"),
    step("b"),
    `explanation: { showed: Joins are solid., comparison: As you claimed., reasons: [], next_step: Try., ai: ${AI("explain-diagnostic@1")} }`,
    `assessment: ${RESULT_ID}`,
    "---",
    "",
  ].join("\n");
  const EARLIER_ID = "0192f3a1-0000-7000-8000-000000000097";
  const EARLIER = [
    "---",
    "schema: evidence/1",
    `id: ${EARLIER_ID}`,
    "created: 2026-11-15T10:00:00Z",
    "kind: assessment",
    "title: SQL diagnostic",
    "date: 2026-11-15",
    "skills: [sql]",
    "diagnostic: { type: question-bank, skill: sql, start: 2 }",
    "steps:",
    "  - { item: sql-2-a, level: 2, answer: 1, correct: true }",
    "  - { item: sql-2-b, level: 2, answer: 1, correct: true }",
    "result: 2",
    "rule: two-right-to-settle@1",
    "---",
    "",
  ].join("\n");

  it("sends earlier question-bank results as the person's earlier results (S23.1)", async () => {
    const { service } = await profile({
      "evidence/payments.md": EVIDENCE,
      "evidence/sql-diagnostic.md": EARLIER,
    });
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    expect(session(service, started.value.location).considered?.earlier).toEqual([EARLIER_ID]);

    const shown = await take(service, started.value.location, {});

    if (shown.pause.kind !== "approve") throw new Error(shown.pause.kind);
    expect(shown.pause.call.parts).toContainEqual({
      kind: "earlier-results",
      text: "Level 2, question-bank diagnostic, 2026-11-15",
    });
  });

  it("stops when a claim it considered has gone since it started", async () => {
    const { service, storage } = await profile();
    await service.recordLevel({ skill: "sql", level: 3 });
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    const sql = service.records().find((r) => r.record.schema === "skill-record/1");
    await storage.removeOutside(sql?.location ?? "");
    const reloaded = await open(storage);

    const turned = await reloaded.aiDiagnosticTurn(started.value.location, {}, model(), NOW);

    expect(turned).toEqual({
      ok: false,
      error: { kind: "material-changed", location: started.value.location },
    });
  });

  it("writes a result whose ID was chosen but which was never written, and won't abandon it meanwhile", async () => {
    const { service } = await profile({ "sessions/ai-led.md": FINISHING });
    expect(service.aiDiagnosticInProgress("sql")).toMatchObject({ finishing: true, asked: 2 });
    expect(await service.abandonDiagnostic("sessions/ai-led.md")).toEqual({
      ok: false,
      error: { kind: "finishing", location: "sessions/ai-led.md" },
    });
    const provider = model();

    const finished = await take(service, "sessions/ai-led.md", {}, provider);

    expect(provider.requests).toEqual([]);
    expect(finished.pause).toEqual({ kind: "explained", result: 4 });
    expect(finished.outcome?.evidence.record.id).toBe(RESULT_ID);
    expect(session(service, "sessions/ai-led.md").status).toBe("completed");
  });

  it("finishes writing its result with any provider, as writing it calls no model", async () => {
    const { service } = await profile({ "sessions/ai-led.md": FINISHING });
    const other = model("cloud");

    const finished = await take(service, "sessions/ai-led.md", {}, other);

    expect(other.requests).toEqual([]);
    expect(finished.outcome?.evidence.record.id).toBe(RESULT_ID);
  });

  it("leaves out an earlier result dated only to the month, rather than stop at the first turn", async () => {
    const monthOnly = EARLIER.replace("date: 2026-11-15", "date: 2026-11");
    const { service } = await profile({
      "evidence/payments.md": EVIDENCE,
      "evidence/sql-diagnostic.md": monthOnly,
    });
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    expect(session(service, started.value.location).considered?.earlier).toEqual([]);

    const shown = await take(service, started.value.location, {});

    expect(shown.pause.kind).toBe("approve");
  });

  it("stops when an earlier result it considered has gone", async () => {
    const { service, storage } = await profile({
      "evidence/payments.md": EVIDENCE,
      "evidence/sql-diagnostic.md": EARLIER,
    });
    const started = await service.startAiDiagnostic("sql", model(), "m");
    if (!started.ok) throw new Error(started.error.kind);
    await storage.removeOutside("evidence/sql-diagnostic.md");
    const reloaded = await open(storage);

    expect(await reloaded.aiDiagnosticTurn(started.value.location, {}, model(), NOW)).toEqual({
      ok: false,
      error: { kind: "material-changed", location: started.value.location },
    });
  });
});

describe("an AI-led diagnostic's written answers, failures and changes (MVP S23.1–S23.5)", () => {
  async function started(service: CoreService, provider = model()) {
    const begun = await service.startAiDiagnostic("sql", provider, "m");
    if (!begun.ok) throw new Error(begun.error.kind);
    return begun.value.location;
  }

  it("keeps a written answer through a reload, then marks it once the person agrees to send it", async () => {
    const { service, storage } = await profile();
    const writing = model("fake", { open: true });
    const location = await started(service, writing);
    await approveShown(service, location, writing);
    const waiting = await take(service, location, { answer: "RANK() OVER (PARTITION BY customer)" }, writing);
    expect(waiting.pause).toMatchObject({ kind: "approve", call: { task: "mark-diagnostic-answer@1" } });
    expect(session(service, location).answer).toBe("RANK() OVER (PARTITION BY customer)");

    const reloaded = await open(storage);
    const calls: CallRecord[] = [];
    const marked = await approveShown(reloaded, location, writing, calls);

    expect(calls.map((call) => call.task)).toEqual(["mark-diagnostic-answer@1"]);
    expect(marked.view.answer).toBeUndefined();
    expect(session(reloaded, location).steps).toMatchObject([
      {
        source: "written",
        format: "open",
        answer: "RANK() OVER (PARTITION BY customer)",
        correct: true,
        reasons: "Partitions by customer.",
        marked: { task: "mark-diagnostic-answer@1", model: "fake/m" },
      },
    ]);
  });

  it("logs a failed call and saves nothing, so the same call can be tried again", async () => {
    const { service, storage } = await profile();
    const location = await started(service);
    const before = storage.text(location);
    const calls: CallRecord[] = [];
    const offline = model("fake", { fail: true });

    const failed = await approveShown(service, location, offline, calls);

    expect(failed.pause.kind).toBe("failed");
    expect(calls.map((call) => `${call.task} ${call.outcome}`)).toEqual(["write-diagnostic-item@1 failed"]);
    expect(storage.text(location)).toBe(before);
  });

  it("abandons only once a turn in flight has finished, saving nothing after (S23.5)", async () => {
    const { service } = await profile();
    const location = await started(service);
    const shown = await take(service, location, {});
    if (shown.pause.kind !== "approve") throw new Error(shown.pause.kind);
    let release: () => void = () => undefined;
    const slow = model("fake", { gate: new Promise<void>((resolve) => (release = resolve)) });
    const order: string[] = [];

    const turn = service
      .aiDiagnosticTurn(
        location,
        { approve: { call: shown.pause.call, model: shown.pause.model } },
        slow,
        NOW,
      )
      .then(() => order.push("turn"));
    const abandon = service.abandonDiagnostic(location).then(() => order.push("abandon"));
    release();
    await Promise.all([turn, abandon]);

    expect(order).toEqual(["turn", "abandon"]);
    expect(session(service, location)).toMatchObject({ status: "abandoned", posed: { item: "sql-2-a" } });
  });

  it("stops when a claim it considered was retracted, or evidence was unlinked from the skill", async () => {
    const { service } = await profile();
    const claimed = await service.recordLevel({ skill: "sql", level: 3 });
    const location = await started(service);
    const claim =
      claimed.ok && claimed.value.record.schema === "skill-record/1"
        ? claimed.value.record.entries[0]
        : undefined;
    await service.retractLevel(claim?.id ?? "");
    expect(await service.aiDiagnosticTurn(location, {}, model(), NOW)).toEqual({
      ok: false,
      error: { kind: "material-changed", location },
    });

    const fresh = await profile();
    const second = await started(fresh.service);
    await fresh.storage.putOutside("evidence/payments.md", EVIDENCE.replace("skills: [sql]", "skills: []"));
    const reloaded = await open(fresh.storage);
    expect(await reloaded.aiDiagnosticTurn(second, {}, model(), NOW)).toEqual({
      ok: false,
      error: { kind: "material-changed", location: second },
    });
  });

  it("goes on only with the model it started with, and says so when asked to start with another", async () => {
    const { service } = await profile();
    await started(service);
    expect(await service.startAiDiagnostic("sql", model("cloud"), "big")).toEqual({
      ok: false,
      error: { kind: "other-model", model: "fake/m" },
    });
  });

  it("says the skill is no longer covered when it was retired since the diagnostic started", async () => {
    const { service, storage } = await profile();
    const location = await started(service);
    const reloaded = await open(storage, pack({ retired: true }));
    expect(await reloaded.aiDiagnosticTurn(location, {}, model(), NOW)).toEqual({
      ok: false,
      error: { kind: "not-covered", skill: "sql" },
    });
  });

  it("sends the person's latest claim by when it was made, not by where it sits in the file", async () => {
    const entry = (id: string, level: number, at: string) =>
      `  - { id: ${id}, level: ${String(level)}, provenance: self-reported, observed_at: ${at} }`;
    const RECORD = [
      "---",
      "schema: skill-record/1",
      "id: 0192f3a1-0000-7000-8000-000000000080",
      "created: 2026-11-01T10:00:00Z",
      "skill: sql",
      "entries:",
      entry("0192f3a1-0000-7000-8000-000000000082", 4, "2026-11-20T10:00:00Z"),
      entry("0192f3a1-0000-7000-8000-000000000081", 1, "2026-11-02T10:00:00Z"),
      "---",
      "",
    ].join("\n");
    const { service } = await profile({ "evidence/payments.md": EVIDENCE, "skills/sql.md": RECORD });
    const location = await started(service);
    expect(session(service, location).considered?.claims).toEqual(["0192f3a1-0000-7000-8000-000000000082"]);
  });
});

describe("an AI-led diagnostic changed outside Pharoam during a turn (hard rule 3)", () => {
  it("never writes over the session when it changed in storage while a call ran", async () => {
    const { service, storage } = await profile();
    const begun = await service.startAiDiagnostic("sql", model(), "m");
    if (!begun.ok) throw new Error(begun.error.kind);
    const { location } = begun.value;
    const shown = await take(service, location, {});
    if (shown.pause.kind !== "approve") throw new Error(shown.pause.kind);
    let release: () => void = () => undefined;
    const slow = model("fake", { gate: new Promise<void>((resolve) => (release = resolve)) });

    const turn = service.aiDiagnosticTurn(
      location,
      { approve: { call: shown.pause.call, model: shown.pause.model } },
      slow,
      NOW,
    );
    const theirs = (storage.text(location) ?? "").replace("status: in-progress", "status: abandoned");
    await storage.putOutside(location, theirs);
    await service.open();
    release();

    expect(await turn).toEqual({ ok: false, error: { kind: "conflict", location } });
    expect(storage.text(location)).toBe(theirs);
  });
});

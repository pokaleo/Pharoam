import { describe, expect, it } from "vitest";
import { LEVELS_FILE, PACK_FILE, PATHWAY_FILE, SKILL_FILE } from "./__fixtures__/content-records.ts";
import { createCoreService, type AssessmentWriter, type CoreService } from "./core-service.ts";
import { QUESTION_BANK_RULE, QUESTION_BANK_WORKFLOW } from "./diagnostic.ts";
import { checkRecord } from "./integrity.ts";
import { compileContentPack, type ContentPack } from "./pack.ts";
import { parseRecordFile } from "./record-file.ts";
import { createMemoryConnector, type MemoryConnector } from "./testing/memory-connector.ts";

const skill = (slug: string, name: string): string =>
  `---\nschema: skill/1\nslug: ${slug}\nname: ${name}\ndomain: Test\norigin: { source: Pharoam, licence: MIT }\n---\n`;

// Three SQL items at each level, the right answer always option 1.
const item = (level: number, part: string): string =>
  `---\nschema: assessment-item/1\nslug: sql-${String(level)}-${part}\nskills: [sql]\nlevel: ${String(level)}\nformat: mcq\nprompt: Which is it?\noptions: [a, b, c]\nanswer: 1\nexplanation: Because b.\norigin: { source: Pharoam content, licence: CC-BY-SA-4.0 }\nreview: { by: The Pharoam founder, at: 2026-11-15 }\n---\n`;

function pack(levels: readonly number[] = [0, 1, 2, 3, 4]): ContentPack {
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
    ...levels.flatMap((level) =>
      ["a", "b", "c"].map((part) => ({
        path: `content/items/sql/sql-${String(level)}-${part}.md`,
        text: item(level, part),
      })),
    ),
  ]);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.error.problems));
  return compiled.value;
}

const WRITER: AssessmentWriter = (facts) => ({
  title: `${facts.name} diagnostic`,
  body: `Result: ${String(facts.result)} by ${facts.rule}, over ${String(facts.steps.length)} questions.`,
});

async function profile(
  files: Readonly<Record<string, string>> = {},
  levels?: readonly number[],
): Promise<{
  service: CoreService;
  storage: MemoryConnector;
  clock: { now: number };
}> {
  const clock = { now: Date.UTC(2026, 10, 15, 10, 0, 0) };
  const storage = createMemoryConnector(files);
  const service = createCoreService({
    storage: storage.connector,
    ids: { now: () => clock.now, fillRandom: (bytes: Uint8Array) => bytes.fill(7) },
    overview: () => "",
    content: pack(levels),
    gapSummary: () => "",
  });
  await service.open();
  return { service, storage, clock };
}

const session = (service: CoreService, location: string) => {
  const found = service.records().find((r) => r.location === location);
  if (found?.record.schema !== "session/1") throw new Error("No session.");
  return found.record;
};

const assessments = (service: CoreService) =>
  service.records().filter((r) => r.record.schema === "evidence/1" && r.record.kind === "assessment");

// Answers the question posed, right or wrong, and returns what came next.
async function answer(service: CoreService, location: string, right: boolean) {
  const posed = service.diagnosticInProgress("sql");
  if (posed?.item === undefined) throw new Error("Nothing posed.");
  return service.answerDiagnostic(location, posed.item.slug, right ? 1 : 0, WRITER);
}

describe("starting a question-bank diagnostic (MVP S19.1, S19.6)", () => {
  it("starts at level 2 for a skill with no level, writing only its session, with the first question posed", async () => {
    const { service, storage } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);

    expect(started.value).toMatchObject({ skill: "sql", start: 2, asked: 0, item: { level: 2 } });
    const record = session(service, started.value.location);
    expect(record).toMatchObject({
      workflow: QUESTION_BANK_WORKFLOW,
      status: "in-progress",
      diagnostic: { skill: "sql", start: 2, rule: QUESTION_BANK_RULE },
      steps: [],
      next: started.value.item?.slug,
    });
    expect(storage.writes()).toBe(1);
  });

  it("starts at the skill's shown level", async () => {
    const { service } = await profile();
    await service.recordLevel({ skill: "sql", level: 3 });
    const started = await service.startDiagnostic("sql");
    expect(started.ok && started.value.start).toBe(3);
  });

  it("says when the bank doesn't cover a skill, and starts nothing", async () => {
    const { service, storage } = await profile();
    expect(service.bankCovers("sql")).toBe(true);
    expect(service.bankCovers("docker")).toBe(false);
    expect(await service.startDiagnostic("docker")).toEqual({
      ok: false,
      error: { kind: "not-covered", skill: "docker" },
    });
    expect(storage.writes()).toBe(0);
  });

  it("resumes a diagnostic in progress instead of starting another, even after the profile is read again", async () => {
    const { service, storage } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    await answer(service, started.value.location, true);
    await service.open();

    const again = await service.startDiagnostic("sql");

    expect(again.ok && again.value).toMatchObject({
      location: started.value.location,
      asked: 1,
      item: { level: 3 },
    });
    expect(storage.writes()).toBe(2);
  });
});

describe("answering (MVP S19.2, S19.3)", () => {
  it("records each answer in the session and poses the next question by the rule", async () => {
    const { service } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);

    const next = await answer(service, started.value.location, true);

    expect(next.ok && next.value).toMatchObject({ kind: "ask", view: { asked: 1, item: { level: 3 } } });
    expect(session(service, started.value.location).steps).toEqual([
      { item: started.value.item?.slug, level: 2, answer: 1, correct: true },
    ]);
  });

  it("refuses an answer to a question that isn't the one posed, as a second click would send", async () => {
    const { service } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const slug = started.value.item?.slug ?? "";
    await service.answerDiagnostic(started.value.location, slug, 1, WRITER);

    const again = await service.answerDiagnostic(started.value.location, slug, 1, WRITER);

    expect(again).toEqual({ ok: false, error: { kind: "not-posed", item: slug } });
    expect(session(service, started.value.location).steps).toHaveLength(1);
  });
});

describe("the result (MVP S19.4, S19.5)", () => {
  async function finished() {
    const found = await profile();
    const started = await found.service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const { location } = started.value;
    for (const right of [true, false, true]) await answer(found.service, location, right);
    const end = await answer(found.service, location, false);
    return { ...found, location, end };
  }

  it("writes one assessment record with the path, the result and the rule, fingerprinted", async () => {
    const { service, storage, end } = await finished();
    if (!end.ok || end.value.kind !== "end") throw new Error("Not ended.");
    expect(end.value.outcome).toMatchObject({ result: 2 });

    const [evidence] = assessments(service);
    if (evidence === undefined) throw new Error("No assessment.");
    const file = parseRecordFile(storage.text(evidence.location) ?? "");
    if (!file.ok) throw new Error("Unreadable.");
    expect(file.value.top).toMatchObject({
      kind: "assessment",
      title: "SQL diagnostic",
      date: "2026-11-15",
      skills: ["sql"],
      diagnostic: { type: "question-bank", skill: "sql", start: 2 },
      result: 2,
      rule: QUESTION_BANK_RULE,
    });
    expect((file.value.top.steps as unknown[]).length).toBe(4);
    expect(file.value.body).toContain("Result: 2 by two-right-to-settle@1, over 4 questions.");
    expect(checkRecord(file.value.top, file.value.body)).toEqual({ kind: "intact" });
  });

  it("appends a demonstrated observation linking to it, with no acceptance, which becomes the shown level", async () => {
    const { service, end } = await finished();
    if (!end.ok || end.value.kind !== "end") throw new Error("Not ended.");
    const [evidence] = assessments(service);
    const history = service.skillHistory("sql");
    expect(history[0]).toMatchObject({
      kind: "observation",
      entry: { level: 2, provenance: "demonstrated", assessment: evidence?.record.id },
      shown: true,
      integrity: { kind: "intact" },
    });
  });

  it("completes the session, so nothing is in progress", async () => {
    const { service, location } = await finished();
    expect(session(service, location)).toMatchObject({ status: "completed" });
    expect(session(service, location).next).toBeUndefined();
    expect(service.diagnosticInProgress("sql")).toBeUndefined();
  });

  it("draws items not seen before when the diagnostic is taken again (S19.7)", async () => {
    const { service, location } = await finished();
    const seen = new Set(session(service, location).steps.map((step) => step.item));
    const again = await service.startDiagnostic("sql");
    expect(again.ok && seen.has(again.value.item?.slug ?? "")).toBe(false);
  });
});

describe("abandoning and finishing safely (MVP S19.6)", () => {
  it("abandons a diagnostic, keeping its session as abandoned and writing no result", async () => {
    const { service } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    await answer(service, started.value.location, true);

    const abandoned = await service.abandonDiagnostic(started.value.location);

    expect(abandoned.ok).toBe(true);
    expect(session(service, started.value.location).status).toBe("abandoned");
    expect(assessments(service)).toHaveLength(0);
    expect(service.skillHistory("sql")).toEqual([]);
    expect(service.diagnosticInProgress("sql")).toBeUndefined();
  });

  it("finishes again after a failed write without writing the result twice", async () => {
    const { service, storage } = await profile();
    await service.recordLevel({ skill: "sql", level: 2 });
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const { location } = started.value;
    for (const right of [true, false, true]) await answer(service, location, right);
    // The skill record changes in another app, so appending the result's observation fails.
    const sql = service.records().find((r) => r.record.schema === "skill-record/1");
    await storage.putOutside(sql?.location ?? "", `${storage.text(sql?.location ?? "") ?? ""}\n`);

    const end = await answer(service, location, false);

    expect(end.ok).toBe(false);
    expect(assessments(service)).toHaveLength(1);
    const waiting = service.diagnosticInProgress("sql");
    expect(waiting).toMatchObject({ location, asked: 4 });
    expect(waiting?.item).toBeUndefined();

    await service.open();
    const finished = await service.finishDiagnostic(location, WRITER);

    expect(finished.ok && finished.value.result).toBe(2);
    expect(assessments(service)).toHaveLength(1);
    expect(
      service
        .skillHistory("sql")
        .filter((one) => one.kind === "observation" && one.entry.provenance === "demonstrated"),
    ).toHaveLength(1);
  });
});

describe("diagnostics under pressure (review findings)", () => {
  it("answers a question once when two answers are sent before the first is saved", async () => {
    const { service } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const slug = started.value.item?.slug ?? "";

    const [first, second] = await Promise.all([
      service.answerDiagnostic(started.value.location, slug, 1, WRITER),
      service.answerDiagnostic(started.value.location, slug, 1, WRITER),
    ]);

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, error: { kind: "not-posed", item: slug } });
    expect(session(service, started.value.location).steps).toHaveLength(1);
    expect(service.needsAttention()).toEqual([]);
  });

  it("starts one diagnostic when starting is asked twice at once", async () => {
    const { service } = await profile();
    const [first, second] = await Promise.all([
      service.startDiagnostic("sql"),
      service.startDiagnostic("sql"),
    ]);
    expect(first.ok && second.ok && first.value.location === second.value.location).toBe(true);
    expect(service.records().filter((r) => r.record.schema === "session/1")).toHaveLength(1);
  });

  it("refuses an answer that names no option", async () => {
    const { service } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const slug = started.value.item?.slug ?? "";
    expect(await service.answerDiagnostic(started.value.location, slug, 3, WRITER)).toEqual({
      ok: false,
      error: { kind: "not-an-option", answer: 3 },
    });
    expect(session(service, started.value.location).steps).toEqual([]);
  });

  it("poses another question when the one posed has left the question bank", async () => {
    const { service, storage } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const { location } = started.value;
    await storage.putOutside(
      location,
      (storage.text(location) ?? "").replace(/next: \S+/, "next: sql-2-gone"),
    );
    await service.open();
    expect(service.diagnosticInProgress("sql")?.item).toBeUndefined();

    const resumed = await service.startDiagnostic("sql");

    expect(resumed.ok && resumed.value).toMatchObject({ location, item: { level: 2 } });
    expect(session(service, location).next).not.toBe("sql-2-gone");
  });

  it("starts at the nearest level the bank has items for", async () => {
    // The bank has no level 4 items, and the person's shown level is 4.
    const { service } = await profile({}, [0, 1, 2, 3]);
    await service.recordLevel({ skill: "sql", level: 4 });
    const started = await service.startDiagnostic("sql");
    expect(started.ok && started.value).toMatchObject({ start: 3, item: { level: 3 } });
  });

  it("won't abandon a diagnostic whose result is being written, and points to finishing it", async () => {
    const { service, storage } = await profile();
    await service.recordLevel({ skill: "sql", level: 2 });
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const { location } = started.value;
    for (const right of [true, false, true]) await answer(service, location, right);
    const sql = service.records().find((r) => r.record.schema === "skill-record/1");
    await storage.putOutside(sql?.location ?? "", `${storage.text(sql?.location ?? "") ?? ""}\n`);
    await answer(service, location, false);

    expect(await service.abandonDiagnostic(location)).toEqual({
      ok: false,
      error: { kind: "finishing", location },
    });
  });

  it("labels a diagnostic's record changed outside Pharoam", async () => {
    const { service, storage } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    for (const right of [true, false, true, false]) await answer(service, started.value.location, right);
    const [evidence] = assessments(service);
    if (evidence === undefined) throw new Error("No assessment.");
    expect(evidence.recordIntegrity).toEqual({ kind: "intact" });

    await storage.putOutside(
      evidence.location,
      (storage.text(evidence.location) ?? "").replace("result: 2", "result: 4"),
    );
    await service.open();

    expect(service.find(evidence.record.id)?.recordIntegrity).toEqual({
      kind: "edited-outside",
      reason: "changed",
    });
  });

  it("counts items seen in an abandoned attempt as seen, so a retake draws others (S19.7)", async () => {
    const { service } = await profile();
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    const first = started.value.item?.slug;
    await service.abandonDiagnostic(started.value.location);

    const again = await service.startDiagnostic("sql");

    expect(again.ok && again.value.item?.slug).not.toBe(first);
  });
});

describe("what the screens need to know (review findings)", () => {
  it("says where a diagnostic would start: the shown level, or the nearest the bank covers", async () => {
    const { service } = await profile({}, [0, 1, 2, 3]);
    expect(service.diagnosticStart("sql")).toBe(2);
    await service.recordLevel({ skill: "sql", level: 4 });
    expect(service.diagnosticStart("sql")).toBe(3);
    expect(service.diagnosticStart("docker")).toBeUndefined();
  });

  it("says whether a diagnostic waits for an answer or for its result to be written", async () => {
    const { service, storage } = await profile();
    await service.recordLevel({ skill: "sql", level: 2 });
    const started = await service.startDiagnostic("sql");
    if (!started.ok) throw new Error(started.error.kind);
    expect(started.value.finishing).toBe(false);
    for (const right of [true, false, true]) await answer(service, started.value.location, right);
    const sql = service.records().find((r) => r.record.schema === "skill-record/1");
    await storage.putOutside(sql?.location ?? "", `${storage.text(sql?.location ?? "") ?? ""}\n`);
    await answer(service, started.value.location, false);

    expect(service.diagnosticInProgress("sql")).toMatchObject({ finishing: true });
    expect(service.diagnosticInProgress("sql")?.item).toBeUndefined();
  });
});

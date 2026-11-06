/**
 * The evidence scan: the calls it makes, and the suggestions their answers become (MVP S16, PRD D1, D2).
 *
 * @remarks Pure functions the core service uses: they build each call and read each answer, and write nothing.
 * Suggestions wait in a review session until the person decides (data model §10).
 * @packageDocumentation
 */
import { judgeSkillLevel } from "./ai/tasks/judge-skill-level.ts";
import { suggestSkillLinks } from "./ai/tasks/suggest-skill-links.ts";
import { prepareCall, type PreparedCall } from "./ai/task.ts";
import type { LoadedRecord } from "./core-service.ts";
import { evidenceText, sentFingerprint } from "./evidence-text.ts";
import type { ContentPack } from "./pack.ts";
import type { EvidenceRecord } from "./schemas/evidence.ts";
import type { AiProvenance } from "./schemas/fields.ts";
import type { Suggestion, SuggestionInput } from "./schemas/session.ts";

/** The workflow every evidence scan's session names (data model §10). */
export const SCAN_WORKFLOW = "evidence-scan@1";

/** A skill as a scan names it to a model. */
interface SkillName {
  readonly slug: string;
  readonly name: string;
}

/** One call of a scan for skill links: one evidence record (MVP S16.1). */
export interface LinkScanCall {
  /** Always `"skill-links"`. */
  readonly kind: "skill-links";
  /** The evidence record's ID. */
  readonly evidence: string;
  /** A fingerprint of what is sent about the record, kept with each suggestion (S16.10). */
  readonly read: string;
  /** The task's input. */
  readonly input: { evidence: string; vocabulary: SkillName[]; custom: SkillName[] };
  /** Exactly what will be sent, for the notice before sending (PRD D4). */
  readonly call: PreparedCall;
}

/** One call of a scan for levels: one skill, with its linked evidence only (MVP S16.2). */
export interface LevelScanCall {
  /** Always `"skill-levels"`. */
  readonly kind: "skill-levels";
  /** The skill's slug. */
  readonly skill: string;
  /** Each evidence record sent: its ID, its reference in the call, and a fingerprint of what was sent. */
  readonly read: readonly { readonly evidence: string; readonly ref: string; readonly sent: string }[];
  /** The task's input. */
  readonly input: {
    skill: string;
    scale: ContentPack["levels"]["levels"];
    evidence: { ref: string; text: string }[];
  };
  /** Exactly what will be sent, for the notice before sending (PRD D4). */
  readonly call: PreparedCall;
}

/** One call of an evidence scan. */
export type ScanCall = LinkScanCall | LevelScanCall;

/** A pending suggestion, as the Review screen lists it (MVP S16.6). */
export interface ReviewItem {
  /** Where its session is stored. */
  readonly session: string;
  /** The suggestion. */
  readonly suggestion: Suggestion;
  /** Whether evidence it was built on changed or went since the scan read it, so it can't be accepted (S16.10). */
  readonly stale: boolean;
}

/**
 * The skills a scan may suggest: Pharoam's active vocabulary.
 *
 * @param content - The content pack.
 * @returns Each active skill's slug and name, in the pack's order.
 */
export function scanVocabulary(content: ContentPack): readonly SkillName[] {
  return content.skills
    .filter((skill) => skill.status === "active")
    .map(({ slug, name }) => ({ slug, name }));
}

/**
 * The person's own skills, by slug and name (MVP S8).
 *
 * @param records - The profile's valid records.
 * @returns Each custom skill.
 */
export function customSkillNames(records: readonly LoadedRecord[]): readonly SkillName[] {
  return records.flatMap(({ record }) =>
    record.schema === "skill-record/1" && record.skill.startsWith("custom-") && record.name !== undefined
      ? [{ slug: record.skill, name: record.name }]
      : [],
  );
}

/**
 * The evidence a scan reads: every evidence record except a diagnostic's, which is never changed and already gives
 * a tested level (data model §4).
 *
 * @param loaded - A valid record.
 * @returns The evidence, or `undefined` for any other record.
 */
export function scannable(loaded: LoadedRecord): EvidenceRecord | undefined {
  const { record } = loaded;
  return record.schema === "evidence/1" && record.kind !== "assessment" ? record : undefined;
}

/**
 * The call asking which skills one record shows (MVP S16.1).
 *
 * @param loaded - The evidence record.
 * @param record - The same record, as Pharoam reads it.
 * @param vocabulary - Pharoam's active skills.
 * @param custom - The person's own skills.
 * @returns The call, ready to show the person and send.
 */
export function linkScanCall(
  loaded: LoadedRecord,
  record: EvidenceRecord,
  vocabulary: readonly SkillName[],
  custom: readonly SkillName[],
): LinkScanCall {
  const text = evidenceText(record, loaded.file.body);
  const input = { evidence: text, vocabulary: [...vocabulary], custom: [...custom] };
  return {
    kind: "skill-links",
    evidence: record.id,
    read: sentFingerprint(text),
    input,
    call: prepareCall(suggestSkillLinks, input),
  };
}

/**
 * The call judging one skill's level from its linked evidence (MVP S16.2).
 *
 * @param skill - The skill's slug.
 * @param description - What the skill is and what each level means for it, as the model reads it.
 * @param scale - Pharoam's shared level scale.
 * @param linked - The skill's linked evidence, with each record's body.
 * @returns The call, ready to show the person and send.
 */
export function levelScanCall(
  skill: string,
  description: string,
  scale: ContentPack["levels"]["levels"],
  linked: readonly { readonly record: EvidenceRecord; readonly body: string }[],
): LevelScanCall {
  const read = linked.map(({ record, body }, index) => {
    const text = evidenceText(record, body);
    return { evidence: record.id, ref: `E${String(index + 1)}`, sent: sentFingerprint(text), text };
  });
  const input = { skill: description, scale, evidence: read.map(({ ref, text }) => ({ ref, text })) };
  return {
    kind: "skill-levels",
    skill,
    read: read.map(({ evidence, ref, sent }) => ({ evidence, ref, sent })),
    input,
    call: prepareCall(judgeSkillLevel, input),
  };
}

/**
 * What a skill is, as a level judgement reads it: its name, what it covers, and what each level means for it.
 *
 * @param skill - The skill's name, its description, and any level descriptions of its own.
 * @returns The text.
 */
export function skillDescription(skill: {
  readonly name: string;
  readonly description?: string | undefined;
  readonly levels?: Readonly<Record<0 | 1 | 2 | 3 | 4, string>> | undefined;
}): string {
  const lines = [`Name: ${skill.name}`];
  if (skill.description !== undefined && skill.description.trim() !== "")
    lines.push(`What it covers: ${skill.description.trim()}`);
  if (skill.levels !== undefined) {
    const { levels } = skill;
    lines.push(
      "What each level means for this skill:",
      ...([0, 1, 2, 3, 4] as const).map((n) => `${String(n)}: ${levels[n]}`),
    );
  }
  return lines.join("\n");
}

/** What one answer becomes: suggestions to decide, and those that would change nothing (MVP S16.11). */
export interface ScanFindings {
  /** New suggestions, pending. */
  readonly suggestions: readonly SuggestionInput[];
  /** Suggestions that would change nothing, listed as already so. */
  readonly already: readonly Readonly<Record<string, unknown>>[];
}

/**
 * Turns an answer about one record into link suggestions (MVP S16.1, S16.11).
 *
 * @remarks A skill on neither list is dropped, not offered; one the record already links is listed as already so;
 * a skill named twice is suggested once.
 * @param call - The call that was answered.
 * @param links - The answer's links.
 * @param ai - The answer's `ai` block.
 * @param known - Every slug the scan may suggest.
 * @param linked - The skills the record already links.
 * @param nextId - Makes a new suggestion's ID.
 * @returns The new suggestions, and those listed as already so.
 */
export function linkFindings(
  call: LinkScanCall,
  links: readonly { readonly skill: string; readonly explanation: string }[],
  ai: AiProvenance,
  known: ReadonlySet<string>,
  linked: readonly string[],
  nextId: () => string,
): ScanFindings {
  const suggestions: SuggestionInput[] = [];
  const already: Readonly<Record<string, unknown>>[] = [];
  const seen = new Set<string>();
  for (const { skill, explanation } of links) {
    if (!known.has(skill) || seen.has(skill)) continue;
    seen.add(skill);
    if (linked.includes(skill)) {
      already.push({ kind: "skill-link", evidence: call.evidence, skill });
      continue;
    }
    suggestions.push({
      id: nextId(),
      kind: "skill-link",
      evidence: call.evidence,
      read: call.read,
      skill,
      explanation,
      ai,
    });
  }
  return { suggestions, already };
}

/**
 * Turns an answer about one skill into a level suggestion, or notes it as already so (MVP S16.2, S16.11).
 *
 * @param call - The call that was answered.
 * @param answer - The answer: the level, its explanation and limits, and the references it rests on.
 * @param ai - The answer's `ai` block.
 * @param shown - The skill's shown level now, if any.
 * @param nextId - Makes a new suggestion's ID.
 * @returns The new suggestion, or the level listed as already so.
 */
export function levelFindings(
  call: LevelScanCall,
  answer: {
    readonly level: number;
    readonly explanation: string;
    readonly limits: string;
    readonly evidence: readonly string[];
  },
  ai: AiProvenance,
  shown: number | undefined,
  nextId: () => string,
): ScanFindings {
  if (answer.level === shown)
    return { suggestions: [], already: [{ kind: "skill-level", skill: call.skill, level: answer.level }] };
  const cited = [...new Set(answer.evidence)].flatMap((ref) => {
    const found = call.read.find((read) => read.ref === ref);
    return found === undefined ? [] : [found.evidence];
  });
  const suggestion: SuggestionInput = {
    id: nextId(),
    kind: "skill-level",
    skill: call.skill,
    level: answer.level,
    explanation: answer.explanation,
    limits: answer.limits,
    evidence: cited,
    read: call.read.map(({ evidence, sent }) => ({ evidence, sent })),
    ai,
  };
  return { suggestions: [suggestion], already: [] };
}

/**
 * Whether evidence a suggestion was built on changed, or went, since the scan read it (MVP S16.10).
 *
 * @param suggestion - A suggestion from a review session.
 * @param evidence - Finds an evidence record and its body by ID, as it is now.
 * @returns `true` when it can't be accepted, only scanned again.
 */
export function isStale(
  suggestion: SuggestionInput,
  evidence: (id: string) => { readonly record: EvidenceRecord; readonly body: string } | undefined,
): boolean {
  const read =
    suggestion.kind === "skill-link"
      ? [{ evidence: suggestion.evidence, sent: suggestion.read }]
      : suggestion.read;
  return read.some(({ evidence: id, sent }) => {
    const now = evidence(id);
    return now === undefined || sentFingerprint(evidenceText(now.record, now.body)) !== sent;
  });
}

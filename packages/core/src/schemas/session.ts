/**
 * The `session` record: a readable log of a workflow in progress, an evidence scan's review or a diagnostic
 * (data model §10).
 *
 * @remarks A scan's suggestions wait here until the person decides (PRD D2). Nothing in a session counts: a skill
 * link is written to the evidence record, and a level to the skill record, only when the person accepts it. Each
 * suggestion keeps what the scan sent, so one whose evidence changed afterwards can't be accepted (MVP S16.10). A
 * diagnostic's session holds every question asked and answered, so it resumes from this record alone (MVP S19.6).
 * @packageDocumentation
 */
import { z } from "zod";
import { AiLedItem, AnyDiagnosticStep, Considered, DiagnosticExplanation, checkSteps } from "./evidence.ts";
import {
  AiProvenance,
  ENVELOPE_FIELDS,
  InventorySkillSlugField,
  LevelField,
  ProfileRecordIdField,
  SentFingerprint,
  SkillSlugField,
  TextField,
  TimestampField,
} from "./fields.ts";

/**
 * What the person decided: accepted, discarded, or adjusted by recording their own level instead (PRD D2).
 *
 * @remarks A skipped suggestion has no decision: it stays pending and never counts (Charter R5).
 */
const Decision = z.literal(["accepted", "discarded", "adjusted"]);

const SUGGESTION_FIELDS = {
  id: ProfileRecordIdField,
  skill: SkillSlugField,
  explanation: TextField,
  ai: AiProvenance,
  decision: Decision.optional(),
  decided_at: TimestampField.optional(),
};

/** A skill the scan suggests one evidence record shows (MVP S16.1). */
export const LinkSuggestion = z.object({
  ...SUGGESTION_FIELDS,
  kind: z.literal("skill-link"),
  evidence: ProfileRecordIdField,
  read: SentFingerprint,
});

/** A level the scan suggests for one skill, from that skill's linked evidence only (MVP S16.2, S16.3). */
export const LevelSuggestion = z.object({
  ...SUGGESTION_FIELDS,
  kind: z.literal("skill-level"),
  level: LevelField,
  limits: TextField,
  /** The evidence the judgement rests on: always some of what it was sent. */
  evidence: z.array(ProfileRecordIdField).min(1),
  /** Every evidence record the call sent, with a fingerprint of what was sent about it. */
  read: z.array(z.object({ evidence: ProfileRecordIdField, sent: SentFingerprint })).min(1),
});

/** One suggestion awaiting, or with, the person's decision. */
export const Suggestion = z.discriminatedUnion("kind", [LinkSuggestion, LevelSuggestion]);

/** A suggestion as Pharoam reads it. */
export type Suggestion = z.output<typeof Suggestion>;

/** A suggestion as Pharoam writes it, before it is read back. */
export type SuggestionInput = z.input<typeof Suggestion>;

/** A suggestion that would change nothing, listed rather than offered (MVP S16.11). */
const AlreadySo = z.object({
  kind: z.literal(["skill-link", "skill-level"]),
  skill: SkillSlugField,
  evidence: ProfileRecordIdField.optional(),
  level: LevelField.optional(),
});

/** A record or skill whose call failed, set aside without stopping the scan (MVP S16.5). */
const SetAside = z.object({
  evidence: ProfileRecordIdField.optional(),
  skill: SkillSlugField.optional(),
  /** Why, as the kind of failure, such as `unreachable` or `invalid-answer`. */
  reason: z.string().min(1),
});

/** The `session/1` record's top block, for an evidence scan's review session. */
export const SessionRecord = z
  .object({
    schema: z.literal("session/1"),
    ...ENVELOPE_FIELDS,
    /** The workflow and its version, such as `evidence-scan@1` or `question-bank@1`. */
    workflow: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*@[1-9]\d*$/),
    /** An evidence scan's: what it asked for, skill links for evidence records, or levels for skills. */
    scan: z.literal(["skill-links", "skill-levels"]).optional(),
    /** In progress while anything is pending; completed when nothing is; abandoned if the person gave it up. */
    status: z.literal(["in-progress", "completed", "abandoned"]),
    suggestions: z.array(Suggestion).default([]),
    already: z.array(AlreadySo).default([]),
    set_aside: z.array(SetAside).default([]),
    /**
     * A diagnostic's: the skill it tests, the level it started at and the published rule (MVP S19.6), and for an
     * AI-led one the model chosen at the start, which every later call uses, after a reload too (S23.1, S23.5).
     */
    diagnostic: z
      .object({
        skill: InventorySkillSlugField,
        start: LevelField,
        rule: z.string().min(1),
        model: z.string().min(1).optional(),
      })
      .optional(),
    /** A diagnostic's questions asked and answered so far, in order. */
    steps: z.array(AnyDiagnosticStep).default([]),
    /** A question-bank diagnostic's question posed now, by item slug, so the person sees the same one on coming back. */
    next: z.string().min(1).optional(),
    /** An AI-led diagnostic's question posed now, in full, since one the model wrote is in no pack (MVP S23.5). */
    posed: AiLedItem.optional(),
    /** An AI-led diagnostic's answer to the question posed, given and not yet marked, so a reload doesn't lose it. */
    answer: TextField.optional(),
    /** An AI-led diagnostic's: the evidence, claims and earlier results it sent. */
    considered: Considered.optional(),
    /** An AI-led diagnostic's explanation, once given, with the call that wrote it, until its result is written. */
    explanation: DiagnosticExplanation.extend({ ai: AiProvenance }).optional(),
    /**
     * A finished diagnostic's assessment evidence, by the ID chosen before it is written, so finishing again after
     * a failed write never writes the result twice.
     */
    assessment: ProfileRecordIdField.optional(),
  })
  .superRefine((session, ctx) => {
    // Each workflow needs its own fields; a scan's session names its scan, a diagnostic's its diagnostic.
    const name = session.workflow.split("@")[0];
    if (name === "evidence-scan" && session.scan === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["scan"],
        message: "A scan's session names what it scanned for.",
      });
    const diagnostic = name === "question-bank" || name === "ai-led-diagnostic";
    if (diagnostic && session.diagnostic === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["diagnostic"],
        message: "A diagnostic's session names its skill.",
      });
    if (diagnostic) checkSteps(name === "ai-led-diagnostic", session.steps, ctx);
    if (name === "question-bank") checkQuestionBank(session, ctx);
    if (name === "ai-led-diagnostic") checkAiLed(session, ctx);
  });

/** A `session` record as Pharoam reads it. */
export type SessionRecord = z.output<typeof SessionRecord>;

// What the diagnostic checks read of a session.
interface DiagnosticSession {
  readonly status: string;
  readonly diagnostic?: { readonly model?: string | undefined } | undefined;
  readonly steps: readonly { readonly item?: string | undefined }[];
  readonly next?: string | undefined;
  readonly posed?: { readonly format: string; readonly item?: string | undefined } | undefined;
  readonly answer?: string | undefined;
  readonly considered?: unknown;
  readonly explanation?: unknown;
  readonly assessment?: string | undefined;
}

const AI_LED_ONLY = ["posed", "answer", "considered", "explanation"] as const;

// A question-bank session holds none of an AI-led one's fields.
function checkQuestionBank(session: DiagnosticSession, ctx: z.RefinementCtx): void {
  for (const field of AI_LED_ONLY)
    if (session[field] !== undefined)
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "Only an AI-led diagnostic's session has this.",
      });
  if (session.diagnostic?.model !== undefined)
    ctx.addIssue({
      code: "custom",
      path: ["diagnostic", "model"],
      message: "A question-bank diagnostic uses no model.",
    });
}

// An AI-led session is always in one state it can resume from (MVP S23.5): a question posed, maybe with an answer
// waiting for the model's marking; or nothing posed, before a question is chosen or once it is explained; then its
// result's ID chosen, and completed once that is written.
function checkAiLed(session: DiagnosticSession, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) => {
    ctx.addIssue({ code: "custom", path, message });
  };
  if (session.diagnostic !== undefined && session.diagnostic.model === undefined)
    issue(["diagnostic", "model"], "An AI-led diagnostic names the model chosen at its start.");
  if (session.next !== undefined)
    issue(["next"], "An AI-led diagnostic holds the question posed in full, in `posed`.");
  const { posed } = session;
  if (session.answer !== undefined && (posed === undefined || posed.format === "mcq"))
    issue(["answer"], "Only an open question or practical task's answer waits to be marked.");
  if (posed?.item !== undefined && session.steps.some((step) => step.item === posed.item))
    issue(["posed", "item"], "This item was already asked.");
  if (session.explanation !== undefined && posed !== undefined)
    issue(["explanation"], "A diagnostic is explained once nothing is posed.");
  if (session.assessment !== undefined && session.explanation === undefined)
    issue(["assessment"], "An AI-led result is written once it is explained.");
  if (session.status === "completed" && session.assessment === undefined)
    issue(["status"], "A completed AI-led diagnostic has written its result.");
}

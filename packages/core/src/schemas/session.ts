/**
 * The `session` record: a readable review session holding one evidence scan's suggestions (data model §10).
 *
 * @remarks Suggestions wait here until the person decides (PRD D2). Nothing in a session counts: a skill link is
 * written to the evidence record, and a level to the skill record, only when the person accepts it. Each
 * suggestion keeps what the scan sent, so one whose evidence changed afterwards can't be accepted (MVP S16.10).
 * @packageDocumentation
 */
import { z } from "zod";
import {
  AiProvenance,
  ENVELOPE_FIELDS,
  LevelField,
  ProfileRecordIdField,
  SkillSlugField,
  TextField,
  TimestampField,
} from "./fields.ts";

/** A fingerprint of exactly what a scan sent about one evidence record: `sha256:` and 64 hex digits. */
export const SentFingerprint = z.string().regex(/^sha256:[0-9a-f]{64}$/);

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
export const SessionRecord = z.object({
  schema: z.literal("session/1"),
  ...ENVELOPE_FIELDS,
  /** The workflow and its version, such as `evidence-scan@1`. */
  workflow: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*@[1-9]\d*$/),
  /** What the scan asked for: skill links for evidence records, or levels for skills. */
  scan: z.literal(["skill-links", "skill-levels"]),
  /** In progress while anything is pending; completed when nothing is; abandoned if the person gave it up. */
  status: z.literal(["in-progress", "completed", "abandoned"]),
  suggestions: z.array(Suggestion).default([]),
  already: z.array(AlreadySo).default([]),
  set_aside: z.array(SetAside).default([]),
});

/** A `session` record as Pharoam reads it. */
export type SessionRecord = z.output<typeof SessionRecord>;

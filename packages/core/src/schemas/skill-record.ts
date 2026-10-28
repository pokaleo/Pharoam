/**
 * The `skill-record` record: one file per skill, with its append-only history and generated summary.
 *
 * @remarks Observations and reviews are only ever appended, never changed (hard rule 4). `proficiency` is
 * regenerated from them so the file is readable without Pharoam (data model §6).
 * @packageDocumentation
 */
import { z } from "zod";
import {
  AiProvenance,
  CalendarDateField,
  ConfirmedAiProvenance,
  ENVELOPE_FIELDS,
  IntegrityField,
  LevelField,
  ProfileRecordIdField,
  Provenance,
  SkillSlugField,
  TextField,
  TimestampField,
} from "./fields.ts";

const OBSERVATION_FIELDS = {
  id: ProfileRecordIdField,
  level: LevelField,
  observed_at: TimestampField,
  evidence: z.array(ProfileRecordIdField).default([]),
  supersedes: ProfileRecordIdField.optional(),
  integrity: IntegrityField.optional(),
  signature: z.null().optional(),
};

/**
 * One statement about the skill at one level, labelled by where it came from (data model §6).
 *
 * @remarks All four provenances are accepted so later releases need no format change; v0.1 writes only
 * `self-reported`. `ai-judged` needs the person's confirmation, because it is written only when they accept it
 * (PRD D2); `demonstrated` and `ai-correlated` name the diagnostic's evidence record.
 */
export const Observation = z.discriminatedUnion("provenance", [
  z.object({ ...OBSERVATION_FIELDS, provenance: z.literal("self-reported") }),
  z.object({
    ...OBSERVATION_FIELDS,
    provenance: z.literal("ai-judged"),
    explanation: TextField,
    limits: TextField,
    ai: ConfirmedAiProvenance,
  }),
  z.object({
    ...OBSERVATION_FIELDS,
    provenance: z.literal("demonstrated"),
    assessment: ProfileRecordIdField,
  }),
  z.object({
    ...OBSERVATION_FIELDS,
    provenance: z.literal("ai-correlated"),
    assessment: ProfileRecordIdField,
    explanation: TextField,
    ai: AiProvenance,
  }),
]);

/** An observation as Pharoam reads it. */
export type Observation = z.output<typeof Observation>;

/** A decision about an earlier observation; the only one is `retract`, which stops it counting (MVP S7.2). */
export const Review = z.object({
  id: ProfileRecordIdField,
  target: ProfileRecordIdField,
  decision: z.literal("retract"),
  reviewed_at: TimestampField,
  note: z.string().optional(),
  integrity: IntegrityField.optional(),
  signature: z.null().optional(),
});

/** A review as Pharoam reads it. */
export type Review = z.output<typeof Review>;

const LevelSince = z.object({ level: LevelField, since: CalendarDateField });

/**
 * The generated summary of a skill: its one shown level, any newer claim, and the latest level from each source.
 *
 * @remarks There is no blended or calculated level (Charter R4); the shown level is chosen by a fixed order.
 */
export const Proficiency = z.object({
  shown: LevelSince.extend({ provenance: Provenance, observation: ProfileRecordIdField }).optional(),
  "newer-claim": LevelSince.extend({ provenance: z.literal(["self-reported", "ai-judged"]) }).optional(),
  "by-source": z
    .object({
      "self-reported": LevelSince.optional(),
      "ai-judged": LevelSince.optional(),
      demonstrated: LevelSince.optional(),
      "ai-correlated": LevelSince.optional(),
    })
    .default({}),
});

/** A proficiency summary as Pharoam reads it. */
export type Proficiency = z.output<typeof Proficiency>;

/** The `skill-record/1` record's top block. */
export const SkillRecord = z
  .object({
    schema: z.literal("skill-record/1"),
    ...ENVELOPE_FIELDS,
    skill: SkillSlugField,
    name: TextField.optional(),
    description: z.string().optional(),
    entries: z.array(z.union([Observation, Review])).default([]),
    proficiency: Proficiency.optional(),
    target: LevelField.optional(),
  })
  .superRefine((record, ctx) => {
    // A custom skill isn't in the inventory, so its record must say what it is (MVP S8.1).
    if (record.skill.startsWith("custom-") && record.name === undefined) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "A custom skill needs a name." });
    }
  });

/** A `skill-record` as Pharoam reads it. */
export type SkillRecord = z.output<typeof SkillRecord>;

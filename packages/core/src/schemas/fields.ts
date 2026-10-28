/**
 * Field schemas shared by the record schemas: IDs, levels, dates, links, fingerprints and the AI block.
 *
 * @remarks Values arrive as the YAML 1.2 core schema reads them (data model §4), so dates and times are strings.
 * Each field checks its form with a pattern or format that the published JSON Schema can express (ADR-0007).
 * @packageDocumentation
 */
import { z } from "zod";
import {
  PROFILE_RECORD_ID_PATTERN,
  SLUG_PATTERN,
  type PathwaySlug,
  type ProfileRecordId,
  type SkillSlug,
} from "../ids.ts";

/** A reference to a profile record by its UUIDv7 ID (data model §2). */
export const ProfileRecordIdField = z
  .string()
  .regex(PROFILE_RECORD_ID_PATTERN)
  .transform((value) => value as ProfileRecordId);

/** A skill named by its inventory slug, such as `python` or `custom-kdb-q` (data model §9). */
export const SkillSlugField = z
  .string()
  .regex(SLUG_PATTERN)
  .transform((value) => value as SkillSlug);

/**
 * A skill in Pharoam's inventory, named by its slug.
 *
 * @remarks Slugs starting with `custom-` are kept for the person's own skills, which never match a pathway
 * requirement (MVP S8.3).
 */
export const InventorySkillSlugField = z
  .string()
  .regex(SLUG_PATTERN)
  .regex(/^(?!custom-)/, "Slugs starting with custom- are for the person's own skills.")
  .transform((value) => value as SkillSlug);

/** A pathway named by its slug, such as `ml-engineer`. */
export const PathwaySlugField = z
  .string()
  .regex(SLUG_PATTERN)
  .transform((value) => value as PathwaySlug);

/** A skill level: a whole number from 0 to 4, described in the skill inventory. */
export const LevelField = z.int().min(0).max(4);

/** A moment in time: an ISO 8601 date and time with seconds and a `Z` or offset, such as `2026-10-24T14:02:11Z`. */
export const TimestampField = z.iso.datetime({ offset: true });

/** A calendar day, such as `2026-10-24`. */
export const CalendarDateField = z.iso.date();

/**
 * A date known to the year, month or day, such as `2024`, `2024-09` or `2024-09-30`.
 *
 * @remarks Evidence often has only a year or month, as on a CV. Impossible dates, such as `2023-02-29`, are rejected.
 */
export const PartialDateField = z
  .string()
  .regex(/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/)
  .refine((value) => value.length < 10 || CalendarDateField.safeParse(value).success, "Not a real date.");

/** A web link: an absolute `http` or `https` URL, so a link can never run script (hard rule 10). */
export const HttpUrlField = z.url({ protocol: /^https?$/ });

/** A language as a BCP 47 tag, such as `en` or `en-GB`. */
export const LanguageTagField = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);

/** A licence named by its SPDX identifier, such as `MIT` or `CC-BY-SA-4.0`, or a `LicenseRef-` of its own. */
export const SpdxIdField = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.+-]*$/);

/** An integrity fingerprint: `sha256-` and the rule name, then 64 lowercase hex digits (data model §4). */
export const IntegrityField = z.string().regex(/^sha256-[a-z0-9]+:[0-9a-f]{64}$/);

/**
 * Short text that isn't blank, such as a title or a grade.
 *
 * @remarks YAML reads an unquoted `1984` or `72` as a number; it is read back as the text written.
 */
export const TextField = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().regex(/\S/, "Text can't be blank."));

/**
 * Where a record or value came from, when AI produced it (data model §5).
 *
 * @remarks `confirmed_by_user` is when the person confirmed the output. A diagnostic's result needs no
 * confirmation (PRD E7), so it is optional here; schemas that need it use {@link ConfirmedAiProvenance}.
 */
export const AiProvenance = z.object({
  /** The registered task and its version, such as `normalise-evidence@1` (ADR-0004). */
  task: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*@[1-9]\d*$/),
  /** The provider and model, such as `anthropic/claude-sonnet-5-5`. */
  model: z.string().min(1),
  /** When the model produced the output. */
  at: TimestampField,
  /** When the person confirmed the output. */
  confirmed_by_user: TimestampField.optional(),
});

/** Where AI output came from, plus when the person confirmed it (PRD D2). */
export const ConfirmedAiProvenance = AiProvenance.extend({ confirmed_by_user: TimestampField });

/** An AI block from a record file. */
export type AiProvenance = z.output<typeof AiProvenance>;

/** Where a skill level came from (data model §6). */
export const Provenance = z.literal(["self-reported", "ai-judged", "demonstrated", "ai-correlated"]);

/** Where a skill level came from. */
export type Provenance = z.output<typeof Provenance>;

/**
 * The fields every profile record starts with, after `schema` (data model §3).
 *
 * @remarks `updated` is optional so a record made by hand is still valid; `ai` defaults to `null`.
 */
export const ENVELOPE_FIELDS = {
  id: ProfileRecordIdField,
  created: TimestampField,
  updated: TimestampField.optional(),
  ai: AiProvenance.nullable().default(null),
};

/**
 * What the AI-led diagnostic's tasks share: Pharoam's scale, the person's material about the skill, and the
 * questions asked so far (MVP S23).
 *
 * @remarks The scale is content, so tasks put it in their instructions. The skill, the person's evidence, claims,
 * earlier results and answers are sent only as data parts (PRD D4, security §3): diagnostics test inventory skills,
 * but a task can't tell an inventory skill's text from a custom one's, so it treats both as material. An item the
 * model wrote is sent as data too, since its text came from a model that read the person's material. Questions and
 * answers are quoted, so an answer that writes its own marking or questions can't pass for the session's.
 * @packageDocumentation
 */
import { z } from "zod";
import { LevelField } from "../../schemas/fields.ts";
import type { DataPart } from "../task.ts";

const Level = z.object({ name: z.string().min(1), description: z.string().min(1) });

/**
 * Pharoam's scale: each level's name and what someone at that level can do.
 *
 * @remarks Content from the pack, so tasks may put it in their instructions.
 */
export const Scale = z.object({ 0: Level, 1: Level, 2: Level, 3: Level, 4: Level });

/** Pharoam's scale, as the tasks take it. */
export type Scale = z.output<typeof Scale>;

/**
 * The person's material about the skill: its linked evidence, their claims and earlier question-bank results
 * (MVP S23.1).
 *
 * @remarks It decides what a diagnostic probes and what its explanation compares, never the level (ADR-0019).
 */
export const DiagnosticMaterial = z.object({
  /** The evidence linked to the skill, each with a short reference such as `E1`. */
  evidence: z.array(z.object({ ref: z.string().regex(/^E\d+$/), text: z.string().regex(/\S/) })),
  /** The latest claimed level from each source that counts. */
  claims: z.array(
    z.object({
      level: LevelField,
      provenance: z.literal(["self-reported", "ai-judged"]),
      since: z.iso.date(),
    }),
  ),
  /** Earlier question-bank diagnostic results, as each ended. */
  earlier: z.array(z.object({ level: LevelField, date: z.iso.date() })),
});

/**
 * One question asked and answered in an AI-led diagnostic, with its marking (MVP S23.2).
 *
 * @remarks Its level and marking are what the published rule reads; the reasons are what the model gave for an
 * answer it marked, and a bank item's multiple-choice answer, marked by its key, has none.
 */
export const AnsweredQuestion = z.object({
  format: z.literal(["mcq", "open", "practical"]),
  level: LevelField,
  /** The question or task, as the person saw it. */
  prompt: z.string().regex(/\S/),
  /** The person's answer: the option chosen, or what they wrote. */
  answer: z.string().regex(/\S/),
  correct: z.boolean(),
  /** Why it was marked so, for an answer the model marked. */
  reasons: z.string().optional(),
});

/**
 * A level by number and name, as instructions name it, such as `level 3 Practitioner`.
 *
 * @remarks Inputs are checked against their schemas first, so the level is always on the scale.
 * @param scale - Pharoam's scale.
 * @param level - A level from 0 to 4.
 * @returns The level's number and name.
 * @throws Error when the level isn't on the scale, which is a bug in the caller.
 */
export function levelName(scale: Scale, level: number): string {
  const step = ([0, 1, 2, 3, 4] as const).find((n) => n === level);
  if (step === undefined) throw new Error(`Level ${String(level)} isn't on Pharoam's scale.`);
  return `level ${String(step)} ${scale[step].name}`;
}

/**
 * The scale as instruction lines, one level each: its number, name and what someone at that level can do.
 *
 * @param scale - Pharoam's scale.
 * @returns The lines, from level 0 to 4.
 */
export function scaleLines(scale: Scale): string[] {
  return ([0, 1, 2, 3, 4] as const).map((n) => `${String(n)} ${scale[n].name}: ${scale[n].description}`);
}

/**
 * The skill as a data part.
 *
 * @param skill - The skill: its name, what it covers and what each level means for it.
 * @returns The data part.
 */
export function skillPart(skill: string): DataPart {
  return { kind: "skill", text: skill };
}

/**
 * The person's material as data parts: each piece of evidence, then their claims, then earlier results.
 *
 * @remarks A kind of material the person has none of sends no part, so the model is never shown an empty one.
 * @param material - The person's material about the skill.
 * @returns The data parts, in that order.
 */
export function materialParts(material: z.output<typeof DiagnosticMaterial>): DataPart[] {
  const { evidence, claims, earlier } = material;
  const lines = (kind: string, texts: readonly string[]): DataPart[] =>
    texts.length === 0 ? [] : [{ kind, text: texts.join("\n") }];
  return [
    ...evidence.map(({ ref, text }) => ({ kind: "evidence", text: `Reference: ${ref}\n${text}` })),
    ...lines(
      "claims",
      claims.map(({ level, provenance, since }) => `Level ${String(level)}, ${provenance}, since ${since}`),
    ),
    ...lines(
      "earlier-results",
      earlier.map(({ level, date }) => `Level ${String(level)}, question-bank diagnostic, ${date}`),
    ),
  ];
}

/**
 * The questions asked so far as data parts, one each, numbered in order.
 *
 * @remarks The marking comes first and the answer last, and the question, reasons and answer are each quoted, so
 * nothing in an answer can read as the session's own lines.
 * @param questions - The questions asked and answered, with their marking.
 * @returns One data part per question.
 */
export function questionParts(questions: readonly z.output<typeof AnsweredQuestion>[]): DataPart[] {
  return questions.map(({ format, level, prompt, answer, correct, reasons }, index) => ({
    kind: "question",
    text: [
      `Question ${String(index + 1)}, level ${String(level)}, ${format}, marked ${correct ? "right" : "wrong"}`,
      `Asked: ${JSON.stringify(prompt)}`,
      ...(reasons === undefined ? [] : [`Reasons: ${JSON.stringify(reasons)}`]),
      `Answer: ${JSON.stringify(answer)}`,
    ].join("\n"),
  }));
}

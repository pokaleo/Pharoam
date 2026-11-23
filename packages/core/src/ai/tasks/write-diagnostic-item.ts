/**
 * Choosing or writing the next item of an AI-led diagnostic (MVP S23.2).
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { MAX_QUESTIONS } from "../../diagnostic.ts";
import { LevelField } from "../../schemas/fields.ts";
import { defineTask } from "../task.ts";
import {
  AnsweredQuestion,
  DiagnosticMaterial,
  Scale,
  levelName,
  materialParts,
  questionParts,
  scaleLines,
  skillPart,
} from "./diagnostic-material.ts";

const INSTRUCTIONS = [
  "You choose the next question of a diagnostic that tests one skill at one level.",
  "The skill, the person's evidence about it, their claimed levels, their earlier question-bank results and the",
  "questions asked so far with their marking are in the material.",
  "Probe where the evidence is thin, or where it conflicts with what the person claims.",
  "Either reuse one of the question bank's items below, by its reference, or write a new open question or",
  "practical task, with a rubric that says what a good answer shows at this level.",
  "A written item must be answerable in a few sentences or a short piece of code, must test the level asked, not a",
  "higher or lower one, and must not ask again what the session or the bank already asks.",
  "Never write a multiple-choice item, and never ask for personal details. Never give a score, confidence or level.",
].join(" ");

// Absent, null and blank are all empty: models leave out, null or blank a field they don't need.
const blank = (text: string | null | undefined): boolean => text == null || !/\S/.test(text);

// Two prompts are the same question when they match after trimming and with runs of spaces as one.
const same = (text: string): string => text.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Chooses a reviewed bank item, or writes an open question or practical task, for the next step of an AI-led
 * diagnostic (MVP S23.2).
 *
 * @remarks The level to test comes from the published rule, never from the model; the model decides only what to
 * ask at it. The bank's items at that level not yet asked are reviewed content, so they go in the instructions,
 * each quoted; the skill, the person's evidence, claims, earlier results and the answers so far are material
 * (PRD D4). A bank choice must name an item it was offered, and a written item needs its format, prompt and rubric
 * and mustn't repeat a question the session or the bank asks, so what is asked is never in doubt. The model can't
 * write a multiple-choice item, which would have no reviewed answer key. The fields only one kind of answer needs
 * may be left out or blank, as models send them; the session never asks more than {@link MAX_QUESTIONS}.
 */
export const writeDiagnosticItem = defineTask({
  name: "write-diagnostic-item",
  version: 1,
  input: z.object({
    /** The skill: its name, what it covers and what each level means for it, from the vocabulary. */
    skill: z.string().regex(/\S/),
    /** The level the next item tests, as the published rule set it. */
    level: LevelField,
    scale: Scale,
    /** The bank's items for the skill at this level that the session hasn't asked. */
    bank: z.array(
      z.object({
        slug: z.string().min(1),
        format: z.literal(["mcq", "open", "practical"]),
        prompt: z.string().regex(/\S/),
      }),
    ),
    material: DiagnosticMaterial,
    /** The questions asked so far, fewer than the most a session asks. */
    steps: z.array(AnsweredQuestion).max(MAX_QUESTIONS - 1),
  }),
  output: z.object({
    source: z
      .literal(["bank", "written"])
      .describe("Whether the item is from the question bank or newly written"),
    bank: z
      .string()
      .nullable()
      .optional()
      .describe("For a bank item, its reference, such as sql-3-a; otherwise null"),
    format: z
      .literal(["open", "practical"])
      .nullable()
      .optional()
      .describe("For a written item, its format; otherwise null"),
    prompt: z
      .string()
      .nullable()
      .optional()
      .describe("For a written item, the question or task; otherwise null"),
    rubric: z
      .string()
      .nullable()
      .optional()
      .describe("For a written item, what a good answer shows; otherwise null"),
    why: z.string().regex(/\S/).describe("What the item probes, and why it was chosen"),
  }),
  instructions: ({ level, scale, bank }) =>
    [
      INSTRUCTIONS,
      `The level to test: ${levelName(scale, level)}.`,
      ...(bank.length === 0
        ? ["The question bank has no item left at this level, so write one."]
        : [
            "The question bank's items at this level, as reference (format): question:",
            ...bank.map(({ slug, format, prompt }) => `- ${slug} (${format}): ${JSON.stringify(prompt)}`),
          ]),
      "Pharoam's scale, as level name: what someone at that level can do:",
      ...scaleLines(scale),
    ].join("\n"),
  data: ({ skill, material, steps }) => [
    skillPart(skill),
    ...materialParts(material),
    ...questionParts(steps),
  ],
  check: ({ bank, steps }, { source, bank: chosen, format, prompt, rubric }) => {
    if (source === "bank") {
      const problems: string[] = [];
      if (blank(chosen)) problems.push("bank: a bank choice names its item");
      else if (!bank.some(({ slug }) => slug === chosen))
        problems.push(`bank: ${String(chosen)} wasn't offered`);
      if (format != null || !blank(prompt) || !blank(rubric))
        problems.push("A bank item is asked as written: format, prompt and rubric must be empty");
      return problems;
    }
    const asked = new Set([...steps, ...bank].map((item) => same(item.prompt)));
    return [
      ...(blank(chosen) ? [] : ["A written item names no bank item"]),
      ...(format == null ? ["format: a written item is open or practical"] : []),
      ...(blank(prompt) ? ["prompt: a written item needs one"] : []),
      ...(!blank(prompt) && asked.has(same(prompt ?? ""))
        ? ["prompt: the session or the bank already asks this"]
        : []),
      ...(blank(rubric) ? ["rubric: a written item needs one"] : []),
    ];
  },
});

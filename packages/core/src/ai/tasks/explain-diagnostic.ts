/**
 * Explaining an AI-led diagnostic's result (MVP S23.3, PRD E5).
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { MAX_QUESTIONS, QUESTION_BANK_RULE } from "../../diagnostic.ts";
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
  "You explain the result of a diagnostic that tested one skill.",
  "The skill, the questions asked, the person's answers and their marking, and the person's evidence, claimed",
  "levels and earlier question-bank results are in the material.",
  "Say what the session showed, and how it compares with the claims and the evidence, in either direction.",
  "Offer likely reasons for any difference as possibilities, never as facts about the person, and suggest one",
  "next step, such as a practical task or something to study.",
  "The level was set by the published rule below, from the marking alone: explain it, never change or question it,",
  "and never suggest another level. Never give a score, percentage, confidence or chance of success.",
].join(" ");

// What the published rule does, in words the model can explain the result by (MVP S19.3, S19.4).
const RULE = [
  "The rule: a right answer moves the next question up a level and a wrong one down; the session ends when the",
  "level is settled, or after 12 questions; the result is the highest level with two answers marked right, or 0.",
].join(" ");

/**
 * Explains an AI-led diagnostic's result: what it showed, how it compares with the claims and evidence, possible
 * reasons, and a next step (MVP S23.3, PRD E5).
 *
 * @remarks The result comes from the published rule applied to the marking, so the rule and the result are stated
 * in the instructions and the answer has no level field to change it (S23.3, ADR-0019). The skill, the person's
 * material and the session's questions are data (PRD D4). Reasons are offered as possibilities, and may be none
 * when the result matches the claims. The explanation is written with the result, labelled with its task and
 * model, without an acceptance step (ADR-0019).
 */
export const explainDiagnostic = defineTask({
  name: "explain-diagnostic",
  version: 1,
  input: z.object({
    /** The skill: its name, what it covers and what each level means for it, from the vocabulary. */
    skill: z.string().regex(/\S/),
    scale: Scale,
    /** The level the diagnostic started at. */
    start: LevelField,
    /** The level the published rule gave. */
    result: LevelField,
    /** The published rule that gave it. */
    rule: z.literal(QUESTION_BANK_RULE),
    material: DiagnosticMaterial,
    steps: z.array(AnsweredQuestion).min(1).max(MAX_QUESTIONS),
  }),
  output: z.object({
    showed: z.string().regex(/\S/).describe("What the session showed"),
    comparison: z
      .string()
      .regex(/\S/)
      .describe("How the result compares with the claims and the evidence, in either direction"),
    reasons: z
      .array(z.string().regex(/\S/))
      .max(3)
      .describe("Likely reasons for any difference, each as a possibility; none when there is no difference"),
    next_step: z
      .string()
      .regex(/\S/)
      .describe("One next step, such as a practical task or something to study"),
  }),
  instructions: ({ scale, start, result, rule }) =>
    [
      INSTRUCTIONS,
      `The diagnostic started at ${levelName(scale, start)} and gave ${levelName(scale, result)} by the published rule ${rule}.`,
      RULE,
      "Pharoam's scale, as level name: what someone at that level can do:",
      ...scaleLines(scale),
    ].join("\n"),
  data: ({ skill, material, steps }) => [
    skillPart(skill),
    ...materialParts(material),
    ...questionParts(steps),
  ],
});

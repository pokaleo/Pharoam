/**
 * Judging one skill's level from its linked evidence, for the evidence scan's second step (MVP S16.2, S16.3).
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { defineTask } from "../task.ts";

const Level = z.object({ name: z.string().min(1), description: z.string().min(1) });

const INSTRUCTIONS = [
  "You judge one skill's level for a person from the evidence they linked to it, and nothing else.",
  "The skill, and each piece of evidence with its reference, are in the material.",
  "Give one level from Pharoam's scale below, explain what in the evidence supports it,",
  "say what the judgement can't tell from this evidence, and list the references of the evidence it rests on.",
  "Never give a confidence or a score. When the evidence says little, give a low level and say so in the limits.",
  "Pharoam's scale, as level name: what someone at that level can do:",
].join(" ");

/**
 * Judges a skill's level from the evidence linked to it, with an explanation and its limits (MVP S16.2, S16.3).
 *
 * @remarks Runs once per skill and reads only that skill's linked evidence (PRD D4), each record marked with a short
 * reference such as `E1`. An answer citing a reference it wasn't sent is rejected, so a judgement can only rest on
 * evidence the person can see it read. It carries no confidence (hard rule 9), and is written as an `ai-judged`
 * observation only if the person accepts it (PRD D2).
 */
export const judgeSkillLevel = defineTask({
  name: "judge-skill-level",
  version: 1,
  input: z.object({
    /** The skill: its name, what it covers and what each level means for it, from the vocabulary or the person. */
    skill: z.string().regex(/\S/),
    scale: z.object({ 0: Level, 1: Level, 2: Level, 3: Level, 4: Level }),
    evidence: z.array(z.object({ ref: z.string().regex(/^E\d+$/), text: z.string().regex(/\S/) })).min(1),
  }),
  output: z.object({
    level: z.int().min(0).max(4).describe("The level, 0 to 4"),
    explanation: z.string().regex(/\S/).describe("What in the evidence supports the level"),
    limits: z.string().regex(/\S/).describe("What this evidence can't tell"),
    evidence: z
      .array(z.string())
      .min(1)
      .describe("The references of the evidence the level rests on, such as E1"),
  }),
  instructions: ({ scale }) =>
    `${INSTRUCTIONS}\n${([0, 1, 2, 3, 4] as const)
      .map((n) => `${String(n)} ${scale[n].name}: ${scale[n].description}`)
      .join("\n")}`,
  data: ({ skill, evidence }) => [
    { kind: "skill", text: skill },
    ...evidence.map(({ ref, text }) => ({ kind: "evidence", text: `Reference: ${ref}\n${text}` })),
  ],
  check: ({ evidence }, { evidence: cited }) => {
    const sent = new Set(evidence.map(({ ref }) => ref));
    return cited.filter((ref) => !sent.has(ref)).map((ref) => `evidence: ${ref} wasn't sent`);
  },
});

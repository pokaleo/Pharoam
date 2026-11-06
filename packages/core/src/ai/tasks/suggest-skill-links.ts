/**
 * Suggesting which skills one piece of evidence shows, for the evidence scan's first step (MVP S16.1).
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { defineTask } from "../task.ts";

/** A skill as the scan names it: its slug and its readable name. */
const SkillName = z.object({ slug: z.string().min(1), name: z.string().min(1) });

const INSTRUCTIONS = [
  "You read one piece of evidence about what a person studied or did, and suggest which skills it shows.",
  "Suggest a skill only when the evidence shows the person used it, and explain in one or two sentences what in the",
  "evidence shows it: an explanation, never a level, a score or a confidence. If the evidence shows no skill on the lists,",
  "answer with no links. Name each skill by its slug, from Pharoam's vocabulary below or from the person's own",
  "skills in the material. Pharoam's vocabulary, as slug: name:",
].join(" ");

/**
 * Reads one evidence record and suggests the skills it shows, each with an explanation (MVP S16.1, PRD D1, B6).
 *
 * @remarks Runs once per record and reads that record only (PRD D4). Pharoam's skill vocabulary is its own content,
 * so it goes in the instructions; the person's custom skills are their data, so they go with the evidence as
 * marked data (security §3). A suggested skill on neither list is dropped by the scan, not offered (S16.11).
 */
export const suggestSkillLinks = defineTask({
  name: "suggest-skill-links",
  version: 1,
  input: z.object({
    evidence: z.string().regex(/\S/),
    vocabulary: z.array(SkillName),
    custom: z.array(SkillName),
  }),
  output: z.object({
    links: z
      .array(
        z.object({
          skill: z.string().min(1).describe("The skill's slug"),
          explanation: z.string().regex(/\S/).describe("What in the evidence shows the skill"),
        }),
      )
      .max(20),
  }),
  instructions: ({ vocabulary }) =>
    `${INSTRUCTIONS}\n${vocabulary.map(({ slug, name }) => `${slug}: ${name}`).join("\n")}`,
  data: ({ evidence, custom }) => [
    { kind: "evidence", text: evidence },
    ...(custom.length === 0
      ? []
      : [{ kind: "custom-skills", text: custom.map(({ slug, name }) => `${slug}: ${name}`).join("\n") }]),
  ],
});

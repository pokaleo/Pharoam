/**
 * Explaining what a gap to a pathway might mean, with places the person could start (MVP S18).
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { Provenance } from "../../schemas/fields.ts";
import { defineTask } from "../task.ts";

const Level = z.object({ name: z.string().min(1), description: z.string().min(1) });

const INSTRUCTIONS = [
  "You explain to a person what their gap to a career pathway might mean, and suggest a few places they could start.",
  "The pathway and its requirements are below. Where the person stands against each requirement, and the titles of",
  "the evidence their levels cite, are in the material. Each requirement is in a group: supported (a level shown in a",
  "Pharoam diagnostic meets it), claimed (a level the person or an AI judgement claims meets it), below (their level",
  "is lower) or unknown (they have no level for it yet).",
  "Explain in plain words what the gap might mean, without judging the person or the pathway.",
  "Then suggest up to three places to start, each naming one of the pathway's requirements by its reference, with why.",
  "Never give a score, percentage, total, ranking, confidence or chance of success, and never suggest a level.",
].join(" ");

/**
 * Explains what the gap to a pathway might mean, and where the person could start (MVP S18.1, S18.2).
 *
 * @remarks The pathway, its requirements and Pharoam's scale are content, so they go in the instructions; the
 * person's levels, their groups and the titles of the evidence they cite are the material (PRD D4). Each place to
 * start must name one of the pathway's requirements, once, and there are at most three, so the card stays short; an
 * answer naming anything else is rejected (S18.2). The
 * answer has no level or score (Charter R1), changes nothing, and becomes a note only if the person accepts it
 * (PRD D2, data model §10).
 */
export const explainGap = defineTask({
  name: "explain-gap",
  version: 1,
  input: z.object({
    pathway: z.object({ title: z.string().regex(/\S/), summary: z.string() }),
    scale: z.object({ 0: Level, 1: Level, 2: Level, 3: Level, 4: Level }),
    requirements: z
      .array(
        z.object({
          skill: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          name: z.string().regex(/\S/),
          importance: z.literal(["core", "helpful"]),
          required: z.int().min(0).max(4),
          shown: z.object({ level: z.int().min(0).max(4), provenance: Provenance }).nullable(),
          group: z.literal(["supported", "claimed", "below", "unknown"]),
          /** The titles of the evidence the shown level cites. */
          evidence: z.array(z.string()),
        }),
      )
      .min(1),
  }),
  output: z.object({
    meaning: z.string().regex(/\S/).describe("What the gap might mean, in plain words"),
    starts: z
      .array(
        z.object({
          skill: z.string().describe("The reference of one of the pathway's requirements, such as python"),
          why: z.string().regex(/\S/).describe("Why it is a good place to start, and how"),
        }),
      )
      .max(3)
      .describe("Up to three places to start"),
  }),
  instructions: ({ pathway, scale, requirements }) => {
    const levels = [0, 1, 2, 3, 4] as const;
    return [
      INSTRUCTIONS,
      `The pathway: ${pathway.title}: ${pathway.summary}`,
      "Its requirements, as reference: skill, the level asked for, and whether core or helpful:",
      ...requirements.map(
        ({ skill, name, required, importance }) =>
          `- ${skill}: ${name}, level ${String(required)} ${scale[levels[required] ?? 0].name}, ${importance}`,
      ),
      "Pharoam's scale, as level name: what someone at that level can do:",
      ...levels.map((n) => `${String(n)} ${scale[n].name}: ${scale[n].description}`),
    ].join("\n");
  },
  data: ({ requirements }) => [
    {
      kind: "gap",
      text: requirements
        .map(({ skill, shown, group, evidence }) =>
          [
            `Requirement: ${skill}`,
            shown === null ? "Level: none yet" : `Level: ${String(shown.level)}, ${shown.provenance}`,
            `Group: ${group}`,
            ...(evidence.length === 0
              ? []
              : [`Evidence its level cites: ${evidence.map((title) => JSON.stringify(title)).join("; ")}`]),
          ].join("\n"),
        )
        .join("\n\n"),
    },
  ],
  check: ({ requirements }, { starts }) => {
    const asked = new Set(requirements.map(({ skill }) => skill));
    const named = new Set<string>();
    const problems: string[] = [];
    for (const { skill } of starts) {
      if (!asked.has(skill)) problems.push(`starts: ${skill} isn't one of the pathway's requirements`);
      else if (named.has(skill)) problems.push(`starts: ${skill} is named twice`);
      named.add(skill);
    }
    return problems;
  },
});

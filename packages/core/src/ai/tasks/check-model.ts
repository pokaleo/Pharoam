/**
 * The test call in the model settings: can this model be reached, and can it answer in a task's shape?
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { defineTask } from "../task.ts";

/**
 * Checks that a model answers, and in a requested structure, without sending anything of the person's.
 *
 * @remarks The model settings' test call goes through a registered task like every other AI call (hard rule 5,
 * MVP S13.3). It reads nothing of the person's, so it needs no notice before sending. An answer that isn't the
 * structure asked for fails, since every real task needs one.
 */
export const checkModel = defineTask({
  name: "check-model",
  version: 1,
  input: z.object({}),
  output: z.object({ ready: z.literal(true) }),
  instructions: () =>
    "This is a check that you can be reached and can answer in a requested structure. Answer with ready set to true.",
  data: () => [],
});

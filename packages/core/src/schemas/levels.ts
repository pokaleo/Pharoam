/**
 * The `levels` content record: the one shared scale every skill level uses.
 *
 * @remarks Levels run from 0 to 4 (Charter P14, PRD C2). The shared description of each level is shown when
 * someone records a level, unless the skill has its own description for that level (MVP S6.3).
 * @packageDocumentation
 */
import { z } from "zod";
import { TextField } from "./fields.ts";

const Level = z.object({
  /** The level's short name, such as `Working`. */
  name: TextField,
  /** What someone at this level can do. */
  description: TextField,
});

/** The `levels/1` record's top block. */
export const LevelScale = z.object({
  schema: z.literal("levels/1"),
  levels: z.object({ 0: Level, 1: Level, 2: Level, 3: Level, 4: Level }),
});

/** The shared level scale as Pharoam reads it. */
export type LevelScale = z.output<typeof LevelScale>;

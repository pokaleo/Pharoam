/**
 * Claude Code PreToolUse hook: blocks hard-rule violations, asks before enforcement changes and git publishing.
 *
 * @packageDocumentation
 */
import { realpathSync } from "node:fs";
import { preToolUse } from "../hooks.ts";
import { canonicalPath } from "../paths.ts";
import { emit, projectDir, readFileOrUndefined, readStdinJson } from "./run.ts";

const realpath = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
};

emit(
  preToolUse(readStdinJson(), {
    projectDir,
    readFile: readFileOrUndefined,
    now: Date.now,
    resolve: (path) => canonicalPath(path, realpath),
  }),
);

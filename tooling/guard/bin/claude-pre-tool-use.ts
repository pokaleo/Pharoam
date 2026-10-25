/**
 * Claude Code PreToolUse hook: blocks hard-rule violations, asks before enforcement changes and git publishing.
 *
 * @remarks Fails closed: if the guard itself throws, the call goes to the user instead of running.
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

try {
  emit(
    preToolUse(readStdinJson(), {
      projectDir,
      readFile: readFileOrUndefined,
      now: Date.now,
      resolve: (path) => canonicalPath(path, realpath),
    }),
  );
} catch (error) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: `Pharoam's guard failed (${String(error)}), so this needs the user's explicit approval.`,
    },
  });
}

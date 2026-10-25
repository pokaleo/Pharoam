/**
 * Claude Code PreToolUse hook: blocks hard-rule violations, asks before enforcement changes and git publishing.
 *
 * @packageDocumentation
 */
import { preToolUse } from "../hooks.ts";
import { emit, projectDir, readFileOrUndefined, readStdinJson } from "./run.ts";

emit(preToolUse(readStdinJson(), { projectDir, readFile: readFileOrUndefined, now: Date.now }));

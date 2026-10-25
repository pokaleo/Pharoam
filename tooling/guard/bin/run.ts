/**
 * Shared I/O for the guard's command-line wrappers.
 *
 * @packageDocumentation
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { CheckResult } from "../hooks.ts";

/** The repository root: Claude Code's project directory, or the current directory under git hooks. */
export const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/**
 * Reads the hook payload from stdin.
 *
 * @returns The parsed object, or an empty object when stdin is empty or not an object.
 * @throws `SyntaxError` when stdin isn't valid JSON.
 */
export function readStdinJson(): object {
  const parsed: unknown = JSON.parse(readFileSync(0, "utf8") || "{}");
  return typeof parsed === "object" && parsed !== null ? parsed : {};
}

/**
 * Reads a text file, tolerating a missing one.
 *
 * @param path - Absolute path of the file.
 * @returns Its text, or `undefined` when it can't be read.
 */
export function readFileOrUndefined(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Runs a command in the repository root and waits for it.
 *
 * @param command - The program to run, such as `pnpm`.
 * @param args - Its arguments.
 * @returns Whether it exited with status 0, and its stdout and stderr together.
 */
export function run(command: string, args: readonly string[]): CheckResult {
  const result = spawnSync(command, args, { cwd: projectDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() };
}

/**
 * Prints a hook's answer for Claude Code, or nothing when there is no answer.
 *
 * @param output - The answer to print as JSON.
 */
export function emit(output: object | undefined): void {
  if (output) process.stdout.write(JSON.stringify(output));
}

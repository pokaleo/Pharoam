/**
 * Decision logic for the Claude Code hooks and the git pre-commit check.
 *
 * @remarks Pure functions; the thin command-line wrappers in `./bin` connect them to stdin, the file system,
 * git and pnpm.
 * @packageDocumentation
 */
import path from "node:path";
import { classifyCommand, writesProtectedPath } from "./bash-rules.ts";
import { checkContent } from "./content-rules.ts";
import { type EditInput, resultingContent } from "./edit-result.ts";
import { isProtectedPath } from "./protected.ts";
import { findUntestedSources } from "./tdd.ts";
import { UNLOCK_FILE, isUnlocked } from "./unlock.ts";

/**
 * The parts of a Claude Code hook payload these hooks read.
 *
 * @remarks Property names follow Claude Code's hook payload.
 */
export interface HookInput {
  /** The tool the agent is calling, such as `Edit` or `Bash`. */
  tool_name?: string;
  /** The tool call's input. */
  tool_input?: Partial<EditInput> & {
    /** The command line, for `Bash`. */
    command?: string;
  };
  /** Set when the agent is already continuing because a Stop hook blocked it. */
  stop_hook_active?: boolean;
}

/** A PreToolUse hook's answer that asks the user or refuses the call. */
export interface PreToolUseOutput {
  /** The decision in Claude Code's format. */
  hookSpecificOutput: {
    /** Always `PreToolUse`. */
    hookEventName: "PreToolUse";
    /** `ask` waits for the user's approval; `deny` refuses the call. */
    permissionDecision: "ask" | "deny";
    /** Shown to the user and the agent. */
    permissionDecisionReason: string;
  };
}

/** A hook's answer that sends the agent back to fix something. */
export interface BlockOutput {
  /** Always `block`. */
  decision: "block";
  /** What the agent must fix. */
  reason: string;
}

/** The outcome of running a check command. */
export interface CheckResult {
  /** Whether the command succeeded. */
  ok: boolean;
  /** Its combined output. */
  output: string;
}

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const LINTABLE = /\.(?:[cm]?[jt]sx?)$/;
const MAX_REASON = 4000;

/**
 * Decides on a tool call before it runs.
 *
 * @remarks Edits are checked as the file will be after the edit. Edits that break a content rule are
 * refused. Changing enforcement files, by edit or shell command, asks the user unless they have unlocked it
 * (`pnpm guard:unlock`). Commands that commit or publish always ask.
 * @param input - The hook payload.
 * @param deps - The project directory, a way to read a file's current text, and the current time.
 * @returns The decision, or `undefined` to let the call go ahead.
 */
export function preToolUse(
  input: HookInput,
  deps: { projectDir: string; readFile: (absolutePath: string) => string | undefined; now: () => number },
): PreToolUseOutput | undefined {
  const toolName = input.tool_name ?? "";
  const unlocked = () => isUnlocked(deps.readFile(path.join(deps.projectDir, UNLOCK_FILE)), deps.now());

  if (toolName === "Bash") {
    const command = input.tool_input?.command ?? "";
    const { decision, reason } = classifyCommand(command);
    if (decision !== "allow") return permission(decision, reason);
    if (writesProtectedPath(command, deps.projectDir) && !unlocked()) {
      return permission(
        "ask",
        "This command may change hard-rule enforcement files. Changing them needs the user's approval (AGENTS.md).",
      );
    }
    return undefined;
  }

  const filePath = input.tool_input?.file_path;
  if (!EDIT_TOOLS.has(toolName) || !filePath) return undefined;
  const relative = projectRelative(deps.projectDir, filePath);
  if (relative === undefined) return undefined;
  if (relative === UNLOCK_FILE) {
    return permission("deny", "Only the user can unlock enforcement edits (`pnpm guard:unlock`).");
  }

  const content = resultingContent(
    toolName,
    { ...input.tool_input, file_path: filePath },
    deps.readFile(filePath),
  );
  const violations = checkContent(relative, content);
  if (violations.length > 0) {
    const details = violations.map((v) => `- [${v.rule}] ${v.message}`).join("\n");
    return permission("deny", `This change breaks Pharoam's hard rules:\n${details}`);
  }
  if (isProtectedPath(relative) && !unlocked()) {
    return permission(
      "ask",
      `${relative} is part of the hard-rule enforcement. Changing it needs the user's approval (AGENTS.md).`,
    );
  }
  return undefined;
}

/**
 * Lints a code file after an agent edits it and feeds errors back.
 *
 * @param input - The hook payload.
 * @param deps - The project directory and a way to lint one repo-relative file.
 * @returns A block with the lint output, or `undefined` when the file is clean or isn't code.
 */
export function postToolUse(
  input: HookInput,
  deps: { projectDir: string; lint: (relativePath: string) => CheckResult },
): BlockOutput | undefined {
  const filePath = input.tool_input?.file_path;
  if (!EDIT_TOOLS.has(input.tool_name ?? "") || !filePath) return undefined;
  const relative = projectRelative(deps.projectDir, filePath);
  if (relative === undefined || !LINTABLE.test(relative)) return undefined;
  const { ok, output } = deps.lint(relative);
  return ok
    ? undefined
    : { decision: "block", reason: `Lint errors in ${relative}; fix them:\n${tail(output)}` };
}

/**
 * Keeps the agent working while `pnpm check` fails.
 *
 * @remarks Doesn't run when nothing changed, or when the agent is already continuing from this hook, so it
 * can't loop.
 * @param input - The hook payload.
 * @param deps - Whether the working tree has changes, and a way to run `pnpm check`.
 * @returns A block with the failing output, or `undefined` to let the agent stop.
 */
export function stop(
  input: HookInput,
  deps: { hasChanges: () => boolean; runCheck: () => CheckResult },
): BlockOutput | undefined {
  if (input.stop_hook_active || !deps.hasChanges()) return undefined;
  const { ok, output } = deps.runCheck();
  return ok
    ? undefined
    : {
        decision: "block",
        reason: `\`pnpm check\` is failing. Fix it before finishing, or tell the user what is blocked:\n${tail(output)}`,
      };
}

/**
 * Lists staged changes that break a hard rule or have no test.
 *
 * @remarks Runs in the git pre-commit hook; see ENGINEERING §10.
 * @param staged - Repo-relative paths mapped to their staged content.
 * @param fileExists - Tells whether a repo-relative path exists in the working tree.
 * @returns One message per problem; empty when the commit may go ahead.
 */
export function checkStaged(staged: Record<string, string>, fileExists: (path: string) => boolean): string[] {
  const ruleProblems = Object.entries(staged).flatMap(([file, content]) =>
    checkContent(file, content).map((v) => `${file}: [${v.rule}] ${v.message}`),
  );
  const untested = findUntestedSources(Object.keys(staged), fileExists).map(
    (file) => `${file}: no test changed or found next to it (TDD, ENGINEERING §1).`,
  );
  return [...ruleProblems, ...untested];
}

function permission(decision: "ask" | "deny", reason: string): PreToolUseOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
}

function projectRelative(projectDir: string, filePath: string): string | undefined {
  const relative = path.relative(projectDir, path.resolve(projectDir, filePath));
  return relative.startsWith("..") || path.isAbsolute(relative)
    ? undefined
    : relative.split(path.sep).join("/");
}

function tail(text: string): string {
  return text.length > MAX_REASON ? `…${text.slice(-MAX_REASON)}` : text;
}

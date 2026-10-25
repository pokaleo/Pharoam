/**
 * Shell command rules for coding agents.
 *
 * @remarks Commands that skip or rewrite verification are denied. Commands that record or publish work need
 * the user's explicit approval each time (AGENTS.md, "How to work").
 * @packageDocumentation
 */
import { coversProtectedPath } from "./protected.ts";

/** What the agent hook should do with a shell command. */
export interface CommandDecision {
  /** `allow` runs it, `ask` waits for the user's approval, `deny` refuses it. */
  decision: "allow" | "ask" | "deny";
  /** Shown to the user and the agent; empty when the command is allowed. */
  reason: string;
}

const DENY: readonly [RegExp, string][] = [
  [/\bgit\s+(?:commit|push)\b[^;&|]*\s--no-verify\b/, "Skipping git hooks with --no-verify is not allowed."],
  [/\bgit\s+commit\b[^;&|]*\s-[a-zA-Z]*n[a-zA-Z]*\b/, "`git commit -n` skips git hooks; not allowed."],
  [/\bHUSKY=0\b/, "Disabling git hooks with HUSKY=0 is not allowed."],
  [
    /\bgit\s+push\b[^;&|]*(?:\s--force(?:-with-lease)?\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+\S)/,
    "Force-pushing rewrites published history; not allowed.",
  ],
  [
    /\bguard:unlock\b|\bbin\/unlock\.ts\b|\.claude\/guard-unlock\b/,
    "Only the user can unlock enforcement edits (`pnpm guard:unlock`).",
  ],
];

const ASK: readonly [RegExp, string][] = [
  [/\bgit\s+commit\b/, "Committing needs the user's explicit approval."],
  [/\bgit\s+push\b/, "Pushing needs the user's explicit approval."],
  [
    /\bgh\s+pr\s+(?:create|merge|edit|close|reopen|ready)\b/,
    "Changing a pull request needs the user's explicit approval.",
  ],
  [
    /\bgit\s+config\b[^;&|]*\bcore\.hooksPath\b/,
    "Changing the git hooks path needs the user's explicit approval.",
  ],
];

/**
 * Decides whether an agent may run a shell command.
 *
 * @remarks Deny rules win over ask rules. Text inside quotes, such as a commit message, is ignored.
 * @param command - The full command line the agent wants to run.
 * @returns The decision, with the reason to show when it isn't `allow`.
 */
export function classifyCommand(command: string): CommandDecision {
  const code = stripQuoted(command);
  for (const [pattern, reason] of DENY) if (pattern.test(code)) return { decision: "deny", reason };
  for (const [pattern, reason] of ASK) if (pattern.test(code)) return { decision: "ask", reason };
  return { decision: "allow", reason: "" };
}

// Commands that change files they name: in-place editors, copies, moves, deletes, git restores and inline
// scripts. Redirections and `tee` are checked by their targets instead, so reading a file isn't a write.
const WRITING_COMMAND =
  /\bsed\s+(?:-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*[ie]|\b(?:cp|mv|rm|ln|touch|truncate|install|rsync|patch)\s|\bgit\s+(?:checkout|restore|mv|rm|apply|reset|stash|clean)\b|\b(?:python3?|node|deno|bun|ruby)\s+(?:-[ce]\b|--eval\b|-\s)/;
const REDIRECT_TARGET = />{1,2}\s*([^\s;&|<>]+)/g;
const TEE_TARGETS = /\btee\s+((?:[^\s;&|]+\s*)+)/g;
const TOKEN_SEPARATOR = /[\s;&|<>()'"`=,]+/;

/**
 * Tells whether a shell command may write a protected enforcement file.
 *
 * @remarks Pattern matching, so not airtight: it covers the usual ways (in-place `sed` and `perl`, `>`, `tee`,
 * `cp`, `mv`, `rm`, git restores, inline Python or Node). Git hooks and CI still check the result.
 * @param command - The full command line.
 * @param projectDir - The repository root, so absolute paths inside it are recognised.
 * @returns `true` when the command names a protected path and writes to it.
 */
export function writesProtectedPath(command: string, projectDir: string): boolean {
  const covers = (token: string) => {
    const path = toRelative(token, projectDir);
    return path !== undefined && coversProtectedPath(path);
  };
  const redirectTargets = [...command.matchAll(REDIRECT_TARGET)].map((match) => match[1] ?? "");
  const teeTargets = [...command.matchAll(TEE_TARGETS)].flatMap((match) => (match[1] ?? "").split(/\s+/));
  if ([...redirectTargets, ...teeTargets].some(covers)) return true;
  // A patch names its target files inside the patch, out of sight; treat every applied patch as a write.
  if (/\bgit\s+apply\b(?![^;&|]*--check)|(?:^|[\s;&|])patch\s/.test(command)) return true;
  return WRITING_COMMAND.test(command) && command.split(TOKEN_SEPARATOR).some(covers);
}

// A token as a repo-relative path, or undefined when it can't be a path inside the repository.
function toRelative(token: string, projectDir: string): string | undefined {
  if (token === "" || token.startsWith("-") || token.startsWith("&")) return undefined;
  let path = token.startsWith(`${projectDir}/`) ? token.slice(projectDir.length + 1) : token;
  if (path === projectDir) path = ".";
  if (path.startsWith("/") || path.startsWith("~")) return undefined;
  path = path.replace(/^(?:\.\/)+/, "").replace(/\/+$/, "");
  return path === "" ? "." : path;
}

// Quoted text (commit messages, echo arguments) is data, not commands.
function stripQuoted(command: string): string {
  return command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");
}

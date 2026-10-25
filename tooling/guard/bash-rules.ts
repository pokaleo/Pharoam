/**
 * Shell command rules for coding agents.
 *
 * @remarks Commands are read word by word with {@link parseShell}, so quoting, git's global options, command
 * prefixes, `sh -c` and substitutions don't hide what runs. Commands that skip or rewrite verification are
 * denied; commands that record or publish work need the user's explicit approval each time (AGENTS.md,
 * "How to work"); commands the guard can't read ask instead of guessing.
 * @packageDocumentation
 */
import path from "node:path";
import { coversProtectedPath } from "./protected.ts";
import { parseShell } from "./shell.ts";
import { UNLOCK_FILE } from "./unlock.ts";

/** What the agent hook should do with a shell command. */
export interface CommandDecision {
  /** `allow` runs it, `ask` waits for the user's approval, `deny` refuses it. */
  decision: "allow" | "ask" | "deny";
  /** Shown to the user and the agent; empty when the command is allowed. */
  reason: string;
}

/** Where a command runs, so the paths it names can be matched to repository files. */
export interface CommandContext {
  /** The repository root. */
  projectDir: string;
  /** The shell's working directory, which relative paths start from; the repository root when absent. */
  cwd?: string;
  /** Resolves symlinks in an absolute path; paths are taken as they are when absent. */
  resolve?: (absolutePath: string) => string;
}

const SKIP_HOOKS = "Skipping git hooks (--no-verify, -n, HUSKY=0 or core.hooksPath) is not allowed.";
const FORCE_PUSH = "Force-pushing rewrites published history; not allowed.";
const UNLOCK = "Only the user can unlock enforcement edits (`pnpm guard:unlock`).";
const COMMIT = "Committing needs the user's explicit approval.";
const PUSH = "Pushing needs the user's explicit approval.";
const PUBLISH =
  "Changing pull requests, releases or the repository on GitHub needs the user's explicit approval.";
const HOOKS_PATH = "Changing the git hooks path needs the user's explicit approval.";
const ALIAS = "Git aliases can hide which command runs, so they need the user's explicit approval.";
const PROGRAM_CONFIG =
  "Git settings that run programs (pager, editor, external diff, text conversion, fsmonitor, commands) need the user's explicit approval.";
// Git configuration keys whose value is a program git runs later.
const RUNS_PROGRAM_CONFIG =
  /^(?:core\.(?:pager|editor|fsmonitor|sshcommand|askpass)|pager\.|sequence\.editor|diff\.external|diff\..+\.(?:textconv|command)|filter\.|merge\..+\.driver|.+\.command|.+\.helper|gpg\.program|credential\.)/i;
const unreadable = (why: string) =>
  `Pharoam's guard can't read this command reliably (${why}), so it needs the user's explicit approval.`;

const ALLOW: CommandDecision = { decision: "allow", reason: "" };
const ask = (reason: string): CommandDecision => ({ decision: "ask", reason });
const deny = (reason: string): CommandDecision => ({ decision: "deny", reason });

/**
 * Decides whether an agent may run a shell command.
 *
 * @remarks Every command in the line is checked, including those in `$(…)`, backticks, `sh -c` strings and
 * heredocs fed to a shell; the strictest decision wins. Text that is only data, such as a commit message,
 * doesn't count as a command.
 * @param command - The full command line the agent wants to run.
 * @param context - The repository root, used to recognise the unlock file by any path.
 * @returns The decision, with the reason to show when it isn't `allow`.
 */
export function classifyCommand(
  command: string,
  context: CommandContext = { projectDir: "" },
): CommandDecision {
  const expanded = expand(command);
  if (expanded.unreadable !== undefined) return ask(unreadable(expanded.unreadable));
  const isUnlockFile = (token: string) => {
    const relative = toRelative(token, context);
    return relative !== undefined && globMatches(relative, UNLOCK_FILE);
  };
  if (writeCandidates(expanded.commands).paths.some(isUnlockFile)) return deny(UNLOCK);
  // `xargs` and other prefixes are unwrapped from the words, so the raw text is checked for xargs too.
  const lineReadsOnly =
    !/(?:^|[\s|;&(])xargs\s/.test(command) && expanded.commands.every((c) => readsOnly(c));
  const named = (c: Unwrapped) => c.argv.some((word) => namesUnlock(word, lineReadsOnly));
  if (UNLOCK_TEXT.test(command) || expanded.commands.some(named)) {
    return deny(UNLOCK);
  }
  return strictest([...expanded.commands.map(classifySimple), backstop(command)]);
}

/**
 * Tells whether a shell command may write a protected enforcement file.
 *
 * @remarks Checks redirection and `tee` targets, and every path named by a command that changes files
 * (`cp`, `mv`, `rm`, in-place `sed` or `perl`, git restores, inline scripts and the like). Applied patches
 * always count, because their targets are inside the patch. Paths are matched after resolving symlinks and
 * ignoring letter case. Pattern-based, so not airtight; git hooks and CI check the result.
 * @param command - The full command line.
 * @param context - The repository root, and how to resolve symlinks.
 * @returns `true` when the command may change a protected file.
 */
export function writesProtectedPath(command: string, context: CommandContext): boolean {
  const { commands } = expand(command);
  const { paths, hidden } = writeCandidates(commands);
  return (
    hidden ||
    paths.some((token) => {
      const relative = toRelative(token, context);
      return relative !== undefined && coversProtectedPath(globFolder(relative));
    })
  );
}

/** A simple command with prefixes such as `sudo`, `env` and `xargs` removed. */
interface Unwrapped {
  argv: string[];
  dynamic: boolean[];
  assignments: string[];
  redirects: string[];
  heredocs: string[];
}

const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
// Commands that run a command line given as one argument, after `-c` or `--command`.
const STRING_RUNNERS = new Set([...SHELLS, "su", "runuser", "script", "flock"]);
const INTERPRETERS = new Set(["python", "python3", "node", "deno", "bun", "ruby", "perl", ...SHELLS]);
const PREFIXES = new Set(["!", "{", "if", "then", "else", "elif", "do", "while", "until", "time", "exec"]);
// Prefix commands, with the options of each that take a separate value.
const WRAPPERS: Record<string, readonly string[]> = {
  command: [],
  builtin: [],
  nohup: [],
  env: ["-u", "-C", "-S"],
  sudo: ["-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U"],
  xargs: ["-I", "-n", "-L", "-P", "-s", "-d", "-E", "-a"],
  nice: ["-n"],
  timeout: ["-s", "-k"],
};
const FILE_CHANGERS = new Set([
  "cp",
  "mv",
  "rm",
  "ln",
  "touch",
  "truncate",
  "install",
  "rsync",
  "dd",
  "chmod",
  "chown",
  "unlink",
  "rmdir",
  "mkdir",
]);
const GIT_FILE_CHANGERS = new Set([
  "checkout",
  "restore",
  "mv",
  "rm",
  "reset",
  "stash",
  "clean",
  "switch",
  "am",
]);
const TOKEN_SEPARATOR = /[\s;&|<>()'"`=,]+/;
const MAX_DEPTH = 5;

// Parses a command line, unwrapping prefixes and following `sh -c` strings and heredocs fed to shells.
function expand(command: string, depth = 0): { commands: Unwrapped[]; unreadable?: string } {
  if (depth > MAX_DEPTH) return { commands: [], unreadable: "shells nested too deeply" };
  const parsed = parseShell(command);
  const commands: Unwrapped[] = [];
  let why = parsed.unreadable;
  for (const simple of parsed.commands) {
    const unwrapped = unwrap(simple.assignments, simple.words, simple.dynamic);
    commands.push({ ...unwrapped, redirects: simple.redirects, heredocs: simple.heredocs });
    const { argv, dynamic } = unwrapped;
    const names = argv.map((word) => path.basename(word));
    // A shell or command runner anywhere in the words (`pnpm exec bash -c …`, `find -exec sh -c …`) runs
    // the script after its `-c`; a heredoc goes to whichever shell is in the command.
    const scripts = names.some((name) => SHELLS.has(name)) ? [...simple.heredocs] : [];
    names.forEach((name, at) => {
      if (STRING_RUNNERS.has(name)) {
        const flag = argv.findIndex((word, i) => i > at && /^(?:-[a-zA-Z]*c[a-zA-Z]*|--command)$/.test(word));
        if (flag !== -1) {
          if (dynamic[flag + 1] === true) why ??= "a script built from a variable";
          scripts.push(argv[flag + 1] ?? "");
        }
        const inline = argv.slice(at + 1).find((word) => word.startsWith("--command="));
        if (inline !== undefined) scripts.push(inline.slice("--command=".length));
      }
      // `watch` runs its remaining arguments as one command line.
      if (name === "watch") {
        scripts.push(
          argv
            .slice(at + 1)
            .filter((word) => !word.startsWith("-"))
            .join(" "),
        );
      }
    });
    for (const script of scripts) {
      const nested = expand(script, depth + 1);
      commands.push(...nested.commands);
      why ??= nested.unreadable;
    }
  }
  return why === undefined ? { commands } : { commands, unreadable: why };
}

// Removes prefix commands and keywords, collecting `env`'s assignments.
function unwrap(
  assignments: readonly string[],
  words: readonly string[],
  dynamic: readonly boolean[],
): Omit<Unwrapped, "redirects" | "heredocs"> {
  const collected = [...assignments];
  let i = 0;
  for (;;) {
    const name = words[i] === undefined ? "" : path.basename(words[i] ?? "");
    if (PREFIXES.has(name)) {
      i++;
      continue;
    }
    const valued = WRAPPERS[name];
    if (valued === undefined || dynamic[i] === true) break;
    i++;
    while (i < words.length) {
      const word = words[i] ?? "";
      if (name === "env" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) collected.push(word);
      else if (!word.startsWith("-")) break;
      i += valued.includes(word) ? 2 : 1;
    }
    if (name === "timeout" && i < words.length) i++;
  }
  return { argv: words.slice(i), dynamic: dynamic.slice(i), assignments: collected };
}

function classifySimple(command: Unwrapped): CommandDecision {
  const { argv, dynamic, assignments } = command;
  if (assignments.some((a) => /^HUSKY=0$/.test(a) || /hookspath/i.test(a))) return deny(SKIP_HOOKS);
  if (argv.length === 0) return ALLOW;
  if (dynamic[0] === true) return ask(unreadable("the command name comes from a variable or substitution"));
  const name = program(argv);
  if (name === "eval")
    return ask(
      "Pharoam's guard can't check commands run through eval, so they need the user's explicit approval.",
    );
  // `git` or `gh` anywhere in the words, as in `find -exec git push` or `doas git commit`, is checked from
  // there, so wrappers the guard doesn't know can't hide them.
  const decisions = argv.flatMap((word, i) => {
    if (dynamic[i] === true) return [];
    const at = path.basename(word);
    if (at === "git") return [classifyGit(argv.slice(i + 1), dynamic.slice(i + 1))];
    if (at === "gh") return [classifyGh(argv.slice(i + 1), dynamic.slice(i + 1))];
    return [];
  });
  return strictest(decisions);
}

// Commands that only read or list files and have no option that runs another program.
const STRICT_READERS = new Set(["ls", "cat", "grep", "wc", "head", "tail", "stat", "file", "du"]);
const STRICT_GIT = new Set(["grep", "ls-files", "status"]);
// git options that run a pager, an external diff or a text conversion, or set configuration.
const GIT_RUNS_PROGRAMS =
  /^(?:-O|--open-files-in-pager|--textconv|--ext-diff|-p|--paginate|-c|--config-env)(?:=|$)/;

// Whether a command only reads or lists files: a strict reader, with no variable assignments (such as a
// PAGER) and, for git, none of the options that run another program.
function readsOnly(command: Unwrapped): boolean {
  if (command.assignments.length > 0) return false;
  const name = program(command.argv);
  if (STRICT_READERS.has(name)) return true;
  const args = command.argv.slice(1);
  return (
    name === "git" &&
    STRICT_GIT.has(gitSubcommand(args) ?? "") &&
    !args.some((arg) => GIT_RUNS_PROGRAMS.test(arg))
  );
}

// Whether a word names the unlock command or script. Fails closed for globs: one whose file-name part could
// match `unlock.ts` counts, unless every command in the line only reads or lists files. So `ls *` and
// `cat tooling/guard/bin/u*` stay allowed; `node tooling/guard/bin/u*`, `ls … | xargs node` and
// `ls … | awk …` don't.
function namesUnlock(word: string, lineReadsOnly: boolean): boolean {
  const base = path.basename(word);
  if (!/[*?[]/.test(word)) return word.toLowerCase() === "guard:unlock" || base.toLowerCase() === "unlock.ts";
  if (word.includes(":") && globMatches(word, "guard:unlock")) return true;
  return globMatches(base, "unlock.ts") && !lineReadsOnly;
}

// The unlock command or script named anywhere in the command line, even inside a longer argument or a
// script string. Commit messages that mention them are refused too; write those from a file.
const UNLOCK_TEXT = /guard:unlock|unlock\.ts/i;

// The old text patterns, kept as a second layer: commits, pushes and PR changes named in plain text ask.
const BACKSTOP: readonly [RegExp, string][] = [
  [/\bgit\s+commit\b/, COMMIT],
  [/\bgit\s+push\b/, PUSH],
  [/\bgh\s+pr\s+(?:create|merge|edit|close|reopen|ready)\b/, PUBLISH],
];

function backstop(command: string): CommandDecision {
  const code = command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");
  const match = BACKSTOP.find(([pattern]) => pattern.test(code));
  return match === undefined ? ALLOW : ask(match[1]);
}

// Whether a path or word matches `target`, ignoring letter case and treating `*`, `?` and `[…]` as the shell
// does in globs.
function globMatches(pattern: string, target: string): boolean {
  const lower = pattern.toLowerCase();
  if (!/[*?[]/.test(lower)) return lower === target;
  const source = globSource(lower);
  // A glob too unusual to convert, such as one with a POSIX class or a reversed range, is assumed to match:
  // fail closed.
  if (source === undefined) return true;
  try {
    return new RegExp(`^${source}$`).test(target);
  } catch {
    return true;
  }
}

// A glob as a regular-expression source, or undefined when it uses bracket features this doesn't convert.
// Inside `[…]`, `*` and `?` are ordinary characters; `[!…]` and `[^…]` negate; `]` right after the opening
// bracket is a member; an unmatched `[` is an ordinary character, as in the shell.
function globSource(glob: string): string | undefined {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i);
    if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else if (c === "[") {
      let j = i + 1;
      const negated = glob.charAt(j) === "!" || glob.charAt(j) === "^";
      if (negated) j++;
      const start = j;
      if (glob.charAt(j) === "]") j++;
      while (j < glob.length && glob.charAt(j) !== "]") j++;
      if (j >= glob.length) {
        source += "\\[";
        continue;
      }
      const members = glob.slice(start, j);
      if (/\[[:=.]/.test(members)) return undefined;
      source += `[${negated ? "^" : ""}${members.replace(/[\\\]^]/g, "\\$&")}]`;
      i = j;
    } else source += c.replace(/[.+^${}()|\\\]]/g, "\\$&");
  }
  return source;
}

// The folder a glob could write in: the part before the first glob character, up to its last `/`.
function globFolder(relative: string): string {
  const wildcard = relative.search(/[*?[]/);
  if (wildcard === -1) return relative;
  const folder = relative.slice(0, wildcard).replace(/\/[^/]*$|^[^/]*$/, "");
  return folder === "" ? "." : folder;
}

// git's global options that take a separate value.
const GIT_VALUED = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--super-prefix",
  "--config-env",
  "--exec-path",
]);

function classifyGit(args: readonly string[], dynamic: readonly boolean[]): CommandDecision {
  let i = 0;
  const configs: string[] = [];
  while (i < args.length && (args[i] ?? "").startsWith("-")) {
    const option = args[i] ?? "";
    if (option === "-c" || option === "--config-env") configs.push(args[i + 1] ?? "");
    if (option.startsWith("--config-env=")) configs.push(option.slice("--config-env=".length));
    i += GIT_VALUED.has(option) ? 2 : 1;
  }
  if (configs.some((c) => /^core\.hookspath/i.test(c))) return deny(SKIP_HOOKS);
  if (configs.some((c) => /^alias\./i.test(c))) return ask(ALIAS);
  if (configs.some((c) => RUNS_PROGRAM_CONFIG.test(c))) return ask(PROGRAM_CONFIG);
  const subcommand = args[i];
  if (subcommand === undefined) return ALLOW;
  if (dynamic[i] === true) return ask(unreadable("the git subcommand comes from a variable or substitution"));
  const rest = args.slice(i + 1);
  switch (subcommand) {
    case "commit":
      return skipsHooks(rest, COMMIT_VALUED, "mFcCt", "uS", true) ? deny(SKIP_HOOKS) : ask(COMMIT);
    case "push":
      if (skipsHooks(rest, PUSH_VALUED, "o", "", false)) return deny(SKIP_HOOKS);
      return forcesPush(rest) ? deny(FORCE_PUSH) : ask(PUSH);
    case "config":
      if (rest.some((word) => /core\.hookspath/i.test(word))) return ask(HOOKS_PATH);
      if (rest.some((word) => /^alias\./i.test(word))) return ask(ALIAS);
      return rest.some((word) => RUNS_PROGRAM_CONFIG.test(word)) ? ask(PROGRAM_CONFIG) : ALLOW;
    default:
      return ALLOW;
  }
}

const COMMIT_VALUED = new Set([
  "--message",
  "--file",
  "--reuse-message",
  "--reedit-message",
  "--template",
  "--author",
  "--date",
  "--fixup",
  "--squash",
  "--trailer",
  "--cleanup",
  "--pathspec-from-file",
]);
const PUSH_VALUED = new Set(["--push-option", "--receive-pack", "--exec", "--repo"]);

// Whether git options skip hooks: `--no-verify` (or an unambiguous prefix) or, for commit, a short `-n`.
// Short clusters stop at the first option that takes a value, as in `-mn` (message "n").
function skipsHooks(
  args: readonly string[],
  valuedLong: ReadonlySet<string>,
  valuedShort: string,
  attachedShort: string,
  shortN: boolean,
): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--") return false;
    if (arg.length >= "--no-veri".length && "--no-verify".startsWith(arg)) return true;
    if (valuedLong.has(arg)) i++;
    else if (/^-[a-zA-Z]+$/.test(arg)) {
      for (let j = 1; j < arg.length; j++) {
        const letter = arg.charAt(j);
        if (shortN && letter === "n") return true;
        if (valuedShort.includes(letter)) {
          if (j === arg.length - 1) i++;
          break;
        }
        if (attachedShort.includes(letter)) break;
      }
    }
  }
  return false;
}

function forcesPush(args: readonly string[]): boolean {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--mirror" || (arg.length >= "--for".length && arg.startsWith("--for"))) return true;
    if (PUSH_VALUED.has(arg)) i++;
    else if (/^-[a-zA-Z]+$/.test(arg)) {
      const letters = arg.slice(1);
      const valueAt = letters.indexOf("o");
      if ((valueAt === -1 ? letters : letters.slice(0, valueAt)).includes("f")) return true;
      if (valueAt === letters.length - 1) i++;
    } else if (arg.startsWith("+")) return true;
  }
  return false;
}

const GH_CHANGES: Record<string, ReadonlySet<string>> = {
  pr: new Set(["create", "merge", "edit", "close", "reopen", "ready", "comment", "review"]),
  release: new Set(["create", "delete", "edit", "upload"]),
  repo: new Set(["create", "delete", "edit", "rename", "archive", "sync"]),
};

function classifyGh(args: readonly string[], dynamic: readonly boolean[]): CommandDecision {
  const [group, action] = args;
  if (group === undefined) return ALLOW;
  if (dynamic[0] === true || dynamic[1] === true) {
    return ask(unreadable("the gh command comes from a variable or substitution"));
  }
  if (group === "api") return ask(PUBLISH);
  return action !== undefined && GH_CHANGES[group]?.has(action) === true ? ask(PUBLISH) : ALLOW;
}

// Paths a command line may write. `hidden` is true when an applied patch hides its targets.
function writeCandidates(commands: readonly Unwrapped[]): { paths: string[]; hidden: boolean } {
  const certain = commands.flatMap((c) => [
    ...c.redirects,
    ...(program(c.argv) === "tee" ? c.argv.slice(1).filter((w) => !w.startsWith("-")) : []),
  ]);
  const hidden = commands.some(appliesPatch);
  if (!commands.some(changesFiles)) return { paths: certain, hidden };
  // A file-changing command may get its paths from anywhere in the line (`… | xargs rm`, inline scripts).
  const named = commands.flatMap((c) =>
    [...c.argv, ...c.heredocs].flatMap((text) => text.split(TOKEN_SEPARATOR)),
  );
  return { paths: [...certain, ...named], hidden };
}

function changesFiles(command: Unwrapped): boolean {
  const { argv, heredocs } = command;
  const name = program(argv);
  const args = argv.slice(1);
  if (FILE_CHANGERS.has(name)) return true;
  if (name === "sed") return args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"));
  if (name === "git") return GIT_FILE_CHANGERS.has(gitSubcommand(args) ?? "");
  if (INTERPRETERS.has(name)) {
    return (
      heredocs.length > 0 || args.some((a) => /^-[a-zA-Z]*[ceip]/.test(a) || a === "-" || a === "--eval")
    );
  }
  return false;
}

function appliesPatch(command: Unwrapped): boolean {
  const name = program(command.argv);
  const args = command.argv.slice(1);
  if (name === "patch") return true;
  return name === "git" && gitSubcommand(args) === "apply" && !args.includes("--check");
}

function gitSubcommand(args: readonly string[]): string | undefined {
  let i = 0;
  while (i < args.length && (args[i] ?? "").startsWith("-")) i += GIT_VALUED.has(args[i] ?? "") ? 2 : 1;
  return args[i];
}

function program(argv: readonly string[]): string {
  return path.basename(argv[0] ?? "");
}

function strictest(decisions: readonly CommandDecision[]): CommandDecision {
  return decisions.find((d) => d.decision === "deny") ?? decisions.find((d) => d.decision === "ask") ?? ALLOW;
}

// A token as a repo-relative path after resolving symlinks, or undefined when it can't be inside the repo.
function toRelative(token: string, context: CommandContext): string | undefined {
  if (token === "" || token.startsWith("-") || token.startsWith("~") || token.startsWith("&"))
    return undefined;
  const resolve = context.resolve ?? ((p: string) => p);
  const root = resolve(path.resolve(context.projectDir || "/"));
  const absolute = resolve(path.resolve(context.cwd ?? root, token));
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return relative === "" ? "." : relative.split(path.sep).join("/");
}

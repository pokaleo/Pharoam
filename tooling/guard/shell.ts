/**
 * Reads a shell command line the way the shell splits it, so command rules match real words, not text.
 *
 * @remarks Covers what agents write in practice: quotes, escapes, `;`, `&&`, `||`, pipes, subshells,
 * redirections, heredocs, command substitution and variable expansion. It doesn't run anything or expand
 * variables; words built from expansions are marked dynamic, and input it can't read is reported so the
 * caller can ask the user instead of guessing.
 * @packageDocumentation
 */

/** One simple command: what runs, with its own assignments, redirections and heredocs. */
export interface SimpleCommand {
  /** Leading `NAME=value` assignments, such as `HUSKY=0`. */
  assignments: string[];
  /** The command and its arguments, with quotes and escapes removed. */
  words: string[];
  /** For each word, whether it contains a variable or command substitution whose value isn't known. */
  dynamic: boolean[];
  /** For each word, whether it has an unquoted `*`, `?` or `[`, so the shell expands it as a glob. */
  globbed: boolean[];
  /** Files written by `>`, `>>`, `>|` or `&>`. */
  redirects: string[];
  /** Heredoc bodies fed to the command, as text. */
  heredocs: string[];
}

/** A parsed command line. */
export interface ParsedShell {
  /** Every simple command, including those inside `$(…)`, backticks and subshells. */
  commands: SimpleCommand[];
  /** Why the line couldn't be read reliably, such as an unterminated quote; absent when it could. */
  unreadable?: string;
}

/**
 * Splits a command line into simple commands and words.
 *
 * @param input - The full command line, possibly several lines long.
 * @returns The commands found, and a reason when part of the line couldn't be read.
 */
export function parseShell(input: string): ParsedShell {
  const commands: SimpleCommand[] = [];
  const unreadable = parseInto(input, commands);
  return unreadable === undefined ? { commands } : { commands, unreadable };
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const FD_DUPLICATE = /^(?:\d+-?|-)$/;
const VARIABLE_NAME = /[A-Za-z0-9_@*#?$!-]/;

interface PendingHeredoc {
  delimiter: string;
  stripTabs: boolean;
  /** An unquoted delimiter means the shell expands `$(…)` and backticks in the body. */
  expands: boolean;
  owner: SimpleCommand;
}

// Parses `input` and appends its commands to `out`; returns why it couldn't, or undefined.
function parseInto(input: string, out: SimpleCommand[]): string | undefined {
  let command = newCommand();
  let word: string | null = null;
  let dynamic = false;
  let quoted = false;
  let globbed = false;
  let target: "word" | "redirect" | "input" | "duplicate" | "heredoc" = "word";
  let heredocTabs = false;
  const heredocs: PendingHeredoc[] = [];

  // A function, so TypeScript doesn't narrow `word` across the helpers that change it.
  const inWord = () => word !== null;
  const append = (text: string, isDynamic = false) => {
    word = (word ?? "") + text;
    dynamic ||= isDynamic;
  };
  const finishWord = () => {
    if (word === null) return;
    if (target === "heredoc") {
      heredocs.push({ delimiter: word, stripTabs: heredocTabs, expands: !quoted, owner: command });
    } else if (target === "redirect" || (target === "duplicate" && !FD_DUPLICATE.test(word))) {
      command.redirects.push(word);
    } else if (target === "word") {
      if (command.words.length === 0 && ASSIGNMENT.test(word)) command.assignments.push(word);
      else {
        command.words.push(word);
        command.dynamic.push(dynamic);
        command.globbed.push(globbed);
      }
    }
    word = null;
    dynamic = false;
    quoted = false;
    globbed = false;
    target = "word";
  };
  const finishCommand = () => {
    finishWord();
    const { assignments, words, redirects } = command;
    if (assignments.length + words.length + redirects.length > 0) out.push(command);
    command = newCommand();
  };
  // A file-descriptor number written right before a redirection, as in `2>`, isn't a word.
  const dropDescriptor = () => {
    if (word !== null && /^\d+$/.test(word) && !dynamic) word = null;
    else finishWord();
  };

  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);
    const next = input.charAt(i + 1);

    if (c === "\n") {
      finishCommand();
      const result = readHeredocs(input, i + 1, heredocs.splice(0), out);
      if (typeof result === "string") return result;
      i = result - 1;
    } else if (c === " " || c === "\t") {
      finishWord();
    } else if (c === "#" && !inWord()) {
      while (i + 1 < input.length && input.charAt(i + 1) !== "\n") i++;
    } else if (c === ";" || c === "(" || c === ")") {
      finishCommand();
    } else if (c === "&") {
      if (next === ">") {
        finishWord();
        target = "redirect";
        i += input.charAt(i + 2) === ">" ? 2 : 1;
      } else {
        if (next === "&") i++;
        finishCommand();
      }
    } else if (c === "|") {
      if (next === "|" || next === "&") i++;
      finishCommand();
    } else if (c === ">") {
      dropDescriptor();
      let j = i + 1;
      if (input.charAt(j) === ">" || input.charAt(j) === "|") j++;
      if (input.charAt(j) === "&") {
        target = "duplicate";
        j++;
      } else target = "redirect";
      i = j - 1;
    } else if (c === "<") {
      dropDescriptor();
      if (next === "<" && input.charAt(i + 2) === "<") {
        target = "input";
        i += 2;
      } else if (next === "<") {
        heredocTabs = input.charAt(i + 2) === "-";
        target = "heredoc";
        i += heredocTabs ? 2 : 1;
      } else if (next === ">") {
        target = "redirect";
        i++;
      } else target = "input";
    } else if (c === "'") {
      const close = input.indexOf("'", i + 1);
      if (close === -1) return "an unterminated single quote";
      quoted = true;
      append(input.slice(i + 1, close));
      i = close;
    } else if (c === '"') {
      const result = readDoubleQuoted(input, i + 1, out);
      if (typeof result === "string") return result;
      quoted = true;
      append(result.text, result.dynamic);
      i = result.end;
    } else if (c === "\\") {
      // A backslash before a newline only continues the line; it doesn't quote anything.
      if (next !== "\n") {
        quoted = true;
        append(next);
      }
      i++;
    } else if (c === "$" || c === "`") {
      const result = readExpansion(input, i, out);
      if (typeof result === "string") return result;
      append(result.text, result.dynamic);
      i = result.end;
    } else {
      if (c === "*" || c === "?" || c === "[") globbed = true;
      append(c);
    }
  }
  finishCommand();
  return undefined;
}

interface Piece {
  text: string;
  dynamic: boolean;
  end: number;
}

// Reads a double-quoted string starting after its opening quote; `end` is the closing quote's index.
function readDoubleQuoted(input: string, start: number, out: SimpleCommand[]): Piece | string {
  let text = "";
  let dynamic = false;
  for (let i = start; i < input.length; i++) {
    const c = input.charAt(i);
    if (c === '"') return { text, dynamic, end: i };
    if (c === "\\" && '"\\$`\n'.includes(input.charAt(i + 1))) {
      if (input.charAt(i + 1) !== "\n") text += input.charAt(i + 1);
      i++;
    } else if (c === "$" || c === "`") {
      const result = readExpansion(input, i, out);
      if (typeof result === "string") return result;
      text += result.text;
      dynamic ||= result.dynamic;
      i = result.end;
    } else text += c;
  }
  return "an unterminated double quote";
}

// Reads `$name`, `${…}`, `$(…)`, `$((…))` or a backtick substitution starting at `start`. Commands inside a
// substitution are parsed into `out`, since the shell runs them too.
function readExpansion(input: string, start: number, out: SimpleCommand[]): Piece | string {
  const next = input.charAt(start + 1);
  if (input.charAt(start) === "`") {
    const close = findBacktick(input, start + 1);
    if (close === -1) return "an unterminated backtick substitution";
    const nested = parseInto(input.slice(start + 1, close), out);
    return nested ?? { text: "`…`", dynamic: true, end: close };
  }
  if (next === "(") {
    const close = findClosingParen(input, start + 1);
    if (close === -1) return "an unterminated $( substitution";
    if (input.charAt(start + 2) === "(") {
      if (/\$\(|`/.test(input.slice(start + 3, close))) return "a substitution inside $((…)) arithmetic";
      return { text: "$((…))", dynamic: true, end: close };
    }
    const nested = parseInto(input.slice(start + 2, close), out);
    return nested ?? { text: "$(…)", dynamic: true, end: close };
  }
  if (next === "{") {
    const close = input.indexOf("}", start + 2);
    if (close === -1) return "an unterminated ${ expansion";
    if (/\$\(|`/.test(input.slice(start + 2, close))) return "a substitution inside a ${…} expansion";
    return { text: input.slice(start, close + 1), dynamic: true, end: close };
  }
  if (VARIABLE_NAME.test(next)) {
    let end = start + 1;
    if (/[A-Za-z_]/.test(next)) while (/[A-Za-z0-9_]/.test(input.charAt(end + 1))) end++;
    return { text: input.slice(start, end + 1), dynamic: true, end };
  }
  return { text: "$", dynamic: false, end: start };
}

// Index of the `)` that closes the `(` at `open`, skipping quoted text; -1 when there is none.
function findClosingParen(input: string, open: number): number {
  let depth = 0;
  for (let i = open; i < input.length; i++) {
    const c = input.charAt(i);
    if (c === "\\") i++;
    else if (c === "'") {
      i = input.indexOf("'", i + 1);
      if (i === -1) return -1;
    } else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}

// Index of the next unescaped backtick from `start`; -1 when there is none.
function findBacktick(input: string, start: number): number {
  for (let i = start; i < input.length; i++) {
    if (input.charAt(i) === "\\") i++;
    else if (input.charAt(i) === "`") return i;
  }
  return -1;
}

// Reads the bodies of pending heredocs from `start`, attaching each to its command; returns where parsing
// resumes, or why a body couldn't be read. A missing delimiter ends the body at the end of the input, as the
// shell does. Substitutions in the body of an unquoted heredoc run, so they are parsed into `out`.
function readHeredocs(
  input: string,
  start: number,
  pending: PendingHeredoc[],
  out: SimpleCommand[],
): number | string {
  let position = start;
  for (const heredoc of pending) {
    let body = "";
    while (position < input.length) {
      const lineEnd = input.indexOf("\n", position);
      const end = lineEnd === -1 ? input.length : lineEnd;
      const line = input.slice(position, end);
      position = end + 1;
      if ((heredoc.stripTabs ? line.replace(/^\t+/, "") : line) === heredoc.delimiter) break;
      body += `${line}\n`;
    }
    heredoc.owner.heredocs.push(body);
    if (heredoc.expands) {
      const why = parseSubstitutions(body, out);
      if (why !== undefined) return why;
    }
  }
  return Math.min(position, input.length);
}

// Parses the `$(…)` and backtick substitutions in text the shell expands without splitting into commands.
function parseSubstitutions(text: string, out: SimpleCommand[]): string | undefined {
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (c === "\\") i++;
    else if (c === "$" || c === "`") {
      const result = readExpansion(text, i, out);
      if (typeof result === "string") return result;
      i = result.end;
    }
  }
  return undefined;
}

function newCommand(): SimpleCommand {
  return { assignments: [], words: [], dynamic: [], globbed: [], redirects: [], heredocs: [] };
}

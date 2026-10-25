import { describe, expect, it } from "vitest";
import { parseShell } from "./shell.ts";

const argv = (command: string) => parseShell(command).commands.map((c) => c.words);

describe("splitting a command line into commands and words", () => {
  it("removes quotes but keeps the words", () => {
    expect(argv(`git "commit" -m 'a message'`)).toEqual([["git", "commit", "-m", "a message"]]);
  });

  it("joins quoted and unquoted parts of one word", () => {
    expect(argv(`git com"mit" -m x`)).toEqual([["git", "commit", "-m", "x"]]);
  });

  it("handles backslash escapes", () => {
    expect(argv(String.raw`git comm\it -m "say \"hi\""`)).toEqual([["git", "commit", "-m", 'say "hi"']]);
  });

  it.each([";", "&&", "||", "|", "&", "\n"])("splits commands on %j", (separator) => {
    expect(argv(`git status${separator}git push`)).toEqual([
      ["git", "status"],
      ["git", "push"],
    ]);
  });

  it("splits on subshell parentheses", () => {
    expect(argv("(cd repo && git push)")).toEqual([
      ["cd", "repo"],
      ["git", "push"],
    ]);
  });

  it("keeps leading variable assignments apart from the words", () => {
    const [command] = parseShell("HUSKY=0 GIT_DIR=x git commit").commands;
    expect(command?.assignments).toEqual(["HUSKY=0", "GIT_DIR=x"]);
    expect(command?.words).toEqual(["git", "commit"]);
  });

  it("ignores comments", () => {
    expect(argv("git status # then git push")).toEqual([["git", "status"]]);
  });
});

describe("redirections", () => {
  it.each([
    ["echo x > a.txt", "a.txt"],
    ["echo x >> 'a b.txt'", "a b.txt"],
    ['echo x >".claude/guard-unlock"', ".claude/guard-unlock"],
    ["echo x 2> err.txt", "err.txt"],
    ["echo x &> out.txt", "out.txt"],
    ["echo x >| out.txt", "out.txt"],
  ])("records the target of %s", (command, target) => {
    expect(parseShell(command).commands[0]?.redirects).toEqual([target]);
  });

  it("doesn't treat fd duplication or input as a write target", () => {
    const [command] = parseShell("cmd 2>&1 < in.txt").commands;
    expect(command?.redirects).toEqual([]);
    expect(command?.words).toEqual(["cmd"]);
  });
});

describe("nested and hidden commands", () => {
  it("parses command substitution as commands of its own", () => {
    expect(argv("echo $(git commit -m x)")).toContainEqual(["git", "commit", "-m", "x"]);
    expect(argv("echo `git push`")).toContainEqual(["git", "push"]);
  });

  it("marks words built from expansions as dynamic", () => {
    const [command] = parseShell("git $SUB -m x").commands;
    expect(command?.dynamic).toEqual([false, true, false, false]);
  });

  it("keeps single-quoted dollars literal", () => {
    expect(parseShell("echo '$HOME'").commands[0]?.dynamic).toEqual([false, false]);
  });

  it("keeps heredoc bodies as data on the command", () => {
    const [command, ...rest] = parseShell("bash <<'EOF'\ngit commit -m x\nEOF\ngit status").commands;
    expect(command?.words).toEqual(["bash"]);
    expect(command?.heredocs).toEqual(["git commit -m x\n"]);
    expect(rest.map((c) => c.words)).toEqual([["git", "status"]]);
  });
});

describe("commands it can't read", () => {
  it.each([
    `git commit -m "unterminated`,
    "git commit -m 'unterminated",
    "echo $(git push",
    "echo `git push",
  ])("reports %j as unreadable", (command) => {
    expect(parseShell(command).unreadable).toBeTruthy();
  });

  it("reads ordinary commands", () => {
    expect(parseShell("git status && pnpm test").unreadable).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { classifyCommand, writesProtectedPath } from "./bash-rules.ts";

const context = { projectDir: "/repo" };
const decision = (cmd: string) => classifyCommand(cmd, context).decision;

describe("Bash command rules", () => {
  describe("skipping or rewriting verification is denied", () => {
    it.each([
      "git commit --no-verify -m 'x'",
      "git commit --no-veri -m 'x'",
      "git commit -nm 'x'",
      "git commit -anm 'x'",
      "git commit -n -m 'x'",
      "git push --no-verify",
      "HUSKY=0 git commit -m 'x'",
      "env HUSKY=0 git commit -m 'x'",
      "git -c core.hooksPath=/dev/null commit -m x",
      "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit -m x",
      "git push --force",
      "git push -f origin main",
      "git push -uf origin main",
      "git push --force-with-lease",
      "git push --force-with-lease=main:abc123",
      "git push --mirror",
      "stdbuf -o0 git push --force",
      "find . -name x -exec git push -f ;",
      "cd repo && git push origin +main",
      `git push origin "+main"`,
    ])("denies: %s", (cmd) => {
      expect(decision(cmd)).toBe("deny");
    });
  });

  describe("recording or publishing needs the user's explicit approval", () => {
    it.each([
      "git commit -m 'feat: x'",
      "git commit -mn",
      `git commit -m "docs: explain why --no-verify is refused"`,
      "git push",
      "git push -u origin feat/x",
      "gh pr create --title x",
      "gh pr merge 1 --squash",
      "gh pr edit 1 --title y",
      "gh api -X PUT repos/o/r/pulls/1/merge",
      "gh release create v1.0.0",
      "git tag v1.0.0 && git push --tags",
      "git config core.hooksPath /dev/null",
      "git config alias.ci commit",
      "git config core.pager node",
      "git config diff.external node",
      "git config diff.ts.textconv node",
      "git config core.fsmonitor node",
      "git config credential.helper.command node",
      "git -c core.pager=node log",
    ])("asks: %s", (cmd) => {
      expect(decision(cmd)).toBe("ask");
    });
  });

  describe("disguised commits and pushes still ask", () => {
    it.each([
      `git "commit" -m x`,
      "git com'mit' -m x",
      "git -C . commit -m x",
      "git -c user.name=x commit -m x",
      "git --git-dir=.git --work-tree=. commit -m x",
      "git --no-pager push",
      "/usr/bin/git commit -m x",
      "command git commit -m x",
      "env git push",
      "sudo git push",
      "echo x | xargs git commit -m x",
      "if git commit -m x; then echo ok; fi",
      "echo $(git commit -m x)",
      "echo `git push`",
      `bash -c "git commit -m x"`,
      "bash <<'EOF'\ngit push\nEOF",
      "git -c alias.ci=commit ci -m x",
      "cat <<EOF\n$(git commit -m x)\nEOF",
      "find . -name x -exec git commit -m x ;",
      "doas git push",
      "watch git push",
      `script -q -c "git push" /dev/null`,
      `su -c "git commit -m x"`,
      `pnpm exec bash -c "git push"`,
      `find . -exec sh -c "git commit -m x" ;`,
      "doas bash <<'EOF'\ngit push\nEOF",
    ])("asks: %s", (cmd) => {
      expect(decision(cmd)).toBe("ask");
    });
  });

  describe("commands it can't read ask instead of guessing", () => {
    it.each([`git commit -m "unterminated`, "git $SUB -m x", "$GIT commit", `eval "git commit -m x"`])(
      "asks: %s",
      (cmd) => {
        const result = classifyCommand(cmd, context);
        expect(result.decision).toBe("ask");
        expect(result.reason).toMatch(/can't read|can't check/i);
      },
    );
  });

  describe("ordinary commands are allowed", () => {
    it.each([
      "git status",
      "git diff --stat",
      "git log --oneline -5",
      "git -C . status",
      "pnpm test",
      "gh pr view 1",
      "gh pr checks 1",
      "echo 'git push is documented here'",
      `grep -rn "git commit" docs`,
      "cat .claude/guard-unlock",
      "echo $(date)",
      "ls *",
      "ls tooling/guard/*.ts",
      "git grep -n x -- '*.md' '.github/*'",
      "rm -f /tmp/*.log",
      "grep -n a[b docs/x.md",
      "python3 - <<'EOF'\nfirst = items[0\nopen('/tmp/out.txt', 'w').write(first)\nEOF",
    ])("allows: %s", (cmd) => {
      expect(decision(cmd)).toBe("allow");
    });
  });

  describe("only the user can unlock enforcement edits", () => {
    it.each([
      "pnpm guard:unlock 60",
      "pnpm run guard:unlock 60",
      "npm run guard:unlock 60",
      "node tooling/guard/bin/unlock.ts 60",
      "echo 9999999999999 > .claude/guard-unlock",
      `echo 9999999999999 > ".claude/guard-unlock"`,
      "printf 9 | tee /repo/.claude/guard-unlock",
      "cp /tmp/x .claude/guard-unlock",
      "echo 9 > .Claude/Guard-Unlock",
      "make guard:unlock",
      "find tooling -name unlock.ts -exec node {} 60 ;",
      "node tooling/guard/bin/unl*.ts 60",
      "pnpm guard:unl?ck 60",
      "cp /tmp/x .claude/guard-unl*",
      `bash -c "pnpm guard:unlock 60"`,
      `pnpm exec bash -c "pnpm guard:unlock 60"`,
      `doas sh -c "node tooling/guard/bin/unlock.ts 60"`,
      `git commit -m "docs: mention guard:unlock"`,
    ])("denies: %s", (cmd) => {
      expect(decision(cmd)).toBe("deny");
    });
  });

  describe("globs are checked against the unlock script's real location", () => {
    it.each([
      ["node tooling/guard/bin/u*", "/repo"],
      ["node tooling/guard/bin/*.ts", "/repo"],
      ["node ./bin/u*", "/repo/tooling/guard"],
      ["node u*", "/repo/tooling/guard/bin"],
      ["cd tooling/guard/bin && node u*", "/repo"],
      ["node tooling/**/u*", "/repo"],
      [`find . -name "u*" -exec node {} 60 ;`, "/repo"],
      ["pnpm -C tooling/guard/bin exec node u*", "/repo"],
      ["env --chdir=tooling/guard/bin node u*", "/repo"],
      ["node ~/code/pharoam/tooling/guard/bin/u*", "/repo"],
      ["node tooling/guard/bin/[u]nlock.ts", "/repo"],
      ["node tooling/guard/bin/[t-v]nlock.ts", "/repo"],
      ["node tooling/guard/bin/[[:lower:]]nlock.ts", "/repo"],
      [`git ls-files "*/u*" | xargs node`, "/repo"],
      [`rg --files -g "u*" | xargs node`, "/repo"],
      ["node scripts/*.ts", "/repo"],
      [`rg --pre node -g "u*" x`, "/repo"],
      [`git log --ext-diff -- "tooling/guard/bin/u*"`, "/repo"],
      [`git grep -O "x" -- "tooling/guard/bin/u*"`, "/repo"],
      [`PAGER=node git ls-files "tooling/guard/bin/u*"`, "/repo"],
      [`ls tooling/guard/bin/u* | awk '{ system("node " $0) }'`, "/repo"],
      ["node tooling/guard/bin/[z-a]nlock.ts", "/repo"],
    ])("denies %s in %s", (cmd, cwd) => {
      expect(classifyCommand(cmd, { projectDir: "/repo", cwd }).decision).toBe("deny");
    });

    it.each([
      ["ls *", "/repo"],
      ["ls tooling/guard/*.ts", "/repo"],
      ["ls *.ts", "/repo/tooling/guard"],
      ["cat tooling/guard/bin/u*", "/repo"],
      ["wc -l tooling/guard/*.ts", "/repo"],
      ["node tooling/guard/bin/[*]nlock.ts", "/repo"],
      ["ls tooling/guard/bin/* | wc -l", "/repo"],
      [`git ls-files "tooling/guard/bin/*"`, "/repo"],
    ])("allows %s in %s", (cmd, cwd) => {
      expect(classifyCommand(cmd, { projectDir: "/repo", cwd }).decision).toBe("allow");
    });
  });

  it("gives a reason for every non-allow decision", () => {
    expect(classifyCommand("git push --force", context).reason).toMatch(/force/i);
    expect(classifyCommand("git commit -m x", context).reason).toMatch(/approval/i);
  });
});

describe("shell commands that write enforcement files", () => {
  const writes = (cmd: string) => writesProtectedPath(cmd, context);

  it.each([
    "sed -i '' 's/a/b/' eslint.config.ts",
    "sed -i 's/a/b/' /repo/vitest.config.ts",
    "echo x > tooling/guard/hooks.ts",
    `echo x > "tooling/guard/hooks.ts"`,
    "echo x >> .husky/pre-commit",
    "echo x > Tooling/Guard/hooks.ts",
    "cat x | tee knip.json",
    "cp /tmp/x tooling/eslint/docs.ts",
    "git mv eslint.config.js eslint.config.ts",
    "rm -rf tooling",
    "python3 - <<'EOF'\nopen('tooling/guard/protected.ts', 'w').write('')\nEOF",
    "perl -pi -e 's/a/b/' package.json",
    `node -e "require('fs').writeFileSync('typedoc.json', '')"`,
    "git checkout -- tsconfig.json",
    "git restore .",
    "git apply /tmp/fix.patch",
    "patch -p1 < /tmp/fix.patch",
    `bash -c "echo x > tooling/guard/a.ts"`,
    "echo tooling/guard/a.ts | xargs rm",
    "rm tooling/gu*/hooks.ts",
    "cp /tmp/x tooling/eslint/*.ts",
    "rm tsconfig*",
  ])("detects: %s", (cmd) => {
    expect(writes(cmd)).toBe(true);
  });

  it("resolves relative paths from the shell's working directory", () => {
    expect(
      writesProtectedPath("echo x > hooks.ts", { projectDir: "/repo", cwd: "/repo/tooling/guard" }),
    ).toBe(true);
    expect(writesProtectedPath("echo x > hooks.ts", { projectDir: "/repo", cwd: "/repo/docs" })).toBe(false);
  });

  it("follows symlinks to protected files", () => {
    const resolve = (absolute: string) => absolute.replace(/^\/repo\/link(?=\/|$)/, "/repo/tooling/guard");
    expect(writesProtectedPath("echo x > link/hooks.ts", { projectDir: "/repo", resolve })).toBe(true);
  });

  it.each([
    "cat eslint.config.ts",
    "grep -n x tooling/guard/hooks.ts",
    "sed -n 1,5p package.json",
    "pnpm exec eslint tooling/guard/hooks.ts 2>&1 | tail -5",
    "pnpm lint > /tmp/lint.txt",
    "git checkout -b feat/x",
    "rm -rf node_modules",
    "python3 -c 'print(1)'",
    "echo x > packages/core/src/a.ts",
    "git apply --check /tmp/fix.patch",
  ])("ignores: %s", (cmd) => {
    expect(writes(cmd)).toBe(false);
  });
});

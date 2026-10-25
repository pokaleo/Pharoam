import { describe, expect, it } from "vitest";
import { classifyCommand, writesProtectedPath } from "./bash-rules.ts";

const decision = (cmd: string) => classifyCommand(cmd).decision;

describe("Bash command rules", () => {
  describe("skipping or rewriting verification is denied", () => {
    it.each([
      "git commit --no-verify -m 'x'",
      "git commit -nm 'x'",
      "git commit -n -m 'x'",
      "git push --no-verify",
      "HUSKY=0 git commit -m 'x'",
      "git push --force",
      "git push -f origin main",
      "git push --force-with-lease",
      "cd repo && git push origin +main",
    ])("denies: %s", (cmd) => {
      expect(decision(cmd)).toBe("deny");
    });
  });

  describe("recording or publishing needs the user's explicit approval", () => {
    it.each([
      "git commit -m 'feat: x'",
      "git push",
      "git push -u origin feat/x",
      "gh pr create --title x",
      "gh pr merge 1 --squash",
      "gh pr edit 1 --title y",
      "git tag v1.0.0 && git push --tags",
      "git config core.hooksPath /dev/null",
    ])("asks: %s", (cmd) => {
      expect(decision(cmd)).toBe("ask");
    });
  });

  describe("ordinary commands are allowed", () => {
    it.each([
      "git status",
      "git diff --stat",
      "git log --oneline -5",
      "pnpm test",
      "gh pr view 1",
      "gh pr checks 1",
      "echo 'git push is documented here'",
    ])("allows: %s", (cmd) => {
      expect(decision(cmd)).toBe("allow");
    });
  });

  describe("only the user can unlock enforcement edits", () => {
    it.each([
      "pnpm guard:unlock 60",
      "pnpm run guard:unlock 60",
      "node tooling/guard/bin/unlock.ts 60",
      "echo 9999999999999 > .claude/guard-unlock",
    ])("denies: %s", (cmd) => {
      expect(decision(cmd)).toBe("deny");
    });
  });

  it("gives a reason for every non-allow decision", () => {
    expect(classifyCommand("git push --force").reason).toMatch(/force/i);
    expect(classifyCommand("git commit -m x").reason).toMatch(/approval/i);
  });
});

describe("shell commands that write enforcement files", () => {
  const writes = (cmd: string) => writesProtectedPath(cmd, "/repo");

  it.each([
    "sed -i '' 's/a/b/' eslint.config.ts",
    "sed -i 's/a/b/' /repo/vitest.config.ts",
    "echo x > tooling/guard/hooks.ts",
    "echo x >> .husky/pre-commit",
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
  ])("detects: %s", (cmd) => {
    expect(writes(cmd)).toBe(true);
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

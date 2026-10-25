import { describe, expect, it } from "vitest";
import { checkStaged, postToolUse, preToolUse, stop } from "./hooks.ts";

const projectDir = "/repo";
const files = (map: Record<string, string>) => (path: string) => map[path];

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const unlocked = { "/repo/.claude/guard-unlock": String(NOW + 60_000) };
const expired = { "/repo/.claude/guard-unlock": String(NOW - 1) };

describe("PreToolUse hook", () => {
  const decide = (input: object, existing: Record<string, string> = {}) =>
    preToolUse(input, { projectDir, readFile: files(existing), now: () => NOW })?.hookSpecificOutput;

  describe("enforcement files", () => {
    const editSettings = {
      tool_name: "Edit",
      tool_input: { file_path: "/repo/.claude/settings.json", old_string: "a", new_string: "b" },
    };
    const shellWrite = { tool_name: "Bash", tool_input: { command: "sed -i '' 's/a/b/' eslint.config.ts" } };

    it("asks before a shell command writes one", () => {
      expect(decide(shellWrite)?.permissionDecision).toBe("ask");
    });

    it("lets edits and shell writes through while the user has unlocked them", () => {
      expect(decide(editSettings, { ...unlocked, "/repo/.claude/settings.json": "a" })).toBeUndefined();
      expect(decide(shellWrite, unlocked)).toBeUndefined();
    });

    it("asks again once the unlock expires", () => {
      expect(decide(shellWrite, expired)?.permissionDecision).toBe("ask");
    });

    it("still asks before commits and pushes while unlocked", () => {
      expect(
        decide({ tool_name: "Bash", tool_input: { command: "git commit -m x" } }, unlocked)
          ?.permissionDecision,
      ).toBe("ask");
    });

    it("still refuses hard-rule violations while unlocked", () => {
      const out = decide(
        {
          tool_name: "Write",
          tool_input: { file_path: "/repo/tooling/eslint/x.ts", content: 'import "posthog-js";' },
        },
        unlocked,
      );
      expect(out?.permissionDecision).toBe("deny");
    });

    it("asks when a protected file is reached through a symlink or another letter case", () => {
      const resolve = (p: string) => p.replace(/^\/repo\/link(?=\/|$)/, "/repo/tooling/guard");
      const decideWith = (filePath: string) =>
        preToolUse(
          { tool_name: "Write", tool_input: { file_path: filePath, content: "export {};" } },
          { projectDir, readFile: files({}), now: () => NOW, resolve },
        )?.hookSpecificOutput.permissionDecision;
      expect(decideWith("/repo/link/hooks.ts")).toBe("ask");
      expect(decideWith("/repo/Tooling/Guard/hooks.ts")).toBe("ask");
    });

    it("refuses an agent writing the unlock file under another letter case", () => {
      expect(
        decide({ tool_name: "Write", tool_input: { file_path: "/repo/.Claude/Guard-Unlock", content: "9" } })
          ?.permissionDecision,
      ).toBe("deny");
    });

    it("asks before a disguised commit", () => {
      expect(
        decide({ tool_name: "Bash", tool_input: { command: `git -C . "commit" -m x` } })?.permissionDecision,
      ).toBe("ask");
    });

    it("refuses an agent writing the unlock file", () => {
      expect(
        decide({ tool_name: "Write", tool_input: { file_path: "/repo/.claude/guard-unlock", content: "9" } })
          ?.permissionDecision,
      ).toBe("deny");
    });
  });

  it("denies a write that breaks a hard rule, naming the rule", () => {
    const out = decide({
      tool_name: "Write",
      tool_input: { file_path: "/repo/apps/web/src/a.ts", content: 'import "posthog-js";' },
    });
    expect(out?.permissionDecision).toBe("deny");
    expect(out?.permissionDecisionReason).toMatch(/HR7-telemetry/);
  });

  it("checks the file as it will be after an Edit", () => {
    const out = decide(
      {
        tool_name: "Edit",
        tool_input: {
          file_path: "/repo/apps/web/src/a.ts",
          old_string: '"zod"',
          new_string: '"@sentry/react"',
        },
      },
      { "/repo/apps/web/src/a.ts": 'import { z } from "zod";' },
    );
    expect(out?.permissionDecision).toBe("deny");
  });

  it("asks before changing enforcement files", () => {
    const out = decide(
      {
        tool_name: "Edit",
        tool_input: { file_path: "/repo/.claude/settings.json", old_string: "a", new_string: "b" },
      },
      { "/repo/.claude/settings.json": "a" },
    );
    expect(out?.permissionDecision).toBe("ask");
    expect(out?.permissionDecisionReason).toMatch(/enforcement/i);
  });

  it("stays silent for a compliant edit", () => {
    expect(
      decide({
        tool_name: "Write",
        tool_input: { file_path: "/repo/packages/core/src/a.ts", content: "export {};" },
      }),
    ).toBeUndefined();
  });

  it("ignores files outside the project", () => {
    expect(
      decide({ tool_name: "Write", tool_input: { file_path: "/tmp/x.ts", content: 'import "posthog-js";' } }),
    ).toBeUndefined();
  });

  it("asks before git commit and denies --no-verify", () => {
    expect(
      decide({ tool_name: "Bash", tool_input: { command: "git commit -m x" } })?.permissionDecision,
    ).toBe("ask");
    expect(
      decide({ tool_name: "Bash", tool_input: { command: "git commit --no-verify -m x" } })
        ?.permissionDecision,
    ).toBe("deny");
  });

  it("stays silent for ordinary commands", () => {
    expect(decide({ tool_name: "Bash", tool_input: { command: "pnpm test" } })).toBeUndefined();
  });
});

describe("PostToolUse hook", () => {
  it("feeds lint errors on the edited file back to the agent", () => {
    const out = postToolUse(
      { tool_name: "Edit", tool_input: { file_path: "/repo/packages/core/src/a.ts" } },
      { projectDir, lint: () => ({ ok: false, output: "a.ts: error no-explicit-any" }) },
    );
    expect(out?.decision).toBe("block");
    expect(out?.reason).toMatch(/no-explicit-any/);
  });

  it("stays silent when lint passes or the file isn't code", () => {
    const deps = { projectDir, lint: () => ({ ok: true, output: "" }) };
    expect(
      postToolUse({ tool_name: "Edit", tool_input: { file_path: "/repo/packages/core/src/a.ts" } }, deps),
    ).toBeUndefined();
    expect(
      postToolUse(
        { tool_name: "Write", tool_input: { file_path: "/repo/docs/PRD.md" } },
        { projectDir, lint: () => ({ ok: false, output: "x" }) },
      ),
    ).toBeUndefined();
  });
});

describe("Stop hook", () => {
  const failing = { hasChanges: () => true, runCheck: () => ({ ok: false, output: "1 test failed" }) };

  it("blocks finishing while checks fail", () => {
    const out = stop({}, failing);
    expect(out?.decision).toBe("block");
    expect(out?.reason).toMatch(/1 test failed/);
  });

  it("lets the agent stop when checks pass", () => {
    expect(stop({}, { hasChanges: () => true, runCheck: () => ({ ok: true, output: "" }) })).toBeUndefined();
  });

  it("doesn't run checks when nothing changed", () => {
    let ran = false;
    stop({}, { hasChanges: () => false, runCheck: () => ((ran = true), { ok: false, output: "" }) });
    expect(ran).toBe(false);
  });

  it("doesn't loop when already continuing from a Stop hook", () => {
    expect(stop({ stop_hook_active: true }, failing)).toBeUndefined();
  });
});

describe("pre-commit check of staged files", () => {
  it("reports rule violations and untested sources", () => {
    const problems = checkStaged(
      {
        "apps/web/src/a.ts": 'import "posthog-js";',
        "packages/core/src/profile.ts": "export const p = 1;",
      },
      () => false,
    );
    expect(problems.join("\n")).toMatch(/HR7-telemetry/);
    expect(problems.join("\n")).toMatch(/packages\/core\/src\/profile\.ts.*test/);
  });

  it("passes clean, tested changes", () => {
    expect(
      checkStaged(
        {
          "packages/core/src/profile.ts": "export const p = 1;",
          "packages/core/src/profile.test.ts": "test",
        },
        () => false,
      ),
    ).toEqual([]);
  });
});

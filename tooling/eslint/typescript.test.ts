import path from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { typescriptConfig } from "./typescript.ts";

// TypeScript practices from ENGINEERING §2 that a lint rule can check.
const root = path.join(import.meta.dirname, "__fixtures__", "typed");

const eslint = new ESLint({
  cwd: root,
  ignore: false,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          // The probes exist only in memory, so they are type-checked against the fixture's default project.
          projectService: {
            allowDefaultProject: ["*.ts", "src/*.ts", "types/*.ts"],
            defaultProject: "tsconfig.json",
          },
          tsconfigRootDir: root,
        },
      },
    },
    ...typescriptConfig,
  ],
});

async function ruleIds(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

const SRC = "src/probe.ts";

describe("exported functions declare their return types", () => {
  it("rejects a missing return type", async () => {
    expect(await ruleIds(SRC, "export function f(a: string) { return a; }")).toContain(
      "@typescript-eslint/explicit-module-boundary-types",
    );
  });

  it("accepts an explicit one", async () => {
    expect(await ruleIds(SRC, "export function f(a: string): string { return a; }")).toEqual([]);
  });
});

describe("named exports only", () => {
  it.each(["export default function f(): void {}", "const f = 1;\nexport { f as default };"])(
    "rejects %s",
    async (code) => {
      expect(await ruleIds(SRC, code)).toContain("no-restricted-syntax");
    },
  );

  it.each(["eslint.config.ts", "vitest.config.ts", "types/plugin.d.ts"])(
    "allows a default export in %s",
    async (file) => {
      expect(await ruleIds(file, "export default {};")).toEqual([]);
    },
  );
});

describe("type assertions", () => {
  it("rejects asserting an object literal's type", async () => {
    expect(await ruleIds(SRC, "interface P { id: string }\nexport const p = {} as P;")).toContain(
      "@typescript-eslint/consistent-type-assertions",
    );
  });
});

describe("unions are handled exhaustively", () => {
  it("rejects a switch that misses a case", async () => {
    const code = [
      "type Level = 'novice' | 'expert';",
      "export function f(level: Level): number {",
      "  switch (level) {",
      "    case 'novice': return 1;",
      "  }",
      "  return 0;",
      "}",
    ].join("\n");
    expect(await ruleIds(SRC, code)).toContain("@typescript-eslint/switch-exhaustiveness-check");
  });
});

describe("naming convention", () => {
  it("rejects snake_case variables", async () => {
    expect(await ruleIds(SRC, "export const my_value = 1;")).toContain(
      "@typescript-eslint/naming-convention",
    );
  });

  it("rejects types that aren't PascalCase", async () => {
    expect(await ruleIds(SRC, "export type level = 'a';")).toContain("@typescript-eslint/naming-convention");
  });

  it.each([
    ["camelCase functions", "export function readProfile(): void {}"],
    [
      "PascalCase components and schemas",
      "export const ProfileSchema = 1;\nexport function Greeting(): null { return null; }",
    ],
    ["UPPER_CASE constants", "export const MAX_RETRIES = 3;"],
    ["external data shapes with snake_case properties", "export interface HookInput { tool_name: string }"],
    ["unused parameters marked with an underscore", "export function f(_unused: string): void {}"],
  ])("allows %s", async (_kind, code) => {
    expect(await ruleIds(SRC, code)).toEqual([]);
  });
});

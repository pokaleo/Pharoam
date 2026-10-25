import path from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { docsConfig } from "./docs.ts";

// Doc comments on every exported item, in TSDoc form, so the API reference can be generated (ADR-0018).
const root = path.join(import.meta.dirname, "__fixtures__", "boundaries");

const eslint = new ESLint({
  cwd: root,
  ignore: false,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    },
    ...docsConfig,
  ],
});

async function ruleIds(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

const SRC = "packages/core/src/probe.ts";

const documented = `
/**
 * Joins a skill's tags into one label.
 *
 * @remarks Used in the profile summary; see PRD B4.
 * @typeParam T - The kind of tag.
 * @param tags - Tags in display order.
 * @param separator - Text placed between tags.
 * @returns The joined label, or an empty string when there are no tags.
 * @throws \`RangeError\` when the separator is empty.
 */
export function label<T extends string>(tags: readonly T[], separator: string): string {
  if (separator === "") throw new RangeError("empty separator");
  return tags.join(separator);
}
`;

describe("exported items need doc comments", () => {
  it("accepts a fully documented function using TSDoc tags", async () => {
    expect(await ruleIds(SRC, documented)).toEqual([]);
  });

  it.each([
    ["function", "export function f(a: string): string { return a; }"],
    ["arrow function constant", "export const f = (a: string): string => a;"],
    ["class", "export class Store {}"],
    ["interface", "export interface Profile { id: string }"],
    ["type alias", "export type Level = 'novice' | 'expert';"],
    ["constant", "export const LIMIT = 3;"],
  ])("rejects an undocumented exported %s", async (_kind, code) => {
    expect(await ruleIds(SRC, code)).toContain("jsdoc/require-jsdoc");
  });

  it("rejects undocumented members of an exported interface", async () => {
    const code = "/** A profile. */\nexport interface Profile {\n  id: string;\n}\n";
    expect(await ruleIds(SRC, code)).toContain("jsdoc/require-jsdoc");
  });

  it.each([
    "function helper(a: string): string { return a; }",
    "const LIMIT = 3;",
    "interface Local { id: string }",
    "type Local = { id: string };",
  ])("leaves private items to the author's judgement: %s", async (code) => {
    expect(await ruleIds(SRC, `${code}\nexport {};\n`)).toEqual([]);
  });

  it("doesn't ask for comments inside a documented function or on inline parameter types", async () => {
    const code = [
      "/**",
      " * Counts open items.",
      " *",
      " * @param deps - Where the items come from.",
      " * @returns How many items are open.",
      " */",
      "export function count(deps: { list: () => string[] }): { open: number } {",
      "  const items = deps.list();",
      "  return { open: items.length };",
      "}",
    ].join("\n");
    expect(await ruleIds(SRC, code)).toEqual([]);
  });

  it("exempts type declaration shims for third-party modules", async () => {
    expect(
      await ruleIds("tooling/types/plugin.d.ts", "declare const p: object;\nexport default p;\n"),
    ).toEqual([]);
  });
});

describe("doc comments are complete TSDoc", () => {
  const fn = (doc: string) => `/**\n${doc}\n */\nexport function f(name: string): string { return name; }\n`;

  it("needs a summary", async () => {
    expect(await ruleIds(SRC, fn(" * @param name - Who to greet.\n * @returns A greeting."))).toContain(
      "jsdoc/require-description",
    );
  });

  it("needs every parameter", async () => {
    expect(await ruleIds(SRC, fn(" * Greets someone.\n * @returns A greeting."))).toContain(
      "jsdoc/require-param",
    );
  });

  it("needs the return value", async () => {
    expect(await ruleIds(SRC, fn(" * Greets someone.\n * @param name - Who to greet."))).toContain(
      "jsdoc/require-returns",
    );
  });

  it("rejects types in comments, which TypeScript already holds", async () => {
    expect(
      await ruleIds(
        SRC,
        fn(" * Greets someone.\n * @param {string} name - Who to greet.\n * @returns A greeting."),
      ),
    ).toContain("jsdoc/no-types");
  });

  it("uses TSDoc's hyphen between a parameter name and its description", async () => {
    expect(
      await ruleIds(SRC, fn(" * Greets someone.\n * @param name Who to greet.\n * @returns A greeting.")),
    ).toContain("jsdoc/require-hyphen-before-param-description");
  });

  it("rejects descriptions that only repeat the name", async () => {
    expect(
      await ruleIds(SRC, fn(" * Greets someone.\n * @param name - The name.\n * @returns A greeting.")),
    ).toContain("jsdoc/informative-docs");
  });

  it("rejects tags that aren't TSDoc", async () => {
    expect(
      await ruleIds(
        SRC,
        fn(" * Greets someone.\n * @param name - Who to greet.\n * @returns A greeting.\n * @foo"),
      ),
    ).toContain("jsdoc/check-tag-names");
  });
});

describe("exempt files", () => {
  it.each(["packages/core/src/probe.test.ts", "packages/core/src/__fixtures__/probe.ts", "vitest.config.ts"])(
    "%s",
    async (file) => {
      expect(await ruleIds(file, "export function f(a: string): string { return a; }")).toEqual([]);
    },
  );
});

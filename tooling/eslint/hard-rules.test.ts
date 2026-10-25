import path from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { hardRulesConfig } from "./hard-rules.ts";

// Path-dependent AGENTS.md hard rules, enforced by ESLint.
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
    ...hardRulesConfig,
  ],
});

async function ruleIds(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

const importOf = (module: string) => `import x from "${module}";\nexport { x };\n`;

describe("HR1: the relay never stores data", () => {
  it.each([
    "node:fs",
    "fs",
    "fs/promises",
    "node:sqlite",
    "better-sqlite3",
    "pg",
    "redis",
    "ioredis",
    "mongodb",
    "@aws-sdk/client-s3",
  ])("rejects %s in apps/relay", async (module) => {
    expect(await ruleIds("apps/relay/src/probe.ts", importOf(module))).toContain("no-restricted-imports");
  });

  it("allows its web framework", async () => {
    expect(await ruleIds("apps/relay/src/probe.ts", importOf("hono"))).toEqual([]);
  });
});

describe("HR5: AI calls only through providers and the core AI layer", () => {
  it.each(["@langchain/core", "@langchain/langgraph", "langchain", "@anthropic-ai/sdk", "openai"])(
    "rejects %s in the web UI",
    async (module) => {
      expect(await ruleIds("apps/web/src/ui/probe.ts", importOf(module))).toContain("no-restricted-imports");
    },
  );

  it.each([
    "packages/core/src/profile/probe.ts",
    "packages/connector-folder/src/probe.ts",
    "apps/relay/src/probe.ts",
  ])("rejects @langchain/core in %s", async (file) => {
    expect(await ruleIds(file, importOf("@langchain/core"))).toContain("no-restricted-imports");
  });

  it.each(["packages/provider-anthropic/src/probe.ts", "packages/core/src/ai/probe.ts"])(
    "allows @langchain/core in %s",
    async (file) => {
      expect(await ruleIds(file, importOf("@langchain/core"))).toEqual([]);
    },
  );
});

describe("the core has no React", () => {
  it.each(["react", "react-dom", "react-dom/client"])("rejects %s in packages/core", async (module) => {
    expect(await ruleIds("packages/core/src/probe.ts", importOf(module))).toContain("no-restricted-imports");
    expect(await ruleIds("packages/core/src/ai/probe.ts", importOf(module))).toContain(
      "no-restricted-imports",
    );
  });

  it("allows React in the web app", async () => {
    expect(await ruleIds("apps/web/src/ui/probe.ts", importOf("react"))).toEqual([]);
  });
});

describe("HR12: no hard-coded interface text", () => {
  it("rejects literal text in web JSX", async () => {
    expect(
      await ruleIds("apps/web/src/ui/Probe.tsx", "export const Greeting = () => <p>Hello there</p>;\n"),
    ).toContain("i18next/no-literal-string");
  });

  it("allows translated text", async () => {
    expect(
      await ruleIds(
        "apps/web/src/ui/Probe.tsx",
        'declare const t: (key: string) => string;\nexport const Greeting = () => <p>{t("greeting")}</p>;\n',
      ),
    ).toEqual([]);
  });
});

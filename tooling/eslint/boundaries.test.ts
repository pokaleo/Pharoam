import path from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { boundariesConfig } from "./boundaries.ts";

// Architecture boundaries from ADR-0003 and ENGINEERING §3.
const fixtureRoot = path.join(import.meta.dirname, "__fixtures__", "boundaries");
const repoRoot = path.join(import.meta.dirname, "..", "..");

const eslint = new ESLint({
  cwd: fixtureRoot,
  ignore: false,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
    ...boundariesConfig,
    { settings: { "boundaries/root-path": fixtureRoot } },
  ],
});

async function violations(fromFile: string, importPath: string): Promise<string[]> {
  const [result] = await eslint.lintText(`import { marker } from "${importPath}";\nexport { marker };\n`, {
    filePath: path.join(fixtureRoot, fromFile),
  });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

// Type errors for a file in packages/core, checked with the package's real tsconfig.
function coreTypeErrors(code: string): string[] {
  const configPath = path.join(repoRoot, "packages", "core", "tsconfig.json");
  const read = ts.readConfigFile(configPath, (file) => ts.sys.readFile(file));
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  const config: unknown = read.config;
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));
  const probe = path.join(repoRoot, "packages", "core", "src", "probe.ts");
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  host.readFile = (file) => (file === probe ? code : readFile(file));
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (file) => file === probe || fileExists(file);
  const program = ts.createProgram([probe], options, host);
  return ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

describe("architecture boundaries", () => {
  describe("packages/core stays pure", () => {
    it("rejects importing a connector", async () => {
      expect(await violations("packages/core/src/probe.ts", "../../connector-folder/src/index")).toContain(
        "boundaries/dependencies",
      );
    });

    it("rejects importing a provider", async () => {
      expect(await violations("packages/core/src/probe.ts", "../../provider-anthropic/src/index")).toContain(
        "boundaries/dependencies",
      );
    });

    it("allows importing itself", async () => {
      expect(await violations("packages/core/src/probe.ts", "./index")).toEqual([]);
    });

    // The core runs in the browser and in Node, so it may use neither's globals; I/O is passed in.
    it.each(["document", "window", "localStorage", "fetch", "process"])("has no `%s` global", (name) => {
      // TypeScript may add a hint after the message, such as which lib or types would declare the name.
      expect(coreTypeErrors(`export const probe = ${name};\n`).join("\n")).toContain(
        `Cannot find name '${name}'.`,
      );
    });

    it("allows standard JavaScript", () => {
      expect(coreTypeErrors("export const probe = [3, 1, 2].toSorted((a, b) => a - b);\n")).toEqual([]);
    });
  });

  describe("connectors and providers depend only on core", () => {
    it("allows a connector to import core", async () => {
      expect(await violations("packages/connector-folder/src/probe.ts", "../../core/src/index")).toEqual([]);
    });

    it("rejects a connector importing the web app", async () => {
      expect(
        await violations("packages/connector-folder/src/probe.ts", "../../../apps/web/src/ui/index"),
      ).toContain("boundaries/dependencies");
    });

    it("rejects a provider importing a connector", async () => {
      expect(
        await violations("packages/provider-anthropic/src/probe.ts", "../../connector-folder/src/index"),
      ).toContain("boundaries/dependencies");
    });
  });

  describe("the web UI talks only to the core service", () => {
    it("allows UI code to import core", async () => {
      expect(await violations("apps/web/src/ui/probe.ts", "../../../../packages/core/src/index")).toEqual([]);
    });

    it("rejects UI code importing a connector", async () => {
      expect(
        await violations("apps/web/src/ui/probe.ts", "../../../../packages/connector-folder/src/index"),
      ).toContain("boundaries/dependencies");
    });

    it("rejects UI code importing a provider", async () => {
      expect(
        await violations("apps/web/src/ui/probe.ts", "../../../../packages/provider-anthropic/src/index"),
      ).toContain("boundaries/dependencies");
    });

    it("allows the composition root to wire up connectors", async () => {
      expect(
        await violations(
          "apps/web/src/composition/probe.ts",
          "../../../../packages/connector-folder/src/index",
        ),
      ).toEqual([]);
    });
  });

  describe("the relay", () => {
    it.each([
      "../../../packages/core/src/index",
      "../../../packages/connector-folder/src/index",
      "../../../packages/provider-anthropic/src/index",
    ])("may import %s", async (target) => {
      expect(await violations("apps/relay/src/probe.ts", target)).toEqual([]);
    });

    it("rejects importing the web app", async () => {
      expect(await violations("apps/relay/src/probe.ts", "../../web/src/ui/index")).toContain(
        "boundaries/dependencies",
      );
    });
  });
});

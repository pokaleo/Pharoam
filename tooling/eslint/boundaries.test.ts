import path from "node:path";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { boundariesConfig } from "./boundaries.js";

// Architecture boundaries from ADR-0003 and ENGINEERING §3.
const fixtureRoot = path.join(import.meta.dirname, "__fixtures__", "boundaries");

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

    it.each(["react", "react-dom", "react-dom/client"])("rejects importing %s", async (module) => {
      expect(await violations("packages/core/src/probe.ts", module)).toContain("no-restricted-imports");
    });

    it("allows importing itself", async () => {
      expect(await violations("packages/core/src/probe.ts", "./index")).toEqual([]);
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

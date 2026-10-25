import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { boundariesConfig } from "./tooling/eslint/boundaries.ts";
import { docsConfig } from "./tooling/eslint/docs.ts";
import { hardRulesConfig } from "./tooling/eslint/hard-rules.ts";
import { typescriptConfig } from "./tooling/eslint/typescript.ts";

export default defineConfig(
  globalIgnores(["**/node_modules/", "**/dist/", "**/coverage/", "api-docs/", "tooling/**/__fixtures__/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["**/*.tsx"],
    extends: [reactHooks.configs.flat["recommended-latest"], jsxA11y.flatConfigs.recommended],
  },
  {
    files: ["tooling/**", "*.config.ts"],
    languageOptions: { globals: globals.node },
  },
  boundariesConfig,
  hardRulesConfig,
  typescriptConfig,
  docsConfig,
  prettier,
);

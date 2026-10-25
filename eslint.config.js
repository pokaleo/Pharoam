import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { boundariesConfig } from "./tooling/eslint/boundaries.js";

export default defineConfig(
  globalIgnores(["**/node_modules/", "**/dist/", "**/coverage/", "tooling/**/__fixtures__/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"], jsxA11y.flatConfigs.recommended],
  },
  {
    files: ["tooling/**", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  boundariesConfig,
  prettier,
);

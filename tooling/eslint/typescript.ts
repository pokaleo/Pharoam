/**
 * TypeScript practices from ENGINEERING §2 that a lint rule can check.
 *
 * @remarks The rest (readonly inputs, branded IDs, typed results for expected failures) are reviewed by
 * hand; see ADR-0018.
 * @packageDocumentation
 */
import type { Linter } from "eslint";
import tseslint from "typescript-eslint";

const NAMED_EXPORTS_ONLY =
  "Use named exports, so names stay the same across imports and the API docs (ENGINEERING §2).";

/** ESLint config for the TypeScript practices in ENGINEERING §2. */
export const typescriptConfig: Linter.Config[] = [
  {
    files: ["**/*.{ts,tsx}"],
    // Tool configs and type shims for other packages must use default exports; nothing else may.
    ignores: ["**/*.config.*", "**/*.d.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "ExportDefaultDeclaration", message: NAMED_EXPORTS_ONLY },
        { selector: "ExportSpecifier[exported.name='default']", message: NAMED_EXPORTS_ONLY },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: false },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        // PascalCase for React components and Zod schemas; UPPER_CASE for fixed values.
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        { selector: "import", format: null },
        { selector: "typeLike", format: ["PascalCase"] },
        // Property names often come from outside: file front matter, hook payloads, HTTP headers.
        { selector: ["property", "parameterProperty"], format: null },
        { selector: "method", format: ["camelCase"] },
      ],
    },
  },
];

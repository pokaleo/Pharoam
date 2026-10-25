/**
 * Doc comments (ENGINEERING §11, ADR-0018).
 *
 * @remarks Every exported item carries a TSDoc comment that TypeDoc turns into the API reference. Private
 * helpers are left to the author's judgement, to avoid filler comments; a doc comment on a helper is still
 * checked for completeness, so short notes on helpers use `//`.
 * @packageDocumentation
 */
import type { Linter } from "eslint";
import jsdoc from "eslint-plugin-jsdoc";

// Files that are not part of any API: tests, fixtures, tool configs and type shims for other packages.
const EXEMPT = ["**/*.test.*", "**/__fixtures__/**", "**/*.config.*", "**/*.d.ts"];

// TSDoc tags that eslint-plugin-jsdoc doesn't know by default (https://tsdoc.org/).
const TSDOC_TAGS = [
  "remarks",
  "privateRemarks",
  "typeParam",
  "defaultValue",
  "packageDocumentation",
  "experimental",
  "alpha",
  "beta",
  "sealed",
  "virtual",
  "eventProperty",
  "label",
];

const preset = jsdoc.configs["flat/recommended-tsdoc-error"];

/** ESLint config that requires complete TSDoc comments on every exported item. */
export const docsConfig: Linter.Config[] = [
  {
    ...preset,
    files: ["**/*.{ts,tsx}"],
    ignores: EXEMPT,
    // TSDoc names some tags differently from JSDoc.
    settings: { jsdoc: { tagNamePreference: { template: "typeParam" } } },
    rules: {
      ...preset.rules,
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
          // Only direct exports and their members; `publicOnly` alone would also flag locals inside exported
          // functions and inline parameter types.
          contexts: [
            "ExportNamedDeclaration > TSInterfaceDeclaration",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > VariableDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration > TSInterfaceBody > TSPropertySignature",
            "ExportNamedDeclaration > TSInterfaceDeclaration > TSInterfaceBody > TSMethodSignature",
          ],
          checkConstructors: false,
        },
      ],
      "jsdoc/require-description": "error",
      // TSDoc has no dotted `@param a.b` names; an object parameter is described as a whole.
      "jsdoc/require-param": ["error", { checkDestructured: false }],
      "jsdoc/check-param-names": ["error", { checkDestructured: false }],
      "jsdoc/require-hyphen-before-param-description": "error",
      "jsdoc/informative-docs": "error",
      "jsdoc/check-tag-names": ["error", { definedTags: TSDOC_TAGS }],
      // A blank line between the summary and the tags, none between tags.
      "jsdoc/tag-lines": ["error", "never", { startLines: 1 }],
    },
  },
];

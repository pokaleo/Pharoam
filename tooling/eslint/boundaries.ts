/**
 * Architecture boundaries (ADR-0003, ENGINEERING §3), enforced by ESLint.
 *
 * @packageDocumentation
 */
import type { ESLint, Linter } from "eslint";
import boundariesModule from "eslint-plugin-boundaries";

// The package is CommonJS with ESM-style type declarations; under NodeNext its default import is typed as
// the module namespace, while at runtime it is the plugin object.
const boundaries = boundariesModule as unknown as ESLint.Plugin;

// A boundaries policy that lets one element type import others.
const allow = (from: string, toTypes: string[]) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: toTypes } } } },
});

/** ESLint config that keeps each package to its allowed dependencies. */
export const boundariesConfig: Linter.Config[] = [
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      // Order matters: the composition root must match before the rest of the web app.
      "boundaries/elements": [
        { type: "core", pattern: "packages/core" },
        { type: "connector", pattern: "packages/connector-*" },
        { type: "provider", pattern: "packages/provider-*" },
        { type: "web-composition", pattern: "apps/web/src/composition" },
        { type: "web", pattern: "apps/web" },
        { type: "relay", pattern: "apps/relay" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            allow("core", ["core"]),
            // Shared file handling, such as the Markdown codec, lives in the core, not in another connector.
            allow("connector", ["core"]),
            allow("provider", ["core", "provider"]),
            allow("web", ["core", "web"]),
            allow("web-composition", ["core", "connector", "provider", "web", "web-composition"]),
            allow("relay", ["core", "connector", "provider", "relay"]),
          ],
        },
      ],
    },
  },
];

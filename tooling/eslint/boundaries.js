// Architecture boundaries (ADR-0003, ENGINEERING §3), enforced by ESLint.
import boundariesModule from "eslint-plugin-boundaries";

// The package is CommonJS with ESM-style type declarations; under NodeNext its default import is typed as
// the module namespace, while at runtime it is the plugin object.
const boundaries = /** @type {import("eslint").ESLint.Plugin} */ (/** @type {unknown} */ (boundariesModule));

/**
 * @param {string} from
 * @param {string[]} toTypes
 */
const allow = (from, toTypes) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: toTypes } } } },
});

/** @type {import("eslint").Linter.Config[]} */
export const boundariesConfig = [
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
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
            allow("connector", ["core", "connector"]),
            allow("provider", ["core", "provider"]),
            allow("web", ["core", "web"]),
            allow("web-composition", ["core", "connector", "provider", "web", "web-composition"]),
            allow("relay", ["core", "connector", "provider", "relay"]),
          ],
        },
      ],
    },
  },
  {
    // The core has no UI or browser-framework dependencies.
    files: ["packages/core/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^react(-dom)?(/.*)?$", message: "packages/core must not depend on React (ADR-0003)." },
          ],
        },
      ],
    },
  },
];

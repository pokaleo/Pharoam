/**
 * Path-dependent AGENTS.md hard rules, enforced by ESLint.
 *
 * @remarks Content rules that apply everywhere (telemetry, raw HTML, LangSmith) live in `tooling/guard`.
 * ESLint doesn't merge one rule's options across config objects, so each area below is mutually exclusive
 * and gets its full list of restrictions.
 * @packageDocumentation
 */
import type { Linter } from "eslint";
import i18next from "eslint-plugin-i18next";

const CODE = "**/*.{ts,tsx}";

interface ImportPattern {
  regex: string;
  message: string;
}

const AI_SDKS: ImportPattern = {
  regex:
    "^(?:@langchain/|langchain(?:/|$)|@anthropic-ai/|openai(?:/|$)|@google/genai$|@google/generative-ai$|ollama(?:/|$)|@mistralai/|cohere-ai$)",
  message:
    "AI SDKs are only allowed in packages/provider-* and packages/core/src/ai; call AI through registered tasks (AGENTS.md hard rule 5).",
};

const STORAGE: ImportPattern = {
  regex:
    "^(?:(?:node:)?fs(?:/promises)?|node:sqlite|better-sqlite3|pg|mysql2?|mongodb|mongoose|redis|ioredis|@prisma/client|drizzle-orm|typeorm|sequelize|knex|@aws-sdk/client-(?:s3|dynamodb)|@google-cloud/storage|@azure/storage-blob)(?:/|$)",
  message:
    "The relay must never store data: no file system, database or storage clients (AGENTS.md hard rule 1).",
};

const REACT: ImportPattern = {
  regex: "^react(?:-dom)?(?:/.*)?$",
  message: "packages/core must not depend on React (ADR-0003).",
};

// A `no-restricted-imports` rule from forbidden import patterns, ready to merge into a config's rules.
const restrict = (patterns: ImportPattern[]): Linter.RulesRecord => ({
  "no-restricted-imports": ["error", { patterns }],
});

/** ESLint config for hard rules 1, 5, 11 and 12 that depend on where a file lives. */
export const hardRulesConfig: Linter.Config[] = [
  {
    files: [CODE],
    ignores: ["packages/core/**", "packages/provider-*/**", "apps/relay/**"],
    rules: restrict([AI_SDKS]),
  },
  {
    files: [`packages/core/${CODE}`],
    ignores: ["packages/core/src/ai/**"],
    rules: restrict([AI_SDKS, REACT]),
  },
  {
    files: [`packages/core/src/ai/${CODE}`],
    rules: restrict([REACT]),
  },
  {
    files: [`apps/relay/${CODE}`],
    rules: restrict([AI_SDKS, STORAGE]),
  },
  {
    files: ["apps/web/**/*.tsx"],
    plugins: { i18next },
    rules: { "i18next/no-literal-string": ["error", { mode: "jsx-text-only" }] },
  },
];

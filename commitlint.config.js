// Conventional Commits, as defined in docs/ENGINEERING.md §6.
import { RuleConfigSeverity } from "@commitlint/types";

/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      ["feat", "fix", "test", "refactor", "docs", "build", "ci", "chore", "perf", "security", "revert"],
    ],
    "header-max-length": [RuleConfigSeverity.Error, "always", 72],
  },
};

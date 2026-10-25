// git pre-commit (via husky): hard-rule content checks and the TDD check on staged files.
import { existsSync } from "node:fs";
import path from "node:path";
import { checkStaged } from "../hooks.ts";
import { projectDir, run } from "./run.ts";

const names = run("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
  .output.split("\0")
  .filter(Boolean);
const staged = Object.fromEntries(names.map((name) => [name, run("git", ["show", `:${name}`]).output]));
const problems = checkStaged(staged, (file) => existsSync(path.join(projectDir, file)));

if (problems.length > 0) {
  console.error(`Commit blocked by Pharoam's hard rules:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}

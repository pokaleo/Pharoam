/**
 * `pnpm guard`: hard-rule content checks across the repository, run by CI and `pnpm check`.
 *
 * @remarks Checks tracked files and new files git doesn't ignore, skipping files deleted from the working tree.
 * @packageDocumentation
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { checkContent } from "../content-rules.ts";
import { projectDir, run } from "./run.ts";

const files = run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
  .output.split("\0")
  .filter((file) => file !== "" && existsSync(path.join(projectDir, file)));
const problems = files.flatMap((file) =>
  checkContent(file, readFileSync(path.join(projectDir, file), "utf8")).map(
    (v) => `${file}: [${v.rule}] ${v.message}`,
  ),
);

if (problems.length > 0) {
  console.error(`Hard-rule violations:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`Hard rules: ${String(files.length)} files checked, no violations.`);

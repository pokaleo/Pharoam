/**
 * `pnpm guard:unlock <minutes>`: lets agents change enforcement files without asking, for a while.
 *
 * @remarks For the user only; the agent hook refuses agents that run it. `0` locks again straight away.
 * @packageDocumentation
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { UNLOCK_FILE, parseMinutes, unlockFileContent } from "../unlock.ts";
import { projectDir } from "./run.ts";

const file = path.join(projectDir, UNLOCK_FILE);
const result = parseMinutes(process.argv[2]);

if (!result.ok) {
  console.error(`${result.error}\nUsage: pnpm guard:unlock <minutes>   (0 locks again)`);
  process.exit(1);
}
if (result.minutes === 0) {
  rmSync(file, { force: true });
  console.log("Enforcement edits are locked: agents ask before changing enforcement files.");
} else {
  const now = Date.now();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, unlockFileContent(result.minutes, now));
  const until = new Date(now + result.minutes * 60_000).toLocaleTimeString();
  console.log(
    `Enforcement edits are unlocked until ${until}. Commits, pushes and pull requests still ask; hard-rule violations are still refused.`,
  );
}

// Claude Code Stop hook: the agent can't finish while `pnpm check` fails on a changed working tree.
import { stop } from "../hooks.ts";
import { emit, readStdinJson, run } from "./run.ts";

emit(
  stop(readStdinJson(), {
    hasChanges: () => run("git", ["status", "--porcelain"]).output !== "",
    runCheck: () => run("pnpm", ["-s", "check"]),
  }),
);

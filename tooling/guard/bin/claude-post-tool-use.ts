// Claude Code PostToolUse hook: lints the edited file and feeds errors back to the agent.
import { postToolUse } from "../hooks.ts";
import { emit, projectDir, readStdinJson, run } from "./run.ts";

emit(
  postToolUse(readStdinJson(), {
    projectDir,
    lint: (file) => run("pnpm", ["exec", "eslint", "--max-warnings=0", "--no-warn-ignored", file]),
  }),
);

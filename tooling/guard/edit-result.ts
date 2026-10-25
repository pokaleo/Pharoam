/**
 * Computes what a file will contain after an agent's edit tool call, so rules can be checked before writing.
 *
 * @packageDocumentation
 */

/** One replacement in a `MultiEdit` call. */
export interface Replacement {
  /** Text to replace. */
  old_string: string;
  /** Replacement text. */
  new_string: string;
  /** Replace every occurrence instead of the first. */
  replace_all?: boolean;
}

/**
 * The input of Claude Code's `Write`, `Edit` and `MultiEdit` tools.
 *
 * @remarks Property names follow Claude Code's hook payload.
 */
export interface EditInput {
  /** Absolute path of the file being written. */
  file_path: string;
  /** The whole new content (`Write`). */
  content?: string;
  /** Text to replace (`Edit`). */
  old_string?: string;
  /** Replacement text (`Edit`). */
  new_string?: string;
  /** Replace every occurrence instead of the first (`Edit`). */
  replace_all?: boolean;
  /** Replacements applied in order (`MultiEdit`). */
  edits?: Replacement[];
}

/**
 * Applies an edit tool call to a file's current text.
 *
 * @param toolName - `Write`, `Edit` or `MultiEdit`.
 * @param input - The tool call's input.
 * @param current - The file's text now, or `undefined` when it doesn't exist yet.
 * @returns The file's text after the call.
 */
export function resultingContent(toolName: string, input: EditInput, current: string | undefined): string {
  if (toolName === "Write") return input.content ?? "";
  const edits: Replacement[] =
    toolName === "MultiEdit"
      ? (input.edits ?? [])
      : [
          {
            old_string: input.old_string ?? "",
            new_string: input.new_string ?? "",
            replace_all: input.replace_all ?? false,
          },
        ];
  return edits.reduce(
    (text, edit) =>
      edit.replace_all
        ? text.split(edit.old_string).join(edit.new_string)
        : text.replace(edit.old_string, () => edit.new_string),
    current ?? "",
  );
}

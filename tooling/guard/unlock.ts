/**
 * A temporary unlock that lets agents change enforcement files without asking each time.
 *
 * @remarks Only the user can unlock, with `pnpm guard:unlock <minutes>`; agents are refused if they try.
 * Commits, pushes and pull requests still always ask, and hard-rule violations are still refused.
 * @packageDocumentation
 */

/** Where the unlock's expiry is kept, relative to the repository root. Ignored by git. */
export const UNLOCK_FILE = ".claude/guard-unlock";

/** The longest unlock allowed, in minutes. */
export const MAX_MINUTES = 240;

/** The outcome of reading the minutes argument. */
export type MinutesResult =
  | {
      /** The argument is usable. */
      ok: true;
      /** How long to unlock for; `0` locks again. */
      minutes: number;
    }
  | {
      /** The argument isn't usable. */
      ok: false;
      /** Why, for the user. */
      error: string;
    };

/**
 * Tells whether enforcement edits are unlocked right now.
 *
 * @param content - The unlock file's text, or `undefined` when it doesn't exist.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns `true` while the expiry in the file is in the future.
 */
export function isUnlocked(content: string | undefined, now: number): boolean {
  if (content === undefined || !/^\d+$/.test(content.trim())) return false;
  return now < Number(content.trim());
}

/**
 * The unlock file's text for an unlock starting now.
 *
 * @param minutes - How long the unlock lasts.
 * @param now - The current time, in milliseconds since the epoch.
 * @returns The expiry, in milliseconds since the epoch.
 */
export function unlockFileContent(minutes: number, now: number): string {
  return String(now + minutes * 60_000);
}

/**
 * Reads the minutes argument of `pnpm guard:unlock`.
 *
 * @param arg - The argument as typed; `0` locks again straight away.
 * @returns The minutes, or why the argument isn't usable.
 */
export function parseMinutes(arg: string | undefined): MinutesResult {
  const minutes = Number(arg);
  if (arg === undefined || !/^\d+$/.test(arg) || minutes > MAX_MINUTES) {
    return { ok: false, error: `Give the minutes as a whole number from 0 to ${String(MAX_MINUTES)}.` };
  }
  return { ok: true, minutes };
}

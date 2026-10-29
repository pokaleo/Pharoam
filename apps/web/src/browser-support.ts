/**
 * Where this browser can keep a profile.
 *
 * @packageDocumentation
 */
import type { PlaceKind } from "./profile/places.ts";

const has = (value: unknown, key: string): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && key in value;

/**
 * Where the browser can keep the profile: in a folder the person chooses, or in the browser's own storage.
 *
 * @remarks Feature detection, not browser sniffing. Desktop Chromium browsers have the File System Access API's
 * `showDirectoryPicker`, so the profile is a folder on the person's computer (MVP §3). Safari and Firefox can't
 * open a folder for writing, but have the origin private file system, so the profile is kept there (ADR-0020).
 * Browsers with neither see the "not supported yet" page.
 * @param scope - The global object to check, normally `window`.
 * @returns `folder`, `browser`, or `undefined` when the browser can keep neither.
 */
export function storageKind(scope: object): PlaceKind | undefined {
  if (has(scope, "showDirectoryPicker") && typeof scope.showDirectoryPicker === "function") return "folder";
  const storage =
    has(scope, "navigator") && has(scope.navigator, "storage") ? scope.navigator.storage : undefined;
  if (has(storage, "getDirectory") && typeof storage.getDirectory === "function") return "browser";
  return undefined;
}

/**
 * Whether this browser can run Pharoam v0.1.
 *
 * @packageDocumentation
 */

/**
 * Whether the browser can open a folder the person chooses, which the v0.1 folder connector needs.
 *
 * @remarks Feature detection, not browser sniffing: desktop Chromium browsers have the File System Access API's
 * `showDirectoryPicker`; Firefox, Safari and mobile browsers don't, and see the "not supported yet" page (MVP §3).
 * @param scope - The global object to check, normally `window`.
 * @returns True when `showDirectoryPicker` is a function.
 */
export function supportsFolderAccess(scope: object): boolean {
  return "showDirectoryPicker" in scope && typeof scope.showDirectoryPicker === "function";
}

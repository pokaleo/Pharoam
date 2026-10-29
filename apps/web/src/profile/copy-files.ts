/**
 * Copies of a profile kept in the browser: bringing a folder in, and downloading a `.zip` out (ADR-0020).
 *
 * @packageDocumentation
 */
import type { StoredFile } from "./places.ts";
import { zipFiles } from "./zip.ts";

/** A file the person picked with its folder: the browser gives its path from that folder. */
type PickedFile = File & { readonly webkitRelativePath: string };

/**
 * Reads the files of a folder the person picked, each with its path inside that folder.
 *
 * @remarks The picked folder's own name is dropped, so `my-copy/evidence/a.md` becomes `evidence/a.md`. Hidden
 * files and folders, such as `.obsidian/` or `.DS_Store`, are left out: they aren't part of the profile.
 * @param files - The files from a folder picker (`<input type="file" webkitdirectory>`).
 * @returns The files, with their paths and bytes.
 */
export async function filesFromFolder(files: readonly File[]): Promise<StoredFile[]> {
  const read: StoredFile[] = [];
  for (const file of files as readonly PickedFile[]) {
    const parts = (file.webkitRelativePath || file.name).split("/").slice(1);
    if (parts.length === 0 || parts.some((part) => part.startsWith("."))) continue;
    read.push({ path: parts.join("/"), bytes: new Uint8Array(await file.arrayBuffer()) });
  }
  return read;
}

/**
 * The name of a downloaded copy.
 *
 * @param date - When the copy is made.
 * @returns A name with the day, such as `pharoam-2026-10-29.zip`.
 */
export function copyName(date: Date): string {
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) =>
    String(n).padStart(2, "0"),
  );
  return `pharoam-${day.join("-")}.zip`;
}

/**
 * Downloads the files as one `.zip`, named by the day.
 *
 * @remarks Made in the browser and handed straight to its download: the copy never goes through a server.
 * @param files - The profile's files.
 * @param date - When the copy is made.
 * @param doc - The page's document.
 */
export function downloadCopy(files: readonly StoredFile[], date: Date, doc: Document): void {
  const url = URL.createObjectURL(new Blob([zipFiles(files, date).slice()], { type: "application/zip" }));
  const link = doc.createElement("a");
  link.href = url;
  link.download = copyName(date);
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The local folder connector: profile records as Markdown files in a folder the user chose.
 *
 * @remarks Runs in the browser over the File System Access API (ADR-0013, MVP §3). Version tokens are the SHA-256
 * of a file's bytes, so any change is seen; a write checks the token again just before the browser commits the new
 * content in one step, keeping the window for a lost edit as short as possible (interfaces §1, AD10). Files are
 * read and written byte for byte: a byte-order mark is kept, and bytes that aren't UTF-8 are reported, never
 * decoded with replacements that a save would write back.
 * @packageDocumentation
 */
import {
  err,
  ok,
  parseRecordFile,
  printRecordFile,
  type Result,
  type StorageConnector,
  type StorageError,
  type StoredRef,
} from "@pharoam/core";
import { PROFILE_FOLDERS, recordPath } from "./layout.ts";

/** The part of the File System Access API's file handle the connector uses. */
export interface FileHandle {
  /** Always `"file"`. */
  readonly kind: "file";
  /** The file's name, such as `python.md`. */
  readonly name: string;
  /** Reads the file's current content. */
  getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
  /** Opens a stream whose content replaces the file in one step when it is closed. */
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

/**
 * The part of the File System Access API's folder handle the connector uses.
 *
 * @remarks The browser's `FileSystemDirectoryHandle` fits it. The permission methods exist only in Chromium
 * browsers, so they are optional.
 */
export interface FolderHandle {
  /** Always `"directory"`. */
  readonly kind: "directory";
  /** The folder's own name, as the person sees it. */
  readonly name: string;
  /** Lists the folder's files and folders. */
  values(): AsyncIterable<FileHandle | FolderHandle>;
  /** Opens a folder inside this one, creating it if asked. */
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FolderHandle>;
  /** Opens a file inside this folder, creating it if asked. */
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
  /** Deletes a file inside this folder. */
  removeEntry(name: string): Promise<void>;
  /** Says whether the app may read and write the folder. */
  queryPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  /** Asks the person to let the app read and write the folder. */
  requestPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
}

const READ_WRITE = { mode: "readwrite" } as const;
const NOT_GRANTED: StorageError = {
  kind: "unavailable",
  reason: "Permission to use the folder isn't granted.",
};
const NOT_FOUND = { kind: "not-found" } as const;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * Asks the browser for permission to read and write a folder, if it isn't already granted (MVP S2.2).
 *
 * @remarks Call it from a user action, such as a click: browsers only show the prompt then.
 * @param folder - The folder the person chose earlier.
 * @returns Nothing when permission is granted, or `denied`.
 */
export async function requestAccess(
  folder: FolderHandle,
): Promise<Result<undefined, { readonly kind: "denied" }>> {
  if ((await folder.queryPermission?.(READ_WRITE)) === "granted") return ok(undefined);
  const answer = (await folder.requestPermission?.(READ_WRITE)) ?? "granted";
  return answer === "granted" ? ok(undefined) : err({ kind: "denied" });
}

/**
 * Creates a storage connector for a folder the person chose.
 *
 * @remarks Every call first checks the folder's permission and, without it, does nothing and returns
 * `unavailable` (MVP S1.4). Records are found anywhere in the folder; hidden folders (such as `.obsidian` or `.git`)
 * and `_attachments` are skipped.
 * @param root - The chosen folder's handle, from `showDirectoryPicker()` or kept from an earlier visit.
 * @returns A connector that reads and writes records in that folder.
 * @example
 * ```ts
 * const folder = await showDirectoryPicker({ mode: "readwrite" });
 * const service = createCoreService({ storage: createFolderConnector(folder), ids: { now: Date.now, fillRandom: (b) => crypto.getRandomValues(b) }, overview: (facts) => t("overview", facts) });
 * ```
 */
export function createFolderConnector(root: FolderHandle): StorageConnector {
  const granted = async (): Promise<boolean> =>
    ((await root.queryPermission?.(READ_WRITE)) ?? "granted") === "granted";

  // The folder holding a location's file, and the file's name; `undefined` for a location outside the folder.
  async function parentOf(
    location: string,
    create: boolean,
  ): Promise<{ folder: FolderHandle; name: string } | undefined> {
    const parts = location.split("/");
    if (parts.some((part) => part === "" || part === "." || part === ".." || part.includes("\\")))
      return undefined;
    const name = parts.pop();
    if (name === undefined) return undefined;
    let folder = root;
    for (const part of parts) folder = await folder.getDirectoryHandle(part, { create });
    return { folder, name };
  }

  return {
    initialise: async () => {
      if (!(await granted())) return err(NOT_GRANTED);
      try {
        // Opening with `create` makes a missing folder and leaves an existing one, and its files, alone.
        for (const name of PROFILE_FOLDERS) await root.getDirectoryHandle(name, { create: true });
        return ok(undefined);
      } catch (error) {
        return err(unavailable(error));
      }
    },

    list: async () => {
      if (!(await granted())) return err(NOT_GRANTED);
      try {
        const found: StoredRef[] = [];
        await collect(root, "", found);
        return ok(found.toSorted((a, b) => (a.location < b.location ? -1 : 1)));
      } catch (error) {
        return err(unavailable(error));
      }
    },

    read: async (location) => {
      if (!(await granted())) return err(NOT_GRANTED);
      try {
        const place = await parentOf(location, false);
        if (place === undefined) return err(NOT_FOUND);
        const bytes = await bytesOf(await place.folder.getFileHandle(place.name));
        const version = await fingerprint(bytes);
        const text = decode(bytes);
        if (text === undefined) return err({ kind: "unreadable", error: { kind: "not-utf8" } });
        const parsed = parseRecordFile(text);
        return parsed.ok
          ? ok({ file: parsed.value, version })
          : err({ kind: "unreadable", error: parsed.error });
      } catch (error) {
        return err(isNotFound(error) ? NOT_FOUND : unavailable(error));
      }
    },

    create: async (file) => {
      if (!(await granted())) return err(NOT_GRANTED);
      const location = recordPath(file);
      try {
        const place = await parentOf(location, true);
        if (place === undefined) return err(unavailable(new Error(`Can't store a record at ${location}.`)));
        if (await exists(place.folder, place.name)) return err({ kind: "exists", location });
        const text = printRecordFile(file);
        await writeText(await place.folder.getFileHandle(place.name, { create: true }), text);
        return ok({ location, version: await fingerprint(encoder.encode(text)) });
      } catch (error) {
        return err(unavailable(error));
      }
    },

    write: async (location, file, expectedVersion) => {
      if (!(await granted())) return err(NOT_GRANTED);
      try {
        const place = await parentOf(location, false);
        if (place === undefined) return err(NOT_FOUND);
        const handle = await place.folder.getFileHandle(place.name);
        // Checked again just before writing, so an edit made since Pharoam read the file is never overwritten.
        if ((await fingerprint(await bytesOf(handle))) !== expectedVersion) return err({ kind: "conflict" });
        const text = printRecordFile(file);
        await writeText(handle, text);
        return ok(await fingerprint(encoder.encode(text)));
      } catch (error) {
        return err(isNotFound(error) ? NOT_FOUND : unavailable(error));
      }
    },

    delete: async (location, expectedVersion) => {
      if (!(await granted())) return err(NOT_GRANTED);
      try {
        const place = await parentOf(location, false);
        if (place === undefined) return err(NOT_FOUND);
        const handle = await place.folder.getFileHandle(place.name);
        if ((await fingerprint(await bytesOf(handle))) !== expectedVersion) return err({ kind: "conflict" });
        await place.folder.removeEntry(place.name);
        return ok(undefined);
      } catch (error) {
        return err(isNotFound(error) ? NOT_FOUND : unavailable(error));
      }
    },
  };
}

// Every Markdown file below a folder, with its version, skipping hidden folders and files, and `_attachments`.
async function collect(folder: FolderHandle, prefix: string, found: StoredRef[]): Promise<void> {
  for await (const entry of folder.values()) {
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (entry.kind === "directory") {
      await collect(entry, `${prefix}${entry.name}/`, found);
    } else if (entry.name.endsWith(".md")) {
      found.push({ location: `${prefix}${entry.name}`, version: await fingerprint(await bytesOf(entry)) });
    }
  }
}

async function exists(folder: FolderHandle, name: string): Promise<boolean> {
  try {
    await folder.getFileHandle(name);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

async function bytesOf(handle: FileHandle): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

async function writeText(handle: FileHandle, text: string): Promise<void> {
  const stream = await handle.createWritable();
  await stream.write(text);
  await stream.close();
}

// The file's text, keeping a byte-order mark; `undefined` if the bytes aren't UTF-8.
function decode(bytes: Uint8Array): string | undefined {
  try {
    return decoder.decode(bytes);
  } catch {
    return undefined;
  }
}

async function fingerprint(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === "NotFoundError" || error.name === "TypeMismatchError")
  );
}

/**
 * Turns what the browser threw into an `unavailable` error, keeping its name and message for diagnostics.
 *
 * @param error - The error the browser threw, usually a `DOMException`.
 * @returns The storage error.
 */
export function unavailable(error: unknown): StorageError {
  const reason = error instanceof DOMException ? `${error.name}: ${error.message}` : String(error);
  return { kind: "unavailable", reason };
}

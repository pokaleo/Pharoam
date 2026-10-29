/**
 * Profile places in the browser's own storage, for browsers that can't open a folder (ADR-0020).
 *
 * @packageDocumentation
 */
import { createFolderConnector, type FileHandle, type FolderHandle } from "@pharoam/connector-folder";
import { err, ok, type Result, type StorageError } from "@pharoam/core";
import type { Places, ProfilePlace, StoredFile } from "../profile/places.ts";

/** The directory the profile is kept in, inside the browser's storage for this site. */
export const BROWSER_PROFILE = "pharoam-profile";

/** The part of the browser's `navigator.storage` browser places use. */
export interface BrowserStorage {
  /** The root of the origin private file system. */
  readonly getDirectory: () => Promise<FolderHandle>;
  /** Asks the browser to keep this site's storage rather than clear it when space runs low. */
  readonly persist?: () => Promise<boolean>;
  /** Whether the browser agreed to keep it. */
  readonly persisted?: () => Promise<boolean>;
}

/**
 * Creates profile places in the browser's origin private file system.
 *
 * @remarks The profile is the same Markdown files a folder would hold, in a directory the folder connector reads and
 * writes unchanged; only where they live differs. They never leave the device (AGENTS.md hard rule 1). Closing the
 * profile keeps them: the person brings files in from a folder they picked and takes a copy out as a `.zip`. In a
 * private window the browser refuses to keep files, which is reported as `unavailable`.
 * @param storage - The browser's storage, such as `navigator.storage`.
 * @returns Opening, filling and copying the profile kept in the browser.
 */
export function createBrowserPlaces(storage: BrowserStorage): Places {
  const profileDirectory = async (create: boolean): Promise<FolderHandle> =>
    (await storage.getDirectory()).getDirectoryHandle(BROWSER_PROFILE, { create });

  const open = async (): Promise<Result<ProfilePlace, StorageError>> => {
    try {
      const directory = await profileDirectory(true);
      // Asked, not awaited: Firefox shows the person a prompt, and the profile opens whatever they answer.
      void storage.persist?.().catch(() => false);
      return ok({ name: BROWSER_PROFILE, storage: createFolderConnector(directory) });
    } catch (error) {
      return err(unavailable(error));
    }
  };

  return {
    kind: "browser",

    remembered: async () => {
      try {
        return (await isEmpty(await profileDirectory(false))) ? undefined : BROWSER_PROFILE;
      } catch {
        return undefined;
      }
    },

    reopen: open,
    choose: open,

    forget: () => Promise.resolve(),

    bringIn: async (files) => {
      try {
        const directory = await profileDirectory(true);
        if (!(await isEmpty(directory))) return err({ kind: "not-empty" });
        for (const file of files) await writeFile(directory, file);
      } catch (error) {
        return err(unavailable(error));
      }
      return open();
    },

    copy: async () => {
      try {
        const files = await filesIn(await profileDirectory(true), "");
        return ok(files.sort((a, b) => a.path.localeCompare(b.path)));
      } catch (error) {
        return err(unavailable(error));
      }
    },

    persisted: () => storage.persisted?.().catch(() => false) ?? Promise.resolve(false),
  };
}

async function isEmpty(directory: FolderHandle): Promise<boolean> {
  for await (const entry of directory.values()) {
    if (entry.kind === "file" || !(await isEmpty(entry))) return false;
  }
  return true;
}

async function writeFile(root: FolderHandle, file: StoredFile): Promise<void> {
  const parts = file.path.split("/");
  const name = parts.pop() ?? file.path;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
  const stream = await (await directory.getFileHandle(name, { create: true })).createWritable();
  // The connector's writer takes text; a profile's files are UTF-8 text, so they round-trip unchanged.
  await stream.write(new TextDecoder().decode(file.bytes));
  await stream.close();
}

async function filesIn(directory: FolderHandle, prefix: string): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  for await (const entry of directory.values()) {
    const path = `${prefix}${entry.name}`;
    if (entry.kind === "file") files.push({ path, bytes: await bytesOf(entry) });
    else files.push(...(await filesIn(entry, `${path}/`)));
  }
  return files;
}

async function bytesOf(file: FileHandle): Promise<Uint8Array> {
  return new Uint8Array(await (await file.getFile()).arrayBuffer());
}

function unavailable(error: unknown): StorageError {
  const reason = error instanceof Error || error instanceof DOMException ? error.message : String(error);
  return { kind: "unavailable", reason };
}

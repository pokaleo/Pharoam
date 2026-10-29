/**
 * Remembers the folder the person chose, so a later visit can offer it again (MVP S2.2).
 *
 * @remarks The browser keeps its folder handle in IndexedDB on this device; the handle holds the folder's name and
 * the browser's own reference, never profile data. A remembered folder still needs permission again before
 * anything is read (`requestAccess`).
 * @packageDocumentation
 */
import { err, ok, type Result, type StorageError } from "@pharoam/core";
import { unavailable, type FolderHandle } from "./folder-connector.ts";

// A database of its own, so it never clashes with the local cache's versions (AD20).
const DATABASE = "pharoam-folder";
const STORE = "folders";
const KEY = "profile";

/** The folder the person chose, kept in the browser between visits. */
export interface FolderMemory {
  /** Keeps a folder, replacing one kept before. */
  readonly remember: (folder: FolderHandle) => Promise<Result<undefined, StorageError>>;
  /** The folder kept, if there is one. */
  readonly recall: () => Promise<Result<FolderHandle | undefined, StorageError>>;
  /** Forgets the folder kept, when the person disconnects their profile (MVP S2.4). */
  readonly forget: () => Promise<Result<undefined, StorageError>>;
}

/**
 * Creates the memory for the chosen folder.
 *
 * @remarks Every call opens the database and closes it again, so nothing stays open between visits. When the
 * browser blocks its storage, as some private windows do, every call returns `unavailable` and the person
 * simply chooses the folder again.
 * @param databases - The browser's IndexedDB, `indexedDB`.
 * @returns A memory that keeps one folder on this device.
 * @example
 * ```ts
 * const memory = createFolderMemory(indexedDB);
 * const kept = await memory.recall();
 * ```
 */
export function createFolderMemory(databases: IDBFactory): FolderMemory {
  async function inStore(
    mode: IDBTransactionMode,
    use: (store: IDBObjectStore) => IDBRequest,
  ): Promise<Result<unknown, StorageError>> {
    try {
      return ok(await run(databases, mode, use));
    } catch (error) {
      return err(unavailable(error));
    }
  }

  return {
    remember: async (folder) => {
      const stored = await inStore("readwrite", (store) => store.put(folder, KEY));
      return stored.ok ? ok(undefined) : stored;
    },

    recall: async () => {
      const kept = await inStore("readonly", (store) => store.get(KEY));
      return kept.ok ? ok(isFolder(kept.value) ? kept.value : undefined) : kept;
    },

    forget: async () => {
      const removed = await inStore("readwrite", (store) => store.delete(KEY));
      return removed.ok ? ok(undefined) : removed;
    },
  };
}

// Runs one request, waiting until the browser has committed it, and returns its result.
async function run(
  databases: IDBFactory,
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = databases.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? failed());
    };
  });
  try {
    const transaction = database.transaction(STORE, mode);
    const request = use(transaction.objectStore(STORE));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = transaction.onabort = () => {
        reject(transaction.error ?? failed());
      };
    });
    return request.result as unknown;
  } finally {
    database.close();
  }
}

// The browser gives no error for an aborted transaction it wasn't asked to abort, such as one it closed itself.
function failed(): DOMException {
  return new DOMException("The browser stopped the request.", "AbortError");
}

// Something an older or newer version of the app kept under the same key is ignored, not trusted.
function isFolder(value: unknown): value is FolderHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "directory" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

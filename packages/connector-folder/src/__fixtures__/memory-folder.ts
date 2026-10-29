// An in-memory stand-in for a folder from the File System Access API, for tests: files as bytes, with a
// permission state, failing the same way a browser does (DOMException names).
import type { FileHandle, FolderHandle } from "../folder-connector.ts";

export interface MemoryFolder {
  /** The folder's handle, as the browser would give it. */
  readonly handle: FolderHandle;
  /** Every file's bytes, by path such as `evidence/a.md`. */
  readonly files: Map<string, Uint8Array>;
  /** Folders created explicitly, by path, including empty ones. */
  readonly folders: Set<string>;
  /** Sets what the permission check returns, and whether a request is granted. */
  readonly setPermission: (state: PermissionState, onRequest?: PermissionState) => void;
}

const encoder = new TextEncoder();

export function memoryFolder(initial: Readonly<Record<string, string | Uint8Array>> = {}): MemoryFolder {
  const files = new Map(
    Object.entries(initial).map(([path, content]) => [path, typeof content === "string" ? encoder.encode(content) : content]),
  );
  let permission: PermissionState = "granted";
  let onRequest: PermissionState = "granted";
  const folders = new Set<string>();

  const fail = (name: string, message: string): never => {
    throw new DOMException(message, name);
  };
  const guard = (): void => {
    if (permission !== "granted") fail("NotAllowedError", "Permission is not granted.");
  };

  function fileHandle(path: string, name: string): FileHandle {
    return {
      kind: "file",
      name,
      getFile: () => {
        guard();
        const bytes = files.get(path) ?? fail("NotFoundError", `${path} was not found.`);
        return Promise.resolve({ arrayBuffer: () => Promise.resolve(bytes.slice().buffer) });
      },
      createWritable: () => {
        guard();
        let pending = "";
        return Promise.resolve({
          write: (data: string) => {
            pending += data;
            return Promise.resolve();
          },
          // Like the browser, the new content replaces the file in one step when the stream closes.
          close: () => {
            files.set(path, encoder.encode(pending));
            return Promise.resolve();
          },
        });
      },
    };
  }

  function folderHandle(prefix: string, name: string): FolderHandle {
    const pathOf = (child: string): string => `${prefix}${child}`;
    const hasFolder = (path: string): boolean =>
      folders.has(path) ? true : [...files.keys()].some((p) => p.startsWith(`${path}/`));
    return {
      kind: "directory",
      name,
      queryPermission: () => Promise.resolve(permission),
      requestPermission: () => {
        permission = onRequest;
        return Promise.resolve(permission);
      },
      values: async function* () {
        guard();
        const children = new Set<string>();
        for (const path of [...files.keys(), ...folders]) {
          if (path.startsWith(prefix)) children.add(path.slice(prefix.length).split("/")[0] ?? "");
        }
        for (const child of children) {
          yield files.has(pathOf(child)) ? fileHandle(pathOf(child), child) : folderHandle(`${pathOf(child)}/`, child);
        }
        await Promise.resolve();
      },
      getDirectoryHandle: (child, options) => {
        guard();
        if (files.has(pathOf(child))) fail("TypeMismatchError", `${child} is a file.`);
        if (!hasFolder(pathOf(child))) {
          if (options?.create !== true) fail("NotFoundError", `${child} was not found.`);
          folders.add(pathOf(child));
        }
        return Promise.resolve(folderHandle(`${pathOf(child)}/`, child));
      },
      getFileHandle: (child, options) => {
        guard();
        if (hasFolder(pathOf(child))) fail("TypeMismatchError", `${child} is a folder.`);
        if (!files.has(pathOf(child))) {
          if (options?.create !== true) fail("NotFoundError", `${child} was not found.`);
          files.set(pathOf(child), new Uint8Array());
        }
        return Promise.resolve(fileHandle(pathOf(child), child));
      },
      removeEntry: (child) => {
        guard();
        if (!files.delete(pathOf(child))) fail("NotFoundError", `${child} was not found.`);
        return Promise.resolve();
      },
    };
  }

  return {
    handle: folderHandle("", "Pharoam"),
    files,
    folders,
    setPermission: (state, request = state) => {
      permission = state;
      onRequest = request;
    },
  };
}

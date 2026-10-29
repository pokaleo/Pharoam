// A directory in memory, shaped like the browser's FileSystemDirectoryHandle, for tests of browser storage.
import type { FileHandle, FolderHandle } from "@pharoam/connector-folder";

const encoder = new TextEncoder();

/** A directory in memory, with its files' text by path, such as `evidence/a.md`. */
export interface MemoryDirectory extends FolderHandle {
  /** Every file's text, by path from this directory. */
  readonly texts: () => Record<string, string>;
}

/**
 * Creates a directory in memory.
 *
 * @param name - Its name.
 * @param failWith - An error every call throws, as Safari's private windows do.
 * @returns The directory.
 */
export function memoryDirectory(name: string, failWith?: Error): MemoryDirectory {
  const dirs = new Map<string, MemoryDirectory>();
  const files = new Map<string, Uint8Array>();
  const check = (): void => {
    if (failWith !== undefined) throw failWith;
  };

  const fileHandle = (fileName: string): FileHandle => ({
    kind: "file",
    name: fileName,
    getFile: () => {
      const bytes = files.get(fileName) ?? new Uint8Array();
      return Promise.resolve({ arrayBuffer: () => Promise.resolve(bytes.slice().buffer) });
    },
    createWritable: () => {
      let written = "";
      return Promise.resolve({
        write: (data: string) => {
          written += data;
          return Promise.resolve();
        },
        close: () => {
          files.set(fileName, encoder.encode(written));
          return Promise.resolve();
        },
      });
    },
  });

  const directory: MemoryDirectory = {
    kind: "directory",
    name,
    async *values() {
      await Promise.resolve();
      check();
      for (const dir of dirs.values()) yield dir;
      for (const fileName of files.keys()) yield fileHandle(fileName);
    },
    getDirectoryHandle: (dirName, options) => {
      check();
      const found = dirs.get(dirName);
      if (found !== undefined) return Promise.resolve(found);
      if (options?.create !== true) return Promise.reject(new DOMException("Not found", "NotFoundError"));
      const created = memoryDirectory(dirName);
      dirs.set(dirName, created);
      return Promise.resolve(created);
    },
    getFileHandle: (fileName, options) => {
      check();
      if (!files.has(fileName)) {
        if (options?.create !== true) return Promise.reject(new DOMException("Not found", "NotFoundError"));
        files.set(fileName, new Uint8Array());
      }
      return Promise.resolve(fileHandle(fileName));
    },
    removeEntry: (entry) => {
      files.delete(entry);
      dirs.delete(entry);
      return Promise.resolve();
    },
    texts: () => {
      const all: Record<string, string> = {};
      for (const [fileName, bytes] of files) all[fileName] = new TextDecoder().decode(bytes);
      for (const [dirName, dir] of dirs) {
        for (const [path, text] of Object.entries(dir.texts())) all[`${dirName}/${path}`] = text;
      }
      return all;
    },
  };
  return directory;
}

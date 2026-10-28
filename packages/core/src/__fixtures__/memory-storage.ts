// An in-memory storage for core service tests: record files as text, with version tokens, that tests can change
// "outside Pharoam" to simulate a person editing a file by hand.
import type { StorageConnector, StorageError } from "../core-service.ts";
import { parseRecordFile, printRecordFile } from "../record-file.ts";
import { err, ok } from "../result.ts";

export interface MemoryStorage {
  readonly connector: StorageConnector;
  /** The stored text of each file, by location. */
  readonly files: Map<string, { text: string; version: number }>;
  /** How many times the core wrote, created or deleted a file. */
  readonly writes: () => number;
  /** Changes a file as if someone edited it by hand. */
  readonly editOutside: (location: string, text: string) => void;
  /** Makes every call fail, as when the browser's folder permission is lost. */
  readonly loseAccess: () => void;
}

export function memoryStorage(initial: Readonly<Record<string, string>> = {}): MemoryStorage {
  const files = new Map(Object.entries(initial).map(([location, text]) => [location, { text, version: 1 }]));
  let writes = 0;
  let available = true;
  const unavailable: StorageError = { kind: "unavailable", reason: "Permission was revoked." };

  const connector: StorageConnector = {
    list: () =>
      Promise.resolve(
        available
          ? ok([...files].map(([location, file]) => ({ location, version: String(file.version) })))
          : err(unavailable),
      ),
    read: (location) => {
      if (!available) return Promise.resolve(err(unavailable));
      const file = files.get(location);
      if (file === undefined) return Promise.resolve(err({ kind: "not-found" }));
      const parsed = parseRecordFile(file.text);
      return Promise.resolve(
        parsed.ok
          ? ok({ file: parsed.value, version: String(file.version) })
          : err({ kind: "unreadable", error: parsed.error }),
      );
    },
    create: (file) => {
      if (!available) return Promise.resolve(err(unavailable));
      const location = `${String(file.top.schema).split("/")[0] ?? "record"}/${String(file.top.id)}.md`;
      if (files.has(location)) return Promise.resolve(err({ kind: "exists", location }));
      writes++;
      files.set(location, { text: printRecordFile(file), version: 1 });
      return Promise.resolve(ok({ location, version: "1" }));
    },
    write: (location, file, expectedVersion) => {
      if (!available) return Promise.resolve(err(unavailable));
      const current = files.get(location);
      if (current === undefined) return Promise.resolve(err({ kind: "not-found" }));
      if (String(current.version) !== expectedVersion) return Promise.resolve(err({ kind: "conflict" }));
      writes++;
      const version = current.version + 1;
      files.set(location, { text: printRecordFile(file), version });
      return Promise.resolve(ok(String(version)));
    },
    delete: (location, expectedVersion) => {
      if (!available) return Promise.resolve(err(unavailable));
      const current = files.get(location);
      if (current === undefined) return Promise.resolve(err({ kind: "not-found" }));
      if (String(current.version) !== expectedVersion) return Promise.resolve(err({ kind: "conflict" }));
      writes++;
      files.delete(location);
      return Promise.resolve(ok(undefined));
    },
  };

  return {
    connector,
    files,
    writes: () => writes,
    editOutside: (location, text) => {
      const current = files.get(location);
      files.set(location, { text, version: (current?.version ?? 0) + 1 });
    },
    loseAccess: () => {
      available = false;
    },
  };
}

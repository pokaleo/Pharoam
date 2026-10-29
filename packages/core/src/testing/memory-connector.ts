/**
 * The in-memory reference connector: the simplest storage that meets the connector contract.
 *
 * @remarks It keeps record files as text and passes the shared connector checks, so tests of the core and of the
 * app can use it in place of real storage (interfaces §1, ENGINEERING §4).
 * @packageDocumentation
 */
import type { StorageConnector, StorageError } from "../core-service.ts";
import { parseRecordFile, printRecordFile } from "../record-file.ts";
import { err, ok } from "../result.ts";

/**
 * A connector under test, plus ways to change its storage as a person or another app would.
 *
 * @remarks Locations passed to the "outside" functions are the connector's own, such as paths for a folder.
 */
export interface ConnectorHarness {
  /** The connector the checks call. */
  readonly connector: StorageConnector;
  /** Writes a file's text at a location, as if someone saved it in another app. */
  readonly putOutside: (location: string, text: string) => Promise<void>;
  /** Reads a file's text as stored, or `undefined` if there is none. */
  readonly readOutside: (location: string) => Promise<string | undefined>;
  /** Deletes a file, as if someone removed it by hand. */
  readonly removeOutside: (location: string) => Promise<void>;
}

/** The reference connector's harness, plus helpers for tests of the core. */
export interface MemoryConnector extends ConnectorHarness {
  /** The stored text at a location, read without waiting. */
  readonly text: (location: string) => string | undefined;
  /** How many times the connector created, wrote or deleted a record. */
  readonly writes: () => number;
  /** How many times the storage was prepared for a new profile. */
  readonly initialisations: () => number;
  /** Makes every later call fail, as when a folder's permission is revoked. */
  readonly loseAccess: () => void;
}

/**
 * Creates an in-memory reference connector.
 *
 * @remarks New records are stored at `<type>/<id>.md`. Every change, by the connector or from outside, gets a new
 * version token, so a record changed and changed back still counts as changed.
 * @param initial - Files to start with, by location.
 * @returns The connector and its harness.
 * @example
 * ```ts
 * const memory = createMemoryConnector({ "pharoam.md": text });
 * const service = createCoreService({ storage: memory.connector, ids: { now: Date.now, fillRandom: (b) => crypto.getRandomValues(b) } });
 * ```
 */
export function createMemoryConnector(initial: Readonly<Record<string, string>> = {}): MemoryConnector {
  let clock = 0;
  const nextVersion = (): string => `v${String(++clock)}`;
  const files = new Map(
    Object.entries(initial).map(([location, text]) => [location, { text, version: nextVersion() }]),
  );
  let writes = 0;
  let initialisations = 0;
  let available = true;
  const unavailable: StorageError = { kind: "unavailable", reason: "Access to the storage was lost." };

  const connector: StorageConnector = {
    // Memory has no folders to prepare; counting the calls lets tests check it was asked.
    initialise: () => {
      if (!available) return Promise.resolve(err(unavailable));
      initialisations++;
      return Promise.resolve(ok(undefined));
    },
    list: () => {
      if (!available) return Promise.resolve(err(unavailable));
      return Promise.resolve(ok([...files].map(([location, file]) => ({ location, version: file.version }))));
    },
    read: (location) => {
      if (!available) return Promise.resolve(err(unavailable));
      const stored = files.get(location);
      if (stored === undefined) return Promise.resolve(err({ kind: "not-found" }));
      const parsed = parseRecordFile(stored.text);
      return Promise.resolve(
        parsed.ok
          ? ok({ file: parsed.value, version: stored.version })
          : err({ kind: "unreadable", error: parsed.error }),
      );
    },
    create: (file) => {
      if (!available) return Promise.resolve(err(unavailable));
      const type = String(file.top.schema).split("/")[0] ?? "record";
      const location = `${type}/${String(file.top.id)}.md`;
      if (files.has(location)) return Promise.resolve(err({ kind: "exists", location }));
      writes++;
      const version = nextVersion();
      files.set(location, { text: printRecordFile(file), version });
      return Promise.resolve(ok({ location, version }));
    },
    write: (location, file, expectedVersion) => {
      if (!available) return Promise.resolve(err(unavailable));
      const stored = files.get(location);
      if (stored === undefined) return Promise.resolve(err({ kind: "not-found" }));
      if (stored.version !== expectedVersion) return Promise.resolve(err({ kind: "conflict" }));
      writes++;
      const version = nextVersion();
      files.set(location, { text: printRecordFile(file), version });
      return Promise.resolve(ok(version));
    },
    delete: (location, expectedVersion) => {
      if (!available) return Promise.resolve(err(unavailable));
      const stored = files.get(location);
      if (stored === undefined) return Promise.resolve(err({ kind: "not-found" }));
      if (stored.version !== expectedVersion) return Promise.resolve(err({ kind: "conflict" }));
      writes++;
      files.delete(location);
      return Promise.resolve(ok(undefined));
    },
  };

  return {
    connector,
    putOutside: (location, text) => {
      files.set(location, { text, version: nextVersion() });
      return Promise.resolve();
    },
    readOutside: (location) => Promise.resolve(files.get(location)?.text),
    removeOutside: (location) => {
      files.delete(location);
      return Promise.resolve();
    },
    text: (location) => files.get(location)?.text,
    writes: () => writes,
    initialisations: () => initialisations,
    loseAccess: () => {
      available = false;
    },
  };
}

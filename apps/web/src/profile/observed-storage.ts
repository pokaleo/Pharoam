/**
 * What Pharoam reads from and writes to the person's storage, observed for the Activity log (MVP S22, PRD J3).
 *
 * @packageDocumentation
 */
import type { Result, StorageConnector } from "@pharoam/core";

/** What was done to the person's storage. */
export type StorageAction =
  | "listed"
  | "read"
  | "prepared"
  | "created"
  | "changed"
  | "deleted"
  | "files-listed"
  | "file-read"
  | "file-added"
  | "file-deleted"
  | "copied";

/** One read or write of the person's storage. */
export interface StorageEvent {
  /** What was done. */
  readonly action: StorageAction;
  /** The record's location; for a file kept with a record, `<record ID>/<name>`; empty for the whole storage. */
  readonly location: string;
  /** When, as an ISO time. */
  readonly at: string;
  /** Whether it worked. */
  readonly ok: boolean;
  /** For a listing or a copy, how many it found. */
  readonly count?: number;
}

/**
 * Wraps a storage connector so each read and write is reported as it ends, for the Activity log (MVP S22.1).
 *
 * @remarks Results pass through unchanged, and nothing is written anywhere: the report goes to the app, which keeps
 * it in memory only (S17.3). Every method of the connector is covered; a call that throws is reported as not
 * working before the error goes on. Reading every file for a downloaded copy goes round the connector, so the app
 * logs that itself (`copied`).
 * @param storage - The connector the core service will use.
 * @param report - Called with each read or write once it ends.
 * @param now - The clock, such as `() => new Date()`.
 * @returns A connector that does the same, and reports.
 */
export function observedStorage(
  storage: StorageConnector,
  report: (event: StorageEvent) => void,
  now: () => Date,
): StorageConnector {
  // Calls through, then reports whether it worked; a listing also reports how many it found.
  const observe = async <T, E>(
    action: StorageAction,
    location: string,
    call: Promise<Result<T, E>>,
    count?: (value: T) => number,
  ): Promise<Result<T, E>> => {
    let result: Result<T, E>;
    try {
      result = await call;
    } catch (error) {
      report({ action, location, at: now().toISOString(), ok: false });
      throw error;
    }
    report({
      action,
      location,
      at: now().toISOString(),
      ok: result.ok,
      ...(result.ok && count !== undefined && { count: count(result.value) }),
    });
    return result;
  };
  const file = (record: string, name: string): string => `${record}/${name}`;
  return {
    list: () => observe("listed", "", storage.list(), (refs) => refs.length),
    initialise: () => observe("prepared", "", storage.initialise()),
    read: (location) => observe("read", location, storage.read(location)),
    create: async (created) => {
      const result = await storage.create(created);
      // A record that couldn't be saved has no location yet, so it is named by its ID.
      const id = typeof created.top.id === "string" ? created.top.id : "";
      report({
        action: "created",
        location: result.ok ? result.value.location : id,
        at: now().toISOString(),
        ok: result.ok,
      });
      return result;
    },
    write: (location, written, expected) =>
      observe("changed", location, storage.write(location, written, expected)),
    delete: (location, expected) => observe("deleted", location, storage.delete(location, expected)),
    attachments: (record) =>
      observe("files-listed", record, storage.attachments(record), (files) => files.length),
    readAttachment: (record, name) =>
      observe("file-read", file(record, name), storage.readAttachment(record, name)),
    addAttachment: (record, name, bytes) =>
      observe("file-added", file(record, name), storage.addAttachment(record, name, bytes)),
    deleteAttachment: (record, name, expected) =>
      observe("file-deleted", file(record, name), storage.deleteAttachment(record, name, expected)),
  };
}

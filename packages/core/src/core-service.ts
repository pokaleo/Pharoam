/**
 * The core service: the one layer the interface calls to open, query and save a profile.
 *
 * @remarks The interface never calls connectors directly (ADR-0003, interfaces §5). The service reads every record
 * through a {@link StorageConnector}, keeps invalid ones under "Needs attention" and out of every calculation, checks
 * the integrity of entries Pharoam never edits, and saves with the version it read so a record changed in storage
 * is never silently overwritten (AD10, MVP S12).
 * @packageDocumentation
 */
import { checkEntry, type IntegrityStatus } from "./integrity.ts";
import type { RecordFile, RecordFileError } from "./record-file.ts";
import { err, ok, type Result } from "./result.ts";
import { parseProfileRecord, type ProfileRecord, type ProfileRecordError } from "./schemas/profile-record.ts";

/** Storage that can't be reached, such as a folder whose permission was revoked. */
export interface StorageError {
  /** Always `"unavailable"`. */
  readonly kind: "unavailable";
  /** What the platform reported, in English, for diagnostics. */
  readonly reason: string;
}

/** A stored record's place and version, as listed by a connector. */
export interface StoredRef {
  /** Where the record is: a path for file connectors, a page for others. Opaque to the core. */
  readonly location: string;
  /** A token that changes whenever the stored record changes, such as a modified time or content hash. */
  readonly version: string;
}

/**
 * Why stored content isn't a record file: the codec's reason, or `not-utf8` for bytes that aren't UTF-8 text.
 *
 * @remarks Decoding such bytes would replace characters, and a later save would write the damage back.
 */
export type UnreadableError = RecordFileError | { readonly kind: "not-utf8" };

/** Why a connector couldn't read a record. */
export type ReadError =
  | StorageError
  | { readonly kind: "not-found" }
  | { readonly kind: "unreadable"; readonly error: UnreadableError };

/** Why a connector couldn't replace or delete a record; `conflict` means it changed since it was read. */
export type WriteError = StorageError | { readonly kind: "not-found" } | { readonly kind: "conflict" };

/** Why a connector couldn't store a new record; `exists` means something is already at its location. */
export type CreateError = StorageError | { readonly kind: "exists"; readonly location: string };

/**
 * The storage a profile lives in: a local folder, Obsidian, Git or another service (interfaces §1).
 *
 * @remarks Records are addressed by location, not by ID, because a broken record has no readable ID and must still
 * be listed. Every write names the version it expects, and the connector refuses it when the stored record has
 * changed (AD10).
 * @example
 * ```ts
 * const listed = await storage.list();
 * const read = await storage.read("evidence/backend-engineer--0192f3a1.md");
 * if (read.ok) await storage.write(read.value.location, changedFile, read.value.version);
 * ```
 */
export interface StorageConnector {
  /** Lists every record in the profile, valid or not. */
  readonly list: () => Promise<Result<readonly StoredRef[], StorageError>>;
  /** Reads one record. */
  readonly read: (location: string) => Promise<Result<{ file: RecordFile; version: string }, ReadError>>;
  /** Stores a new record where the connector's layout puts it, never over something already there. */
  readonly create: (file: RecordFile) => Promise<Result<StoredRef, CreateError>>;
  /** Replaces a record, only if it is still at `expectedVersion`; returns the new version. */
  readonly write: (
    location: string,
    file: RecordFile,
    expectedVersion: string,
  ) => Promise<Result<string, WriteError>>;
  /** Deletes a record, only if it is still at `expectedVersion`. */
  readonly delete: (location: string, expectedVersion: string) => Promise<Result<undefined, WriteError>>;
}

/** A valid record the service has read. */
export interface LoadedRecord {
  /** Where the record is stored. */
  readonly location: string;
  /** The version it was read or last saved at. */
  readonly version: string;
  /** The record file, with everything Pharoam doesn't know kept. */
  readonly file: RecordFile;
  /** The record's fields as Pharoam reads them. */
  readonly record: ProfileRecord;
  /** For a skill record, each entry's integrity, in file order; otherwise empty (MVP S12.3). */
  readonly entryIntegrity: readonly IntegrityStatus[];
}

/**
 * A record the person needs to look at; it is left out of every calculation and never rewritten (MVP S12.2).
 *
 * @remarks `unreadable`: the file isn't a record file, or isn't UTF-8 text; `invalid`: its fields don't match its schema;
 * `duplicate-id`: another record already has its ID; `unavailable`: storage failed while reading it.
 */
export interface AttentionItem {
  /** Where the record is stored. */
  readonly location: string;
  /** What is wrong with it. */
  readonly problem:
    | { readonly kind: "unreadable"; readonly error: UnreadableError }
    | { readonly kind: "invalid"; readonly error: ProfileRecordError }
    | { readonly kind: "duplicate-id"; readonly id: string; readonly keptAt: string }
    | StorageError;
}

/** Why the service didn't save a record. */
export type SaveError =
  | StorageError
  | { readonly kind: "invalid"; readonly error: ProfileRecordError }
  | { readonly kind: "conflict"; readonly location: string }
  | { readonly kind: "needs-attention"; readonly location: string }
  | { readonly kind: "not-found"; readonly location: string }
  | { readonly kind: "exists"; readonly location: string }
  | { readonly kind: "id-changed"; readonly location: string }
  | { readonly kind: "duplicate-id"; readonly id: string; readonly keptAt: string };

/** The core service for one open profile. */
export interface CoreService {
  /** Reads every record from storage, replacing what was read before; writes nothing (MVP S2.1). */
  readonly open: () => Promise<Result<undefined, StorageError>>;
  /** The valid records, in the order storage listed them. */
  readonly records: () => readonly LoadedRecord[];
  /** The records that need attention, in the order storage listed them. */
  readonly needsAttention: () => readonly AttentionItem[];
  /** The valid record with this ID, if there is one. */
  readonly find: (id: string) => LoadedRecord | undefined;
  /** Saves a new record, after validating it. */
  readonly create: (file: RecordFile) => Promise<Result<LoadedRecord, SaveError>>;
  /** Saves a change to a record read earlier, only if storage still has the version read (AD10). */
  readonly update: (location: string, file: RecordFile) => Promise<Result<LoadedRecord, SaveError>>;
}

/** What the core service needs. */
export interface CoreServiceOptions {
  /** The storage the profile lives in. */
  readonly storage: StorageConnector;
}

/**
 * Creates the core service for one profile.
 *
 * @remarks Call {@link CoreService.open} before anything else.
 * @param options - The storage the profile lives in.
 * @returns The service, with nothing read yet.
 */
export function createCoreService(options: CoreServiceOptions): CoreService {
  const { storage } = options;
  let loaded: LoadedRecord[] = [];
  let attention: AttentionItem[] = [];

  const byId = (id: string): LoadedRecord | undefined => loaded.find((r) => r.record.id === id);

  return {
    open: async () => {
      const listed = await storage.list();
      if (!listed.ok) return listed;
      const reads = await Promise.all(
        listed.value.map(async ({ location }) => ({ location, read: await storage.read(location) })),
      );
      loaded = [];
      attention = [];
      for (const { location, read } of reads) {
        if (!read.ok) {
          // A record deleted between listing and reading is simply gone.
          if (read.error.kind === "not-found") continue;
          attention.push({ location, problem: read.error });
          continue;
        }
        const record = parseProfileRecord(read.value.file.top);
        if (!record.ok) {
          attention.push({ location, problem: { kind: "invalid", error: record.error } });
          continue;
        }
        const kept = byId(record.value.id);
        if (kept !== undefined) {
          attention.push({
            location,
            problem: { kind: "duplicate-id", id: record.value.id, keptAt: kept.location },
          });
          continue;
        }
        loaded.push(toLoaded(location, read.value.version, read.value.file, record.value));
      }
      return ok(undefined);
    },

    records: () => loaded,
    needsAttention: () => attention,
    find: byId,

    create: async (file) => {
      const record = parseProfileRecord(file.top);
      if (!record.ok) return err({ kind: "invalid", error: record.error });
      const kept = byId(record.value.id);
      if (kept !== undefined)
        return err({ kind: "duplicate-id", id: record.value.id, keptAt: kept.location });
      const created = await storage.create(file);
      if (!created.ok) return err(created.error);
      const result = toLoaded(created.value.location, created.value.version, file, record.value);
      loaded = [...loaded, result];
      return ok(result);
    },

    update: async (location, file) => {
      if (attention.some((item) => item.location === location))
        return err({ kind: "needs-attention", location });
      const current = loaded.find((r) => r.location === location);
      if (current === undefined) return err({ kind: "not-found", location });
      const record = parseProfileRecord(file.top);
      if (!record.ok) return err({ kind: "invalid", error: record.error });
      if (record.value.id !== current.record.id) return err({ kind: "id-changed", location });
      const written = await storage.write(location, file, current.version);
      if (!written.ok) return err(saveError(written.error, location));
      const result = toLoaded(location, written.value, file, record.value);
      loaded = loaded.map((r) => (r.location === location ? result : r));
      return ok(result);
    },
  };
}

function toLoaded(location: string, version: string, file: RecordFile, record: ProfileRecord): LoadedRecord {
  return { location, version, file, record, entryIntegrity: entryIntegrity(file, record) };
}

// Each skill-record entry checked against its own fingerprint, using the values as written. The schema has just
// checked that `entries` is a list of objects.
function entryIntegrity(file: RecordFile, record: ProfileRecord): IntegrityStatus[] {
  if (record.schema !== "skill-record/1") return [];
  const entries = (file.top.entries ?? []) as readonly Readonly<Record<string, unknown>>[];
  return entries.map((entry) => checkEntry(entry));
}

function saveError(error: WriteError, location: string): SaveError {
  switch (error.kind) {
    case "unavailable":
      return error;
    case "conflict":
      return { kind: "conflict", location };
    case "not-found":
      return { kind: "not-found", location };
  }
}

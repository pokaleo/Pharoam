/**
 * The core service: the one layer the interface calls to open, query and save a profile.
 *
 * @remarks The interface never calls connectors directly (ADR-0003, interfaces §5). The service reads every record
 * through a {@link StorageConnector}, keeps invalid ones under "Needs attention" and out of every calculation, checks
 * the integrity of entries Pharoam never edits, and saves with the version it read so a record changed in storage
 * is never silently overwritten (AD10, MVP S12).
 * @packageDocumentation
 */
import {
  editedEvidence,
  evidenceDraft,
  type EvidenceForm,
  type InvalidEvidenceError,
} from "./evidence-form.ts";
import { customSkillSlug } from "./custom-skills.ts";
import { gapItems, type GapItem, type GapWriter } from "./gaps.ts";
import { createProfileRecordIdGenerator, type IdSource } from "./ids.ts";
import { checkEntry, sealEntry, type IntegrityStatus } from "./integrity.ts";
import { overviewFacts, withOverview, type OverviewWriter } from "./overview.ts";
import type { ContentPack } from "./pack.ts";
import { pathwayDetail, type PathwayDetail } from "./pathways.ts";
import { proficiencyOf } from "./proficiency.ts";
import {
  createRecordFile,
  withAppendedItem,
  withTopFields,
  type RecordFile,
  type RecordFileError,
} from "./record-file.ts";
import { err, ok, type Result } from "./result.ts";
import {
  observationStatuses,
  skillHistory,
  type HistoryItem,
  type ObservationStatus,
} from "./skill-history.ts";
import { skillView, type SkillFilter, type SkillViewItem } from "./skill-view.ts";
import { parseProfileRecord, type ProfileRecord, type ProfileRecordError } from "./schemas/profile-record.ts";
import type { Observation } from "./schemas/skill-record.ts";
import type { SkillEntry } from "./schemas/skill.ts";

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
  /**
   * Prepares the storage for a new profile, such as a folder's `skills/`, `evidence/` and `gaps/` (MVP S1.1).
   *
   * @remarks Creates only what is missing and changes nothing that exists, so it is safe to run twice (MVP S1.3).
   */
  readonly initialise: () => Promise<Result<undefined, StorageError>>;
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

/**
 * A record that changed in storage since Pharoam read it, when Pharoam was about to write or delete it (AD10).
 *
 * @remarks Nothing was written. The app shows both versions and the person chooses one with
 * {@link CoreService.resolveConflict} (MVP S12.1).
 */
export interface Conflict {
  /** Where the record is stored. */
  readonly location: string;
  /** What Pharoam was about to write, or `undefined` when it was about to delete the record. */
  readonly mine: RecordFile | undefined;
  /** The record as it is in storage now, or why it couldn't be read. */
  readonly theirs: Result<RecordFile, ReadError>;
}

/** Why a conflict wasn't resolved as the person chose. */
export type ResolveConflictError =
  | SaveError
  | { readonly kind: "no-conflict"; readonly location: string }
  /** Their version couldn't be read, so only keeping theirs is possible. */
  | { readonly kind: "theirs-unreadable"; readonly location: string };

/**
 * What the person says about themselves in `pharoam.md` (MVP S1.2, S3.1).
 *
 * @remarks There is no field for a name, photo, contact details or exact location, and any given are never written
 * (hard rule 8, data model §10).
 */
export interface ProfileFields {
  /** Their own one-line summary. */
  readonly headline?: string;
  /** What they are doing now, and in which field. */
  readonly situation?: {
    readonly stage: "studying" | "working" | "between-roles" | "changing-career";
    readonly field?: string;
  };
  /** Their country, as an ISO 3166-1 two-letter code such as `GB`. */
  readonly region?: string;
  /** The pathways and skills they are exploring, by slug. */
  readonly focus?: { readonly pathways?: readonly string[]; readonly skills?: readonly string[] };
}

/** Why the service didn't create a profile. */
export type CreateProfileError = SaveError | { readonly kind: "profile-exists"; readonly location: string };

/** Why the service didn't change `pharoam.md`: the reasons a save fails, or there is no valid profile to change. */
export type ProfileChangeError = SaveError | { readonly kind: "no-profile" };

/** Why the service didn't change a piece of evidence. */
export type EditEvidenceError = SaveError | { readonly kind: "not-editable"; readonly location: string };

/** Why the service didn't delete a piece of evidence. */
export type DeleteEvidenceError = SaveError | { readonly kind: "not-evidence"; readonly location: string };

/** An observation that cites a piece of evidence (MVP S5.3). */
export interface EvidenceReference {
  /** Where the skill record holding the observation is stored. */
  readonly location: string;
  /** The skill the observation is about, by slug. */
  readonly skill: string;
  /** The observation's ID. */
  readonly observation: string;
}

/**
 * A level the person gives themselves for a skill (MVP S6).
 *
 * @remarks There is no provenance to choose: a level recorded by hand is always `self-reported` (MVP S6.5).
 */
export interface SelfRating {
  /** The skill, by slug. */
  readonly skill: string;
  /** The level, 0–4. */
  readonly level: number;
  /** The IDs of evidence records the person cites; citing evidence doesn't test the level (MVP S6.2). */
  readonly evidence?: readonly string[];
}

/** Why the service didn't record a level. */
export type RecordLevelError = SaveError | { readonly kind: "unknown-evidence"; readonly id: string };

/** A skill the vocabulary is missing, as the person describes it (MVP S8.1). */
export interface CustomSkill {
  /** What the skill is called, as the person writes it. */
  readonly name: string;
  /** What it covers, in the person's own words. */
  readonly description?: string;
}

/** Why the service didn't add a custom skill. */
export type AddCustomSkillError =
  | SaveError
  | {
      /** The person already has a custom skill with this name. */
      readonly kind: "skill-exists";
      /** That skill's slug. */
      readonly skill: string;
      /** Where its skill record is stored. */
      readonly location: string;
    };

/** Why the service didn't correct or retract an observation. */
export type ChangeLevelError =
  | RecordLevelError
  | { readonly kind: "no-observation"; readonly id: string }
  | {
      readonly kind: "not-correctable";
      readonly observation: string;
      /** A tested or AI level is retaken, not corrected; a superseded or retracted one no longer counts. */
      readonly reason: "not-self-reported" | "superseded" | "retracted";
    };

/** The gap to a pathway, as stored and shown (MVP S11). */
export interface GapView {
  /** The stored gap record's ID. */
  readonly id: string;
  /** Where the gap record is stored, such as `gaps/ml-engineer.md`. */
  readonly location: string;
  /** When the stored gap last changed, for "Updated just now" (MVP S11.5). */
  readonly updated: string;
  /** The pathway, in full. */
  readonly pathway: PathwayDetail;
  /** Each requirement, grouped, in the pathway's order. */
  readonly requirements: readonly GapItem[];
}

/** Why the gap to a pathway couldn't be shown or stored. */
export type GapError = SaveError | { readonly kind: "unknown-pathway"; readonly pathway: string };

/** Why the overview in `pharoam.md` wasn't brought up to date. */
export type OverviewError =
  ProfileChangeError | { readonly kind: "overview-markers"; readonly location: string };

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
  /**
   * The profile's own `pharoam` record, if storage has a valid one.
   *
   * @remarks Without one, the app offers to create a profile there instead of showing an error (MVP S2.3).
   */
  readonly profile: () => LoadedRecord | undefined;
  /** Forgets every record read, so no profile data is held once the profile is disconnected (MVP S2.4). */
  readonly close: () => void;
  /** The records that changed in storage when Pharoam was about to write them, in the order they happened. */
  readonly conflicts: () => readonly Conflict[];
  /**
   * Resolves a conflict with the version the person chose (MVP S12.1, AD10).
   *
   * @remarks `theirs` reads the record again and uses it, or lists it under Needs attention if it is no longer
   * valid. `mine` writes Pharoam's version over theirs, only if theirs hasn't changed again since it was shown;
   * if it has, the conflict is shown again with the newer version.
   */
  readonly resolveConflict: (
    location: string,
    keep: "mine" | "theirs",
  ) => Promise<Result<undefined, ResolveConflictError>>;
  /**
   * Saves a new record, after validating it.
   *
   * @remarks A new evidence or skill record also brings the overview up to date ({@link CoreService.refreshOverview}).
   */
  readonly create: (file: RecordFile) => Promise<Result<LoadedRecord, SaveError>>;
  /**
   * Saves a change to a record read earlier, only if storage still has the version read (AD10).
   *
   * @remarks A changed evidence or skill record also brings the overview up to date.
   */
  readonly update: (location: string, file: RecordFile) => Promise<Result<LoadedRecord, SaveError>>;
  /**
   * Turns a filled evidence form into the record it will be stored as, writing nothing (MVP S4.2).
   *
   * @remarks The draft has its own new ID and time; show it as a preview and save it with
   * {@link CoreService.create} when the person confirms.
   */
  readonly draftEvidence: (form: EvidenceForm) => Result<RecordFile, InvalidEvidenceError>;
  /**
   * Saves the edited evidence form over a piece of evidence (MVP S5.1).
   *
   * @remarks Keeps the ID, creation time and fields Pharoam doesn't know, and sets `updated`; only if storage still
   * has the version read (AD10). A diagnostic's record (`kind: assessment`) is never edited (data model §4).
   */
  readonly editEvidence: (
    location: string,
    form: EvidenceForm,
  ) => Promise<Result<LoadedRecord, EditEvidenceError>>;
  /**
   * The observations that cite a piece of evidence, so the person sees them before deleting it (MVP S5.3).
   *
   * @remarks Observations are never edited (hard rule 4): after a deletion they keep the ID, which no longer
   * finds a record, so they show it as removed (MVP S5.2).
   */
  readonly evidenceReferences: (id: string) => readonly EvidenceReference[];
  /**
   * Deletes a piece of evidence the person confirmed, only if storage still has the version read (MVP S5.2, AD10).
   *
   * @remarks Only evidence is deleted, never a record under Needs attention (hard rule 3). The overview is brought
   * up to date afterwards.
   */
  readonly deleteEvidence: (location: string) => Promise<Result<undefined, DeleteEvidenceError>>;
  /**
   * Appends the person's own rating of a skill to its skill record, starting the record if needed (MVP S6).
   *
   * @remarks The observation is `self-reported`, with its own ID, the time and an `integrity` fingerprint; the
   * entries already in the record are left exactly as written (hard rule 4, MVP S6.4). Cited evidence must be in
   * the profile.
   */
  readonly recordLevel: (rating: SelfRating) => Promise<Result<LoadedRecord, RecordLevelError>>;
  /**
   * Corrects one of the person's own levels: appends a new `self-reported` observation that supersedes it (MVP S7.1).
   *
   * @remarks The old observation is left as written (hard rule 4). Only a current `self-reported` level can be
   * corrected: a tested level is retaken instead (PRD E7), and a superseded or retracted one no longer counts.
   */
  readonly correctLevel: (
    observation: string,
    correction: Omit<SelfRating, "skill">,
  ) => Promise<Result<LoadedRecord, ChangeLevelError>>;
  /**
   * Withdraws an observation: appends a review with `decision: retract`, so it stops counting (MVP S7.2).
   *
   * @remarks Any observation that isn't already retracted can be withdrawn; it stays in the history, marked.
   */
  readonly retractLevel: (
    observation: string,
    note?: string,
  ) => Promise<Result<LoadedRecord, ChangeLevelError>>;
  /**
   * Adds a skill the vocabulary is missing: starts its skill record, with a `custom-` slug made from the name (MVP S8.1).
   *
   * @remarks The record holds the name and any description, and takes observations like any other skill (S8.2).
   * A name already used, ignoring case, is refused. When another name gives the same slug, or the name has no
   * letters a slug can hold, the record's short ID is added to the slug so it is still unique.
   */
  readonly addCustomSkill: (skill: CustomSkill) => Promise<Result<LoadedRecord, AddCustomSkillError>>;
  /**
   * The person's skills, each with its one shown level, its source and since when, sorted by name (MVP S9.1).
   *
   * @remarks Narrowed by vocabulary domain or by a search of names, other names and slugs (S9.3). The level comes
   * from each skill record's `proficiency` summary, which every save regenerates from the history (S9.2).
   */
  readonly skillView: (vocabulary: readonly SkillEntry[], filter?: SkillFilter) => readonly SkillViewItem[];
  /**
   * Compares the profile with a pathway and stores the result as `gaps/<pathway>.md` (MVP S11.1, S11.4).
   *
   * @remarks Any pathway can be explored, however far off it is (Charter R2, S11.6). The stored gap pins the pathway
   * to its pack version and has a readable summary in its body; it is written only when it has changed. Call it
   * again to refresh by hand (S11.5). Nothing is scored, totalled or ranked (Charter R1).
   */
  readonly exploreGap: (pathway: string) => Promise<Result<GapView, GapError>>;
  /**
   * Why a stored gap couldn't be regenerated after the last change to evidence or skills, if it couldn't (MVP S11.5).
   *
   * @remarks Every stored gap is regenerated after such a change; the change itself was saved. A gap changed outside
   * Pharoam is never overwritten (hard rule 3).
   */
  readonly gapProblem: (pathway: string) => GapError | undefined;
  /** A skill's history, newest first, with each entry marked; empty for a skill without a record (MVP S7.3). */
  readonly skillHistory: (skill: string) => readonly HistoryItem[];
  /**
   * Saves the person's headline, situation, country and focus, and the time of the change (MVP S3.1).
   *
   * @remarks The fields given replace those in `pharoam.md`; a field left out is removed. Unchanged fields, the
   * preferences, fields Pharoam doesn't know and the body are kept as written.
   */
  readonly updateProfile: (fields: ProfileFields) => Promise<Result<LoadedRecord, ProfileChangeError>>;
  /**
   * Regenerates the overview section of `pharoam.md` from the evidence and skill records (MVP S3.2, S3.3).
   *
   * @remarks Writes only between the overview's markers, and nothing at all when the overview hasn't changed.
   */
  readonly refreshOverview: () => Promise<Result<LoadedRecord, OverviewError>>;
  /**
   * Why the overview couldn't be brought up to date after the last change to evidence or skills, if it couldn't.
   *
   * @remarks The change itself was saved. The app shows the problem and offers {@link CoreService.refreshOverview}.
   */
  readonly overviewProblem: () => OverviewError | undefined;
  /**
   * Creates the profile: prepares the storage and writes `pharoam.md` (MVP S1).
   *
   * @remarks Validates before writing anything, and refuses if the profile already has a `pharoam` record.
   */
  readonly createProfile: (profile: ProfileFields) => Promise<Result<LoadedRecord, CreateProfileError>>;
}

/** What the core service needs. */
export interface CoreServiceOptions {
  /** The storage the profile lives in. */
  readonly storage: StorageConnector;
  /** The clock and randomness for new IDs and times, such as `Date.now` and `crypto.getRandomValues`. */
  readonly ids: IdSource;
  /** Writes the overview in `pharoam.md` in the person's language, from the app's translation files. */
  readonly overview: OverviewWriter;
  /** The content pack: the skill vocabulary, level scale and pathways. */
  readonly content: ContentPack;
  /** Writes a stored gap's summary in the person's language, from the app's translation files. */
  readonly gapSummary: GapWriter;
}

/**
 * Creates the core service for one profile.
 *
 * @remarks Call {@link CoreService.open} before anything else.
 * @param options - The storage the profile lives in, and where new IDs and times come from.
 * @returns The service, with nothing read yet.
 */
export function createCoreService(options: CoreServiceOptions): CoreService {
  const { storage, ids, overview, content, gapSummary } = options;
  const nextId = createProfileRecordIdGenerator(ids);
  let loaded: LoadedRecord[] = [];
  let attention: AttentionItem[] = [];
  let overviewProblem: OverviewError | undefined;
  const gapProblems = new Map<string, GapError>();
  // Each conflict, with the version of theirs it was shown with, if it could be read, and my validated record.
  const conflicts = new Map<
    string,
    { conflict: Conflict; version: string | undefined; mine: Mine | undefined }
  >();

  const byId = (id: string): LoadedRecord | undefined => loaded.find((r) => r.record.id === id);
  const profile = (): LoadedRecord | undefined => loaded.find((r) => r.record.schema === "pharoam/1");

  // Adds a record read from storage to the valid records, or to Needs attention (MVP S12.2).
  function place(location: string, read: Awaited<ReturnType<StorageConnector["read"]>>): void {
    if (!read.ok) {
      // A record deleted between listing and reading is simply gone.
      if (read.error.kind !== "not-found") attention.push({ location, problem: read.error });
      return;
    }
    const record = parseProfileRecord(read.value.file.top);
    if (!record.ok) {
      attention.push({ location, problem: { kind: "invalid", error: record.error } });
      return;
    }
    const kept = byId(record.value.id);
    if (kept !== undefined) {
      attention.push({
        location,
        problem: { kind: "duplicate-id", id: record.value.id, keptAt: kept.location },
      });
      return;
    }
    loaded.push(toLoaded(location, read.value.version, read.value.file, record.value));
  }

  // Keeps both versions after a write or delete found the record changed in storage (AD10).
  async function noteConflict(location: string, mine: Mine | undefined): Promise<void> {
    const read = await storage.read(location);
    const theirs = read.ok ? ok(read.value.file) : err(read.error);
    const version = read.ok ? read.value.version : undefined;
    conflicts.delete(location);
    conflicts.set(location, { conflict: { location, mine: mine?.file, theirs }, version, mine });
  }

  async function createRecord(given: RecordFile): Promise<Result<LoadedRecord, SaveError>> {
    const file = withProficiency(given);
    const record = parseProfileRecord(file.top);
    if (!record.ok) return err({ kind: "invalid", error: record.error });
    const kept = byId(record.value.id);
    if (kept !== undefined) return err({ kind: "duplicate-id", id: record.value.id, keptAt: kept.location });
    const created = await storage.create(file);
    if (!created.ok) return err(created.error);
    const result = toLoaded(created.value.location, created.value.version, file, record.value);
    loaded = [...loaded, result];
    await afterChange(result);
    return ok(result);
  }

  async function updateRecord(location: string, given: RecordFile): Promise<Result<LoadedRecord, SaveError>> {
    if (attention.some((item) => item.location === location))
      return err({ kind: "needs-attention", location });
    const current = loaded.find((r) => r.location === location);
    if (current === undefined) return err({ kind: "not-found", location });
    const file = withProficiency(given);
    const record = parseProfileRecord(file.top);
    if (!record.ok) return err({ kind: "invalid", error: record.error });
    if (record.value.id !== current.record.id) return err({ kind: "id-changed", location });
    const written = await storage.write(location, file, current.version);
    if (!written.ok) {
      if (written.error.kind === "conflict") await noteConflict(location, { file, record: record.value });
      return err(saveError(written.error, location));
    }
    const result = toLoaded(location, written.value, file, record.value);
    loaded = loaded.map((r) => (r.location === location ? result : r));
    await afterChange(result);
    return ok(result);
  }

  // Saves a change to `pharoam.md`, marking the time of the change (data model §4).
  function saveProfile(current: LoadedRecord, file: RecordFile): Promise<Result<LoadedRecord, SaveError>> {
    return updateRecord(current.location, withTopFields(file, { updated: timestamp(ids.now()) }));
  }

  async function regenerateOverview(): Promise<Result<LoadedRecord, OverviewError>> {
    const current = profile();
    if (current === undefined) return err({ kind: "no-profile" });
    const body = withOverview(current.file.body, overview(overviewFacts(loaded.map((r) => r.record))));
    if (!body.ok) return err({ kind: "overview-markers", location: current.location });
    if (body.value === current.file.body) return ok(current);
    return saveProfile(current, { ...current.file, body: body.value });
  }

  async function refreshOverview(): Promise<Result<LoadedRecord, OverviewError>> {
    const result = await regenerateOverview();
    overviewProblem = result.ok ? undefined : result.error;
    return result;
  }

  // Evidence and skills feed the overview (MVP S3.3) and every stored gap (MVP S11.5); a folder without a profile
  // has no overview to refresh.
  async function afterChange(saved: LoadedRecord): Promise<void> {
    const { schema } = saved.record;
    if (schema !== "evidence/1" && schema !== "skill-record/1") return;
    if (profile() !== undefined) await refreshOverview();
    for (const gap of loaded)
      if (gap.record.schema === "gap/1") await refreshGap(pathwaySlug(gap.record.pathway));
  }

  const storedGap = (pathway: string): LoadedRecord | undefined =>
    loaded.find((r) => r.record.schema === "gap/1" && pathwaySlug(r.record.pathway) === pathway);

  async function writeGap(slug: string): Promise<Result<GapView, GapError>> {
    const pathway = pathwayDetail(content, slug);
    if (pathway === undefined) return err({ kind: "unknown-pathway", pathway: slug });
    const requirements = gapItems(
      pathway,
      loaded.map((r) => r.record),
    );
    const fields = {
      pathway: `${content.manifest.name}@${content.manifest.version}:${slug}`,
      requirements: requirements.map(({ skill, required, shown, group, evidence }) => ({
        skill,
        required,
        shown,
        group,
        ...(evidence.length > 0 && { evidence: evidence.map((e) => e.id) }),
      })),
    };
    const summary = gapSummary({ title: pathway.title, requirements });
    const body = summary === "" || summary.endsWith("\n") ? summary : `${summary}\n`;
    const current = storedGap(slug);
    const now = timestamp(ids.now());
    let saved: Result<LoadedRecord, SaveError>;
    if (current === undefined) {
      const top = { schema: "gap/1", id: nextId(), created: now, updated: now, ai: null, ...fields };
      saved = await createRecord(createRecordFile(top, body));
    } else {
      const changed = withTopFields(current.file, fields);
      saved =
        changed === current.file && current.file.body === body
          ? ok(current)
          : await updateRecord(current.location, { ...withTopFields(changed, { updated: now }), body });
    }
    if (!saved.ok) return saved;
    const { location, record } = saved.value;
    const updated = record.updated ?? record.created;
    return ok({ id: record.id, location, updated, pathway, requirements });
  }

  async function refreshGap(slug: string): Promise<Result<GapView, GapError>> {
    const result = await writeGap(slug);
    if (result.ok) gapProblems.delete(slug);
    else gapProblems.set(slug, result.error);
    return result;
  }

  const skillRecord = (skill: string): LoadedRecord | undefined =>
    loaded.find((r) => r.record.schema === "skill-record/1" && r.record.skill === skill);

  // A new self-reported observation, sealed; cited evidence must be in the profile (MVP S6.2).
  function newObservation(
    level: number,
    evidence: readonly string[],
    supersedes?: string,
  ): Result<Readonly<Record<string, unknown>> & { readonly observed_at: string }, RecordLevelError> {
    const unknown = evidence.find((id) => byId(id)?.record.schema !== "evidence/1");
    if (unknown !== undefined) return err({ kind: "unknown-evidence", id: unknown });
    const observedAt = timestamp(ids.now());
    const sealed = sealEntry({
      id: nextId(),
      level,
      provenance: "self-reported",
      observed_at: observedAt,
      ...(evidence.length > 0 && { evidence: [...evidence] }),
      ...(supersedes !== undefined && { supersedes }),
    });
    return sealed.ok ? ok({ ...sealed.value, observed_at: observedAt }) : err(invalidLevel());
  }

  function appendEntry(record: LoadedRecord, entry: unknown): Promise<Result<LoadedRecord, SaveError>> {
    return updateRecord(record.location, withAppendedItem(record.file, "entries", entry));
  }

  // The skill record holding an observation, and whether the observation still counts.
  function observationById(
    id: string,
  ): Result<{ record: LoadedRecord; observation: Observation; status: ObservationStatus }, ChangeLevelError> {
    for (const record of loaded) {
      if (record.record.schema !== "skill-record/1") continue;
      const observation = record.record.entries.find(
        (e): e is Observation => !("decision" in e) && e.id === id,
      );
      if (observation === undefined) continue;
      const status = observationStatuses(record.record.entries).get(id) ?? "counts";
      return ok({ record, observation, status });
    }
    return err({ kind: "no-observation", id });
  }

  return {
    open: async () => {
      const listed = await storage.list();
      if (!listed.ok) return listed;
      const reads = await Promise.all(
        listed.value.map(async ({ location }) => ({ location, read: await storage.read(location) })),
      );
      loaded = [];
      attention = [];
      overviewProblem = undefined;
      gapProblems.clear();
      conflicts.clear();
      for (const { location, read } of reads) place(location, read);
      return ok(undefined);
    },

    records: () => loaded,
    needsAttention: () => attention,
    find: byId,
    profile,

    close: () => {
      loaded = [];
      attention = [];
      overviewProblem = undefined;
      gapProblems.clear();
      conflicts.clear();
    },

    conflicts: () => [...conflicts.values()].map(({ conflict }) => conflict),

    resolveConflict: async (location, keep) => {
      const noted = conflicts.get(location);
      if (noted === undefined) return err({ kind: "no-conflict", location });
      const before = loaded.find((r) => r.location === location);
      if (keep === "theirs") {
        conflicts.delete(location);
        loaded = loaded.filter((r) => r.location !== location);
        attention = attention.filter((item) => item.location !== location);
        place(location, await storage.read(location));
      } else {
        const { version, mine } = noted;
        if (version === undefined) return err({ kind: "theirs-unreadable", location });
        const saved =
          mine === undefined
            ? await storage.delete(location, version)
            : await storage.write(location, mine.file, version);
        if (!saved.ok) {
          if (saved.error.kind === "conflict") await noteConflict(location, mine);
          return err(saveError(saved.error, location));
        }
        conflicts.delete(location);
        loaded = loaded.filter((r) => r.location !== location);
        if (mine !== undefined && saved.value !== undefined)
          loaded.push(toLoaded(location, saved.value, mine.file, mine.record));
      }
      // The overview and gaps follow whichever version was kept, or the record's removal.
      const after = loaded.find((r) => r.location === location) ?? before;
      if (after !== undefined) await afterChange(after);
      return ok(undefined);
    },

    create: createRecord,
    update: updateRecord,
    draftEvidence: (form) => evidenceDraft(form, nextId(), timestamp(ids.now())),

    editEvidence: async (location, form) => {
      if (attention.some((item) => item.location === location))
        return err({ kind: "needs-attention", location });
      const current = loaded.find((r) => r.location === location);
      if (current === undefined) return err({ kind: "not-found", location });
      if (current.record.schema !== "evidence/1" || current.record.kind === "assessment")
        return err({ kind: "not-editable", location });
      const edited = editedEvidence(current.file, form, timestamp(ids.now()));
      if (!edited.ok) return edited;
      return updateRecord(location, edited.value);
    },

    recordLevel: async ({ skill, level, evidence = [] }) => {
      const observation = newObservation(level, evidence);
      if (!observation.ok) return observation;
      const current = skillRecord(skill);
      if (current !== undefined) return appendEntry(current, observation.value);
      const top = {
        schema: "skill-record/1",
        id: nextId(),
        created: observation.value.observed_at,
        ai: null,
        skill,
        entries: [observation.value],
      };
      return createRecord(createRecordFile(top, ""));
    },

    addCustomSkill: async ({ name, description = "" }) => {
      const wanted = sameName(name);
      const kept = loaded.find(
        (r) =>
          r.record.schema === "skill-record/1" &&
          r.record.name !== undefined &&
          sameName(r.record.name) === wanted,
      );
      if (kept?.record.schema === "skill-record/1")
        return err({ kind: "skill-exists", skill: kept.record.skill, location: kept.location });
      const id = nextId();
      const slug = customSkillSlug(name);
      // The short ID is the UUIDv7's random end, as in file names (data model §8).
      const shortId = id.replaceAll("-", "").slice(-8);
      const skill =
        slug === undefined
          ? `custom-${shortId}`
          : skillRecord(slug) === undefined
            ? slug
            : `${slug}-${shortId}`;
      const top = {
        schema: "skill-record/1",
        id,
        created: timestamp(ids.now()),
        ai: null,
        skill,
        name: name.trim(),
        ...(description.trim() !== "" && { description }),
      };
      return createRecord(createRecordFile(top, ""));
    },

    correctLevel: async (id, { level, evidence = [] }) => {
      const found = observationById(id);
      if (!found.ok) return found;
      const { record, observation, status } = found.value;
      if (observation.provenance !== "self-reported")
        return err({ kind: "not-correctable", observation: id, reason: "not-self-reported" });
      if (status !== "counts") return err({ kind: "not-correctable", observation: id, reason: status });
      const correction = newObservation(level, evidence, id);
      if (!correction.ok) return correction;
      return appendEntry(record, correction.value);
    },

    retractLevel: async (id, note) => {
      const found = observationById(id);
      if (!found.ok) return found;
      const { record, status } = found.value;
      if (status === "retracted") return err({ kind: "not-correctable", observation: id, reason: status });
      const review = {
        id: nextId(),
        target: id,
        decision: "retract",
        reviewed_at: timestamp(ids.now()),
        ...(note !== undefined && note !== "" && { note }),
      };
      const sealed = sealEntry(review);
      // A review holds only IDs, a time and text, which always have a fingerprint.
      if (!sealed.ok) throw new Error("A review couldn't be fingerprinted.");
      return appendEntry(record, sealed.value);
    },

    exploreGap: refreshGap,
    gapProblem: (pathway) => gapProblems.get(pathway),

    skillView: (vocabulary, filter) => skillView(loaded, vocabulary, filter),

    skillHistory: (skill) => {
      const current = skillRecord(skill);
      return current?.record.schema === "skill-record/1"
        ? skillHistory(current.record.entries, current.entryIntegrity)
        : [];
    },

    evidenceReferences: (id) =>
      loaded.flatMap(({ location, record }) =>
        record.schema === "skill-record/1"
          ? record.entries
              .filter((entry) => "evidence" in entry && entry.evidence.some((cited) => cited === id))
              .map((entry) => ({ location, skill: record.skill, observation: entry.id }))
          : [],
      ),

    deleteEvidence: async (location) => {
      if (attention.some((item) => item.location === location))
        return err({ kind: "needs-attention", location });
      const current = loaded.find((r) => r.location === location);
      if (current === undefined) return err({ kind: "not-found", location });
      if (current.record.schema !== "evidence/1") return err({ kind: "not-evidence", location });
      const removed = await storage.delete(location, current.version);
      if (!removed.ok) {
        if (removed.error.kind === "conflict") await noteConflict(location, undefined);
        return err(saveError(removed.error, location));
      }
      loaded = loaded.filter((r) => r !== current);
      await afterChange(current);
      return ok(undefined);
    },

    createProfile: async (fields) => {
      const existing = profile();
      if (existing !== undefined) return err({ kind: "profile-exists", location: existing.location });
      const created = timestamp(ids.now());
      const top = { schema: "pharoam/1", id: nextId(), created, updated: created, ai: null };
      const file = createRecordFile({ ...top, ...profileFields(fields) }, "");
      const record = parseProfileRecord(file.top);
      if (!record.ok) return err({ kind: "invalid", error: record.error });
      const ready = await storage.initialise();
      if (!ready.ok) return ready;
      return createRecord(file);
    },

    updateProfile: async (fields) => {
      const current = profile();
      if (current === undefined) return err({ kind: "no-profile" });
      const wanted = profileFields(fields);
      // Unchanged fields keep how they were written and their comments; those left out are removed.
      const changes = Object.fromEntries(PROFILE_KEYS.map((key) => [key, wanted[key]]));
      return saveProfile(current, withTopFields(current.file, changes));
    },

    refreshOverview,
    overviewProblem: () => overviewProblem,
  };
}

// A skill record with its `proficiency` summary brought up to date from its history, so the file reads correctly
// without Pharoam (MVP S9.2). A summary already up to date is left exactly as written; other records are unchanged.
function withProficiency(file: RecordFile): RecordFile {
  const record = parseProfileRecord(file.top);
  if (!record.ok || record.value.schema !== "skill-record/1") return file;
  return withTopFields(file, { proficiency: proficiencyOf(record.value.entries) });
}

// What Pharoam was about to write when it found a conflict, already validated.
interface Mine {
  readonly file: RecordFile;
  readonly record: ProfileRecord;
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

// The person's own fields in `pharoam.md`, in the data model's order (§10).
const PROFILE_KEYS = ["headline", "situation", "region", "focus"] as const;

// Only the fields a profile may hold, in the data model's order; anything else is dropped (hard rule 8).
function profileFields(profile: ProfileFields): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (profile.headline !== undefined) fields.headline = profile.headline;
  if (profile.situation !== undefined) fields.situation = { ...profile.situation };
  if (profile.region !== undefined) fields.region = profile.region;
  if (profile.focus !== undefined) fields.focus = { ...profile.focus };
  return fields;
}

// A level that can't be fingerprinted, such as one that isn't a finite number; the schema rejects the rest.
function invalidLevel(): SaveError {
  const issue = { path: ["entries", 0, "level"], code: "invalid_type", message: "Not a level." };
  return { kind: "invalid", error: { kind: "invalid-fields", issues: [issue] } };
}

// A skill's name compared as the person would: ignoring case and surrounding spaces.
function sameName(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase();
}

// The pathway's own slug in a gap's pinned reference, such as `ml-engineer` in `pharoam-core@0.1.0:ml-engineer`.
function pathwaySlug(pinned: string): string {
  return pinned.slice(pinned.lastIndexOf(":") + 1);
}

// A time as Pharoam writes it, to the second, such as `2026-10-24T14:02:11Z`.
function timestamp(milliseconds: number): string {
  return new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, "Z");
}

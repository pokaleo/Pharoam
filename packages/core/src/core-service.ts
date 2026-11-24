/**
 * The core service: the one layer the interface calls to open, query and save a profile.
 *
 * @remarks The interface never calls connectors directly (ADR-0003, interfaces §5). The service reads every record
 * through a {@link StorageConnector}, keeps invalid ones under "Needs attention" and out of every calculation, checks
 * the integrity of entries Pharoam never edits, and saves with the version it read so a record changed in storage
 * is never silently overwritten (AD10, MVP S12).
 * @packageDocumentation
 */
// Types only: the graph, and LangGraph with it, is loaded with `import()` when an AI-led diagnostic runs.
import type {
  AiLedContext,
  AiLedPause,
  AiLedProgress,
  AiLedTurn,
  AiLedTurnError,
  HeldExplanation,
} from "./ai/ai-led-diagnostic.ts";
import { modelName, type ModelProvider } from "./ai/provider.ts";
import { runTask, type CallRecord, type TaskError } from "./ai/run-task.ts";
import { prepareCall } from "./ai/task.ts";
import { explainGap } from "./ai/tasks/explain-gap.ts";
import { judgeSkillLevel } from "./ai/tasks/judge-skill-level.ts";
import { suggestSkillLinks } from "./ai/tasks/suggest-skill-links.ts";
import { MAX_ATTACHMENT_BYTES, attachmentName, numberedName } from "./attachments.ts";
import {
  editedEvidence,
  evidenceDraft,
  type EvidenceForm,
  type InvalidEvidenceError,
} from "./evidence-form.ts";
import { customSkillSlug } from "./custom-skills.ts";
import { evidenceText, sentFingerprint } from "./evidence-text.ts";
import {
  ORIGINAL_INPUT,
  isSameEvidence,
  pastedEvidence,
  type EvidenceIdentity,
  type PasteProvenance,
} from "./pasted-evidence.ts";
import { gapItems, type GapItem, type GapWriter } from "./gaps.ts";
import { createProfileRecordIdGenerator, type IdSource } from "./ids.ts";
import {
  AI_LED_WORKFLOW,
  QUESTION_BANK_RULE,
  QUESTION_BANK_WORKFLOW,
  diagnosticResult,
  nextQuestion,
  type DiagnosticStep,
} from "./diagnostic.ts";
import { checkEntry, checkRecord, recordFingerprint, sealEntry, type IntegrityStatus } from "./integrity.ts";
import { overviewFacts, withOverview, type OverviewWriter } from "./overview.ts";
import type { ContentPack } from "./pack.ts";
import {
  gapExplanationInput,
  gapNoteFile,
  noteText,
  type ExplainedGap,
  type GapExplanationCall,
  type GapNote,
} from "./notes.ts";
import { pathwayDetail, type PathwayDetail } from "./pathways.ts";
import { proficiencyOf } from "./proficiency.ts";
import {
  SCAN_WORKFLOW,
  customSkillNames,
  isStale,
  levelFindings,
  levelScanCall,
  linkFindings,
  linkScanCall,
  scanVocabulary,
  scannable,
  skillDescription,
  type ReviewItem,
  type ScanCall,
} from "./scan.ts";
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
  countingObservations,
  shownObservation,
} from "./skill-history.ts";
import { skillView, type SkillFilter, type SkillViewItem } from "./skill-view.ts";
import { parseProfileRecord, type ProfileRecord, type ProfileRecordError } from "./schemas/profile-record.ts";
import type { McqItem } from "./schemas/assessment-item.ts";
import type { AiLedItem, AiLedStep, Considered, EvidenceRecord } from "./schemas/evidence.ts";
import type { SuggestionInput } from "./schemas/session.ts";
import type { Provenance } from "./schemas/fields.ts";
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

/** A file kept with a record, as storage lists it (MVP S14). */
export interface StoredAttachment {
  /** The file's name, which the record lists under `attachments`. */
  readonly name: string;
  /** A token that changes whenever the file changes, as for records. */
  readonly version: string;
  /** The file's size in bytes. */
  readonly size: number;
}

/** Why a connector couldn't read an attachment. */
export type AttachmentReadError = StorageError | { readonly kind: "not-found" };

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
  /**
   * Lists the files kept with a record, by the record's ID (MVP S14).
   *
   * @remarks Attachments are never listed as records, even a Markdown file (data model §8).
   */
  readonly attachments: (record: string) => Promise<Result<readonly StoredAttachment[], StorageError>>;
  /** Reads one of a record's files, byte for byte. */
  readonly readAttachment: (
    record: string,
    name: string,
  ) => Promise<Result<{ bytes: Uint8Array<ArrayBuffer>; version: string }, AttachmentReadError>>;
  /**
   * Keeps a new file with a record, never over a file already there.
   *
   * @remarks Refuses, as unavailable, a record ID or name that could reach outside the record's own folder; the
   * core only gives names made safe (`attachmentName`).
   */
  readonly addAttachment: (
    record: string,
    name: string,
    bytes: Uint8Array<ArrayBuffer>,
  ) => Promise<Result<StoredAttachment, CreateError>>;
  /** Deletes one of a record's files, only if it is still at `expectedVersion` (AD10). */
  readonly deleteAttachment: (
    record: string,
    name: string,
    expectedVersion: string,
  ) => Promise<Result<undefined, WriteError>>;
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
  /** For a diagnostic's assessment evidence, whether it is as Pharoam wrote it (data model §4). */
  readonly recordIntegrity?: IntegrityStatus;
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

/** A file a piece of evidence lists under `attachments`, and what storage holds under its name (MVP S14). */
export interface AttachmentView {
  /** The name the evidence lists. */
  readonly name: string;
  /** The stored file, or `undefined` when it is missing, such as one moved or deleted outside Pharoam. */
  readonly stored: StoredAttachment | undefined;
}

/** A file to attach, as the person picked it. */
export interface NewAttachment {
  /** The file's own name; the service makes it safe to store (`attachmentName`). */
  readonly name: string;
  /** The file's bytes. */
  readonly bytes: Uint8Array<ArrayBuffer>;
}

/** Why the service didn't attach a file: the reasons evidence can't be changed, or the file is over the limit. */
export type AttachError = EditEvidenceError | { readonly kind: "too-large"; readonly limit: number };

/**
 * Why the service didn't save evidence made from pasted text.
 *
 * @remarks `not-pasted`: the record isn't one from pasted text with an `ai` block. `missing-original`: it names a
 * copy of the pasted text, but none was given. `too-large`: the copy is over the attachment limit.
 */
export type SavePastedError =
  | SaveError
  | { readonly kind: "not-pasted" }
  | { readonly kind: "missing-original" }
  | { readonly kind: "too-large"; readonly limit: number };

/** How a scan runs: the model, the clock, and how it reports progress and is stopped (MVP S16.5). */
export interface ScanOptions {
  /** The provider's own ID for the model. */
  readonly model: string;
  /** The clock to time each call by. */
  readonly now: () => Date;
  /** Called after each call, with how many are done and how many there are. */
  readonly onProgress?: (done: number, total: number) => void;
  /** Asked before each call; when it says yes, the scan stops, keeping what finished. */
  readonly stopped?: () => boolean;
  /** Told of each call as it ends, with its record, for the activity log (MVP S17.1). */
  readonly onCall?: (call: CallRecord) => void;
}

/** Why the service didn't run a scan: the reasons a save fails, or nothing was given to scan. */
export type ScanError = SaveError | { readonly kind: "nothing-to-scan" } | { readonly kind: "mixed-scan" };

/** What deciding several suggestions did: which were decided, and which weren't, and why (MVP S16.7). */
export interface DecisionReport {
  /** The suggestions decided, by ID. */
  readonly decided: readonly string[];
  /**
   * The suggestions left as they were: `stale`, its evidence changed since the scan read it (S16.10);
   * `replaced`, a level that a newer scan of the same skill judged again; `not-pending`, already decided or gone.
   */
  readonly refused: readonly {
    readonly id: string;
    readonly reason: "stale" | "replaced" | "not-pending";
  }[];
  /**
   * The write that failed, if one did: deciding stopped there. Everything listed under `decided` was written
   * and marked; the failed suggestion stays pending, and deciding it again is safe, since an accepted level is
   * never written twice.
   */
  readonly failed?: { readonly id: string; readonly error: SaveError };
}

/** Why the service didn't record the person's own level instead of a suggested one. */
export type AdjustError = RecordLevelError | { readonly kind: "not-pending"; readonly id: string };

/** Why the service didn't list a piece of evidence's files. */
export type AttachmentsError = StorageError | { readonly kind: "not-found"; readonly location: string };

/** Why the service didn't read an attached file; `not-attached` means the evidence doesn't list that name. */
export type ReadAttachmentError =
  AttachmentReadError | { readonly kind: "not-attached"; readonly name: string };

/**
 * Why the service didn't remove an attached file.
 *
 * @remarks `attachment-changed`: the file changed outside Pharoam since it was shown, so nothing was removed (AD10).
 * `not-unlisted`: the file was deleted, but the evidence couldn't then be saved without it, so it still lists the
 * file, now shown as missing.
 */
export type RemoveAttachmentError =
  | EditEvidenceError
  | { readonly kind: "not-attached"; readonly name: string }
  | { readonly kind: "attachment-changed"; readonly name: string }
  | { readonly kind: "not-unlisted"; readonly name: string };

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

/** Why the service didn't save a note: storage refused it, or the explanation was edited down to nothing. */
export type SaveNoteError = SaveError | { readonly kind: "empty-note" };

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
   * up to date afterwards. The evidence's files are deleted only when the person agreed, and only those it lists
   * (MVP S14.4): pass them as {@link CoreService.attachments} showed them. A file changed since then, or one storage
   * couldn't delete, is kept and named in `kept`.
   */
  readonly deleteEvidence: (
    location: string,
    attachments?: readonly AttachmentView[],
  ) => Promise<Result<{ readonly kept: readonly string[] }, DeleteEvidenceError>>;
  /**
   * Turns a draft from pasted text into the record it will be stored as, writing nothing (MVP S15.2, S15.5).
   *
   * @remarks The draft has its own new ID and time, `source: paste`, the `ai` block and the disclaimer; show it as
   * a preview and save it with {@link CoreService.savePastedEvidence} when the person confirms.
   */
  readonly draftPastedEvidence: (
    form: EvidenceForm,
    paste: PasteProvenance,
  ) => Result<RecordFile, InvalidEvidenceError>;
  /**
   * Evidence the person already has that a draft looks like: the same kind, title and organisation (MVP S15.4).
   *
   * @returns The first such record, or `undefined`.
   */
  readonly similarEvidence: (draft: EvidenceIdentity) => LoadedRecord | undefined;
  /**
   * Saves evidence made from pasted text, with its own copy of the text, once the person confirms (MVP S15.5).
   *
   * @remarks `confirmed_by_user` is set to the time of saving. The copy is stored first, under the name in
   * `original_input`, then the record; if the record can't be stored, the copy is removed again, so nothing is left
   * behind (S15.6). A record already in the profile is refused before anything is written.
   * @param file - A record from {@link CoreService.draftPastedEvidence}, perhaps edited.
   * @param original - The pasted text's bytes, when the record keeps a copy; `undefined` when it was discarded.
   */
  readonly savePastedEvidence: (
    file: RecordFile,
    original: Uint8Array<ArrayBuffer> | undefined,
  ) => Promise<Result<LoadedRecord, SavePastedError>>;
  /**
   * The files a piece of evidence lists, in its order, each with what storage holds (MVP S14).
   *
   * @remarks A file in storage the evidence doesn't list isn't shown; a listed file storage doesn't have is shown as
   * missing.
   */
  readonly attachments: (location: string) => Promise<Result<readonly AttachmentView[], AttachmentsError>>;
  /**
   * Keeps a file with a piece of evidence and lists it under `attachments` (MVP S14.1).
   *
   * @remarks The name is made safe, and numbered when the evidence or storage already has it, so no file is ever
   * replaced. A file over {@link MAX_ATTACHMENT_BYTES} is refused (S14.3). If the evidence changed outside Pharoam,
   * the file is kept for the conflict's "mine"; if it can't be saved for another reason, the file is removed
   * again, so the evidence is unchanged either way. A diagnostic's record is never changed (data model §4).
   */
  readonly attachFile: (location: string, file: NewAttachment) => Promise<Result<LoadedRecord, AttachError>>;
  /**
   * Reads a file the evidence lists, byte for byte, for the person to open or download (MVP S14.2).
   *
   * @remarks Only names the evidence lists can be read. The app never shows a file inside the page (hard rule 10).
   */
  readonly readAttachment: (
    location: string,
    name: string,
  ) => Promise<Result<Uint8Array<ArrayBuffer>, ReadAttachmentError>>;
  /**
   * Deletes one of the evidence's files from storage and from its `attachments` list.
   *
   * @remarks The file is deleted first, only if it is still as {@link CoreService.attachments} showed it (AD10); a
   * file already missing is just taken off the list. If the evidence then can't be saved, it still lists the file,
   * now shown as missing, so nothing is left hidden.
   */
  readonly removeAttachment: (
    location: string,
    attachment: AttachmentView,
  ) => Promise<Result<LoadedRecord, RemoveAttachmentError>>;
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
  /**
   * The call that would explain the gap to a pathway: the gap and the titles of the evidence its levels cite
   * (MVP S18.1).
   *
   * @remarks Sends nothing, so the app can show what will be sent and its size first (PRD D4). The stored gap is
   * brought up to date first, as {@link CoreService.exploreGap} does, writing only if it changed, so the call
   * explains the gap the note will name, and its time tells later when the profile has moved on (S18.4, S18.5). A
   * gap that can't be brought up to date, such as one changed outside Pharoam, is refused (hard rule 3).
   */
  readonly explainGapCall: (pathway: string) => Promise<Result<GapExplanationCall, GapError>>;
  /**
   * Saves an explanation the person accepted, as they accepted or edited it, as a new `note/1` (MVP S18.3, S18.4).
   *
   * @remarks `confirmed_by_user` is the time of saving, and the disclaimer goes at the top of the body. It changes no
   * level and no gap (S18.2). A note is never rewritten: asking again saves a new one.
   * @param gap - Which gap it explains and the `ai` block, from the call and its answer.
   * @param text - The explanation, as Markdown.
   * @param disclaimer - The disclaimer, in the person's language.
   */
  readonly saveGapNote: (
    gap: ExplainedGap,
    text: string,
    disclaimer: string,
  ) => Promise<Result<LoadedRecord, SaveNoteError>>;
  /**
   * The newest note on the gap to a pathway, and whether the gap has changed since (MVP S18.5).
   *
   * @remarks A note counts as out of date when the stored gap was regenerated after the gap it explained, couldn't
   * be after the last change, or isn't stored at all. Only notes on this pack's pathway count.
   */
  readonly latestGapNote: (pathway: string) => GapNote | undefined;
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
  /**
   * The calls a scan for skill links would make: one per evidence record, sending that record only (MVP S16.1).
   *
   * @remarks Writes nothing, so the app can show what will be sent and its size first (PRD D4). A diagnostic's
   * record, or an ID that isn't evidence, is left out.
   */
  readonly linkScan: (evidence: readonly string[]) => readonly ScanCall[];
  /**
   * The calls a scan for levels would make: one per skill, sending only that skill's linked evidence (MVP S16.2).
   *
   * @remarks Writes nothing. A skill with no linked evidence, or one on neither Pharoam's list nor the person's
   * own, is left out.
   */
  readonly levelScan: (skills: readonly string[]) => readonly ScanCall[];
  /** The skills a level scan can judge: on a list, with linked evidence; sorted by slug (MVP S16.2). */
  readonly judgeableSkills: () => readonly string[];
  /**
   * Runs a scan's calls, writing what they suggest to a review session of its own in `sessions/` (MVP S16.4).
   *
   * @remarks The session is written after every call, so suggestions from finished calls are kept if the scan is
   * stopped; a failed call sets aside only its own record or skill (S16.5). No link or level is written: the person
   * decides each suggestion later (PRD D2). Suggestions that would change nothing are listed as already so, and a
   * skill on no list is dropped (S16.11). The session is complete once nothing in it is pending.
   */
  readonly runScan: (
    calls: readonly ScanCall[],
    provider: ModelProvider,
    options: ScanOptions,
  ) => Promise<Result<LoadedRecord, ScanError>>;
  /** Every pending suggestion, from every session but an abandoned one, oldest session first (MVP S16.6). */
  readonly reviewItems: () => readonly ReviewItem[];
  /**
   * Accepts or discards suggestions, several at once (MVP S16.7).
   *
   * @remarks Accepting a link adds the skill to the evidence record's `skills` and lists it under `ai-skill-links`
   * (S16.8); accepting a level appends an `ai-judged` observation citing its evidence, with the suggestion's ID
   * (S16.9). Discarding writes nothing but the decision. A suggestion whose evidence changed since the scan read it
   * isn't accepted (S16.10), nor is a level that a newer scan of the same skill replaced. Skipping is simply not deciding: the suggestion stays pending and never counts.
   */
  readonly decideSuggestions: (
    items: readonly Pick<ReviewItem, "session" | "suggestion">[],
    decision: "accept" | "discard",
  ) => Promise<DecisionReport>;
  /**
   * Records the person's own level instead of a suggested one, and drops the suggestion (MVP S16.7, PRD D2).
   *
   * @returns The skill record with the new `self-reported` observation.
   */
  readonly adjustSuggestion: (
    item: Pick<ReviewItem, "session" | "suggestion">,
    level: number,
  ) => Promise<Result<LoadedRecord, AdjustError>>;
  /**
   * Deletes a review session the person no longer wants, only if storage still has the version read (MVP S16.14).
   *
   * @remarks Nothing it led to is changed: accepted links and levels stay.
   */
  readonly deleteSession: (location: string) => Promise<Result<undefined, SaveError>>;
  /**
   * Whether a skill's latest accepted AI level was judged from evidence that has since changed, or from fewer
   * records than are now linked, so the app can offer to ask AI again; Pharoam never judges again on its own (MVP
   * S16.12).
   */
  readonly levelOutOfDate: (skill: string) => boolean;
  /**
   * Whether the question bank has items for a skill, so a diagnostic can be offered (MVP S19.1).
   *
   * @param skill - The skill's slug.
   * @returns `true` when the bank has a multiple-choice item for it.
   */
  readonly bankCovers: (skill: string) => boolean;
  /**
   * The level a new diagnostic of a skill would start at: its shown level, or level 2 when there is none, or the
   * nearest level the question bank has items for (MVP S19.1).
   *
   * @param skill - The skill's slug.
   * @returns The level, or `undefined` when the bank doesn't cover the skill.
   */
  readonly diagnosticStart: (skill: string) => number | undefined;
  /**
   * Starts a question-bank diagnostic of a skill, or resumes the one in progress (MVP S19.1, S19.6).
   *
   * @remarks It starts at the skill's shown level, or level 2 when there is none, or the nearest level the bank has
   * items for, and poses the first question by the published rule. Only its session record is written; nothing
   * counts until it ends. It needs no AI (S19.8). Resuming poses another question if the one posed has left the
   * bank. Starting twice at once starts one diagnostic.
   * @param skill - The skill's slug.
   * @returns The diagnostic, with the question posed, or why it can't start.
   */
  readonly startDiagnostic: (skill: string) => Promise<Result<DiagnosticView, DiagnosticError>>;
  /**
   * The question-bank diagnostic of a skill in progress, if there is one, as its session record holds it.
   *
   * @remarks Writes nothing. To go on with it, call {@link CoreService.startDiagnostic}, which resumes it; a view
   * with no question is waiting for {@link CoreService.finishDiagnostic}.
   */
  readonly diagnosticInProgress: (skill: string) => DiagnosticView | undefined;
  /**
   * Answers the question posed, recording the answer in the session, and poses the next or ends (MVP S19.2–S19.5).
   *
   * @remarks An answer to any other question is refused, and answers to one diagnostic are taken one at a time, so
   * a second click can't answer twice. When the rule ends the diagnostic, the result is written as
   * {@link CoreService.finishDiagnostic} does.
   * @param location - The session record's location.
   * @param item - The slug of the question being answered.
   * @param answer - The index of the option chosen.
   * @param writer - The assessment record's readable title and summary, used if this answer ends it.
   * @returns The next question, or the end with its result; or why the answer wasn't taken.
   */
  readonly answerDiagnostic: (
    location: string,
    item: string,
    answer: number,
    writer: AssessmentWriter,
  ) => Promise<Result<DiagnosticNext, DiagnosticError>>;
  /**
   * Writes an ended diagnostic's result: its assessment evidence, fingerprinted and never edited, and a
   * `demonstrated` observation linking to it, with no acceptance step; then completes the session (MVP S19.5).
   *
   * @remarks Safe to call again after a failed write: the evidence's ID is chosen and kept in the session first,
   * so neither the evidence nor the observation is ever written twice.
   * @param location - The session record's location.
   * @param writer - The assessment record's readable title and summary.
   * @returns What the diagnostic gave, or why it couldn't be written.
   * @throws Error when a record Pharoam builds can't be fingerprinted, which is a bug.
   */
  readonly finishDiagnostic: (
    location: string,
    writer: AssessmentWriter,
  ) => Promise<Result<DiagnosticOutcome, DiagnosticError>>;
  /**
   * Abandons a diagnostic: its session is kept as abandoned, and no result is written (MVP S19.6).
   *
   * @remarks One whose result is being written can only be finished.
   * @param location - The session record's location.
   * @returns Nothing, or why it couldn't be abandoned.
   */
  readonly abandonDiagnostic: (location: string) => Promise<Result<undefined, DiagnosticError>>;
  /**
   * Starts an AI-led diagnostic of a skill with a model, or resumes the one in progress (MVP S23.1, S23.2).
   *
   * @remarks It starts at the skill's shown level, or level 2 when there is none, and names the model chosen, which
   * every later call uses. It notes the evidence linked to the skill (with a fingerprint of what will be sent about
   * each), the person's latest claims and earlier question-bank results: what its calls will send. Only its session
   * record is written, and nothing is sent: each call is shown first, in {@link CoreService.aiDiagnosticTurn}.
   * @param skill - The skill's slug, in Pharoam's vocabulary.
   * @param provider - The provider of the model chosen.
   * @param model - The provider's own ID for the model.
   * @returns The diagnostic, or why it can't start.
   */
  readonly startAiDiagnostic: (
    skill: string,
    provider: ModelProvider,
    model: string,
  ) => Promise<Result<AiDiagnosticView, AiDiagnosticError>>;
  /**
   * The level a new AI-led diagnostic of a skill would start at: its shown level, or level 2 when there is none
   * (MVP S23.2). Unlike the question bank's, it needs no items at that level, as the model can write a question.
   *
   * @param skill - The skill's slug.
   * @returns The level.
   */
  readonly aiDiagnosticStart: (skill: string) => number;
  /**
   * Whether an AI-led diagnostic can test a skill: one in Pharoam's vocabulary, not retired, with or without a
   * question bank, as the model can write questions (MVP S21.1, S23).
   *
   * @param skill - The skill's slug.
   * @returns `true` when it can.
   */
  readonly aiDiagnosticCovers: (skill: string) => boolean;
  /**
   * A skill's shown level, worked out from its entries by the fixed order, even when the record's generated summary
   * is missing or out of date (data model §6).
   *
   * @param skill - The skill's slug.
   * @returns The level, or `undefined` when nothing counts.
   */
  readonly shownLevel: (skill: string) => number | undefined;
  /** The AI-led diagnostic of a skill in progress, if there is one, as its session record holds it. Writes nothing. */
  readonly aiDiagnosticInProgress: (skill: string) => AiDiagnosticView | undefined;
  /**
   * Takes one turn of an AI-led diagnostic: an answer, an approval of the call shown, or neither, to see where it
   * is; then saves its progress to the session record (MVP S23.1–S23.5).
   *
   * @remarks The diagnostic is rebuilt from its session record each turn, so a turn after a reload goes on exactly
   * where it was. Its graph, and LangGraph with it, is loaded only here, so nothing else downloads it. A call runs
   * only when the turn approves exactly what was shown for it, to the model chosen at the start; each call made is
   * told to `onCall` for the activity log. When the evidence it considered has changed since it started, it stops
   * rather than send something else. Once explained, its result is written as assessment evidence and an
   * `ai-correlated` observation, with no acceptance step (S23.4). Turns of one diagnostic are taken one at a time,
   * and abandoning waits for a turn in progress, so nothing is saved after it is abandoned.
   * @param location - The session record's location.
   * @param turn - What the person did.
   * @param provider - The provider of the model chosen at the start.
   * @param options - The clock, the activity log, and the assessment record's readable title and summary.
   * @returns Where it paused, with the result once written; or why the turn wasn't taken.
   * @throws Error when a record Pharoam builds can't be fingerprinted, which is a bug.
   */
  readonly aiDiagnosticTurn: (
    location: string,
    turn: AiLedTurn,
    provider: ModelProvider,
    options: AiDiagnosticOptions,
  ) => Promise<Result<AiDiagnosticTurnResult, AiDiagnosticError>>;
}

/** An AI-led diagnostic as the app shows it (MVP S23). */
export interface AiDiagnosticView {
  /** Where its session record is stored. */
  readonly location: string;
  /** The skill it tests. */
  readonly skill: string;
  /** The level it started at. */
  readonly start: number;
  /** The provider and model chosen at the start, such as `anthropic/claude-sonnet-5-5`. */
  readonly model: string;
  /** How many questions have been answered and marked. */
  readonly asked: number;
  /** The question posed now, in full. */
  readonly posed?: AiLedItem;
  /** An answer to the question posed, waiting for the model's marking. */
  readonly answer?: string;
  /** Whether it has been explained and its result is being written. */
  readonly finishing: boolean;
}

/**
 * What a turn's caller supplies besides the turn.
 *
 * @remarks Calls are timed by the service's own clock, as the records they lead to are, so an `ai` block is never
 * timed after the record holding it.
 */
export interface AiDiagnosticOptions {
  /** Told of each call made, answered or not: required, as every call is in the activity log (MVP S17.1, S23.4). */
  readonly onCall: (call: CallRecord) => void;
  /** The assessment record's readable title and summary, used once the diagnostic is explained. */
  readonly writer: AiAssessmentWriter;
}

/** An AI-led diagnostic after a turn. */
export interface AiDiagnosticTurnResult {
  /** The diagnostic as its session record now holds it. */
  readonly view: AiDiagnosticView;
  /** Where it paused, and why. */
  readonly pause: AiLedPause;
  /** A question dropped unmarked because its bank item changed since it was posed. */
  readonly dropped?: AiLedItem;
  /** The result, once explained and written. */
  readonly outcome?: AiDiagnosticOutcome;
}

/** What an AI-led diagnostic gave when it ended (MVP S23.3, S23.4). */
export interface AiDiagnosticOutcome {
  /** The level the published rule gave from the markings. */
  readonly result: number;
  /** Each question asked, in full, with the answer and its marking. */
  readonly steps: readonly AiLedStep[];
  /** The explanation, with the call that wrote it. */
  readonly explanation: HeldExplanation;
  /** The assessment evidence written. */
  readonly evidence: LoadedRecord;
  /** What it considered, in words (S23.3). */
  readonly considered: ConsideredView;
}

/**
 * What an AI-led diagnostic considered, as the person can read it (MVP S23.3): the evidence by title, the claims by
 * level and source, and the earlier results by level and day.
 *
 * @remarks Anything gone since is left out; the record keeps every ID it sent.
 */
export interface ConsideredView {
  /** Each evidence record sent, by ID and title. */
  readonly evidence: readonly { readonly id: string; readonly title: string }[];
  /** Each claim sent: its level, where it came from, and the day it was made. */
  readonly claims: readonly {
    readonly level: number;
    readonly provenance: Provenance;
    readonly since: string;
  }[];
  /** Each earlier question-bank result sent: its level and the day it ended. */
  readonly earlier: readonly { readonly level: number; readonly date: string }[];
}

/** What an AI-led diagnostic's assessment record reports, for its readable title and summary. */
export interface AiAssessmentFacts {
  /** The skill's slug. */
  readonly skill: string;
  /** The skill's name. */
  readonly name: string;
  /** The level it started at. */
  readonly start: number;
  /** The level the published rule gave. */
  readonly result: number;
  /** Each question asked, in full, with the answer and its marking. */
  readonly steps: readonly AiLedStep[];
  /** The published rule's name. */
  readonly rule: string;
  /** The explanation, with the call that wrote it, for its label and disclaimer (hard rule 6). */
  readonly explanation: HeldExplanation;
  /** The day it ended, as `YYYY-MM-DD`. */
  readonly date: string;
  /** What it considered, in words (S23.3). */
  readonly considered: ConsideredView;
}

/**
 * Writes an AI-led assessment record's title and Markdown summary in the person's language, from the app's
 * translation files, with the AI label and disclaimer (hard rules 6, 12).
 */
export type AiAssessmentWriter = (facts: AiAssessmentFacts) => {
  readonly title: string;
  readonly body: string;
};

/**
 * Why an AI-led diagnostic couldn't go on: why a question-bank one couldn't; the turn's answer wasn't taken; the
 * provider and model aren't the ones chosen at the start; or the evidence, claims or earlier results it considered
 * have changed or gone since it started, so its calls would send something else.
 */
export type AiDiagnosticError =
  | DiagnosticError
  | AiLedTurnError
  | { readonly kind: "other-model"; readonly model: string }
  | { readonly kind: "material-changed"; readonly location: string }
  /** The diagnostic's code couldn't be loaded, as when offline or after the app was updated; try again later. */
  | { readonly kind: "unavailable" };

/** A question-bank diagnostic as the app shows it (MVP S19). */
export interface DiagnosticView {
  /** Where its session record is stored. */
  readonly location: string;
  /** The skill it tests. */
  readonly skill: string;
  /** The level it started at. */
  readonly start: number;
  /** How many questions have been answered. */
  readonly asked: number;
  /** The question posed now; none while the result is being written, or when a new question has to be posed. */
  readonly item?: McqItem;
  /**
   * Whether the last answer is in and the result still has to be written, with
   * {@link CoreService.finishDiagnostic}. With neither this nor a question, the one posed has left the question
   * bank, and {@link CoreService.startDiagnostic} poses another.
   */
  readonly finishing: boolean;
}

/** What a diagnostic gave when it ended (MVP S19.4, S19.5). */
export interface DiagnosticOutcome {
  /** The level it gave. */
  readonly result: number;
  /** Each question asked, with the answer and its marking: the path taken. */
  readonly steps: readonly DiagnosticStep[];
  /** The assessment evidence written. */
  readonly evidence: LoadedRecord;
}

/** What comes after an answer: the next question, or the end with its result. */
export type DiagnosticNext =
  | { readonly kind: "ask"; readonly view: DiagnosticView }
  | { readonly kind: "end"; readonly outcome: DiagnosticOutcome };

/** What a diagnostic's assessment record reports, for its readable title and summary. */
export interface AssessmentFacts {
  /** The skill's slug. */
  readonly skill: string;
  /** The skill's name. */
  readonly name: string;
  /** The level it started at. */
  readonly start: number;
  /** The level it gave. */
  readonly result: number;
  /** The path taken. */
  readonly steps: readonly DiagnosticStep[];
  /** The published rule's name. */
  readonly rule: string;
  /** The day it ended, as `YYYY-MM-DD`. */
  readonly date: string;
}

/**
 * Writes an assessment record's title and Markdown summary in the person's language, from the app's translation
 * files, so the record reads well outside Pharoam (hard rule 12).
 */
export type AssessmentWriter = (facts: AssessmentFacts) => { readonly title: string; readonly body: string };

/**
 * Why a diagnostic couldn't go on: storage refused a write; the bank doesn't cover the skill; the session isn't a
 * diagnostic in progress; the answer isn't to the question posed, as a second click would send; the answer names
 * no option; or its result is being written, so it can only be finished, not abandoned.
 */
export type DiagnosticError =
  | SaveError
  | { readonly kind: "not-covered"; readonly skill: string }
  | { readonly kind: "not-in-progress"; readonly location: string }
  | { readonly kind: "not-posed"; readonly item: string }
  | { readonly kind: "not-an-option"; readonly answer: number }
  | { readonly kind: "finishing"; readonly location: string };

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

  // A pathway pinned to this pack's version, as gaps and notes name it.
  const pinnedPathway = (slug: string): string =>
    `${content.manifest.name}@${content.manifest.version}:${slug}`;

  // What a note on the gap fingerprints: each requirement's skill, the level asked, the level shown with its source,
  // and the group, in this fixed form, so neither a new field on the gap record nor its key order changes it.
  function gapFingerprint(slug: string): string | undefined {
    const gap = storedGap(slug)?.record;
    if (gap?.schema !== "gap/1") return undefined;
    const form = gap.requirements.map(({ skill, required, shown, group }) => [
      skill,
      required,
      shown === null ? null : [shown.level, shown.provenance],
      group,
    ]);
    return sentFingerprint(JSON.stringify(form));
  }

  // The fingerprint of a gap just brought up to date, which is therefore stored; its absence would be a bug.
  function gapRead(slug: string): string {
    const read = gapFingerprint(slug);
    if (read === undefined) throw new Error(`The gap to ${slug} was refreshed but isn't stored.`);
    return read;
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
      pathway: pinnedPathway(slug),
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

  // A piece of evidence Pharoam may change: not under Needs attention, and not a diagnostic's record (data model §4).
  function editableEvidence(location: string): Result<LoadedRecord, EditEvidenceError> {
    if (attention.some((item) => item.location === location))
      return err({ kind: "needs-attention", location });
    const current = loaded.find((r) => r.location === location);
    if (current === undefined) return err({ kind: "not-found", location });
    if (current.record.schema !== "evidence/1" || current.record.kind === "assessment")
      return err({ kind: "not-editable", location });
    return ok(current);
  }

  const listedFiles = (record: LoadedRecord): readonly string[] =>
    record.record.schema === "evidence/1" ? record.record.attachments : [];

  // Saves the evidence with a new list of files and the time of the change.
  function saveFiles(
    current: LoadedRecord,
    files: readonly string[],
  ): Promise<Result<LoadedRecord, SaveError>> {
    const changed = withTopFields(current.file, { attachments: [...files], updated: timestamp(ids.now()) });
    return updateRecord(current.location, changed);
  }

  // Stores the file under its safe name, or the first numbered name neither the evidence nor storage has.
  async function storeFile(
    record: LoadedRecord,
    file: NewAttachment,
  ): Promise<Result<StoredAttachment, CreateError>> {
    const name = attachmentName(file.name);
    const taken = new Set(listedFiles(record).map(sameName));
    let added: Result<StoredAttachment, CreateError> = err({ kind: "exists", location: name });
    for (let number = 1; number <= MAX_NUMBERED && !added.ok && added.error.kind === "exists"; number++) {
      const candidate = number === 1 ? name : numberedName(name, number);
      if (!taken.has(sameName(candidate)))
        added = await storage.addAttachment(record.record.id, candidate, file.bytes);
    }
    return added;
  }

  // Stores the copy of pasted text for a record not yet saved, reusing one an earlier try left that holds the same
  // text, so a draft whose save was cut short can still be saved; any other file there is never replaced.
  async function storeCopy(
    record: string,
    name: string,
    bytes: Uint8Array<ArrayBuffer>,
  ): Promise<Result<string, SavePastedError>> {
    const added = await storage.addAttachment(record, name, bytes);
    if (added.ok) return ok(added.value.version);
    if (added.error.kind !== "exists") return err(added.error);
    const there = await storage.readAttachment(record, name);
    const same =
      there.ok &&
      there.value.bytes.length === bytes.length &&
      there.value.bytes.every((b, i) => b === bytes[i]);
    return same ? ok(there.value.version) : err(added.error);
  }

  // Appends the person's own level to a skill record, starting the record if needed (MVP S6).
  async function recordLevelOf({
    skill,
    level,
    evidence = [],
  }: SelfRating): Promise<Result<LoadedRecord, RecordLevelError>> {
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
  }

  // A number from 0 up to 1 from the secure random source, for choosing among a diagnostic's items.
  function randomUnit(): number {
    const bytes = new Uint8Array(4);
    ids.fillRandom(bytes);
    return new DataView(bytes.buffer).getUint32(0) / 2 ** 32;
  }

  // The question bank's multiple-choice items for a skill.
  const bankFor = (skill: string): McqItem[] =>
    content.items.filter((item): item is McqItem => item.format === "mcq" && item.skills[0] === skill);

  // The items shown in earlier diagnostics of a skill, finished or abandoned, so a retake draws others (S19.7).
  function seenItems(skill: string): Set<string> {
    return new Set(
      loaded.flatMap((one) => {
        const { record } = one;
        if (
          record.schema === "evidence/1" &&
          record.kind === "assessment" &&
          record.diagnostic?.skill === skill
        )
          return record.steps.flatMap((step) => (step.item === undefined ? [] : [step.item]));
        // An abandoned session of either kind: the bank items it asked, and the one it had posed.
        if (
          record.schema === "session/1" &&
          record.status === "abandoned" &&
          record.diagnostic?.skill === skill &&
          (record.workflow === QUESTION_BANK_WORKFLOW || record.workflow === AI_LED_WORKFLOW)
        )
          return [...record.steps.map((step) => step.item), record.next, record.posed?.item].filter(
            (slug) => slug !== undefined,
          );
        return [];
      }),
    );
  }

  // The newest diagnostic of a skill in progress, the one both starting and asking resume.
  function runningSession(skill: string): LoadedRecord | undefined {
    return loaded
      .filter((one) => {
        const found = diagnosticSession(one.location);
        return found?.record.status === "in-progress" && found.diagnostic.skill === skill;
      })
      .toSorted((a, b) => (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0))
      .at(-1);
  }

  // Runs one change to a diagnostic after the last one queued for the same key has finished, so two clicks never
  // write from the same version of its record.
  const queues = new Map<string, Promise<unknown>>();
  function oneAtATime<T>(key: string, change: () => Promise<T>): Promise<T> {
    const before = queues.get(key) ?? Promise.resolve();
    const run = before.then(change, change);
    queues.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  // A question-bank diagnostic's session record, if the location holds one.
  function diagnosticSession(location: string) {
    const found = loaded.find((one) => one.location === location);
    return found?.record.schema === "session/1" &&
      found.record.workflow === QUESTION_BANK_WORKFLOW &&
      found.record.diagnostic !== undefined
      ? {
          loaded: found,
          record: found.record,
          diagnostic: found.record.diagnostic,
          steps: bankSteps(found.record.steps),
        }
      : undefined;
  }

  function diagnosticView(location: string): DiagnosticView | undefined {
    const session = diagnosticSession(location);
    if (session === undefined) return undefined;
    const item = bankFor(session.diagnostic.skill).find((one) => one.slug === session.record.next);
    return {
      location,
      skill: session.diagnostic.skill,
      start: session.diagnostic.start,
      asked: session.steps.length,
      ...(item !== undefined && { item }),
      finishing: session.record.assessment !== undefined,
    };
  }

  // Appends a sealed observation to a skill's record, creating the record when there is none.
  function appendObservation(skill: string, entry: Readonly<Record<string, unknown>>, at: string) {
    const current = skillRecord(skill);
    if (current !== undefined) return appendEntry(current, entry);
    const top = { schema: "skill-record/1", id: nextId(), created: at, ai: null, skill, entries: [entry] };
    return createRecord(createRecordFile(top, ""));
  }

  // The level a new diagnostic starts at: the shown level, or 2; or the nearest level the bank has items for, the
  // lower when two are as near.
  function diagnosticStart(skill: string): number | undefined {
    const levels = [...new Set(bankFor(skill).map((item) => item.level))];
    if (levels.length === 0) return undefined;
    const record = skillRecord(skill)?.record;
    const wanted =
      (record?.schema === "skill-record/1" ? shownObservation(record.entries) : undefined)?.level ?? 2;
    return levels.toSorted((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b)[0];
  }

  // Begins a new diagnostic of a skill at a level, posing its first question; only its session is written.
  async function beginDiagnostic(
    skill: string,
    start: number,
  ): Promise<Result<DiagnosticView, DiagnosticError>> {
    const first = nextQuestion(content.items, skill, start, [], seenItems(skill), randomUnit);
    if (first.kind === "end") return err({ kind: "not-covered", skill });
    const now = timestamp(ids.now());
    const top = {
      schema: "session/1",
      id: nextId(),
      created: now,
      updated: now,
      ai: null,
      workflow: QUESTION_BANK_WORKFLOW,
      status: "in-progress",
      diagnostic: { skill, start, rule: QUESTION_BANK_RULE },
      steps: [],
      next: first.item.slug,
    };
    const created = await createRecord(createRecordFile(top, ""));
    if (!created.ok) return created;
    return ok({
      location: created.value.location,
      skill,
      start,
      asked: 0,
      item: first.item,
      finishing: false,
    });
  }

  // Resumes a diagnostic as its session holds it, posing another question when the one posed has left the bank.
  async function resumeDiagnostic(location: string): Promise<Result<DiagnosticView, DiagnosticError>> {
    const session = diagnosticSession(location);
    const view = diagnosticView(location);
    if (session?.record.status !== "in-progress" || view === undefined)
      return err({ kind: "not-in-progress", location });
    if (view.item !== undefined || session.record.assessment !== undefined) return ok(view);
    const { skill, start } = session.diagnostic;
    const next = nextQuestion(content.items, skill, start, session.steps, seenItems(skill), randomUnit);
    const now = timestamp(ids.now());
    const fields =
      next.kind === "ask"
        ? { next: next.item.slug, updated: now }
        : { next: undefined, assessment: nextId(), updated: now };
    const saved = await updateRecord(location, withTopFields(session.loaded.file, fields));
    if (!saved.ok) return saved;
    const resumed = diagnosticView(location);
    if (resumed === undefined) throw new Error("The diagnostic just saved isn't loaded.");
    return ok(resumed);
  }

  // Takes one answer to the question posed, then poses the next or writes the result.
  async function answerOne(
    location: string,
    slug: string,
    answer: number,
    writer: AssessmentWriter,
  ): Promise<Result<DiagnosticNext, DiagnosticError>> {
    const session = diagnosticSession(location);
    if (session?.record.status !== "in-progress") return err({ kind: "not-in-progress", location });
    const { skill, start } = session.diagnostic;
    const item = bankFor(skill).find((one) => one.slug === slug);
    if (session.record.next !== slug || item === undefined) return err({ kind: "not-posed", item: slug });
    if (!Number.isInteger(answer) || answer < 0 || answer >= item.options.length)
      return err({ kind: "not-an-option", answer });
    const steps = [
      ...session.steps,
      { item: slug, level: item.level, answer, correct: answer === item.answer },
    ];
    const next = nextQuestion(content.items, skill, start, steps, seenItems(skill), randomUnit);
    const now = timestamp(ids.now());
    const fields =
      next.kind === "ask"
        ? { steps, next: next.item.slug, updated: now }
        : { steps, next: undefined, assessment: nextId(), updated: now };
    const saved = await updateRecord(location, withTopFields(session.loaded.file, fields));
    if (!saved.ok) return saved;
    if (next.kind === "ask") {
      const view = diagnosticView(location);
      if (view === undefined) throw new Error("The diagnostic just saved isn't loaded.");
      return ok({ kind: "ask", view });
    }
    const finished = await finishDiagnostic(location, writer);
    return finished.ok ? ok({ kind: "end", outcome: finished.value }) : finished;
  }

  async function finishDiagnostic(
    location: string,
    writer: AssessmentWriter,
  ): Promise<Result<DiagnosticOutcome, DiagnosticError>> {
    const session = diagnosticSession(location);
    const evidenceId = session?.record.assessment;
    if (session?.record.status !== "in-progress" || evidenceId === undefined)
      return err({ kind: "not-in-progress", location });
    const { skill, start, rule } = session.diagnostic;
    const { steps } = session;
    const result = diagnosticResult(steps);
    const now = timestamp(ids.now());
    if (byId(evidenceId) === undefined) {
      const name = content.skills.find((one) => one.slug === skill)?.name ?? skill;
      const date = now.slice(0, 10);
      const { title, body } = writer({ skill, name, start, result, steps, rule, date });
      const top = {
        schema: "evidence/1",
        id: evidenceId,
        created: now,
        ai: null,
        kind: "assessment",
        title,
        date,
        skills: [skill],
        diagnostic: { type: "question-bank", skill, start },
        steps,
        result,
        rule,
      };
      const text = body.endsWith("\n") ? body : `${body}\n`;
      const sealed = recordFingerprint(top, text);
      // A diagnostic's record holds only plain text, numbers and booleans, which always have a fingerprint.
      if (!sealed.ok) throw new Error("An assessment record couldn't be fingerprinted.");
      const created = await createRecord(createRecordFile({ ...top, integrity: sealed.value }, text));
      if (!created.ok) return created;
    }
    const record = skillRecord(skill)?.record;
    const linked =
      record?.schema === "skill-record/1" &&
      record.entries.some((entry) => "assessment" in entry && entry.assessment === evidenceId);
    if (!linked) {
      const sealed = sealEntry({
        id: nextId(),
        level: result,
        provenance: "demonstrated",
        observed_at: now,
        assessment: evidenceId,
      });
      // An observation holds only IDs, a level and a time, which always have a fingerprint.
      if (!sealed.ok) throw new Error("An observation couldn't be fingerprinted.");
      const appended = await appendObservation(skill, sealed.value, now);
      if (!appended.ok) return appended;
    }
    const current = diagnosticSession(location)?.loaded ?? session.loaded;
    const completed = await updateRecord(
      current.location,
      withTopFields(current.file, { status: "completed", updated: now }),
    );
    if (!completed.ok) return completed;
    const evidence = byId(evidenceId);
    if (evidence === undefined) throw new Error("The assessment record written isn't loaded.");
    return ok({ result, steps, evidence });
  }

  // An AI-led diagnostic's session record, if the location holds one, with its model and AI-led steps.
  function aiSession(location: string) {
    const found = loaded.find((one) => one.location === location);
    if (found?.record.schema !== "session/1" || found.record.workflow !== AI_LED_WORKFLOW) return undefined;
    const { diagnostic } = found.record;
    // The session's schema requires the model for this workflow; this only narrows the type.
    if (diagnostic?.model === undefined) return undefined;
    return {
      loaded: found,
      record: found.record,
      diagnostic: { ...diagnostic, model: diagnostic.model },
      considered: found.record.considered ?? { evidence: [], claims: [], earlier: [] },
      steps: found.record.steps.filter((step): step is AiLedStep => "format" in step),
    };
  }

  function aiView(location: string): AiDiagnosticView | undefined {
    const session = aiSession(location);
    if (session === undefined) return undefined;
    const { record, diagnostic } = session;
    return {
      location,
      skill: diagnostic.skill,
      start: diagnostic.start,
      model: diagnostic.model,
      asked: session.steps.length,
      ...(record.posed !== undefined && { posed: record.posed }),
      ...(record.answer !== undefined && { answer: record.answer }),
      finishing: record.assessment !== undefined,
    };
  }

  // The newest AI-led diagnostic of a skill in progress.
  function runningAiSession(skill: string): LoadedRecord | undefined {
    return loaded
      .filter((one) => {
        const found = aiSession(one.location);
        return found?.record.status === "in-progress" && found.diagnostic.skill === skill;
      })
      .toSorted((a, b) => (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0))
      .at(-1);
  }

  // Whether a skill is in Pharoam's vocabulary and not retired, so a diagnostic can test it.
  const activeSkill = (skill: string): boolean =>
    content.skills.some((one) => one.slug === skill && one.status === "active");

  // The observations of a skill that count now, so a retracted or replaced claim is never sent as the person's.
  function countingClaims(skill: string): readonly Observation[] {
    const record = skillRecord(skill)?.record;
    return record?.schema === "skill-record/1" ? countingObservations(record.entries) : [];
  }

  // An earlier question-bank result an AI-led diagnostic can send: one with its level and the day it ended.
  const earlierResult = (record: ProfileRecord, skill: string) =>
    record.schema === "evidence/1" &&
    record.kind === "assessment" &&
    record.diagnostic?.type === "question-bank" &&
    record.diagnostic.skill === skill &&
    record.result !== undefined &&
    record.date?.length === 10
      ? { level: record.result, date: record.date, created: record.created, id: record.id }
      : undefined;

  // What an AI-led diagnostic of a skill will send (MVP S23.1): each linked evidence record with a fingerprint of
  // its text, the latest claim from each source that counts, and earlier question-bank results.
  function aiConsidered(skill: string) {
    // Latest by when it was made, as the shown level is chosen, not by where it sits in the file (data model §6).
    const claims = (["self-reported", "ai-judged"] as const).flatMap((source) => {
      const latest = countingClaims(skill)
        .filter((one) => one.provenance === source)
        .reduce<Observation | undefined>(
          (last, one) =>
            last === undefined || Date.parse(one.observed_at) >= Date.parse(last.observed_at) ? one : last,
          undefined,
        );
      return latest === undefined ? [] : [latest.id];
    });
    const earlier = loaded
      .flatMap(({ record: one }) => {
        const result = earlierResult(one, skill);
        return result === undefined ? [] : [result];
      })
      .toSorted((a, b) => Date.parse(a.created) - Date.parse(b.created))
      .map((one) => one.id);
    const evidence = linkedEvidence(skill).map(({ record: one, body }) => ({
      evidence: one.id,
      sent: sentFingerprint(evidenceText(one, body)),
    }));
    return { evidence, claims, earlier };
  }

  // The material an AI-led diagnostic's calls send, rebuilt from what it noted at the start; or nothing when any of
  // it has changed or gone since, so a call never sends something other than what the diagnostic considered.
  function aiMaterial(skill: string, considered: Considered): AiLedContext["material"] | undefined {
    const evidence: { ref: string; text: string }[] = [];
    for (const [index, one] of considered.evidence.entries()) {
      const now = evidenceNow(one.evidence);
      // Still linked to the skill, as the person may have unlinked it since; and still saying the same.
      if (!now?.record.skills.some((linked) => linked === skill)) return undefined;
      const text = evidenceText(now.record, now.body);
      if (sentFingerprint(text) !== one.sent) return undefined;
      evidence.push({ ref: `E${String(index + 1)}`, text });
    }
    const counting = countingClaims(skill);
    const claims: AiLedContext["material"]["claims"][number][] = [];
    for (const id of considered.claims) {
      const entry = counting.find((one) => one.id === id);
      if (entry === undefined) return undefined;
      if (entry.provenance !== "self-reported" && entry.provenance !== "ai-judged") return undefined;
      claims.push({
        level: entry.level,
        provenance: entry.provenance,
        since: entry.observed_at.slice(0, 10),
      });
    }
    const earlier: AiLedContext["material"]["earlier"][number][] = [];
    for (const id of considered.earlier) {
      const found = byId(id);
      const result = found === undefined ? undefined : earlierResult(found.record, skill);
      if (result === undefined) return undefined;
      earlier.push({ level: result.level, date: result.date });
    }
    return { evidence, claims, earlier };
  }

  // What an AI-led diagnostic considered, in words: evidence titles, claims and earlier results still there.
  function consideredView(skill: string, considered: Considered): ConsideredView {
    const record = skillRecord(skill)?.record;
    const entries = record?.schema === "skill-record/1" ? record.entries : [];
    return {
      evidence: considered.evidence.flatMap(({ evidence }) => {
        const found = evidenceNow(evidence)?.record;
        return found === undefined ? [] : [{ id: found.id, title: found.title }];
      }),
      claims: considered.claims.flatMap((id) => {
        const entry = entries.find((one) => one.id === id);
        return entry === undefined || !("provenance" in entry)
          ? []
          : [{ level: entry.level, provenance: entry.provenance, since: entry.observed_at.slice(0, 10) }];
      }),
      earlier: considered.earlier.flatMap((id) => {
        const found = byId(id);
        const result = found === undefined ? undefined : earlierResult(found.record, skill);
        return result === undefined ? [] : [{ level: result.level, date: result.date }];
      }),
    };
  }

  // Where a new AI-led diagnostic of a skill starts: its shown level, worked out from its entries, or level 2.
  const aiDiagnosticStart = (skill: string): number => shownLevel(skill) ?? 2;

  // Begins an AI-led diagnostic of a skill with a model: only its session is written, and nothing is sent.
  async function beginAiDiagnostic(
    skill: string,
    provider: ModelProvider,
    model: string,
  ): Promise<Result<AiDiagnosticView, AiDiagnosticError>> {
    const start = aiDiagnosticStart(skill);
    const now = timestamp(ids.now());
    const top = {
      schema: "session/1",
      id: nextId(),
      created: now,
      updated: now,
      ai: null,
      workflow: AI_LED_WORKFLOW,
      status: "in-progress",
      diagnostic: { skill, start, rule: QUESTION_BANK_RULE, model: modelName(provider, model) },
      considered: aiConsidered(skill),
      steps: [],
    };
    const created = await createRecord(createRecordFile(top, ""));
    if (!created.ok) return created;
    const view = aiView(created.value.location);
    if (view === undefined) throw new Error("The diagnostic just started isn't loaded.");
    return ok(view);
  }

  // Takes one turn of an AI-led diagnostic, saves its progress, and writes its result once explained.
  async function aiTurn(
    location: string,
    turn: AiLedTurn,
    provider: ModelProvider,
    options: AiDiagnosticOptions,
  ): Promise<Result<AiDiagnosticTurnResult, AiDiagnosticError>> {
    const session = aiSession(location);
    if (session?.record.status !== "in-progress") return err({ kind: "not-in-progress", location });
    const { record, diagnostic } = session;
    // Writing a result already explained calls no model, so it needs none: a person who has since changed their
    // provider can still finish it.
    if (record.assessment !== undefined) return finishAiTurn(location, options.writer);
    const prefix = `${provider.id}/`;
    if (!diagnostic.model.startsWith(prefix)) return err({ kind: "other-model", model: diagnostic.model });
    if (!activeSkill(diagnostic.skill)) return err({ kind: "not-covered", skill: diagnostic.skill });
    const description = skillInfo(diagnostic.skill);
    const material = aiMaterial(diagnostic.skill, session.considered);
    if (description === undefined || material === undefined)
      return err({ kind: "material-changed", location });
    const progress: AiLedProgress = {
      start: diagnostic.start,
      steps: session.steps,
      ...(record.posed !== undefined && { posed: record.posed }),
      ...(record.answer !== undefined && { answer: record.answer }),
      ...(record.explanation !== undefined && { explanation: record.explanation }),
    };
    let graph: typeof import("./ai/ai-led-diagnostic.ts");
    try {
      graph = await import("./ai/ai-led-diagnostic.ts");
    } catch {
      // Fetched only now, so it can fail as any download can: offline, or gone after the app was updated.
      return err({ kind: "unavailable" });
    }
    const advanced = await graph.advanceAiLed(progress, turn, {
      provider,
      model: diagnostic.model.slice(prefix.length),
      now: () => new Date(ids.now()),
      slug: diagnostic.skill,
      skill: description,
      scale: content.levels.levels,
      bank: content.items,
      material,
    });
    if (!advanced.ok) return advanced;
    for (const call of advanced.value.calls) options.onCall(call);
    // Changed in storage while the calls ran, as when the person kept another version: never write over it.
    if (loaded.find((one) => one.location === location) !== session.loaded)
      return err({ kind: "conflict", location });
    const { progress: next, pause, dropped } = advanced.value;
    const explained = pause.kind === "explained";
    if (explained || JSON.stringify(next) !== JSON.stringify(progress)) {
      const fields = {
        steps: next.steps,
        posed: next.posed,
        answer: next.answer,
        explanation: next.explanation,
        updated: timestamp(ids.now()),
        // The result's ID is chosen before it is written, so writing again after a failure never writes it twice.
        ...(explained && { assessment: nextId() }),
      };
      const saved = await updateRecord(location, withTopFields(session.loaded.file, fields));
      if (!saved.ok) return saved;
    }
    if (explained) return finishAiTurn(location, options.writer, dropped);
    const view = aiView(location);
    if (view === undefined) throw new Error("The diagnostic just saved isn't loaded.");
    return ok({ view, pause, ...(dropped !== undefined && { dropped }) });
  }

  // Writes an explained AI-led diagnostic's result and reports it as the turn's end.
  async function finishAiTurn(
    location: string,
    writer: AiAssessmentWriter,
    dropped?: AiLedItem,
  ): Promise<Result<AiDiagnosticTurnResult, AiDiagnosticError>> {
    const finished = await finishAiDiagnostic(location, writer);
    if (!finished.ok) return finished;
    const view = aiView(location);
    if (view === undefined) throw new Error("The diagnostic just finished isn't loaded.");
    return ok({
      view,
      pause: { kind: "explained", result: finished.value.result },
      outcome: finished.value,
      ...(dropped !== undefined && { dropped }),
    });
  }

  // Writes an explained AI-led diagnostic's assessment evidence and `ai-correlated` observation, then completes its
  // session (MVP S23.4). Safe to call again after a failed write, as the question bank's finishing is.
  async function finishAiDiagnostic(
    location: string,
    writer: AiAssessmentWriter,
  ): Promise<Result<AiDiagnosticOutcome, AiDiagnosticError>> {
    const session = aiSession(location);
    const evidenceId = session?.record.assessment;
    const explanation = session?.record.explanation;
    if (session?.record.status !== "in-progress" || evidenceId === undefined || explanation === undefined)
      return err({ kind: "not-in-progress", location });
    const { skill, start, rule } = session.diagnostic;
    const { steps } = session;
    const result = diagnosticResult(steps);
    const { ai, ...said } = explanation;
    const considered = consideredView(skill, session.considered);
    const now = timestamp(ids.now());
    if (byId(evidenceId) === undefined) {
      const name = content.skills.find((one) => one.slug === skill)?.name ?? skill;
      const date = now.slice(0, 10);
      const { title, body } = writer({
        skill,
        name,
        start,
        result,
        steps,
        rule,
        explanation,
        date,
        considered,
      });
      const top = {
        schema: "evidence/1",
        id: evidenceId,
        created: now,
        // The explanation is the record's AI output, so its call is the record's `ai` block (hard rule 6).
        ai,
        kind: "assessment",
        title,
        date,
        skills: [skill],
        diagnostic: { type: "ai-led", skill, start },
        steps,
        result,
        rule,
        considered: session.considered,
        explanation: said,
      };
      const text = body.endsWith("\n") ? body : `${body}\n`;
      const sealed = recordFingerprint(top, text);
      // A diagnostic's record holds only plain text, numbers and booleans, which always have a fingerprint.
      if (!sealed.ok) throw new Error("An assessment record couldn't be fingerprinted.");
      const created = await createRecord(createRecordFile({ ...top, integrity: sealed.value }, text));
      if (!created.ok) return created;
    }
    const record = skillRecord(skill)?.record;
    const linked =
      record?.schema === "skill-record/1" &&
      record.entries.some((entry) => "assessment" in entry && entry.assessment === evidenceId);
    if (!linked) {
      const sealed = sealEntry({
        id: nextId(),
        level: result,
        provenance: "ai-correlated",
        observed_at: now,
        assessment: evidenceId,
        explanation: `${said.showed}\n\n${said.comparison}`,
        ai,
      });
      // An observation holds only IDs, a level, a time and text, which always have a fingerprint.
      if (!sealed.ok) throw new Error("An observation couldn't be fingerprinted.");
      const appended = await appendObservation(skill, sealed.value, now);
      if (!appended.ok) return appended;
    }
    const current = aiSession(location)?.loaded ?? session.loaded;
    const completed = await updateRecord(
      current.location,
      withTopFields(current.file, { status: "completed", updated: now }),
    );
    if (!completed.ok) return completed;
    const evidence = byId(evidenceId);
    if (evidence === undefined) throw new Error("The assessment record written isn't loaded.");
    return ok({ result, steps, explanation, evidence, considered });
  }

  // An evidence record as it is now, for a scan to read or compare with what it read.
  function evidenceNow(id: string): { record: EvidenceRecord; body: string } | undefined {
    const found = byId(id);
    return found?.record.schema === "evidence/1"
      ? { record: found.record, body: found.file.body }
      : undefined;
  }

  // The evidence a level judgement reads for a skill: every record linking it, except a diagnostic's.
  function linkedEvidence(skill: string): { record: EvidenceRecord; body: string; loaded: LoadedRecord }[] {
    return loaded.flatMap((one) => {
      const record = scannable(one);
      return record?.skills.some((one) => one === skill) === true
        ? [{ record, body: one.file.body, loaded: one }]
        : [];
    });
  }

  // What a skill is, for a level judgement: from Pharoam's vocabulary, or the person's own skill record.
  function skillInfo(skill: string): string | undefined {
    const entry = content.skills.find((one) => one.slug === skill && one.status === "active");
    if (entry !== undefined) return skillDescription(entry);
    const own = skillRecord(skill);
    if (own?.record.schema !== "skill-record/1" || own.record.name === undefined) return undefined;
    return skillDescription({ name: own.record.name, description: own.record.description });
  }

  // Whether a suggestion can't be accepted, only scanned again (MVP S16.10).
  // Whether a newer session, not abandoned, also judged this level suggestion's skill. Sessions are ordered by when
  // they started; their UUIDv7 IDs, which sort as they were made, break a tie.
  function replacedNow(location: string, suggestion: SuggestionInput): boolean {
    if (suggestion.kind !== "skill-level") return false;
    const own = loaded.find((one) => one.location === location)?.record;
    if (own?.schema !== "session/1") return false;
    const newer = (other: typeof own): boolean =>
      Date.parse(other.created) - Date.parse(own.created) > 0 ||
      (other.created === own.created && other.id > own.id);
    return loaded.some(
      ({ record }) =>
        record.schema === "session/1" &&
        record.id !== own.id &&
        record.status !== "abandoned" &&
        newer(record) &&
        record.suggestions.some((one) => one.kind === "skill-level" && one.skill === suggestion.skill),
    );
  }

  function staleNow(suggestion: SuggestionInput): boolean {
    if (isStale(suggestion, evidenceNow)) return true;
    if (suggestion.kind === "skill-link") {
      const found = byId(suggestion.evidence);
      return found === undefined || scannable(found) === undefined;
    }
    const read = new Set(suggestion.read.map(({ evidence }) => evidence));
    const linked = linkedEvidence(suggestion.skill).map(({ record }) => record.id);
    return (
      linked.length !== read.size ||
      linked.some((id) => !read.has(id)) ||
      suggestion.evidence.some((id) => !read.has(id))
    );
  }

  function shownLevel(skill: string): number | undefined {
    const record = skillRecord(skill)?.record;
    return record?.schema === "skill-record/1" ? shownObservation(record.entries)?.level : undefined;
  }

  // Writes a link or level the person accepted to the evidence or skill record (MVP S16.8, S16.9).
  async function applySuggestion(
    suggestion: SuggestionInput,
    now: string,
  ): Promise<Result<undefined, SaveError>> {
    const confirmed = { ...suggestion.ai, confirmed_by_user: now };
    if (suggestion.kind === "skill-link") {
      const evidence = byId(suggestion.evidence);
      if (evidence?.record.schema !== "evidence/1")
        return err({ kind: "not-found", location: suggestion.evidence });
      if (evidence.record.skills.some((one) => one === suggestion.skill)) return ok(undefined);
      // The links as written, kept exactly, with the new one added after them.
      const written: unknown = evidence.file.top["ai-skill-links"];
      const links: readonly unknown[] = Array.isArray(written) ? written : [];
      const saved = await updateRecord(
        evidence.location,
        withTopFields(evidence.file, {
          updated: now,
          skills: [...evidence.record.skills, suggestion.skill],
          "ai-skill-links": [...links, { skill: suggestion.skill, ...confirmed }],
        }),
      );
      return saved.ok ? ok(undefined) : saved;
    }
    // The observation keeps the suggestion's ID, so what the judgement read can be found again (S16.12).
    const sealed = sealEntry({
      id: suggestion.id,
      level: suggestion.level,
      provenance: "ai-judged",
      observed_at: now,
      evidence: [...suggestion.evidence],
      explanation: suggestion.explanation,
      limits: suggestion.limits,
      ai: confirmed,
    });
    if (!sealed.ok) return err(invalidLevel());
    const current = skillRecord(suggestion.skill);
    const entries = current?.record.schema === "skill-record/1" ? current.record.entries : [];
    if (entries.some((entry) => entry.id === suggestion.id)) return ok(undefined);
    const saved =
      current === undefined
        ? await createRecord(
            createRecordFile(
              {
                schema: "skill-record/1",
                id: nextId(),
                created: now,
                ai: null,
                skill: suggestion.skill,
                entries: [sealed.value],
              },
              "",
            ),
          )
        : await appendEntry(current, sealed.value);
    return saved.ok ? ok(undefined) : saved;
  }

  // Writes a running scan's findings into its session as it is now, so decisions the person made on it meanwhile
  // are kept; complete once the scan is over and nothing is pending (MVP S16.5, S16.14).
  async function writeScan(
    started: LoadedRecord,
    found: readonly SuggestionInput[],
    already: readonly Readonly<Record<string, unknown>>[],
    setAside: readonly Readonly<Record<string, unknown>>[],
    over: boolean,
  ): Promise<Result<LoadedRecord, SaveError>> {
    const current = loaded.find((one) => one.location === started.location) ?? started;
    const written = (
      Array.isArray(current.file.top.suggestions) ? current.file.top.suggestions : []
    ) as readonly Readonly<Record<string, unknown>>[];
    const known = new Set(written.map((one) => one.id));
    const suggestions = [...written, ...found.filter((one) => !known.has(one.id))];
    const pending = suggestions.some((one) => one.decision === undefined);
    return updateRecord(
      current.location,
      withTopFields(current.file, {
        updated: timestamp(ids.now()),
        status: over && !pending ? "completed" : "in-progress",
        suggestions: suggestions.length === 0 ? undefined : suggestions,
        already: already.length === 0 ? undefined : already,
        set_aside: setAside.length === 0 ? undefined : setAside,
      }),
    );
  }

  // Writes decisions into a session, completing it when nothing is pending (MVP S16.14).
  async function markDecided(
    session: LoadedRecord,
    decisions: ReadonlyMap<string, "accepted" | "discarded" | "adjusted">,
    now: string,
  ): Promise<Result<LoadedRecord, SaveError>> {
    const raw = (
      Array.isArray(session.file.top.suggestions) ? session.file.top.suggestions : []
    ) as readonly Readonly<Record<string, unknown>>[];
    const suggestions = raw.map((one) => {
      const decision = typeof one.id === "string" ? decisions.get(one.id) : undefined;
      return decision === undefined ? one : { ...one, decision, decided_at: now };
    });
    const pending = suggestions.some((one) => one.decision === undefined);
    return updateRecord(
      session.location,
      withTopFields(session.file, {
        updated: now,
        status: pending ? "in-progress" : "completed",
        suggestions,
      }),
    );
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
    draftPastedEvidence: (form, paste) => pastedEvidence(form, nextId(), timestamp(ids.now()), paste),

    similarEvidence: (draft) =>
      loaded.find(
        ({ record }) =>
          record.schema === "evidence/1" &&
          isSameEvidence(draft, {
            kind: record.kind,
            title: record.title,
            ...(record.organisation !== undefined && { organisation: record.organisation }),
          }),
      ),

    savePastedEvidence: async (given, original) => {
      const parsed = parseProfileRecord(given.top);
      if (!parsed.ok) return err({ kind: "invalid", error: parsed.error });
      const record = parsed.value;
      if (record.schema !== "evidence/1" || record.source !== "paste" || record.ai === null)
        return err({ kind: "not-pasted" });
      const kept = byId(record.id);
      if (kept !== undefined) return err({ kind: "duplicate-id", id: record.id, keptAt: kept.location });
      const name = record.original_input;
      // The copy only ever goes under its own name, listed with the record (data model §7).
      if (name !== undefined && (name !== ORIGINAL_INPUT || !record.attachments.includes(name)))
        return err({ kind: "not-pasted" });
      if (name !== undefined && original === undefined) return err({ kind: "missing-original" });
      if (original !== undefined && original.length > MAX_ATTACHMENT_BYTES)
        return err({ kind: "too-large", limit: MAX_ATTACHMENT_BYTES });
      // Confirmed now, when the person saves it (data model §5).
      const file = withTopFields(given, { ai: { ...record.ai, confirmed_by_user: timestamp(ids.now()) } });
      if (name === undefined || original === undefined) return createRecord(file);
      const copy = await storeCopy(record.id, name, original);
      if (!copy.ok) return copy;
      const created = await createRecord(file);
      if (!created.ok) await storage.deleteAttachment(record.id, name, copy.value);
      return created;
    },

    editEvidence: async (location, form) => {
      const editable = editableEvidence(location);
      if (!editable.ok) return editable;
      const current = editable.value;
      const edited = editedEvidence(current.file, form, timestamp(ids.now()));
      if (!edited.ok) return edited;
      return updateRecord(location, edited.value);
    },

    recordLevel: recordLevelOf,

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

    explainGapCall: async (slug) => {
      const gap = await refreshGap(slug);
      if (!gap.ok) return gap;
      const input = gapExplanationInput(gap.value.pathway, gap.value.requirements, content.levels.levels);
      return ok({
        pathway: pinnedPathway(slug),
        gapUpdated: gap.value.updated,
        gapRead: gapRead(slug),
        gap: gap.value,
        input,
        call: prepareCall(explainGap, input),
      });
    },

    saveGapNote: async (gap, text, disclaimer) => {
      if (text.trim() === "") return err({ kind: "empty-note" });
      return createRecord(gapNoteFile(gap, text, nextId(), timestamp(ids.now()), disclaimer));
    },

    latestGapNote: (slug) => {
      // Any version of this pack's pathway, as a note pins the version its gap had.
      const pack = `${content.manifest.name}@`;
      const notes = loaded.flatMap((r) =>
        r.record.schema === "note/1" &&
        r.record.pathway.startsWith(pack) &&
        pathwaySlug(r.record.pathway) === slug
          ? [{ ...r, note: r.record }]
          : [],
      );
      // The newest by when it was accepted; UUIDv7 IDs, which sort as they were made, break a tie.
      const latest = notes.toSorted(
        (a, b) =>
          Date.parse(b.note.created) - Date.parse(a.note.created) ||
          (a.note.id < b.note.id ? 1 : a.note.id > b.note.id ? -1 : 0),
      )[0];
      if (latest === undefined) return undefined;
      const gap = storedGap(slug)?.record;
      const gapUpdated = gap?.schema === "gap/1" ? Date.parse(gap.updated ?? gap.created) : undefined;
      // A note with a fingerprint is compared by it, which sees a change within the same second; an older note
      // without one goes by the gap's time.
      const changed =
        latest.note.gap_read === undefined
          ? gapUpdated !== Date.parse(latest.note.gap_updated)
          : gapFingerprint(slug) !== latest.note.gap_read;
      return {
        id: latest.note.id,
        location: latest.location,
        created: latest.note.created,
        ai: latest.note.ai,
        text: noteText(latest.file.body),
        outOfDate: gapProblems.has(slug) || changed,
      };
    },

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

    deleteEvidence: async (location, attachments = []) => {
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
      // Only files the evidence listed, as they were shown; anything else stays (MVP S14.4).
      const listed = new Set(current.record.attachments);
      const kept: string[] = [];
      for (const { name, stored } of attachments) {
        if (!listed.has(name) || stored === undefined) continue;
        const deleted = await storage.deleteAttachment(current.record.id, stored.name, stored.version);
        if (!deleted.ok && deleted.error.kind !== "not-found") kept.push(name);
      }
      return ok({ kept });
    },

    attachments: async (location) => {
      const current = loaded.find((r) => r.location === location);
      if (current?.record.schema !== "evidence/1") return err({ kind: "not-found", location });
      const stored = await storage.attachments(current.record.id);
      if (!stored.ok) return stored;
      // A name listed twice by hand is shown once.
      return ok(
        [...new Set(current.record.attachments)].map((name) => ({
          name,
          stored: storedAs(stored.value, name),
        })),
      );
    },

    attachFile: async (location, file) => {
      const editable = editableEvidence(location);
      if (!editable.ok) return editable;
      if (file.bytes.length > MAX_ATTACHMENT_BYTES)
        return err({ kind: "too-large", limit: MAX_ATTACHMENT_BYTES });
      const current = editable.value;
      const added = await storeFile(current, file);
      if (!added.ok) return err(added.error);
      const saved = await saveFiles(current, [...listedFiles(current), added.value.name]);
      // On a conflict the file stays for the person's "mine"; otherwise the evidence is left as it was.
      if (!saved.ok && saved.error.kind !== "conflict")
        await storage.deleteAttachment(current.record.id, added.value.name, added.value.version);
      return saved;
    },

    readAttachment: async (location, name) => {
      const current = loaded.find((r) => r.location === location);
      if (current === undefined || !listedFiles(current).includes(name))
        return err({ kind: "not-attached", name });
      // Read by the name storage holds, which may be spelled another way (NFC or NFD) than the evidence lists it.
      const stored = await storage.attachments(current.record.id);
      if (!stored.ok) return stored;
      const file = storedAs(stored.value, name);
      if (file === undefined) return err({ kind: "not-found" });
      const read = await storage.readAttachment(current.record.id, file.name);
      return read.ok ? ok(read.value.bytes) : read;
    },

    removeAttachment: async (location, { name, stored }) => {
      const editable = editableEvidence(location);
      if (!editable.ok) return editable;
      const current = editable.value;
      const files = listedFiles(current);
      if (!files.includes(name)) return err({ kind: "not-attached", name });
      if (stored !== undefined) {
        const deleted = await storage.deleteAttachment(current.record.id, stored.name, stored.version);
        // A file already gone is just taken off the list.
        if (!deleted.ok && deleted.error.kind === "conflict")
          return err({ kind: "attachment-changed", name });
        if (!deleted.ok && deleted.error.kind === "unavailable") return err(deleted.error);
      }
      const saved = await saveFiles(
        current,
        files.filter((file) => file !== name),
      );
      // The file is gone, so the person mustn't be told nothing changed.
      if (!saved.ok && stored !== undefined) return err({ kind: "not-unlisted", name });
      return saved;
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

    linkScan: (ids) => {
      const vocabulary = scanVocabulary(content);
      const custom = customSkillNames(loaded);
      return ids.flatMap((id) => {
        const found = byId(id);
        const record = found === undefined ? undefined : scannable(found);
        return found === undefined || record === undefined
          ? []
          : [linkScanCall(found, record, vocabulary, custom)];
      });
    },

    levelScan: (skills) =>
      skills.flatMap((skill) => {
        const description = skillInfo(skill);
        const linked = linkedEvidence(skill);
        if (description === undefined || linked.length === 0) return [];
        return [levelScanCall(skill, description, content.levels.levels, linked)];
      }),

    judgeableSkills: () =>
      [...new Set(loaded.flatMap((one) => scannable(one)?.skills ?? []))]
        .filter((skill) => skillInfo(skill) !== undefined)
        .sort(),

    runScan: async (calls, provider, options) => {
      const first = calls[0];
      if (first === undefined) return err({ kind: "nothing-to-scan" });
      if (calls.some((call) => call.kind !== first.kind)) return err({ kind: "mixed-scan" });
      const started = timestamp(ids.now());
      const top = {
        schema: "session/1",
        id: nextId(),
        created: started,
        updated: started,
        ai: null,
        workflow: SCAN_WORKFLOW,
        scan: first.kind,
        status: "in-progress",
      };
      let saved = await createRecord(createRecordFile(top, ""));
      if (!saved.ok) return saved;
      const known = new Set(
        [...scanVocabulary(content), ...customSkillNames(loaded)].map(({ slug }) => slug),
      );
      const suggestions: SuggestionInput[] = [];
      const already: Readonly<Record<string, unknown>>[] = [];
      const setAside: Readonly<Record<string, unknown>>[] = [];
      let done = 0;
      for (const call of calls) {
        if (options.stopped?.() === true) break;
        if (call.kind === "skill-links") {
          const answer = await runTask(provider, suggestSkillLinks, call.input, options);
          options.onCall?.(answer.ok ? answer.value.call : answer.error.call);
          if (!answer.ok) setAside.push({ evidence: call.evidence, reason: reasonOf(answer.error.reason) });
          else {
            const linked = evidenceNow(call.evidence)?.record.skills ?? [];
            const found = linkFindings(
              call,
              answer.value.output.links,
              answer.value.ai,
              known,
              linked,
              nextId,
            );
            suggestions.push(...found.suggestions);
            already.push(...found.already);
          }
        } else {
          const answer = await runTask(provider, judgeSkillLevel, call.input, options);
          options.onCall?.(answer.ok ? answer.value.call : answer.error.call);
          if (!answer.ok) setAside.push({ skill: call.skill, reason: reasonOf(answer.error.reason) });
          else {
            const found = levelFindings(
              call,
              answer.value.output,
              answer.value.ai,
              shownLevel(call.skill),
              nextId,
            );
            suggestions.push(...found.suggestions);
            already.push(...found.already);
          }
        }
        done++;
        saved = await writeScan(saved.value, suggestions, already, setAside, done === calls.length);
        if (!saved.ok) return saved;
        options.onProgress?.(done, calls.length);
      }
      // Stopped early: a session with nothing pending is complete.
      if (done < calls.length) saved = await writeScan(saved.value, suggestions, already, setAside, true);
      return saved;
    },

    reviewItems: () =>
      loaded
        .flatMap((one) =>
          one.record.schema === "session/1" && one.record.status !== "abandoned"
            ? [{ location: one.location, record: one.record }]
            : [],
        )
        .sort((a, b) => Date.parse(a.record.created) - Date.parse(b.record.created))
        .flatMap(({ location, record }) =>
          record.suggestions
            .filter((suggestion) => suggestion.decision === undefined)
            .map((suggestion) => ({
              session: location,
              suggestion,
              stale: staleNow(suggestion),
              replaced: replacedNow(location, suggestion),
            })),
        ),

    decideSuggestions: async (items, decision) => {
      const now = timestamp(ids.now());
      const decided: string[] = [];
      const refused: { id: string; reason: "stale" | "replaced" | "not-pending" }[] = [];
      let failed: { id: string; error: SaveError } | undefined;
      for (const location of new Set(items.map((item) => item.session))) {
        const session = loaded.find((one) => one.location === location);
        const wanted = [
          ...new Set(items.filter((item) => item.session === location).map((item) => item.suggestion.id)),
        ];
        if (session?.record.schema !== "session/1") {
          refused.push(...wanted.map((id) => ({ id, reason: "not-pending" as const })));
          continue;
        }
        const decisions = new Map<string, "accepted" | "discarded">();
        for (const id of wanted) {
          const suggestion = session.record.suggestions.find((one) => one.id === id);
          if (suggestion === undefined || suggestion.decision !== undefined) {
            refused.push({ id, reason: "not-pending" });
            continue;
          }
          if (decision === "accept") {
            if (staleNow(suggestion)) {
              refused.push({ id, reason: "stale" });
              continue;
            }
            if (replacedNow(location, suggestion)) {
              refused.push({ id, reason: "replaced" });
              continue;
            }
            const applied = await applySuggestion(suggestion, now);
            if (!applied.ok) {
              failed = { id, error: applied.error };
              break;
            }
          }
          decisions.set(id, decision === "accept" ? "accepted" : "discarded");
        }
        // Whatever was written is marked, even when a later write failed, so nothing is left half-decided.
        if (decisions.size > 0) {
          const current = loaded.find((one) => one.location === location) ?? session;
          const marked = await markDecided(current, decisions, now);
          if (marked.ok) decided.push(...decisions.keys());
          else failed ??= { id: [...decisions.keys()][0] ?? "", error: marked.error };
        }
        if (failed !== undefined) break;
      }
      return { decided, refused, ...(failed !== undefined && { failed }) };
    },

    adjustSuggestion: async ({ session: location, suggestion: { id } }, level) => {
      const session = loaded.find((one) => one.location === location);
      const suggestion =
        session?.record.schema === "session/1"
          ? session.record.suggestions.find((one) => one.id === id)
          : undefined;
      if (session === undefined || suggestion?.kind !== "skill-level" || suggestion.decision !== undefined)
        return err({ kind: "not-pending", id });
      const recorded = await recordLevelOf({ skill: suggestion.skill, level });
      if (!recorded.ok) return recorded;
      const current = loaded.find((one) => one.location === location) ?? session;
      const marked = await markDecided(current, new Map([[id, "adjusted"]]), timestamp(ids.now()));
      return marked.ok ? recorded : marked;
    },

    deleteSession: async (location) => {
      const current = loaded.find((one) => one.location === location);
      if (current?.record.schema !== "session/1") return err({ kind: "not-found", location });
      const removed = await storage.delete(location, current.version);
      if (!removed.ok) {
        if (removed.error.kind === "conflict") await noteConflict(location, undefined);
        return err(saveError(removed.error, location));
      }
      loaded = loaded.filter((one) => one !== current);
      return ok(undefined);
    },

    bankCovers: (skill) => bankFor(skill).length > 0,

    diagnosticStart,

    diagnosticInProgress: (skill) => {
      const session = runningSession(skill);
      return session === undefined ? undefined : diagnosticView(session.location);
    },

    startDiagnostic: (skill) =>
      oneAtATime(`start:${skill}`, async (): Promise<Result<DiagnosticView, DiagnosticError>> => {
        const items = bankFor(skill);
        if (items.length === 0) return err({ kind: "not-covered", skill });
        const running = runningSession(skill);
        if (running !== undefined)
          return oneAtATime(running.location, () => resumeDiagnostic(running.location));
        return beginDiagnostic(skill, diagnosticStart(skill) ?? 2);
      }),

    answerDiagnostic: (location, slug, answer, writer) =>
      oneAtATime(location, () => answerOne(location, slug, answer, writer)),

    finishDiagnostic: (location, writer) => oneAtATime(location, () => finishDiagnostic(location, writer)),

    startAiDiagnostic: (skill, provider, model) =>
      oneAtATime(`start-ai:${skill}`, async (): Promise<Result<AiDiagnosticView, AiDiagnosticError>> => {
        // Only a skill in Pharoam's vocabulary: its record and the result are an inventory skill's (MVP S23).
        if (!activeSkill(skill)) return err({ kind: "not-covered", skill });
        const running = runningAiSession(skill);
        if (running === undefined) return beginAiDiagnostic(skill, provider, model);
        // After any turn of it in progress, so the view is never of a session about to end.
        return oneAtATime(
          running.location,
          async (): Promise<Result<AiDiagnosticView, AiDiagnosticError>> => {
            const view = aiView(running.location);
            if (view === undefined || aiSession(running.location)?.record.status !== "in-progress")
              return beginAiDiagnostic(skill, provider, model);
            // One in progress goes on with the model it started with, never silently another (S23.1).
            return view.model === modelName(provider, model)
              ? ok(view)
              : err({ kind: "other-model", model: view.model });
          },
        );
      }),

    aiDiagnosticStart,

    aiDiagnosticCovers: activeSkill,

    shownLevel,

    aiDiagnosticInProgress: (skill) => {
      const running = runningAiSession(skill);
      return running === undefined ? undefined : aiView(running.location);
    },

    aiDiagnosticTurn: (location, turn, provider, options) =>
      oneAtATime(location, () => aiTurn(location, turn, provider, options)),

    abandonDiagnostic: (location) =>
      oneAtATime(location, async (): Promise<Result<undefined, DiagnosticError>> => {
        // Either kind of diagnostic; one turn of an AI-led one finishes first, so nothing is saved after this.
        const session = diagnosticSession(location) ?? aiSession(location);
        if (session?.record.status !== "in-progress") return err({ kind: "not-in-progress", location });
        if (session.record.assessment !== undefined) return err({ kind: "finishing", location });
        // The question posed stays in the record, so a retake counts it as seen (S19.7).
        const saved = await updateRecord(
          location,
          withTopFields(session.loaded.file, { status: "abandoned", updated: timestamp(ids.now()) }),
        );
        return saved.ok ? ok(undefined) : saved;
      }),

    levelOutOfDate: (skill) => {
      const record = skillRecord(skill)?.record;
      if (record?.schema !== "skill-record/1") return false;
      const judged = countingObservations(record.entries)
        .filter((one) => one.provenance === "ai-judged")
        .at(-1);
      if (judged === undefined) return false;
      const linked = linkedEvidence(skill);
      const read = loaded
        .flatMap((one) => (one.record.schema === "session/1" ? one.record.suggestions : []))
        .find((one) => one.id === judged.id);
      if (read?.kind === "skill-level") {
        if (linked.length !== read.read.length) return true;
        return linked.some(({ record: evidence }) => {
          const sent = read.read.find((one) => one.evidence === evidence.id)?.sent;
          return (
            sent === undefined || isStale({ ...read, read: [{ evidence: evidence.id, sent }] }, evidenceNow)
          );
        });
      }
      // Its session was deleted: a record it rests on that is no longer linked, or linked evidence changed since.
      if (judged.evidence.some((id) => !linked.some(({ record: evidence }) => evidence.id === id)))
        return true;
      const after = Date.parse(judged.observed_at);
      return linked.some(({ record: evidence }) => Date.parse(evidence.updated ?? evidence.created) > after);
    },
  };
}

// The kind of failure a scan sets a record or skill aside for, such as `unreachable` (MVP S16.5).
function reasonOf(error: TaskError): string {
  return error.kind === "provider" ? error.error.kind : error.kind;
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
  // A diagnostic's record is fingerprinted as a whole; one written by hand has no diagnostic and isn't checked.
  const assessment =
    record.schema === "evidence/1" && record.kind === "assessment" && record.diagnostic !== undefined;
  return {
    location,
    version,
    file,
    record,
    entryIntegrity: entryIntegrity(file, record),
    ...(assessment && { recordIntegrity: checkRecord(file.top, file.body) }),
  };
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

// The stored file for a name the evidence lists, matching however either spells accented letters (NFC or NFD).
function storedAs(stored: readonly StoredAttachment[], name: string): StoredAttachment | undefined {
  const wanted = name.normalize("NFC");
  return stored.find((file) => file.name.normalize("NFC") === wanted);
}

// How many numbered names to try for a file before giving up, as storage keeps saying each one exists.
const MAX_NUMBERED = 100;

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

// A question-bank session's steps. Its schema keeps out AI-led steps, so none is dropped; this only narrows the type.
function bankSteps(steps: readonly (DiagnosticStep | AiLedStep)[]): DiagnosticStep[] {
  return steps.filter((step): step is DiagnosticStep => !("format" in step));
}

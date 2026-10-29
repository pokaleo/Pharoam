/**
 * Where a profile is kept, as the interface sees it.
 *
 * @remarks The interface never touches a connector (ADR-0003, AGENTS.md rule 11); the composition root implements
 * these for a folder the person chooses (`src/composition/folder-places.ts`) or, in browsers that can't open one,
 * the browser's own storage (`src/composition/browser-places.ts`, ADR-0020).
 * @packageDocumentation
 */
import type { Result, StorageConnector, StorageError } from "@pharoam/core";

/** A place the person chose and gave permission for, ready to open. */
export interface ProfilePlace {
  /** Its name, as the person sees it, such as the folder's name. */
  readonly name: string;
  /** Its storage, for the core service. */
  readonly storage: StorageConnector;
}

/**
 * Where profiles are kept: `folder`, a folder on the person's computer (Chromium browsers); `browser`, the
 * browser's own storage, where a folder can't be opened (Safari, Firefox; ADR-0020).
 */
export type PlaceKind = "folder" | "browser";

/** A file in a place, with its path from the place's top, such as `evidence/payments-api--0192f3a1.md`. */
export interface StoredFile {
  /** Its path, with `/` between folders. */
  readonly path: string;
  /** Its bytes, exactly as stored. */
  readonly bytes: Uint8Array;
}

/**
 * Why a place couldn't be opened: the person closed the picker, refused permission, no place was remembered, or
 * the storage failed.
 */
export type PlaceError =
  | { readonly kind: "cancelled" }
  | { readonly kind: "denied" }
  | { readonly kind: "forgotten" }
  | StorageError;

/** Choosing, reopening and forgetting the place a profile is kept. */
export interface Places {
  /** What kind of place this is, which decides how the screens describe it. */
  readonly kind: PlaceKind;
  /** The name of the place chosen on an earlier visit, found without reading it or asking for permission (MVP S2.2). */
  readonly remembered: () => Promise<string | undefined>;
  /** Asks for permission to the remembered place again; call it from a click, as browsers require. */
  readonly reopen: () => Promise<Result<ProfilePlace, PlaceError>>;
  /** Lets the person choose a place and asks for permission, then remembers it for next time. */
  readonly choose: () => Promise<Result<ProfilePlace, PlaceError>>;
  /** Forgets the remembered place (MVP S2.4); in browser storage the files stay, as closing isn't deleting. */
  readonly forget: () => Promise<void>;
  /**
   * Fills an empty browser store from files the person picked, such as a copy they downloaded, then opens it.
   *
   * @remarks Only for browser storage. Refuses with `not-empty` when a profile is already there, so nothing is ever
   * written over (hard rule 3).
   */
  readonly bringIn?: (
    files: readonly StoredFile[],
  ) => Promise<Result<ProfilePlace, PlaceError | { readonly kind: "not-empty" }>>;
  /** Every file in the browser store, for a downloaded copy the person keeps. Only for browser storage. */
  readonly copy?: () => Promise<Result<readonly StoredFile[], StorageError>>;
  /** Whether the browser agreed to keep the store's files rather than clear them when space runs low. */
  readonly persisted?: () => Promise<boolean>;
}

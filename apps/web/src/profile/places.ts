/**
 * Where a profile is kept, as the interface sees it.
 *
 * @remarks The interface never touches a connector (ADR-0003, AGENTS.md rule 11); the composition root implements
 * these for the folder connector (`src/composition/folder-places.ts`).
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
  /** The name of the place chosen on an earlier visit, found without reading it or asking for permission (MVP S2.2). */
  readonly remembered: () => Promise<string | undefined>;
  /** Asks for permission to the remembered place again; call it from a click, as browsers require. */
  readonly reopen: () => Promise<Result<ProfilePlace, PlaceError>>;
  /** Lets the person choose a place and asks for permission, then remembers it for next time. */
  readonly choose: () => Promise<Result<ProfilePlace, PlaceError>>;
  /** Forgets the remembered place (MVP S2.4). */
  readonly forget: () => Promise<void>;
}

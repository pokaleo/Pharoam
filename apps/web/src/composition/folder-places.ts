/**
 * Profile places backed by local folders.
 *
 * @packageDocumentation
 */
import {
  createFolderConnector,
  requestAccess,
  type FolderHandle,
  type FolderMemory,
} from "@pharoam/connector-folder";
import { err, ok, type Result } from "@pharoam/core";
import type { PlaceError, Places, ProfilePlace } from "../profile/places.ts";

/** What folder places need from the browser. */
export interface FolderPlacesOptions {
  /** Shows the folder picker, such as `() => showDirectoryPicker({ mode: "readwrite" })`. */
  readonly pick: () => Promise<FolderHandle>;
  /** Keeps the chosen folder between visits. */
  readonly memory: FolderMemory;
}

/**
 * Creates profile places for folders the person chooses (MVP S1, S2).
 *
 * @remarks A folder is remembered only once permission is granted, so a refused folder isn't offered again. When
 * the browser can't remember folders, as in some private windows, the folder still opens; the person just chooses
 * it again next time.
 * @param options - The folder picker and the folder memory.
 * @returns Choosing, reopening and forgetting the profile's folder.
 */
export function createFolderPlaces({ pick, memory }: FolderPlacesOptions): Places {
  const recall = async (): Promise<FolderHandle | undefined> => {
    const kept = await memory.recall();
    return kept.ok ? kept.value : undefined;
  };

  return {
    remembered: async () => (await recall())?.name,

    reopen: async () => {
      const folder = await recall();
      if (folder === undefined) return err({ kind: "forgotten" });
      return open(folder);
    },

    choose: async () => {
      let folder: FolderHandle;
      try {
        folder = await pick();
      } catch (error) {
        return err(pickerError(error));
      }
      const place = await open(folder);
      if (place.ok) await memory.remember(folder);
      return place;
    },

    forget: async () => {
      await memory.forget();
    },
  };
}

async function open(folder: FolderHandle): Promise<Result<ProfilePlace, PlaceError>> {
  const access = await requestAccess(folder);
  if (!access.ok) return access;
  return ok({ name: folder.name, storage: createFolderConnector(folder) });
}

// Closing the picker is an AbortError; anything else, such as a folder the browser refuses, is a failure to report.
function pickerError(error: unknown): PlaceError {
  if (error instanceof DOMException && error.name === "AbortError") return { kind: "cancelled" };
  return { kind: "unavailable", reason: error instanceof Error ? error.message : String(error) };
}

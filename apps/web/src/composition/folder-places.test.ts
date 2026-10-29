import type { FolderHandle, FolderMemory } from "@pharoam/connector-folder";
import { err, ok } from "@pharoam/core";
import { describe, expect, it } from "vitest";
import { createFolderPlaces } from "./folder-places.ts";

// A folder whose permission answers as given; its contents don't matter here.
function folder(
  name: string,
  permission: { query: PermissionState; request: PermissionState },
): FolderHandle {
  return {
    kind: "directory",
    name,
    values: async function* () {
      // An empty folder.
    },
    getDirectoryHandle: () => Promise.reject(new Error("not used")),
    getFileHandle: () => Promise.reject(new Error("not used")),
    removeEntry: () => Promise.reject(new Error("not used")),
    queryPermission: () => Promise.resolve(permission.query),
    requestPermission: () => Promise.resolve(permission.request),
  };
}

const GRANTED = { query: "granted", request: "granted" } as const;
const ASKS_AND_GRANTS = { query: "prompt", request: "granted" } as const;
const ASKS_AND_DENIES = { query: "prompt", request: "denied" } as const;

function memory(initial?: FolderHandle): FolderMemory & { kept: () => FolderHandle | undefined } {
  let kept = initial;
  return {
    remember: (handle) => {
      kept = handle;
      return Promise.resolve(ok(undefined));
    },
    recall: () => Promise.resolve(ok(kept)),
    forget: () => {
      kept = undefined;
      return Promise.resolve(ok(undefined));
    },
    kept: () => kept,
  };
}

const abort = (): Promise<FolderHandle> =>
  Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
const noPicker = (): Promise<FolderHandle> => Promise.reject(new Error("the picker must not open"));

describe("createFolderPlaces", () => {
  describe("remembered (MVP S2.2)", () => {
    it("names the folder chosen on an earlier visit, without asking for permission", async () => {
      let asked = false;
      const kept = {
        ...folder("pharoam-profile", ASKS_AND_GRANTS),
        requestPermission: () => ((asked = true), Promise.resolve("granted" as const)),
      };
      const places = createFolderPlaces({ pick: noPicker, memory: memory(kept) });

      expect(await places.remembered()).toBe("pharoam-profile");
      expect(asked).toBe(false);
    });

    it("is undefined when no folder was chosen, or the browser's storage is blocked", async () => {
      expect(await createFolderPlaces({ pick: noPicker, memory: memory() }).remembered()).toBeUndefined();
      const blocked: FolderMemory = {
        ...memory(),
        recall: () => Promise.resolve(err({ kind: "unavailable", reason: "blocked" })),
      };
      expect(await createFolderPlaces({ pick: noPicker, memory: blocked }).remembered()).toBeUndefined();
    });
  });

  describe("reopen (MVP S2.2)", () => {
    it("asks for permission, then gives the folder's storage", async () => {
      const places = createFolderPlaces({ pick: noPicker, memory: memory(folder("cv", ASKS_AND_GRANTS)) });
      const place = await places.reopen();
      expect(place.ok && place.value.name).toBe("cv");
    });

    it("says permission was denied, and gives no storage", async () => {
      const places = createFolderPlaces({ pick: noPicker, memory: memory(folder("cv", ASKS_AND_DENIES)) });
      expect(await places.reopen()).toEqual(err({ kind: "denied" }));
    });

    it("says there is nothing to reopen when no folder is remembered", async () => {
      const places = createFolderPlaces({ pick: noPicker, memory: memory() });
      expect(await places.reopen()).toEqual(err({ kind: "forgotten" }));
    });
  });

  describe("choose (MVP S1, S1.4)", () => {
    it("gives the chosen folder's storage and remembers the folder for next time", async () => {
      const chosen = folder("my-profile", GRANTED);
      const kept = memory();
      const places = createFolderPlaces({ pick: () => Promise.resolve(chosen), memory: kept });

      const place = await places.choose();
      expect(place.ok && place.value.name).toBe("my-profile");
      expect(kept.kept()).toBe(chosen);
    });

    it("says the person cancelled the picker, remembering nothing", async () => {
      const kept = memory();
      const places = createFolderPlaces({ pick: abort, memory: kept });
      expect(await places.choose()).toEqual(err({ kind: "cancelled" }));
      expect(kept.kept()).toBeUndefined();
    });

    it("says permission was denied, remembering nothing (MVP S1.4)", async () => {
      const kept = memory();
      const places = createFolderPlaces({
        pick: () => Promise.resolve(folder("x", ASKS_AND_DENIES)),
        memory: kept,
      });
      expect(await places.choose()).toEqual(err({ kind: "denied" }));
      expect(kept.kept()).toBeUndefined();
    });

    it("reports a picker that fails for another reason, such as a system folder the browser refuses", async () => {
      const places = createFolderPlaces({
        pick: () => Promise.reject(new DOMException("Can't open this folder.", "SecurityError")),
        memory: memory(),
      });
      const place = await places.choose();
      expect(place.ok ? undefined : place.error.kind).toBe("unavailable");
    });

    it("still opens the folder when the browser can't remember it, as in some private windows", async () => {
      const blocked: FolderMemory = {
        ...memory(),
        remember: () => Promise.resolve(err({ kind: "unavailable", reason: "blocked" })),
      };
      const places = createFolderPlaces({
        pick: () => Promise.resolve(folder("p", GRANTED)),
        memory: blocked,
      });
      expect((await places.choose()).ok).toBe(true);
    });
  });

  describe("forget (MVP S2.4)", () => {
    it("forgets the remembered folder", async () => {
      const kept = memory(folder("cv", GRANTED));
      const places = createFolderPlaces({ pick: noPicker, memory: kept });
      await places.forget();
      expect(kept.kept()).toBeUndefined();
      expect(await places.remembered()).toBeUndefined();
    });
  });
});

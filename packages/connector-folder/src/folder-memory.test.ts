import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import type { FileHandle, FolderHandle } from "./folder-connector.ts";
import { createFolderMemory } from "./folder-memory.ts";

// The browser stores its own folder handles; this stand-in's methods are on its prototype, so storing it keeps
// only its data, which is all these tests compare.
class StoredFolder implements FolderHandle {
  readonly kind = "directory";
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  values(): AsyncIterable<FileHandle | FolderHandle> {
    throw new Error("Not used.");
  }
  getDirectoryHandle(): Promise<FolderHandle> {
    throw new Error("Not used.");
  }
  getFileHandle(): Promise<FileHandle> {
    throw new Error("Not used.");
  }
  removeEntry(): Promise<void> {
    throw new Error("Not used.");
  }
}

const FOLDER = new StoredFolder("Career");
const RECALLED = { ok: true, value: { kind: "directory", name: "Career" } };

describe("remembering the folder", () => {
  it("recalls nothing before a folder is chosen", async () => {
    expect(await createFolderMemory(new IDBFactory()).recall()).toEqual({ ok: true, value: undefined });
  });

  it("recalls the folder chosen on an earlier visit (MVP S2.2)", async () => {
    const browser = new IDBFactory();
    expect(await createFolderMemory(browser).remember(FOLDER)).toEqual({ ok: true, value: undefined });
    // A later visit starts with a new memory over the same browser storage.
    expect(await createFolderMemory(browser).recall()).toEqual(RECALLED);
  });

  it("recalls only the folder chosen last", async () => {
    const memory = createFolderMemory(new IDBFactory());
    await memory.remember(new StoredFolder("Old"));
    await memory.remember(FOLDER);
    expect(await memory.recall()).toEqual(RECALLED);
  });

  it("forgets the folder when the profile is disconnected (MVP S2.4)", async () => {
    const browser = new IDBFactory();
    await createFolderMemory(browser).remember(FOLDER);
    expect(await createFolderMemory(browser).forget()).toEqual({ ok: true, value: undefined });
    expect(await createFolderMemory(browser).recall()).toEqual({ ok: true, value: undefined });
  });

  it("ignores anything else kept in its place, such as by another version of the app", async () => {
    const browser = new IDBFactory();
    await createFolderMemory(browser).forget();
    await new Promise<void>((resolve) => {
      browser.open("pharoam-folder").onsuccess = function () {
        const transaction = this.result.transaction("folders", "readwrite");
        transaction.objectStore("folders").put({ path: "/Users/me/Career" }, "profile");
        transaction.oncomplete = () => {
          this.result.close();
          resolve();
        };
      };
    });
    expect(await createFolderMemory(browser).recall()).toEqual({ ok: true, value: undefined });
  });

  it("reports what the browser says when its storage can't be used", async () => {
    const blocked = new IDBFactory();
    blocked.open = () => {
      throw new DOMException("Storage is blocked.", "SecurityError");
    };
    const unavailable = {
      ok: false,
      error: { kind: "unavailable", reason: "SecurityError: Storage is blocked." },
    };
    const memory = createFolderMemory(blocked);
    expect(await memory.recall()).toEqual(unavailable);
    expect(await memory.remember(FOLDER)).toEqual(unavailable);
    expect(await memory.forget()).toEqual(unavailable);
  });
});

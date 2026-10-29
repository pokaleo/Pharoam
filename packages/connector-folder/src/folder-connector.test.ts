import { createCoreService, createRecordFile, printRecordFile } from "@pharoam/core";
import { CONNECTOR_CHECKS, type ConnectorHarness } from "@pharoam/core/testing";
import { describe, expect, it } from "vitest";
import { memoryFolder, type MemoryFolder } from "./__fixtures__/memory-folder.ts";
import { createFolderConnector, requestAccess, type FolderHandle } from "./folder-connector.ts";

const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
const encoder = new TextEncoder();

// The shared checks' outside edits go straight to the folder's bytes, as another app would.
function harness(folder: MemoryFolder = memoryFolder()): ConnectorHarness {
  return {
    connector: createFolderConnector(folder.handle),
    putOutside: (location, text) => {
      folder.files.set(location, encoder.encode(text));
      return Promise.resolve();
    },
    readOutside: (location) => {
      const bytes = folder.files.get(location);
      return Promise.resolve(bytes === undefined ? undefined : decoder.decode(bytes));
    },
    removeOutside: (location) => {
      folder.files.delete(location);
      return Promise.resolve();
    },
  };
}

const RECORD = createRecordFile(
  { schema: "evidence/1", id: "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d", title: "Backend Engineer" },
  "Body.\n",
);

describe("the folder connector", () => {
  it.each(CONNECTOR_CHECKS)("$name", async (check) => {
    await check.run(() => harness());
  });

  it("accepts the browser's own folder handle", () => {
    // A type-level check: the File System Access API's handle has everything the connector uses.
    const fromBrowser = (handle: FileSystemDirectoryHandle): FolderHandle => handle;
    expect(fromBrowser).toBeTypeOf("function");
  });

  it("stores a new record where the folder layout puts it, creating folders as needed", async () => {
    const folder = memoryFolder();
    const created = await createFolderConnector(folder.handle).create(RECORD);
    expect(created).toMatchObject({
      ok: true,
      value: { location: "evidence/backend-engineer--6a7b8c9d.md" },
    });
    expect(decoder.decode(folder.files.get("evidence/backend-engineer--6a7b8c9d.md"))).toBe(
      printRecordFile(RECORD),
    );
  });

  it("stores evidence from the form in evidence/, named from its title and short ID (MVP S4.3)", async () => {
    const folder = memoryFolder();
    const service = createCoreService({
      storage: createFolderConnector(folder.handle),
      ids: { now: () => Date.UTC(2026, 9, 29, 9, 30, 0), fillRandom: (bytes) => bytes.fill(7) },
      overview: () => "",
    });
    const draft = service.draftEvidence({
      kind: "job",
      title: "Backend Engineer",
      organisation: "Example Co",
    });
    if (!draft.ok) throw new Error(draft.error.kind);
    expect(await service.create(draft.value)).toMatchObject({
      ok: true,
      value: { location: "evidence/backend-engineer-example-co--07070707.md" },
    });
    expect([...folder.files.keys()]).toEqual(["evidence/backend-engineer-example-co--07070707.md"]);
  });

  it("prepares a folder for a new profile with skills/, evidence/ and gaps/ (MVP S1.1)", async () => {
    const folder = memoryFolder({ "notes.txt": "mine", "evidence/a.md": "x" });
    expect(await createFolderConnector(folder.handle).initialise()).toEqual({ ok: true, value: undefined });
    // evidence/ already existed, so only the missing folders are created.
    expect([...folder.folders].toSorted()).toEqual(["gaps", "skills"]);
    expect(decoder.decode(folder.files.get("notes.txt"))).toBe("mine");
    expect(decoder.decode(folder.files.get("evidence/a.md"))).toBe("x");
  });

  it("lists Markdown files at any depth, but not hidden folders, attachments or other files", async () => {
    const folder = memoryFolder({
      "pharoam.md": "x",
      "evidence/a.md": "x",
      "evidence/2026/b.md": "x",
      "evidence/_attachments/0192f3a1/original-input.md": "x",
      "evidence/_attachments/0192f3a1/original-input.txt": "x",
      ".obsidian/workspace.md": "x",
      ".git/HEAD": "x",
      "notes.txt": "x",
      ".hidden.md": "x",
    });
    const listed = await createFolderConnector(folder.handle).list();
    expect(listed.ok && listed.value.map((ref) => ref.location).toSorted()).toEqual([
      "evidence/2026/b.md",
      "evidence/a.md",
      "pharoam.md",
    ]);
  });

  it("reads a file that isn't UTF-8 as unreadable, so it is never rewritten with replaced characters", async () => {
    const latin1 = new Uint8Array([...encoder.encode("---\ntitle: Caf"), 0xe9, ...encoder.encode("\n---\n")]);
    const folder = memoryFolder({ "evidence/latin1.md": latin1 });
    expect(await createFolderConnector(folder.handle).read("evidence/latin1.md")).toEqual({
      ok: false,
      error: { kind: "unreadable", error: { kind: "not-utf8" } },
    });
  });

  it("refuses locations outside the folder", async () => {
    const connector = createFolderConnector(memoryFolder({ "pharoam.md": "x" }).handle);
    for (const location of ["../pharoam.md", "evidence/../pharoam.md", "/pharoam.md", "evidence//a.md", ""]) {
      expect(await connector.read(location)).toEqual({ ok: false, error: { kind: "not-found" } });
    }
  });

  it.each(["denied", "prompt"] as const)(
    "writes nothing, and returns a typed error, when permission is %s (MVP S1.4)",
    async (state) => {
      const folder = memoryFolder({ "evidence/a.md": printRecordFile(RECORD) });
      folder.setPermission(state);
      const connector = createFolderConnector(folder.handle);
      const unavailable = {
        ok: false,
        error: { kind: "unavailable", reason: "Permission to use the folder isn't granted." },
      };
      expect(await connector.list()).toEqual(unavailable);
      expect(await connector.read("evidence/a.md")).toEqual(unavailable);
      expect(await connector.create(createRecordFile({ schema: "pharoam/1" }, ""))).toEqual(unavailable);
      expect(await connector.write("evidence/a.md", RECORD, "any")).toEqual(unavailable);
      expect(await connector.delete("evidence/a.md", "any")).toEqual(unavailable);
      expect([...folder.files.keys()]).toEqual(["evidence/a.md"]);
      expect(decoder.decode(folder.files.get("evidence/a.md"))).toBe(printRecordFile(RECORD));
    },
  );

  it("reports what the browser says when storage fails", async () => {
    const folder = memoryFolder({ "evidence/a.md": "x" });
    const connector = createFolderConnector({
      ...folder.handle,
      values: () => {
        throw new DOMException("The disk is gone.", "NotReadableError");
      },
    });
    expect(await connector.list()).toEqual({
      ok: false,
      error: { kind: "unavailable", reason: "NotReadableError: The disk is gone." },
    });
  });
});

describe("asking for access (MVP S2.2)", () => {
  it("is granted without asking when permission was already given", async () => {
    expect(await requestAccess(memoryFolder().handle)).toEqual({ ok: true, value: undefined });
  });

  it("asks, and reports the answer", async () => {
    const granted = memoryFolder();
    granted.setPermission("prompt", "granted");
    expect(await requestAccess(granted.handle)).toEqual({ ok: true, value: undefined });

    const refused = memoryFolder();
    refused.setPermission("prompt", "denied");
    expect(await requestAccess(refused.handle)).toEqual({ ok: false, error: { kind: "denied" } });
  });
});

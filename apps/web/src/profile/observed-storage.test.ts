import { createRecordFile, type StorageConnector } from "@pharoam/core";
import { createMemoryConnector } from "@pharoam/core/testing";
import { describe, expect, it } from "vitest";
import { observedStorage, type StorageEvent } from "./observed-storage.ts";

const AT = new Date("2026-11-16T10:00:00Z");
const PHAROAM =
  "---\nschema: pharoam/1\nid: 0192f3a1-0000-7000-8000-000000000001\ncreated: 2026-10-01T10:00:00Z\n---\n";

function observe(): { storage: StorageConnector; events: StorageEvent[]; inner: StorageConnector } {
  const memory = createMemoryConnector({ "pharoam.md": PHAROAM });
  const events: StorageEvent[] = [];
  const storage = observedStorage(
    memory.connector,
    (event) => events.push(event),
    () => AT,
  );
  return { storage, events, inner: memory.connector };
}

describe("observing what Pharoam reads and writes (MVP S22.1)", () => {
  it("reports listing and reading, with what was read and when, and passes the results through", async () => {
    const { storage, events, inner } = observe();

    const listed = await storage.list();
    const read = await storage.read("pharoam.md");

    expect(listed).toEqual(await inner.list());
    expect(read.ok && read.value.file.top.schema).toBe("pharoam/1");
    expect(events).toEqual([
      { action: "listed", location: "", at: "2026-11-16T10:00:00.000Z", ok: true, count: 1 },
      { action: "read", location: "pharoam.md", at: "2026-11-16T10:00:00.000Z", ok: true },
    ]);
  });

  it("reports each write by what it did, where, and whether it worked", async () => {
    const { storage, events } = observe();
    const file = createRecordFile(
      {
        schema: "evidence/1",
        id: "0192f3a1-0000-7000-8000-000000000002",
        created: "2026-11-16T10:00:00Z",
        kind: "project",
        title: "Shell search",
      },
      "",
    );

    const created = await storage.create(file);
    if (!created.ok) throw new Error(created.error.kind);
    const read = await storage.read(created.value.location);
    if (!read.ok) throw new Error(read.error.kind);
    await storage.write(created.value.location, file, "a stale version");
    await storage.write(created.value.location, file, read.value.version);
    await storage.addAttachment("0192f3a1-0000-7000-8000-000000000002", "cv.pdf", new Uint8Array([1]));
    await storage.delete(created.value.location, "a stale version");
    await storage.initialise();

    expect(events.map(({ action, location, ok }) => [action, location, ok])).toEqual([
      ["created", created.value.location, true],
      ["read", created.value.location, true],
      ["changed", created.value.location, false],
      ["changed", created.value.location, true],
      ["file-added", "0192f3a1-0000-7000-8000-000000000002/cv.pdf", true],
      ["deleted", created.value.location, false],
      ["prepared", "", true],
    ]);
  });

  it("reports a file's reading and deletion by its record and name", async () => {
    const { storage, events } = observe();
    const added = await storage.addAttachment(
      "0192f3a1-0000-7000-8000-000000000002",
      "cv.pdf",
      new Uint8Array([1]),
    );
    if (!added.ok) throw new Error(added.error.kind);
    await storage.attachments("0192f3a1-0000-7000-8000-000000000002");
    await storage.readAttachment("0192f3a1-0000-7000-8000-000000000002", "cv.pdf");
    await storage.deleteAttachment("0192f3a1-0000-7000-8000-000000000002", "cv.pdf", added.value.version);

    expect(events.map(({ action, location, count }) => [action, location, count])).toEqual([
      ["file-added", "0192f3a1-0000-7000-8000-000000000002/cv.pdf", undefined],
      ["files-listed", "0192f3a1-0000-7000-8000-000000000002", 1],
      ["file-read", "0192f3a1-0000-7000-8000-000000000002/cv.pdf", undefined],
      ["file-deleted", "0192f3a1-0000-7000-8000-000000000002/cv.pdf", undefined],
    ]);
  });

  it("reports a call that throws as not working, then lets the error through", async () => {
    const events: StorageEvent[] = [];
    const memory = createMemoryConnector({});
    const broken: StorageConnector = {
      ...memory.connector,
      read: () => Promise.reject(new Error("The disk went away.")),
    };
    const storage = observedStorage(
      broken,
      (event) => events.push(event),
      () => AT,
    );

    await expect(storage.read("pharoam.md")).rejects.toThrow("The disk went away.");
    expect(events).toEqual([
      { action: "read", location: "pharoam.md", at: "2026-11-16T10:00:00.000Z", ok: false },
    ]);
  });

  it("names a new record that couldn't be saved by its ID", async () => {
    const memory = createMemoryConnector({});
    memory.loseAccess();
    const events: StorageEvent[] = [];
    const storage = observedStorage(
      memory.connector,
      (event) => events.push(event),
      () => AT,
    );
    await storage.create(
      createRecordFile({ schema: "evidence/1", id: "0192f3a1-0000-7000-8000-000000000009" }, ""),
    );
    expect(events).toEqual([
      {
        action: "created",
        location: "0192f3a1-0000-7000-8000-000000000009",
        at: "2026-11-16T10:00:00.000Z",
        ok: false,
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { createRecordFile } from "../record-file.ts";
import { CONNECTOR_CHECKS } from "./connector-checks.ts";
import { createMemoryConnector } from "./memory-connector.ts";

describe("the in-memory reference connector", () => {
  it.each(CONNECTOR_CHECKS)("$name", async (check) => {
    await check.run(() => createMemoryConnector());
  });

  it("starts with the files it is given", async () => {
    const memory = createMemoryConnector({ "notes/a.md": "# A\n" });
    expect(memory.text("notes/a.md")).toBe("# A\n");
    expect(await memory.connector.list()).toMatchObject({ ok: true, value: [{ location: "notes/a.md" }] });
  });

  it("counts the records it creates, writes and deletes", async () => {
    const memory = createMemoryConnector();
    const record = createRecordFile({ schema: "evidence/1", id: "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d" }, "");
    const created = await memory.connector.create(record);
    if (!created.ok) throw new Error(created.error.kind);
    const written = await memory.connector.write(created.value.location, record, created.value.version);
    if (!written.ok) throw new Error(written.error.kind);
    await memory.connector.delete(created.value.location, written.value);
    expect(memory.writes()).toBe(3);
  });

  it("fails every call once access is lost", async () => {
    const memory = createMemoryConnector({ "notes/a.md": "# A\n" });
    memory.loseAccess();
    const record = createRecordFile({}, "");
    const unavailable = {
      ok: false,
      error: { kind: "unavailable", reason: "Access to the storage was lost." },
    };
    expect(await memory.connector.list()).toEqual(unavailable);
    expect(await memory.connector.read("notes/a.md")).toEqual(unavailable);
    expect(await memory.connector.create(record)).toEqual(unavailable);
    expect(await memory.connector.write("notes/a.md", record, "v1")).toEqual(unavailable);
    expect(await memory.connector.delete("notes/a.md", "v1")).toEqual(unavailable);
  });
});

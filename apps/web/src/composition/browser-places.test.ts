import { describe, expect, it, vi } from "vitest";
import { memoryDirectory, type MemoryDirectory } from "./__fixtures__/memory-directory.ts";
import { BROWSER_PROFILE, createBrowserPlaces } from "./browser-places.ts";

const encoder = new TextEncoder();
const PHAROAM =
  "---\nschema: pharoam/1\nid: 0192f3a1-0000-7000-8000-000000000001\ncreated: 2026-10-01T09:00:00Z\n---\n";

function browser(root: MemoryDirectory = memoryDirectory("")) {
  const persist = vi.fn(() => Promise.resolve(true));
  const places = createBrowserPlaces({
    getDirectory: () => Promise.resolve(root),
    persist,
    persisted: () => Promise.resolve(false),
  });
  return { root, persist, places };
}

describe("createBrowserPlaces (ADR-0020)", () => {
  it("is browser storage", () => {
    expect(browser().places.kind).toBe("browser");
  });

  it("keeps the profile in its own directory of the browser's storage, asking the browser to keep it", async () => {
    const { root, persist, places } = browser();

    const place = await places.choose();

    expect(place.ok).toBe(true);
    if (!place.ok) return;
    const created = await place.value.storage.initialise();
    expect(created.ok).toBe(true);
    expect(Object.keys(root.texts())).toEqual([]);
    expect(await root.getDirectoryHandle(BROWSER_PROFILE)).toBeDefined();
    expect(persist).toHaveBeenCalledOnce();
  });

  it("remembers a profile already in the browser, and nothing before one is there (MVP S2.2)", async () => {
    const { places } = browser();
    expect(await places.remembered()).toBeUndefined();

    const place = await places.choose();
    expect(await places.remembered()).toBeUndefined();

    if (place.ok) await place.value.storage.create(await profileFile());
    expect(await places.remembered()).toBe(BROWSER_PROFILE);
    expect((await places.reopen()).ok).toBe(true);
  });

  it("keeps the files when the profile is closed: closing isn't deleting", async () => {
    const { root, places } = browser();
    const place = await places.choose();
    if (place.ok) await place.value.storage.create(await profileFile());

    await places.forget();

    expect(await places.remembered()).toBe(BROWSER_PROFILE);
    const profile = (await root.getDirectoryHandle(BROWSER_PROFILE)) as MemoryDirectory;
    expect(profile.texts()["pharoam.md"]).toContain("schema: pharoam/1");
  });

  it("says when the browser won't keep files, as in Safari's private windows", async () => {
    const { places } = browser(memoryDirectory("", new DOMException("The operation failed", "UnknownError")));

    const place = await places.choose();

    expect(place.ok ? undefined : place.error).toEqual({
      kind: "unavailable",
      reason: "The operation failed",
    });
    expect(await places.remembered()).toBeUndefined();
  });

  it("brings files the person picked into an empty store, keeping their paths", async () => {
    const { root, places } = browser();

    const place = await places.bringIn?.([
      { path: "pharoam.md", bytes: encoder.encode(PHAROAM) },
      { path: "evidence/a.md", bytes: encoder.encode("evidence") },
    ]);

    expect(place?.ok).toBe(true);
    const profile = (await root.getDirectoryHandle(BROWSER_PROFILE)) as MemoryDirectory;
    expect(profile.texts()).toEqual({ "pharoam.md": PHAROAM, "evidence/a.md": "evidence" });
  });

  it("never brings files over a profile already in the browser", async () => {
    const { places } = browser();
    const place = await places.choose();
    if (place.ok) await place.value.storage.create(await profileFile());

    const brought = await places.bringIn?.([{ path: "pharoam.md", bytes: encoder.encode("other") }]);

    expect(brought).toEqual({ ok: false, error: { kind: "not-empty" } });
  });

  it("copies every file, with its path, for a download", async () => {
    const { places } = browser();
    await places.bringIn?.([
      { path: "pharoam.md", bytes: encoder.encode(PHAROAM) },
      { path: "evidence/a.md", bytes: encoder.encode("evidence") },
    ]);

    const copy = await places.copy?.();

    expect(copy?.ok && copy.value.map((file) => [file.path, new TextDecoder().decode(file.bytes)])).toEqual([
      ["evidence/a.md", "evidence"],
      ["pharoam.md", PHAROAM],
    ]);
  });

  it("says whether the browser agreed to keep the files", async () => {
    expect(await browser().places.persisted?.()).toBe(false);
  });
});

async function profileFile() {
  const { parseRecordFile } = await import("@pharoam/core");
  const parsed = parseRecordFile(PHAROAM);
  if (!parsed.ok) throw new Error("invalid fixture");
  return parsed.value;
}

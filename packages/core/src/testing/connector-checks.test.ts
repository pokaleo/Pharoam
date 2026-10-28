import { describe, expect, it } from "vitest";
import type { StorageConnector } from "../core-service.ts";
import { createRecordFile } from "../record-file.ts";
import { ok } from "../result.ts";
import { CONNECTOR_CHECKS, type ConnectorCheck } from "./connector-checks.ts";
import { createMemoryConnector, type ConnectorHarness } from "./memory-connector.ts";

// A reference connector with some of its behaviour replaced by a broken version.
function broken(breakIt: (connector: StorageConnector) => Partial<StorageConnector>): () => ConnectorHarness {
  return () => {
    const harness = createMemoryConnector();
    return { ...harness, connector: { ...harness.connector, ...breakIt(harness.connector) } };
  };
}

function check(name: string): ConnectorCheck {
  const found = CONNECTOR_CHECKS.find((c) => c.name.startsWith(name));
  if (found === undefined) throw new Error(`No check named "${name}"`);
  return found;
}

// The current version at a location, so a broken connector can ignore the version it was given.
async function currentVersion(connector: StorageConnector, location: string): Promise<string> {
  const listed = await connector.list();
  if (!listed.ok) return "";
  return listed.value.find((ref) => ref.location === location)?.version ?? "";
}

describe("the connector checks catch broken connectors", () => {
  it("has a unique name for every check", () => {
    const names = CONNECTOR_CHECKS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(CONNECTOR_CHECKS)("fails when the connector can't reach its storage: $name", async (each) => {
    const unreachable = (): ConnectorHarness => {
      const harness = createMemoryConnector();
      harness.loseAccess();
      return harness;
    };
    await expect(each.run(unreachable)).rejects.toThrow();
  });

  it("catches a connector where the last write wins", async () => {
    const lastWriteWins = broken((c) => ({
      write: async (location, file) => c.write(location, file, await currentVersion(c, location)),
    }));
    await expect(
      check("refuses a write after the record changed outside").run(lastWriteWins),
    ).rejects.toThrow(/should have failed/);
    await expect(check("refuses a second write").run(lastWriteWins)).rejects.toThrow(/should have failed/);
  });

  it("catches a connector that rewrites a file from its fields alone, losing comments and layout", async () => {
    const lossy = broken((c) => ({
      write: (location, file, version) => c.write(location, createRecordFile(file.top, file.body), version),
    }));
    await expect(check("keeps what Pharoam doesn't know").run(lossy)).rejects.toThrow(/stored text/);
  });

  it("catches a connector whose version changes on every listing", async () => {
    let clock = 0;
    const unstable = broken((c) => ({
      list: async () => {
        const listed = await c.list();
        return listed.ok
          ? ok(listed.value.map((ref) => ({ ...ref, version: `${ref.version}.${String(++clock)}` })))
          : listed;
      },
    }));
    await expect(check("lists changes").run(unstable)).rejects.toThrow(/unchanged version/);
    await expect(check("creates a record").run(unstable)).rejects.toThrow(/listed version/);
  });

  it("catches a connector that creates over an existing record", async () => {
    const overwriting = broken((c) => ({
      create: async (file) => {
        const created = await c.create(file);
        if (created.ok || created.error.kind !== "exists") return created;
        const location = created.error.location;
        const version = await c.write(location, file, await currentVersion(c, location));
        return version.ok ? ok({ location, version: version.value }) : created;
      },
    }));
    await expect(check("never creates a record over one").run(overwriting)).rejects.toThrow(
      /should have failed/,
    );
  });

  it("catches a connector that deletes whatever version it finds", async () => {
    const careless = broken((c) => ({
      delete: async (location) => c.delete(location, await currentVersion(c, location)),
    }));
    await expect(check("deletes a record only at the version read").run(careless)).rejects.toThrow(
      /should have failed/,
    );
  });

  it("catches a connector that writes a removed record back", async () => {
    const resurrecting = broken((c) => ({
      write: async (location, file, version) => {
        const written = await c.write(location, file, version);
        if (written.ok || written.error.kind !== "not-found") return written;
        const created = await c.create(file);
        return created.ok ? ok(created.value.version) : written;
      },
    }));
    await expect(check("stops listing a record removed outside").run(resurrecting)).rejects.toThrow(
      /should have failed/,
    );
  });

  it("catches a connector that can't read what it lists", async () => {
    const forgetful = broken(() => ({
      read: () => Promise.resolve({ ok: false, error: { kind: "not-found" } }),
    }));
    await expect(check("lists and reads files written outside Pharoam").run(forgetful)).rejects.toThrow(
      /Reading/,
    );
  });
});

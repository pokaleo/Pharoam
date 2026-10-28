/**
 * The shared connector checks: behaviour every storage connector must show, whatever its backend.
 *
 * @remarks Each check runs against a fresh {@link ConnectorHarness} and throws when the connector misbehaves. They
 * cover reading, writing, listing changes through version tokens, conflicts (including an edit between Pharoam's
 * read and its write), and keeping what Pharoam doesn't know byte for byte (interfaces §1, AD10, ENGINEERING §4).
 * They don't depend on a test runner, so any package can run them.
 * @packageDocumentation
 */
import type { StoredRef } from "../core-service.ts";
import {
  createRecordFile,
  parseRecordFile,
  printRecordFile,
  withTopField,
  type RecordFile,
} from "../record-file.ts";
import type { Result } from "../result.ts";
import type { ConnectorHarness } from "./memory-connector.ts";

/** One behaviour a connector must show. */
export interface ConnectorCheck {
  /** What the connector must do, as a sentence for test output. */
  readonly name: string;
  /** Runs the check on a fresh harness; resolves if the connector behaves, rejects with the reason if not. */
  readonly run: (setup: () => ConnectorHarness | Promise<ConnectorHarness>) => Promise<void>;
}

const RECORD = createRecordFile(
  {
    schema: "evidence/1",
    id: "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d",
    created: "2026-10-24T14:02:11Z",
    ai: null,
    kind: "project",
    title: "Shell history search",
    skills: ["python"],
  },
  "Built a small tool.\n",
);

// A hand-written file: a byte-order mark, Windows line endings, a comment, a field Pharoam doesn't know, and
// non-ASCII text, all of which must survive a rewrite unchanged.
const HAND_MADE = `\uFEFF${`---
schema: evidence/1
id: 0192f3a1-0000-7000-8000-0000000000aa
created: 2026-10-24T14:02:11Z
kind: job # written by hand
title: Développeuse backend
my_rating: 5
---
Résumé: built the payments API.
`.replaceAll("\n", "\r\n")}`;

const HAND_MADE_LOCATION = "evidence/hand-made.md";
const BROKEN_LOCATION = "evidence/broken.md";

type Setup = () => ConnectorHarness | Promise<ConnectorHarness>;

const check = (name: string, run: (setup: Setup) => Promise<void>): ConnectorCheck => ({ name, run });

function fail(message: string): never {
  throw new Error(message);
}

function value<T, E>(result: Result<T, E>, what: string): T {
  if (!result.ok) fail(`${what} failed: ${JSON.stringify(result.error)}`);
  return result.value;
}

function errorKind<T, E extends { readonly kind: string }>(result: Result<T, E>, what: string): string {
  if (result.ok) fail(`${what} should have failed, but succeeded.`);
  return result.error.kind;
}

function same(actual: unknown, expected: unknown, what: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

function versionAt(listed: readonly StoredRef[], location: string): string | undefined {
  return listed.find((ref) => ref.location === location)?.version;
}

function parsed(text: string): RecordFile {
  return value(parseRecordFile(text), "Parsing the test record");
}

/** Every check a storage connector must pass. */
export const CONNECTOR_CHECKS: readonly ConnectorCheck[] = [
  check("lists nothing in empty storage", async (setup) => {
    const { connector } = await setup();
    same(value(await connector.list(), "Listing"), [], "The listing");
  }),
  check("creates a record, then lists and reads it back at the same version", async (setup) => {
    const { connector, readOutside } = await setup();
    const created = value(await connector.create(RECORD), "Creating");
    same(
      versionAt(value(await connector.list(), "Listing"), created.location),
      created.version,
      "The listed version",
    );
    const read = value(await connector.read(created.location), "Reading");
    same(read.version, created.version, "The read version");
    same(read.file.top, RECORD.top, "The read fields");
    same(read.file.body, RECORD.body, "The read body");
    same(await readOutside(created.location), printRecordFile(RECORD), "The stored text");
  }),
  check("never creates a record over one already at its location", async (setup) => {
    const { connector, readOutside } = await setup();
    const created = value(await connector.create(RECORD), "Creating");
    const again = await connector.create(withTopField(RECORD, "title", "Overwritten"));
    same(errorKind(again, "Creating over an existing record"), "exists", "The error");
    same(await readOutside(created.location), printRecordFile(RECORD), "The stored text");
  }),
  check("lists and reads files written outside Pharoam", async (setup) => {
    const { connector, putOutside } = await setup();
    await putOutside(HAND_MADE_LOCATION, HAND_MADE);
    const listed = value(await connector.list(), "Listing");
    same(
      listed.map((ref) => ref.location),
      [HAND_MADE_LOCATION],
      "The listed locations",
    );
    const read = value(await connector.read(HAND_MADE_LOCATION), "Reading");
    same(read.file.top, parsed(HAND_MADE).top, "The read fields");
    same(read.version, versionAt(listed, HAND_MADE_LOCATION), "The read version");
  }),
  check("lists a broken file and reads it as unreadable, without failing", async (setup) => {
    const { connector, putOutside } = await setup();
    await putOutside(BROKEN_LOCATION, "---\ntitle: One\ntitle: Two\n---\n");
    same(
      value(await connector.list(), "Listing").map((ref) => ref.location),
      [BROKEN_LOCATION],
      "The listed locations",
    );
    same(
      errorKind(await connector.read(BROKEN_LOCATION), "Reading a broken file"),
      "unreadable",
      "The error",
    );
  }),
  check("reports a location with nothing there as not found", async (setup) => {
    const { connector } = await setup();
    same(
      errorKind(await connector.read("evidence/missing.md"), "Reading a missing file"),
      "not-found",
      "The error",
    );
  }),
  check("writes a change at the version read and returns a new version", async (setup) => {
    const { connector, readOutside } = await setup();
    const created = value(await connector.create(RECORD), "Creating");
    const changed = withTopField(RECORD, "title", "Renamed");
    const version = value(await connector.write(created.location, changed, created.version), "Writing");
    if (version === created.version) fail("The version didn't change after a write.");
    same(
      versionAt(value(await connector.list(), "Listing"), created.location),
      version,
      "The listed version",
    );
    same(await readOutside(created.location), printRecordFile(changed), "The stored text");
  }),
  check("keeps what Pharoam doesn't know byte for byte when it rewrites a file", async (setup) => {
    const { connector, putOutside, readOutside } = await setup();
    await putOutside(HAND_MADE_LOCATION, HAND_MADE);
    const read = value(await connector.read(HAND_MADE_LOCATION), "Reading");
    const changed = withTopField(read.file, "title", "Développeuse senior");
    value(await connector.write(HAND_MADE_LOCATION, changed, read.version), "Writing");
    same(
      await readOutside(HAND_MADE_LOCATION),
      HAND_MADE.replace("Développeuse backend", "Développeuse senior"),
      "The stored text",
    );
  }),
  check(
    "refuses a write after the record changed outside, between Pharoam's read and its write (AD10)",
    async (setup) => {
      const { connector, putOutside, readOutside } = await setup();
      await putOutside(HAND_MADE_LOCATION, HAND_MADE);
      const read = value(await connector.read(HAND_MADE_LOCATION), "Reading");
      const outside = HAND_MADE.replace("Résumé", "Summary");
      await putOutside(HAND_MADE_LOCATION, outside);
      const written = await connector.write(
        HAND_MADE_LOCATION,
        withTopField(read.file, "title", "Mine"),
        read.version,
      );
      same(errorKind(written, "Writing over an outside change"), "conflict", "The error");
      same(await readOutside(HAND_MADE_LOCATION), outside, "The stored text");
    },
  ),
  check("refuses a second write at the same old version", async (setup) => {
    const { connector } = await setup();
    const created = value(await connector.create(RECORD), "Creating");
    value(
      await connector.write(created.location, withTopField(RECORD, "title", "First"), created.version),
      "Writing",
    );
    const second = await connector.write(
      created.location,
      withTopField(RECORD, "title", "Second"),
      created.version,
    );
    same(errorKind(second, "Writing at a stale version"), "conflict", "The error");
  }),
  check("lists changes: a version stays the same until the record changes outside", async (setup) => {
    const { connector, putOutside } = await setup();
    await putOutside(HAND_MADE_LOCATION, HAND_MADE);
    const before = versionAt(value(await connector.list(), "Listing"), HAND_MADE_LOCATION);
    same(
      versionAt(value(await connector.list(), "Listing again"), HAND_MADE_LOCATION),
      before,
      "An unchanged version",
    );
    await putOutside(HAND_MADE_LOCATION, HAND_MADE.replace("my_rating: 5", "my_rating: 4"));
    const after = versionAt(value(await connector.list(), "Listing after an edit"), HAND_MADE_LOCATION);
    if (after === undefined || after === before) fail("The version didn't change after an outside edit.");
  }),
  check("stops listing a record removed outside, and doesn't write it back", async (setup) => {
    const { connector, removeOutside, readOutside } = await setup();
    const created = value(await connector.create(RECORD), "Creating");
    await removeOutside(created.location);
    same(value(await connector.list(), "Listing"), [], "The listing");
    same(
      errorKind(await connector.read(created.location), "Reading a removed record"),
      "not-found",
      "The error",
    );
    const written = await connector.write(created.location, RECORD, created.version);
    same(errorKind(written, "Writing a removed record"), "not-found", "The error");
    same(await readOutside(created.location), undefined, "The stored text");
  }),
  check("deletes a record only at the version read", async (setup) => {
    const { connector, putOutside, readOutside } = await setup();
    const created = value(await connector.create(RECORD), "Creating");
    const outside = printRecordFile(withTopField(RECORD, "title", "Edited outside"));
    await putOutside(created.location, outside);
    same(
      errorKind(await connector.delete(created.location, created.version), "Deleting"),
      "conflict",
      "The error",
    );
    same(await readOutside(created.location), outside, "The stored text");
    const current = versionAt(value(await connector.list(), "Listing"), created.location) ?? "";
    value(await connector.delete(created.location, current), "Deleting at the current version");
    same(await readOutside(created.location), undefined, "The stored text after deleting");
  }),
];

import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  checkEntry,
  checkRecord,
  entryFingerprint,
  recordFingerprint,
  sealEntry,
} from "./integrity.ts";
import { parseRecordFile } from "./record-file.ts";

function top(text: string): Readonly<Record<string, unknown>> {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.top;
}

// The first entry of a skill file, as the codec reads it.
function entry(yaml: string): Readonly<Record<string, unknown>> {
  const [first] = top(`---\nentries:\n${yaml}---\n`).entries as Readonly<Record<string, unknown>>[];
  if (first === undefined) throw new Error("no entry");
  return first;
}

const ENTRY = `  - id: 0192f3a1-0000-7000-8000-000000000011
    level: 3
    provenance: self-reported
    observed_at: 2026-10-01T10:00:00Z
    evidence: [0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d]
`;

// Computed independently: the canonical form below, hashed with `shasum -a 256`.
const ENTRY_FINGERPRINT = "sha256-c1:32008deddd7e2671491c5f32a6ebe1280e7d3f0fb1980a992656e8be0be1839f";

describe("canonical form (RFC 8785)", () => {
  it("sorts keys and leaves out whitespace", () => {
    expect(canonicalJson({ b: 2, a: [1, "x", null, true], é: "ü", c: { z: 1.5, y: -0 } })).toEqual({
      ok: true,
      value: '{"a":[1,"x",null,true],"b":2,"c":{"y":0,"z":1.5},"é":"ü"}',
    });
  });

  it("sorts keys by UTF-16 code units (RFC 8785 §3.2.3)", () => {
    const value = {
      "€": "Euro Sign",
      "\r": "Carriage Return",
      "\uFB33": "Hebrew Letter Dalet With Dagesh",
      1: "One",
      "😀": "Emoji: Grinning Face",
      "\u0080": "Control",
      ö: "Latin Small Letter O With Diaeresis",
    };
    const canonical = canonicalJson(value);
    expect(canonical.ok && [...canonical.value.matchAll(/"([^"]+)":/g)].map((m) => m[1])).toEqual([
      "\\r",
      "1",
      "\u0080",
      "ö",
      "€",
      "😀",
      "\uFB33",
    ]);
  });

  it.each([
    [1e21, "1e+21"],
    [0.000001, "0.000001"],
    [1e-7, "1e-7"],
    [333333333.3333333, "333333333.3333333"],
    [-0, "0"],
  ])("writes the number %s as %s", (value, expected) => {
    expect(canonicalJson(value)).toEqual({ ok: true, value: expected });
  });

  it("escapes only what JSON requires, without normalising Unicode", () => {
    expect(canonicalJson('a"b\\c\nd\u0001eée\u0301')).toEqual({
      ok: true,
      value: '"a\\"b\\\\c\\nd\\u0001eée\u0301"',
    });
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN])("can't write %s", (value) => {
    expect(canonicalJson({ list: [value] })).toEqual({
      ok: false,
      error: { kind: "not-canonical", path: ["list", 0] },
    });
  });

  it("can't write values that aren't JSON", () => {
    expect(canonicalJson(undefined)).toEqual({ ok: false, error: { kind: "not-canonical", path: [] } });
    expect(canonicalJson({ a: new Map() })).toEqual({
      ok: false,
      error: { kind: "not-canonical", path: ["a"] },
    });
  });

  it("keeps a __proto__ field as data", () => {
    expect(canonicalJson(top("---\n__proto__: x\na: 1\n---\n"))).toEqual({
      ok: true,
      value: '{"__proto__":"x","a":1}',
    });
  });
});

describe("entry fingerprints", () => {
  it("pins the fingerprint of an entry", () => {
    expect(entryFingerprint(entry(ENTRY))).toEqual({ ok: true, value: ENTRY_FINGERPRINT });
  });

  it("leaves out the entry's own integrity and signature", () => {
    const sealed = entry(`${ENTRY}    integrity: sha256-c1:${"0".repeat(64)}\n    signature: null\n`);
    expect(entryFingerprint(sealed)).toEqual({ ok: true, value: ENTRY_FINGERPRINT });
  });

  it("doesn't count layout as an edit: quoting, indentation, flow style, comments, key order", () => {
    const relaid = entry(`  -   provenance: "self-reported"   # my rating
      evidence:
        - '0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d'
      observed_at: "2026-10-01T10:00:00Z"
      level: 3
      id: 0192f3a1-0000-7000-8000-000000000011
`);
    expect(entryFingerprint(relaid)).toEqual({ ok: true, value: ENTRY_FINGERPRINT });
  });

  it.each([
    ["a changed value", ENTRY.replace("level: 3", "level: 4")],
    ["a value's type", ENTRY.replace("level: 3", 'level: "3"')],
    ["an added field Pharoam doesn't know", `${ENTRY}    note: added by hand\n`],
    ["a removed field", ENTRY.replace(/ {4}evidence: .*\n/, "")],
  ])("counts %s as an edit", (_name, yaml) => {
    expect(entryFingerprint(entry(yaml))).not.toEqual({ ok: true, value: ENTRY_FINGERPRINT });
  });
});

describe("record fingerprints", () => {
  const RECORD = {
    schema: "evidence/1",
    id: "0192f3a1-0000-7000-8000-000000000020",
    assessment_of: "python",
  };
  // Computed independently from {"body":…,"top":…} in canonical form.
  const RECORD_FINGERPRINT = "sha256-c1:b8216cc750ea68edddce17eb9d69b1220ed2475b89be435b0833d96abec14dd7";

  it("pins the fingerprint of a top block and body", () => {
    expect(recordFingerprint(RECORD, "Asked 3 questions.\nPassed 2.")).toEqual({
      ok: true,
      value: RECORD_FINGERPRINT,
    });
  });

  it("ignores line endings, trailing newlines and the record's own integrity", () => {
    const sealed = { ...RECORD, integrity: `sha256-c1:${"0".repeat(64)}`, signature: null };
    expect(recordFingerprint(sealed, "Asked 3 questions.\r\nPassed 2.\r\n\r\n")).toEqual({
      ok: true,
      value: RECORD_FINGERPRINT,
    });
  });

  it("counts any other change to the body", () => {
    expect(recordFingerprint(RECORD, "Asked 3 questions.\nPassed 2. ")).not.toEqual({
      ok: true,
      value: RECORD_FINGERPRINT,
    });
    expect(recordFingerprint(RECORD, "\nAsked 3 questions.\nPassed 2.")).not.toEqual({
      ok: true,
      value: RECORD_FINGERPRINT,
    });
  });
});

describe("checking integrity (MVP S12.3)", () => {
  it("seals a new entry and finds it intact", () => {
    const sealed = sealEntry(entry(ENTRY));
    expect(sealed.ok && sealed.value.integrity).toBe(ENTRY_FINGERPRINT);
    expect(sealed.ok && Object.keys(sealed.value).at(-1)).toBe("integrity");
    expect(sealed.ok && checkEntry(sealed.value)).toEqual({ kind: "intact" });
  });

  it("finds an entry edited by hand", () => {
    const edited = entry(`${ENTRY.replace("level: 3", "level: 4")}    integrity: ${ENTRY_FINGERPRINT}\n`);
    expect(checkEntry(edited)).toEqual({ kind: "edited-outside", reason: "changed" });
  });

  it("finds an entry added by hand, with no fingerprint", () => {
    expect(checkEntry(entry(ENTRY))).toEqual({ kind: "edited-outside", reason: "no-fingerprint" });
  });

  it("finds an entry whose values can't have been written by Pharoam", () => {
    const edited = entry(`${ENTRY.replace("level: 3", "level: .inf")}    integrity: ${ENTRY_FINGERPRINT}\n`);
    expect(checkEntry(edited)).toEqual({ kind: "edited-outside", reason: "changed" });
  });

  it("reports a fingerprint rule it doesn't know, instead of guessing", () => {
    const later = entry(`${ENTRY}    integrity: sha256-c2:${"0".repeat(64)}\n`);
    expect(checkEntry(later)).toEqual({ kind: "unknown-rule", rule: "c2" });
  });

  it("treats a malformed fingerprint as no fingerprint", () => {
    expect(checkEntry(entry(`${ENTRY}    integrity: oops\n`))).toEqual({
      kind: "edited-outside",
      reason: "no-fingerprint",
    });
  });

  it("checks a whole record the same way", () => {
    const record = { schema: "evidence/1", id: "0192f3a1-0000-7000-8000-000000000020" };
    const fingerprint = recordFingerprint(record, "Body.\n");
    const sealed = { ...record, integrity: fingerprint.ok ? fingerprint.value : "" };
    expect(checkRecord(sealed, "Body.")).toEqual({ kind: "intact" });
    expect(checkRecord(sealed, "Body changed.")).toEqual({ kind: "edited-outside", reason: "changed" });
  });
});

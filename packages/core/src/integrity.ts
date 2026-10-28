/**
 * Integrity fingerprints for what Pharoam never edits, and the check that shows hand edits.
 *
 * @remarks Observation and review entries, and assessment records, are never edited by Pharoam (hard rule 4). It
 * stores a fingerprint when it writes one; a mismatch later labels it "edited outside Pharoam", and it is still
 * used (MVP S12.3). The fingerprint is over parsed values, so layout doesn't count as an edit but any change to a
 * value or field does. This catches casual edits, not deliberate tampering (data model §4).
 * @packageDocumentation
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { err, ok, type Result } from "./result.ts";

/** A value with no canonical JSON form, such as an infinite number, so it can't be fingerprinted. */
export interface NotCanonicalError {
  /** Always `"not-canonical"`. */
  readonly kind: "not-canonical";
  /** Where the value is, such as `["level"]`. */
  readonly path: readonly (string | number)[];
}

/**
 * The result of checking an entry or record against its stored fingerprint.
 *
 * @remarks
 * - `intact`: the fingerprint matches;
 * - `edited-outside`: the values changed since Pharoam wrote them (`changed`), or there is no valid fingerprint,
 *   so it was added outside Pharoam (`no-fingerprint`); either way it is still used;
 * - `unknown-rule`: the fingerprint names a rule this Pharoam doesn't know, such as one from a newer version.
 */
export type IntegrityStatus =
  | { readonly kind: "intact" }
  | { readonly kind: "edited-outside"; readonly reason: "changed" | "no-fingerprint" }
  | { readonly kind: "unknown-rule"; readonly rule: string };

// `c1` names the rule below; a changed rule gets a new name, and old values are checked with the rule they name.
const RULE = "c1";
const FINGERPRINT = /^sha256-([a-z0-9]+):([0-9a-f]{64})$/;
const OWN_FIELDS = new Set(["integrity", "signature"]);

/**
 * Writes a value in the JSON Canonicalization Scheme (RFC 8785).
 *
 * @remarks Keys are sorted by UTF-16 code units, there is no whitespace, numbers are written the one way
 * ECMAScript writes them, and text is not Unicode-normalised. Only JSON values can be written: an infinite or
 * not-a-number value, which YAML allows, has no canonical form.
 * @param value - A value as the codec reads it from YAML.
 * @returns The canonical JSON text, or where the value that can't be written is.
 */
export function canonicalJson(value: unknown): Result<string, NotCanonicalError> {
  return writeCanonical(value, []);
}

/**
 * Computes the fingerprint of an observation or review entry.
 *
 * @remarks The entry's own `integrity` and `signature` are left out, so a future signature signs the same form.
 * @param entry - The entry's values, as the codec reads them.
 * @returns The fingerprint, such as `sha256-c1:` and 64 hex digits, or why there is none.
 */
export function entryFingerprint(
  entry: Readonly<Record<string, unknown>>,
): Result<string, NotCanonicalError> {
  return fingerprint(withoutOwnFields(entry));
}

/**
 * Computes the fingerprint of a whole record, such as a diagnostic's assessment evidence.
 *
 * @remarks Covers `{ top, body }`, with the top block's own `integrity` and `signature` left out. The body's line
 * endings become LF and trailing newlines are removed; nothing else in it changes.
 * @param top - The record's top block, as the codec reads it.
 * @param body - The record's Markdown body.
 * @returns The fingerprint, or why there is none.
 */
export function recordFingerprint(
  top: Readonly<Record<string, unknown>>,
  body: string,
): Result<string, NotCanonicalError> {
  const normalisedBody = body.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  return fingerprint({ top: withoutOwnFields(top), body: normalisedBody });
}

/**
 * Returns a copy of a new entry with its fingerprint added as the last field.
 *
 * @param entry - The entry Pharoam is about to write.
 * @returns The entry with `integrity` set, or why it can't be fingerprinted.
 */
export function sealEntry(
  entry: Readonly<Record<string, unknown>>,
): Result<Readonly<Record<string, unknown>>, NotCanonicalError> {
  const result = entryFingerprint(entry);
  if (!result.ok) return result;
  const rest = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "integrity"));
  return ok({ ...rest, integrity: result.value });
}

/**
 * Checks an observation or review entry against its stored fingerprint.
 *
 * @param entry - The entry's values, as the codec reads them.
 * @returns Whether the entry is as Pharoam wrote it.
 */
export function checkEntry(entry: Readonly<Record<string, unknown>>): IntegrityStatus {
  return check(entry.integrity, () => entryFingerprint(entry));
}

/**
 * Checks a whole record against the fingerprint in its top block.
 *
 * @param top - The record's top block, as the codec reads it.
 * @param body - The record's Markdown body.
 * @returns Whether the record is as Pharoam wrote it.
 */
export function checkRecord(top: Readonly<Record<string, unknown>>, body: string): IntegrityStatus {
  return check(top.integrity, () => recordFingerprint(top, body));
}

function check(stored: unknown, compute: () => Result<string, NotCanonicalError>): IntegrityStatus {
  const match = typeof stored === "string" ? FINGERPRINT.exec(stored) : null;
  const rule = match?.[1];
  if (match === null || rule === undefined) return { kind: "edited-outside", reason: "no-fingerprint" };
  if (rule !== RULE) return { kind: "unknown-rule", rule };
  // A value Pharoam can't fingerprint can't be one Pharoam wrote.
  const computed = compute();
  return computed.ok && computed.value === stored
    ? { kind: "intact" }
    : { kind: "edited-outside", reason: "changed" };
}

function fingerprint(value: unknown): Result<string, NotCanonicalError> {
  const canonical = canonicalJson(value);
  if (!canonical.ok) return canonical;
  return ok(`sha256-${RULE}:${bytesToHex(sha256(utf8ToBytes(canonical.value)))}`);
}

function withoutOwnFields(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !OWN_FIELDS.has(key)));
}

function writeCanonical(
  value: unknown,
  path: readonly (string | number)[],
): Result<string, NotCanonicalError> {
  if (value === null || typeof value === "boolean") return ok(String(value));
  if (typeof value === "string") return ok(JSON.stringify(value));
  if (typeof value === "number") {
    // JSON.stringify writes finite numbers as ECMAScript does, which RFC 8785 adopts; -0 becomes 0.
    return Number.isFinite(value) ? ok(JSON.stringify(value)) : err({ kind: "not-canonical", path });
  }
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    const parts: string[] = [];
    for (const [index, item] of items.entries()) {
      const written = writeCanonical(item, [...path, index]);
      if (!written.ok) return written;
      parts.push(written.value);
    }
    return ok(`[${parts.join(",")}]`);
  }
  if (isPlainObject(value)) {
    const entries: [string, unknown][] = Object.entries(value);
    // String comparison in JavaScript is by UTF-16 code units, as RFC 8785 §3.2.3 requires.
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const [key, item] of entries) {
      const written = writeCanonical(item, [...path, key]);
      if (!written.ok) return written;
      parts.push(`${JSON.stringify(key)}:${written.value}`);
    }
    return ok(`{${parts.join(",")}}`);
  }
  return err({ kind: "not-canonical", path });
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== "object" || value === null) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

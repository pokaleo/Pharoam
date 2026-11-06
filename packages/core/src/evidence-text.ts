/**
 * Evidence as an evidence scan sends it to a model, and a fingerprint of what was sent.
 *
 * @packageDocumentation
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { EvidenceRecord } from "./schemas/evidence.ts";

// The fields a model reads, in the form's order, by their record names. Skills, links Pharoam keeps for itself and
// provenance are left out: they say nothing about what the person did.
const FIELDS = [
  ["url", "URL"],
  ["role", "Role"],
  ["course_code", "Course code"],
  ["credits", "Credits"],
  ["grade", "Grade"],
  ["issuer", "Issuer"],
  ["credential_id", "Credential ID"],
  ["expires", "Expires"],
] as const;

// The disclaimer Pharoam puts at the top of AI-made evidence: a quote line starting with the warning sign.
const DISCLAIMER = /^> ⚠️[^\n]*\n+/;

/**
 * Writes a piece of evidence as plain text for a model: its fields, then what the person did (MVP S16.1, S16.2).
 *
 * @remarks Only what the person recorded about the work is sent: not its skills, which the scan is about, nor
 * Pharoam's own provenance, nor the AI disclaimer at the top of a body, which isn't the person's (PRD D4). The
 * labels are English, as the tasks' instructions are.
 * @param record - The evidence, as Pharoam reads it.
 * @param body - The record's body: what the person did, as Markdown.
 * @returns The text, without a trailing newline.
 */
export function evidenceText(record: EvidenceRecord, body: string): string {
  const values: Readonly<Record<string, unknown>> = record;
  const when =
    record.date ??
    ([record.start, record.end].filter((part) => part !== undefined).join(" to ") || undefined);
  const lines = [
    `Kind: ${record.kind}`,
    `Title: ${record.title}`,
    ...(record.organisation === undefined ? [] : [`Organisation: ${record.organisation}`]),
    ...(when === undefined ? [] : [`When: ${when}`]),
    ...FIELDS.flatMap(([field, label]) => {
      const value = values[field];
      return typeof value === "string" || typeof value === "number" ? [`${label}: ${String(value)}`] : [];
    }),
    ...(record.links.length === 0 ? [] : [`Links: ${record.links.join(" ")}`]),
  ];
  const described = body.replace(DISCLAIMER, "").trim();
  return described === "" ? lines.join("\n") : `${lines.join("\n")}\n\n${described}`;
}

/**
 * A fingerprint of exactly what a scan sent about one record, so a later change to the record can be seen (MVP
 * S16.10).
 *
 * @param text - What was sent, such as {@link evidenceText}'s result.
 * @returns `sha256:` and the 64 hex digits of the text's SHA-256.
 */
export function sentFingerprint(text: string): string {
  return `sha256:${bytesToHex(sha256(utf8ToBytes(text)))}`;
}

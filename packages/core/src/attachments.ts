/**
 * Files kept with evidence: their size limit and the names they are stored under (MVP S14, data model §7).
 *
 * @remarks An attachment is stored under its own name, so the person recognises it in their folder. Names come from
 * the person's files, so they are made safe for any folder on any system before storage sees them, and storage
 * refuses any other name.
 * @packageDocumentation
 */

/** The largest file that can be attached: 10 MB (MVP S14.3, data model §7). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Well under the 255 bytes most file systems allow, leaving room for a number when a name is taken.
const MAX_NAME_BYTES = 120;
// A longer "extension" is just part of the name.
const MAX_EXTENSION_LENGTH = 20;
const FALLBACK = "attachment";

// Characters Windows refuses in a name; control characters, which no system shows well; and direction and
// zero-width marks, which can disguise a file's type, as `invoice\u202Efdp.exe` shows as `invoiceexe.pdf`.
// eslint-disable-next-line no-control-regex -- control characters are exactly what is matched
const UNSAFE = /[<>:"|?*\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
// Names Windows keeps for devices, judged by the part before the first dot (`nul.tar.gz` too).
const RESERVED = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)$/i;
// Each pass can only shorten a name or mark a device name once, so it settles within a few.
const MAX_PASSES = 8;

/**
 * Makes a file's name safe to store an attachment under, keeping it as close to the person's own as possible.
 *
 * @remarks Keeps only the last part of a path; replaces characters a folder can't hold on some system with `-`;
 * drops dots and spaces at either end, so the file is never hidden and works on Windows; avoids device names
 * Windows reserves; and shortens a long name, keeping its extension. Accented letters are written one way (NFC),
 * so the same name always matches.
 * @param raw - The file's name, as the browser gives it.
 * @returns A safe name; `attachment` when nothing of the name is left.
 */
export function attachmentName(raw: string): string {
  // Shortening can expose a new extension, or leave dots and spaces at the end, so the rules run until the name
  // stops changing: then the name is exactly one storage accepts.
  let name = raw.normalize("NFC").split(/[/\\]/).at(-1) ?? "";
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = onePass(name);
    if (next === name) return name;
    name = next;
  }
  return FALLBACK;
}

function onePass(name: string): string {
  const cleaned = name.replace(UNSAFE, "-").replace(/^[.\s]+|[.\s]+$/g, "");
  if (cleaned === "") return FALLBACK;
  const first = cleaned.split(".")[0] ?? "";
  const marked = RESERVED.test(first.trimEnd())
    ? `${first.trimEnd()}-file${cleaned.slice(first.length)}`
    : cleaned;
  const { base, extension } = splitName(marked);
  return fitted(base, extension);
}

/**
 * Whether storage may keep an attachment under this name.
 *
 * @remarks Exactly the names {@link attachmentName} gives, so a connector can refuse anything else, such as a
 * path that would reach outside the attachment's folder.
 * @param name - The name to check.
 * @returns `true` for a safe name.
 */
export function isAttachmentName(name: string): boolean {
  return name !== "" && attachmentName(name) === name;
}

/**
 * The name for another attachment whose name is already taken, numbered as file managers do.
 *
 * @param name - A safe name, from {@link attachmentName}.
 * @param number - The number to add, from 2.
 * @returns A safe name such as `cv (2).pdf`.
 */
export function numberedName(name: string, number: number): string {
  const { base, extension } = splitName(name);
  return attachmentName(fitted(base, extension, ` (${String(number)})`));
}

function splitName(name: string): { base: string; extension: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || name.length - dot > MAX_EXTENSION_LENGTH) return { base: name, extension: "" };
  return { base: name.slice(0, dot), extension: name.slice(dot) };
}

// The base, shortened so the whole name fits, then the suffix and extension.
function fitted(base: string, extension: string, suffix = ""): string {
  let room = MAX_NAME_BYTES - utf8Length(extension) - utf8Length(suffix);
  let kept = "";
  for (const character of base) {
    room -= utf8Length(character);
    if (room < 0) break;
    kept += character;
  }
  return `${kept.replace(/[.\s]+$/, "")}${suffix}${extension}`;
}

function utf8Length(text: string): number {
  let length = 0;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    length += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return length;
}

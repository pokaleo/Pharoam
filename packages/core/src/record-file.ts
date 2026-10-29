/**
 * Record files: Markdown with a YAML top block, read and written without losing what the person wrote.
 *
 * @remarks File connectors (local folder, Obsidian, Git) share this codec (interfaces §1). The top block is edited
 * in place with `yaml`, so comments, field order and unknown fields survive a rewrite (ADR-0006, AD19). Broken
 * files are returned as typed errors, never thrown, so they can be listed under "Needs attention" and left
 * untouched (data model §4, hard rule 3).
 * @packageDocumentation
 */
import {
  Document,
  isAlias,
  isMap,
  isSeq,
  LineCounter,
  parseDocument,
  type DocumentOptions,
  type ParseOptions,
  type ScalarTag,
  type SchemaOptions,
  type Tags,
  type ToStringOptions,
  visit,
} from "yaml";
import { err, ok, type Result } from "./result.ts";

/** A record file read into its fields and body. */
export interface RecordFile {
  /** The top block's fields as plain values: YAML 1.2 core schema, aliases resolved. */
  readonly top: Readonly<Record<string, unknown>>;
  /** The Markdown after the top block, exactly as written. */
  readonly body: string;
  /**
   * The top block as a YAML document, keeping comments, field order and how values were written.
   *
   * @remarks Change it only through {@link withTopField}, which works on a copy.
   */
  readonly document: Document;
  /** How the file was laid out, so it is written back the same way. */
  readonly layout: RecordFileLayout;
}

/** The parts of a file's layout that are kept when it is written back. */
export interface RecordFileLayout {
  /** Whether the file starts with a byte-order mark, as some Windows editors write. */
  readonly byteOrderMark: boolean;
  /** The line ending of the opening `---` line, used for the whole top block. */
  readonly lineEnding: "\n" | "\r\n";
}

/** One problem in a top block's YAML. */
export interface YamlProblem {
  /** The `yaml` parser's code for the problem, such as `DUPLICATE_KEY` or `TAB_AS_INDENT`. */
  readonly code: string;
  /** The parser's description, in English. */
  readonly message: string;
  /** The line in the file, counting from 1 and including the opening `---`. */
  readonly line: number;
  /** The column, counting from 1. */
  readonly column: number;
}

/**
 * Why a file couldn't be read as a record.
 *
 * @remarks Each kind maps to a plain explanation under "Needs attention" (MVP S12.2):
 * - `no-top-block`: the file doesn't start with a `---` line;
 * - `unclosed-top-block`: no `---` line ends the top block;
 * - `invalid-yaml`: the top block breaks YAML's rules, such as a duplicate key or tabs used for indentation;
 * - `not-fields`: the top block is empty, a list or a single value, not a set of fields;
 * - `too-many-aliases`: aliases repeat so much they would use excessive memory.
 */
export type RecordFileError =
  | { readonly kind: "no-top-block" }
  | { readonly kind: "unclosed-top-block" }
  | { readonly kind: "invalid-yaml"; readonly problems: readonly YamlProblem[] }
  | { readonly kind: "not-fields"; readonly found: "nothing" | "list" | "value" }
  | { readonly kind: "too-many-aliases" };

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const FENCE = /^---[ \t]*$/;
const MAX_ALIASES = 100;

// Numbers, booleans and nulls print as they were written while their value is unchanged. Otherwise `yaml`
// would rewrite `010` as `10`, `True` as `true`, and round a big integer to a different number.
function keepWrittenScalars(tags: Tags): Tags {
  return tags.map((tag) => {
    if (typeof tag === "string" || "collection" in tag || !tag.stringify || tag.tag.endsWith(":str"))
      return tag;
    return { ...tag, stringify: printAsWritten(tag, tag.stringify) };
  });
}

function printAsWritten(
  tag: ScalarTag,
  print: NonNullable<ScalarTag["stringify"]>,
): NonNullable<ScalarTag["stringify"]> {
  return (item, ctx, onComment, onChompKeep) => {
    const { source } = item;
    if (source !== undefined && (tag.test?.test(source) ?? true)) {
      const reread: unknown = tag.resolve(source, () => undefined, {});
      if (Object.is(reread, item.value)) return source;
    }
    return print(item, ctx, onComment, onChompKeep);
  };
}

const YAML_OPTIONS = {
  version: "1.2",
  schema: "core",
  customTags: keepWrittenScalars,
  uniqueKeys: true,
  prettyErrors: false,
} as const satisfies DocumentOptions & ParseOptions & SchemaOptions;

// No line folding, so long values stay on one line; `[a, b]` as Obsidian writes it.
const PRINT_OPTIONS = { lineWidth: 0, flowCollectionPadding: false } as const satisfies ToStringOptions;

/**
 * Reads a record file's text into its fields and body.
 *
 * @remarks The file must start with a `---` line, and the next `---` line ends the top block; later `---` lines
 * belong to the body. A byte-order mark and Windows line endings are accepted and kept. Values follow the YAML 1.2
 * core schema, so `yes` and `2026-10-24` stay strings (data model §4).
 * @param text - The whole file, as read from storage.
 * @returns The record file, or why it isn't a valid one.
 */
export function parseRecordFile(text: string): Result<RecordFile, RecordFileError> {
  const byteOrderMark = text.startsWith(BYTE_ORDER_MARK);
  const content = byteOrderMark ? text.slice(1) : text;
  const split = splitTopBlock(content);
  if (!split.ok) return split;
  const { yaml, body } = split.value;

  const lineCounter = new LineCounter();
  const document = parseDocument(yaml, { ...YAML_OPTIONS, lineCounter });
  const problems = [
    ...document.errors.map((error) => ({ code: error.code, message: error.message, offset: error.pos[0] })),
    ...unresolvedAliases(document),
  ].map(({ code, message, offset }) => {
    const { line, col } = lineCounter.linePos(offset);
    return { code, message, line: line + 1, column: col };
  });
  if (problems.length > 0) return err({ kind: "invalid-yaml", problems });

  const top = topFields(document);
  if (!top.ok) return top;
  const lineEnding = /^[^\n]*\r\n/.test(content) ? "\r\n" : "\n";
  return ok({ top: top.value, body, document, layout: { byteOrderMark, lineEnding } });
}

/**
 * Writes a record file back to text.
 *
 * @remarks Comments, field order, unknown fields and how numbers, booleans and nulls were written are kept, and
 * the body is written byte for byte. Some layout can still change, such as quoting or the spacing around a
 * comment; values never do (ADR-0006).
 * @param file - The record file to write.
 * @returns The file's text, ready to store.
 */
export function printRecordFile(file: RecordFile): string {
  const { byteOrderMark, lineEnding } = file.layout;
  const top = `---\n${file.document.toString(PRINT_OPTIONS)}---\n`;
  return (byteOrderMark ? BYTE_ORDER_MARK : "") + top.replaceAll("\n", lineEnding) + file.body;
}

/**
 * Creates a new record file from fields and a body.
 *
 * @param top - The top block's fields, in the order they should be written.
 * @param body - The Markdown below the top block.
 * @returns A record file with Unix line endings and no byte-order mark.
 */
export function createRecordFile(top: Readonly<Record<string, unknown>>, body: string): RecordFile {
  const document = new Document(top, YAML_OPTIONS);
  return { top: plainFields(document), body, document, layout: { byteOrderMark: false, lineEnding: "\n" } };
}

/**
 * Returns a copy of a record file with one top-block field set.
 *
 * @remarks An existing field keeps its place and its comments; a new field is added at the end. Everything else
 * in the file is unchanged, including fields Pharoam doesn't know (MVP S12.4).
 * @param file - The record file to start from; it isn't changed.
 * @param key - The field to set.
 * @param value - The field's new value.
 * @returns The changed copy.
 */
export function withTopField(file: RecordFile, key: string, value: unknown): RecordFile {
  const document = file.document.clone();
  document.set(key, value);
  return { ...file, top: plainFields(document), document };
}

/**
 * Returns a copy of a record file without one top-block field.
 *
 * @remarks Everything else in the file is unchanged, including fields Pharoam doesn't know (MVP S12.4).
 * @param file - The record file to start from; it isn't changed.
 * @param key - The field to remove; nothing is removed if the file doesn't have it.
 * @returns The changed copy.
 */
export function withoutTopField(file: RecordFile, key: string): RecordFile {
  const document = file.document.clone();
  document.delete(key);
  return { ...file, top: plainFields(document), document };
}

// Finds the top block between the opening `---` line and the next one.
function splitTopBlock(content: string): Result<{ yaml: string; body: string }, RecordFileError> {
  const firstBreak = content.indexOf("\n");
  const firstLine = firstBreak === -1 ? content : content.slice(0, firstBreak);
  if (!FENCE.test(firstLine.replace(/\r$/, ""))) return err({ kind: "no-top-block" });
  if (firstBreak === -1) return err({ kind: "unclosed-top-block" });

  const lines: string[] = [];
  let start = firstBreak + 1;
  for (;;) {
    const next = content.indexOf("\n", start);
    const line = content.slice(start, next === -1 ? content.length : next).replace(/\r$/, "");
    if (FENCE.test(line)) {
      const yaml = lines.map((l) => `${l}\n`).join("");
      return ok({ yaml, body: next === -1 ? "" : content.slice(next + 1) });
    }
    if (next === -1) return err({ kind: "unclosed-top-block" });
    lines.push(line);
    start = next + 1;
  }
}

// `yaml` doesn't report an alias to a missing anchor until the values are built, and then throws.
function unresolvedAliases(document: Document): { code: string; message: string; offset: number }[] {
  const found: { code: string; message: string; offset: number }[] = [];
  visit(document, (_key, node) => {
    if (isAlias(node) && node.resolve(document) === undefined) {
      found.push({
        code: "BAD_ALIAS",
        message: `Unknown alias *${node.source}`,
        offset: node.range?.[0] ?? 0,
      });
    }
  });
  return found;
}

function topFields(document: Document): Result<Readonly<Record<string, unknown>>, RecordFileError> {
  if (document.contents === null) return err({ kind: "not-fields", found: "nothing" });
  if (isSeq(document.contents)) return err({ kind: "not-fields", found: "list" });
  if (!isMap(document.contents)) return err({ kind: "not-fields", found: "value" });
  try {
    return ok(plainFields(document));
  } catch (error) {
    // `yaml` throws a ReferenceError when aliases expand past the limit (a "billion laughs" file).
    if (error instanceof ReferenceError) return err({ kind: "too-many-aliases" });
    throw error;
  }
}

// The top block's values; the caller has checked the document is a map.
function plainFields(document: Document): Readonly<Record<string, unknown>> {
  return document.toJS({ maxAliasCount: MAX_ALIASES }) as Record<string, unknown>;
}

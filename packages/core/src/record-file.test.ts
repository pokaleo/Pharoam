import { describe, expect, it } from "vitest";
import { INVALID_FILES, VALID_FILES } from "./__fixtures__/record-files.ts";
import {
  createRecordFile,
  parseRecordFile,
  printRecordFile,
  withoutTopField,
  withTopField,
  type RecordFile,
} from "./record-file.ts";

function parsed(text: string): RecordFile {
  const result = parseRecordFile(text);
  if (!result.ok) throw new Error(`Expected a valid file, got ${JSON.stringify(result.error)}`);
  return result.value;
}

// The YAML comments in a file's top block, in order.
function comments(text: string): string[] {
  const top = text.split(/\r?\n---[ \t]*(?:\r?\n|$)/)[0] ?? "";
  return [...top.matchAll(/(?:^|\s)(#[^\r\n]*)/g)]
    .map((m) => m[1] ?? "")
    .filter((c) => !c.startsWith("#career"));
}

describe("reading and writing record files", () => {
  describe.each(VALID_FILES)("$name", ({ text }) => {
    const file = parsed(text);
    const written = printRecordFile(file);
    const reread = parsed(written);

    it("keeps every value", () => {
      expect(reread.top).toEqual(file.top);
    });

    it("keeps the field order", () => {
      expect(Object.keys(reread.top)).toEqual(Object.keys(file.top));
    });

    it("keeps the comments", () => {
      expect(comments(written)).toEqual(comments(text));
    });

    it("keeps the body byte for byte", () => {
      expect(reread.body).toBe(file.body);
      expect(written.endsWith(file.body)).toBe(true);
    });

    it("keeps the byte-order mark and line endings", () => {
      expect(written.startsWith("\uFEFF")).toBe(text.startsWith("\uFEFF"));
      expect(written.includes("\r\n")).toBe(text.includes("\r\n"));
      expect(written.replaceAll("\r\n", "").includes("\n")).toBe(text.replaceAll("\r\n", "").includes("\n"));
    });

    it("writes the same text when written again", () => {
      expect(printRecordFile(reread)).toBe(written);
    });
  });

  it("writes a file Pharoam wrote back unchanged", () => {
    const [clean] = VALID_FILES;
    expect(clean).toBeDefined();
    if (clean) expect(printRecordFile(parsed(clean.text))).toBe(clean.text);
  });

  it("writes numbers, booleans and nulls as they were written", () => {
    const text =
      "---\nbig: 12345678901234567890\noctal_looking: 010\nhex: 0x1F\ndecimal: 0.10\ncapital: True\nnothing: ~\n---\n";
    expect(printRecordFile(parsed(text))).toBe(text);
  });

  it("splits the body at the first closing ---", () => {
    const file = parsed("---\ntitle: Rules\n---\nAbove\n\n---\n\nBelow\n");
    expect(file.top).toEqual({ title: "Rules" });
    expect(file.body).toBe("Above\n\n---\n\nBelow\n");
  });

  it("reads YAML 1.1 values as YAML 1.2 does", () => {
    const { top } = parsed(VALID_FILES.find((f) => f.name === "YAML 1.1 values")?.text ?? "");
    expect(top).toMatchObject({
      answer: "yes",
      negative: "no",
      switch: "on",
      letter: "y",
      octal_looking: 10,
      sexagesimal: "1:20",
      date: "2026-10-24",
      nothing: null,
      capital: true,
    });
  });

  it("resolves aliases in the values but keeps them in the file", () => {
    const text = VALID_FILES.find((f) => f.name === "anchors and aliases")?.text ?? "";
    const file = parsed(text);
    expect(file.top.first).toEqual({ visibility: "private", reviewed: false });
    expect(printRecordFile(file)).toContain("first: *defaults");
  });

  it("keeps a __proto__ field as data without touching prototypes", () => {
    const { top } = parsed("---\n__proto__:\n  polluted: true\n---\n");
    expect(Object.hasOwn(top, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(top)).toBe(Object.prototype);
    const fresh: Record<string, unknown> = {};
    expect(fresh.polluted).toBeUndefined();
  });
});

describe("broken files", () => {
  it.each(INVALID_FILES)("reports $name as $kind", ({ text, kind }) => {
    const result = parseRecordFile(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe(kind);
  });

  it("gives the file's line number for a YAML problem", () => {
    const result = parseRecordFile("---\nschema: evidence/1\ntitle: One\ntitle: Two\n---\n");
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid-yaml",
        problems: [expect.objectContaining({ code: "DUPLICATE_KEY", line: 4, column: 1 })],
      },
    });
  });

  it("counts lines the same way with a byte-order mark and Windows line endings", () => {
    const result = parseRecordFile("\uFEFF---\r\nschema: evidence/1\r\nmeta:\r\n\tsource: import\r\n---\r\n");
    expect(result.ok ? [] : result.error).toMatchObject({ problems: [{ code: "TAB_AS_INDENT", line: 4 }] });
  });

  it("gives the line of an unknown alias", () => {
    const result = parseRecordFile("---\nschema: evidence/1\nfirst: *missing\n---\n");
    expect(result.ok ? [] : result.error).toMatchObject({
      problems: [{ code: "BAD_ALIAS", line: 3, column: 8 }],
    });
  });

  it("says what the top block holds when it isn't fields", () => {
    expect(parseRecordFile("---\n---\n")).toEqual({
      ok: false,
      error: { kind: "not-fields", found: "nothing" },
    });
    expect(parseRecordFile("---\n- a\n---\n")).toEqual({
      ok: false,
      error: { kind: "not-fields", found: "list" },
    });
    expect(parseRecordFile("---\ntext\n---\n")).toEqual({
      ok: false,
      error: { kind: "not-fields", found: "value" },
    });
  });

  it("never throws, whatever the text", () => {
    for (const { text } of [...VALID_FILES, ...INVALID_FILES]) {
      for (let end = 0; end <= text.length; end++) {
        expect(() => parseRecordFile(text.slice(0, end))).not.toThrow();
      }
    }
  });
});

describe("changing a record file", () => {
  const text = `---
# Kept.
schema: evidence/1
title: Old title # kept too
unknown_field: kept
zeta: 1
---
Body.
`;

  it("changes one field and keeps everything else", () => {
    const changed = printRecordFile(withTopField(parsed(text), "title", "New title"));
    expect(changed).toBe(text.replace("title: Old title # kept too", "title: New title # kept too"));
  });

  it("adds a new field at the end", () => {
    const changed = withTopField(parsed(text), "updated", "2026-10-28T09:00:00Z");
    expect(Object.keys(changed.top)).toEqual(["schema", "title", "unknown_field", "zeta", "updated"]);
    expect(printRecordFile(changed)).toContain("zeta: 1\nupdated: 2026-10-28T09:00:00Z\n---\nBody.\n");
  });

  it("removes one field and keeps everything else", () => {
    const changed = withoutTopField(parsed(text), "unknown_field");
    expect(changed.top).toEqual({ schema: "evidence/1", title: "Old title", zeta: 1 });
    expect(printRecordFile(changed)).toBe(text.replace("unknown_field: kept\n", ""));
  });

  it("removes nothing when the field isn't there", () => {
    expect(printRecordFile(withoutTopField(parsed(text), "missing"))).toBe(text);
  });

  it("leaves the original file as it was", () => {
    const original = parsed(text);
    withoutTopField(original, "title");
    withTopField(original, "title", "New title");
    expect(original.top.title).toBe("Old title");
    expect(printRecordFile(original)).toBe(text);
  });

  it("keeps Windows line endings and the byte-order mark", () => {
    const windows = `\uFEFF${text.replaceAll("\n", "\r\n")}`;
    const changed = printRecordFile(withTopField(parsed(windows), "title", "New title"));
    expect(changed).toBe(windows.replace("Old title", "New title"));
  });
});

describe("creating a record file", () => {
  it("writes the fields in order, then the body", () => {
    const file = createRecordFile({ schema: "evidence/1", title: "New", skills: ["python"] }, "Body.\n");
    expect(printRecordFile(file)).toBe(
      "---\nschema: evidence/1\ntitle: New\nskills:\n  - python\n---\nBody.\n",
    );
  });

  it("quotes strings that would read back as something else", () => {
    const file = createRecordFile({ answer: "yes", count: "10", empty: "", date: "2026-10-24" }, "");
    expect(parsed(printRecordFile(file)).top).toEqual({
      answer: "yes",
      count: "10",
      empty: "",
      date: "2026-10-24",
    });
  });

  it("reads back what it wrote", () => {
    const top = { schema: "evidence/1", nested: { list: [1, "two", null, true] } };
    const file = createRecordFile(top, "Body\n");
    expect(parsed(printRecordFile(file))).toMatchObject({ top, body: "Body\n" });
  });
});

import { describe, expect, it } from "vitest";
import { crc32, zipFiles } from "./zip.ts";

const encoder = new TextEncoder();
const file = (path: string, text: string) => ({ path, bytes: encoder.encode(text) });

// Reads the little-endian numbers a zip is made of.
const u16 = (bytes: Uint8Array, at: number): number => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const u32 = (bytes: Uint8Array, at: number): number => (u16(bytes, at) | (u16(bytes, at + 2) << 16)) >>> 0;

// The entries a zip lists in its central directory, read the way an unzip tool reads them.
function entries(zip: Uint8Array): { name: string; text: string }[] {
  const end = zip.length - 22;
  expect(u32(zip, end)).toBe(0x06054b50);
  const count = u16(zip, end + 10);
  let at = u32(zip, end + 16);
  const found: { name: string; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    expect(u32(zip, at)).toBe(0x02014b50);
    const size = u32(zip, at + 20);
    const nameLength = u16(zip, at + 28);
    const extra = u16(zip, at + 30);
    const comment = u16(zip, at + 32);
    const local = u32(zip, at + 42);
    const name = new TextDecoder().decode(zip.slice(at + 46, at + 46 + nameLength));
    expect(u32(zip, local)).toBe(0x04034b50);
    const data = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
    found.push({ name, text: new TextDecoder().decode(zip.slice(data, data + size)) });
    at += 46 + nameLength + extra + comment;
  }
  return found;
}

describe("crc32", () => {
  it("matches the standard check values", () => {
    expect(crc32(encoder.encode(""))).toBe(0);
    expect(crc32(encoder.encode("hello"))).toBe(0x3610a686);
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("zipFiles", () => {
  it("stores every file at its path, unchanged, in a zip any unzip tool reads", () => {
    const zip = zipFiles(
      [
        file("pharoam.md", "---\nschema: pharoam/1\n---\n"),
        file("evidence/payments-api--0192f3a1.md", "Café ✓\n"),
      ],
      new Date(2026, 9, 29, 14, 30, 0),
    );
    expect(entries(zip)).toEqual([
      { name: "pharoam.md", text: "---\nschema: pharoam/1\n---\n" },
      { name: "evidence/payments-api--0192f3a1.md", text: "Café ✓\n" },
    ]);
  });

  it("records each file's checksum, and marks names as UTF-8", () => {
    const zip = zipFiles([file("ä.md", "hello")], new Date(2026, 9, 29));
    expect(u32(zip, 14)).toBe(0x3610a686);
    expect(u16(zip, 6) & 0x0800).toBe(0x0800);
  });

  it("dates each file in the zip's own format, to the two seconds it can hold", () => {
    const zip = zipFiles([file("a.md", "")], new Date(2026, 9, 29, 14, 30, 7));
    const time = u16(zip, 10);
    const date = u16(zip, 12);
    expect([time >> 11, (time >> 5) & 63, (time & 31) * 2]).toEqual([14, 30, 6]);
    expect([(date >> 9) + 1980, (date >> 5) & 15, date & 31]).toEqual([2026, 10, 29]);
  });

  it("makes an empty zip for no files", () => {
    expect(entries(zipFiles([], new Date(2026, 9, 29)))).toEqual([]);
  });
});

/**
 * A `.zip` of the profile's files, for a copy the person downloads and keeps (ADR-0020).
 *
 * @remarks Files are stored, not compressed: profiles are small, the code stays short enough to read, and the app
 * takes on no compression library. Any unzip tool, Finder and Windows Explorer included, opens the result.
 * @packageDocumentation
 */
import type { StoredFile } from "./places.ts";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/**
 * The CRC-32 checksum a zip records for each file.
 *
 * @param bytes - The file's bytes.
 * @returns The checksum, as an unsigned 32-bit number.
 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// A zip's date and time: two seconds' precision, from 1980, in local time.
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Puts files into a zip, each at its path, stored unchanged.
 *
 * @param files - The files, in the order to list them.
 * @param date - The date and time to give every file.
 * @returns The zip's bytes.
 */
export function zipFiles(files: readonly StoredFile[], date: Date): Uint8Array {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(date);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const crc = crc32(file.bytes);
    // Version 2.0, the UTF-8 name flag, stored, then the date, checksum and sizes.
    const fields = (view: DataView, at: number): void => {
      view.setUint16(at, 20, true);
      view.setUint16(at + 2, 0x0800, true);
      view.setUint16(at + 4, 0, true);
      view.setUint16(at + 6, stamp.time, true);
      view.setUint16(at + 8, stamp.date, true);
      view.setUint32(at + 10, crc, true);
      view.setUint32(at + 14, file.bytes.length, true);
      view.setUint32(at + 18, file.bytes.length, true);
      view.setUint16(at + 22, name.length, true);
    };

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    fields(localView, 4);
    local.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const entryView = new DataView(entry.buffer);
    entryView.setUint32(0, 0x02014b50, true);
    entryView.setUint16(4, 20, true);
    fields(entryView, 6);
    entryView.setUint32(42, offset, true);
    entry.set(name, 46);

    parts.push(local, file.bytes);
    central.push(entry);
    offset += local.length + file.bytes.length;
  }

  const centralSize = central.reduce((size, entry) => size + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const zip = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...parts, ...central, end]) {
    zip.set(part, at);
    at += part.length;
  }
  return zip;
}

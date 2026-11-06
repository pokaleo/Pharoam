/**
 * Handing a file kept with evidence to the browser's download.
 *
 * @packageDocumentation
 */

/**
 * Downloads a file under its own name, without ever showing it inside the page (MVP S14.2, hard rule 10).
 *
 * @remarks The file is given a generic type, so the browser saves it rather than opening it in the app's own
 * origin, where an HTML or SVG file could run. It goes straight from the person's storage to their download; no
 * server sees it.
 * @param name - The file's name, as the evidence lists it.
 * @param bytes - What the file holds, exactly as stored.
 * @param doc - The page's document.
 */
export function downloadFile(name: string, bytes: Uint8Array<ArrayBuffer>, doc: Document): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const link = doc.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Later, not at once: some browsers still read the address after the click returns.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * A file's size as people read it, such as `2 kB` or `1.4 MB`.
 *
 * @param bytes - How many bytes the file holds.
 * @param locale - The interface's locale, such as `en`.
 * @returns The size in the largest unit under which it is at least 1.
 */
export function fileSize(bytes: number, locale: string): string {
  const [value, unit] =
    bytes < 1024
      ? [bytes, "byte"]
      : bytes < 1024 * 1024
        ? [bytes / 1024, "kilobyte"]
        : [bytes / (1024 * 1024), "megabyte"];
  // "14 bytes" in full, as the short form reads "14 byte"; kB and MB are familiar.
  const unitDisplay = unit === "byte" ? "long" : "short";
  return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay, maximumFractionDigits: 1 }).format(
    value,
  );
}

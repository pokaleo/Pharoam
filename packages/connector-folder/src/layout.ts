/**
 * Where each record lives in the folder the user chose (data model §8).
 *
 * @remarks File names are for people; Pharoam relies only on the IDs inside the files, so a renamed or moved file
 * still works. Names are built only from letters, digits and hyphens, so no field value can point outside the
 * folder.
 * @packageDocumentation
 */
import type { RecordFile } from "@pharoam/core";

const MAX_NAME_LENGTH = 60;

/**
 * Chooses the path for a new record.
 *
 * @remarks `pharoam.md` at the top; `skills/<skill>.md`; `gaps/<pathway>.md`; and for evidence and other records,
 * `<folder>/<title>--<short id>.md`. The short ID is the last 8 hex digits of the record's UUIDv7, its random
 * part: the first digits are a timestamp that records made within a minute share.
 * @param file - The new record, already validated by the core.
 * @returns A path relative to the chosen folder, such as `evidence/backend-engineer-example-co--6a7b8c9d.md`.
 */
export function recordPath(file: RecordFile): string {
  const { top } = file;
  const type = slugify(text(top.schema).split("/")[0] ?? "") || "record";
  const shortId = slugify(text(top.id).replaceAll("-", "").slice(-8));
  switch (type) {
    case "pharoam":
      return "pharoam.md";
    case "skill-record":
      return `skills/${slugify(text(top.skill)) || shortId}.md`;
    case "gap":
      return `gaps/${slugify(text(top.pathway).split(":").at(-1) ?? "") || shortId}.md`;
    default: {
      const folder = type === "evidence" ? "evidence" : `${type}s`;
      const title = [text(top.title), text(top.organisation)].filter((part) => part !== "").join(" ");
      return `${folder}/${slugify(title) || type}--${shortId}.md`;
    }
  }
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

// Lowercase letters and digits joined by single hyphens; accents are dropped, anything else becomes a hyphen.
function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME_LENGTH)
    .replace(/-+$/, "");
}

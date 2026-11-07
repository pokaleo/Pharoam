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

/** The folders a new profile starts with, so the person can see where each kind of record goes (MVP S1.1). */
export const PROFILE_FOLDERS = ["skills", "evidence", "gaps"] as const;

/**
 * Where files kept with records go: one folder per record, named by its ID (MVP S14.1).
 *
 * @remarks The full ID, not the short one in file names, so two records' files can never mix. The leading `_`
 * keeps the folder out of record listings (data model §8).
 */
export const ATTACHMENTS_FOLDER = ["evidence", "_attachments"] as const;

/**
 * Chooses the path for a new record.
 *
 * @remarks `pharoam.md` at the top; `skills/<skill>.md`; `gaps/<pathway>.md`;
 * `sessions/<workflow>-<day>--<short id>.md`; `notes/<pathway>-<day>--<short id>.md`; and for evidence and other records, `<folder>/<title>--<short id>.md`. The short ID is the last 8 hex digits of the record's UUIDv7, its random
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
    case "session": {
      // The workflow without its version, and the day it started, such as `evidence-scan-2026-11-06`.
      const name = [text(top.workflow).split("@")[0] ?? "", text(top.created).slice(0, 10)].join(" ");
      return `sessions/${slugify(name) || type}--${shortId}.md`;
    }
    case "note": {
      // The pathway whose gap it explains, and the day it was written, such as `ml-engineer-2026-11-07`.
      const name = [text(top.pathway).split(":").at(-1) ?? "", text(top.created).slice(0, 10)].join(" ");
      return `notes/${slugify(name) || type}--${shortId}.md`;
    }
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

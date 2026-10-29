/**
 * Profile files for the end-to-end tests, written as Pharoam writes them.
 *
 * @packageDocumentation
 */

const lines = (...text: string[]): string => `${text.join("\n")}\n`;

/** A `pharoam.md` with a headline and the person's own words below the top block. */
export const PHAROAM = lines(
  "---",
  "schema: pharoam/1",
  "id: 0192f3a1-0000-7000-8000-000000000001",
  "created: 2026-10-01T09:00:00Z",
  "headline: Backend developer",
  "---",
  "# About me",
  "",
  "I like small teams.",
);

/** A piece of evidence: a project. */
export const PAYMENTS_API = lines(
  "---",
  "schema: evidence/1",
  "id: 0192f3a1-0000-7000-8000-000000000002",
  "created: 2026-10-02T09:00:00Z",
  "kind: project",
  "title: Payments API",
  "---",
  "I built the **refunds** flow.",
);

/**
 * A skill record for SQL with one self-reported level and its regenerated summary (MVP S9.2).
 *
 * @param level - The level, 0–4.
 * @returns The file's text.
 */
export function sqlRecord(level: number): string {
  return lines(
    "---",
    "schema: skill-record/1",
    "id: 0192f3a1-0000-7000-8000-000000000003",
    "created: 2026-10-03T09:00:00Z",
    "skill: sql",
    "entries:",
    "  - id: 0192f3a1-0000-7000-8000-000000000004",
    `    level: ${String(level)}`,
    "    provenance: self-reported",
    "    observed_at: 2026-10-03T09:00:00Z",
    "    evidence:",
    "      - 0192f3a1-0000-7000-8000-000000000002",
    "proficiency:",
    "  shown:",
    `    level: ${String(level)}`,
    "    since: 2026-10-03",
    "    provenance: self-reported",
    "    observation: 0192f3a1-0000-7000-8000-000000000004",
    "  by-source:",
    "    self-reported:",
    `      level: ${String(level)}`,
    "      since: 2026-10-03",
    "---",
  );
}

/** An evidence file whose top block isn't valid YAML. */
export const BROKEN = lines("---", "schema: evidence/1", "title: [unclosed", "---");

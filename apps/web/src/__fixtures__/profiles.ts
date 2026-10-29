// Profiles in memory for the web app's tests, written as Pharoam writes them, and ways to open them.
import { createMemoryConnector, type MemoryConnector } from "@pharoam/core/testing";
import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { renderApp, type RenderedApp } from "./render-app.tsx";

export const PROFILE_ID = "0192f3a1-0000-7000-8000-000000000001";
export const EVIDENCE_ID = "0192f3a1-0000-7000-8000-000000000002";
export const SKILL_ID = "0192f3a1-0000-7000-8000-000000000003";
export const OBSERVATION_ID = "0192f3a1-0000-7000-8000-000000000004";
export const EVIDENCE = "evidence/payments-api--0192f3a1.md";
export const SQL = "skills/sql.md";

export const lines = (...text: string[]): string => `${text.join("\n")}\n`;

export const PHAROAM = lines(
  "---",
  "schema: pharoam/1",
  `id: ${PROFILE_ID}`,
  "created: 2026-10-01T09:00:00Z",
  "---",
);

export const PAYMENTS_API = lines(
  "---",
  "schema: evidence/1",
  `id: ${EVIDENCE_ID}`,
  "created: 2026-10-02T09:00:00Z",
  "updated: 2026-10-02T09:00:00Z",
  "ai: null",
  "kind: project",
  "title: Payments API",
  "organisation: Example Co",
  "links:",
  "  - https://example.com/payments",
  "skills:",
  "  - python",
  "source: manual",
  "client: A field Pharoam doesn't know",
  "---",
  "I built the **refunds** flow.",
);

export const SQL_OBSERVATION = (level: number, cites = false): string =>
  lines(
    `  - id: ${OBSERVATION_ID}`,
    `    level: ${String(level)}`,
    "    provenance: self-reported",
    "    observed_at: 2026-10-03T09:00:00Z",
    ...(cites ? ["    evidence:", `      - ${EVIDENCE_ID}`] : []),
  );

// A skill record for SQL as Pharoam writes it: one self-reported level, then the summary regenerated from it (S9.2).
export function sqlRecord(level: number, cites = false): string {
  return (
    lines("---", "schema: skill-record/1", `id: ${SKILL_ID}`, "created: 2026-10-03T09:00:00Z", "skill: sql", "entries:") +
    SQL_OBSERVATION(level, cites) +
    lines(
      "proficiency:",
      "  shown:",
      `    level: ${String(level)}`,
      "    since: 2026-10-03",
      "    provenance: self-reported",
      `    observation: ${OBSERVATION_ID}`,
      "  by-source:",
      "    self-reported:",
      `      level: ${String(level)}`,
      "      since: 2026-10-03",
      "---",
    )
  );
}

/** A profile with one piece of evidence and the person's own rating of SQL, citing it. */
export function fullProfile(sqlLevel = 2): MemoryConnector {
  return createMemoryConnector({
    "pharoam.md": PHAROAM,
    [EVIDENCE]: PAYMENTS_API,
    [SQL]: sqlRecord(sqlLevel, true),
  });
}

/** A profile with nothing but pharoam.md. */
export function emptyProfile(): MemoryConnector {
  return createMemoryConnector({ "pharoam.md": PHAROAM });
}

/**
 * Renders the app, opens the folder, and follows a link in the sidebar.
 *
 * @param user - The user events.
 * @param memory - The profile's files.
 * @param link - The sidebar link to follow, such as "Skills"; none stays on the profile's home.
 * @returns The rendered app.
 */
export async function openProfile(user: UserEvent, memory: MemoryConnector, link?: string): Promise<RenderedApp> {
  const rendered = renderApp({ name: "my-profile", memory });
  await user.click(await screen.findByRole("button", { name: "Choose a folder" }));
  await screen.findByRole("link", { name: "Profile" });
  if (link !== undefined) await user.click(screen.getByRole("link", { name: link }));
  return rendered;
}

/** The text of the first stored file that contains `marker`, or an empty string. */
export async function fileContaining(memory: MemoryConnector, marker: string): Promise<string> {
  const listed = await memory.connector.list();
  for (const ref of listed.ok ? listed.value : []) {
    const text = (await memory.readOutside(ref.location)) ?? "";
    if (text.includes(marker)) return text;
  }
  return "";
}

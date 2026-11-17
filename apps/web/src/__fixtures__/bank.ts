// The built-in content pack with a small question bank for SQL, for testing diagnostics before the real bank ships.
import { ContentPack, type AssessmentItem } from "@pharoam/core";
import { loadContentPack } from "../content.ts";

/** The text of the right option of every test item; every other option is wrong. */
export const RIGHT = "The right one";

/** The text of a wrong option of every test item. */
export const WRONG = "A wrong one";

// Three SQL items at each level, the right answer in the middle, and one Python item.
const SQL_ITEMS: readonly AssessmentItem[] = [0, 1, 2, 3, 4].flatMap((level) =>
  ["a", "b", "c"].map(
    (part): AssessmentItem => ({
      schema: "assessment-item/1",
      slug: `sql-${String(level)}-${part}`,
      skills: ["sql"] as AssessmentItem["skills"],
      level,
      format: "mcq",
      prompt: `SQL question ${part} at level ${String(level)}?`,
      options: [WRONG, RIGHT, "Another wrong one"],
      answer: 1,
      explanation: `Why ${part} at level ${String(level)} is so.`,
      language: "en",
      origin: { source: "Pharoam content", licence: "CC-BY-SA-4.0" },
      review: { by: "The Pharoam founder", at: "2026-11-17" },
      ai: null,
    }),
  ),
);
const PYTHON: AssessmentItem = {
  schema: "assessment-item/1",
  slug: "python-2-a",
  skills: ["python"] as AssessmentItem["skills"],
  level: 2,
  format: "mcq",
  prompt: "Python question a at level 2?",
  options: [WRONG, RIGHT, "Another wrong one"],
  answer: 1,
  explanation: "Why a at level 2 is so.",
  language: "en",
  origin: { source: "Pharoam content", licence: "CC-BY-SA-4.0" },
  review: { by: "The Pharoam founder", at: "2026-11-17" },
  ai: null,
};
const ITEMS: readonly AssessmentItem[] = [...SQL_ITEMS, PYTHON];

/**
 * Loads the built-in pack with the test question bank added.
 *
 * @returns The pack, checked as the app checks any pack.
 */
export async function packWithBank(): Promise<ContentPack> {
  return packWith(ITEMS);
}

/**
 * Makes a loader for the built-in pack with only some levels of the test question bank.
 *
 * @param levels - The SQL levels the bank has items for.
 * @returns The loader.
 */
export function packWithBankAt(levels: readonly number[]): () => Promise<ContentPack> {
  return () => packWith(ITEMS.filter((item) => item.skills[0] !== "sql" || levels.includes(item.level)));
}

async function packWith(items: readonly AssessmentItem[]): Promise<ContentPack> {
  const pack = await loadContentPack();
  return ContentPack.parse({
    ...pack,
    manifest: { ...pack.manifest, contents: { ...pack.manifest.contents, items: items.length } },
    items,
  });
}

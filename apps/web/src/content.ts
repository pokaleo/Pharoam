/**
 * The content the app is built with: the skill vocabulary, the level scale and the pathways.
 *
 * @packageDocumentation
 */
import { ContentPack } from "@pharoam/core";

/**
 * Loads and checks the built-in content pack.
 *
 * @remarks Loaded on demand, so the start page doesn't wait for the vocabulary. Packs are data, never code, and are
 * validated against their schema like any other (security §5).
 * @returns The vocabulary, level scale and pathways, validated.
 * @throws When the bundled pack doesn't match its schema, which the build prevents, so it means a bug.
 */
export async function loadContentPack(): Promise<ContentPack> {
  const bundled = await import("virtual:pharoam/content-pack");
  return ContentPack.parse(bundled.default);
}

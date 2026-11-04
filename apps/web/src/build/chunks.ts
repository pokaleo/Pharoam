/**
 * How the built app is split into chunks, and the size no chunk may pass.
 *
 * @remarks The libraries go in named chunks that change less often than the app, so a returning browser keeps them
 * cached, and no single file is too large to load quickly. Runs in Node, from the Vite config.
 * @packageDocumentation
 */
import type { Plugin } from "vite";

/** The most a chunk may weigh, in bytes: Vite's own warning size, made a hard limit. */
export const CHUNK_LIMIT = 500 * 1024;

/**
 * The most an AI chunk may weigh, in bytes.
 *
 * @remarks AI code loads only once the person sets up a model, never with the app (MVP S13.1), so it doesn't slow
 * the app down; one provider's code is about 0.5 to 0.7 MB minified (spike S1). Splitting it further would mean
 * splitting chunks by size, which can break the order the app's own libraries start in, so the AI chunks get their
 * own limit instead.
 */
export const AI_CHUNK_LIMIT = 800 * 1024;

// The AI chunks, named by their groups below.
const AI_CHUNK = /(?:^|\/)ai-[a-z]+-[^/]*\.js$/;

/** Each named chunk, and the packages that go in it, matched by name in `node_modules`. */
const GROUPS: readonly (readonly [name: string, packages: RegExp])[] = [
  ["react", /^(?:react|react-dom|scheduler)$/],
  ["tanstack", /^@tanstack\//],
  ["i18n", /^(?:i18next|react-i18next|html-parse-stringify|void-elements)$/],
  ["records", /^(?:zod|yaml|@noble\/hashes)$/],
  [
    "markdown",
    /^(?:react-markdown|rehype-.+|remark-.+|unified|micromark.*|mdast-.+|hast-.+|hastscript|unist-.+|vfile.*|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities.*|devlop|bail|trough|is-plain-obj|ccount|zwitch|html-url-attributes|estree-util-is-identifier-name|style-to-js|style-to-object|inline-style-parser|trim-lines|longest-streak|markdown-table|web-namespaces)$/,
  ],
];

// The AI code, loaded only once a model is set up, one provider at a time (spike S1, `AI_CHUNK_LIMIT`).
const AI_GROUPS: readonly (readonly [name: string, packages: RegExp])[] = [
  ["ai-langchain", /^@langchain\/core$/],
  ["ai-anthropic", /^(?:@langchain\/anthropic|@anthropic-ai\/sdk)$/],
  ["ai-openai", /^(?:@langchain\/openai|openai)$/],
];

// The package a module belongs to, from the last `node_modules/` in its path, with its scope if it has one.
function packageOf(id: string): string | undefined {
  const at = id.lastIndexOf("node_modules/");
  if (at === -1) return undefined;
  const [first = "", second = ""] = id.slice(at + "node_modules/".length).split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}

/**
 * The chunk a module goes in, for the libraries the app loads with it.
 *
 * @param id - The module's path.
 * @returns The chunk's name for a library in one of the groups, or `null` to leave it where Vite puts it.
 */
export function chunkGroup(id: string): string | null {
  return groupOf(GROUPS, id);
}

/**
 * The chunk an AI library goes in.
 *
 * @remarks Used by a group of its own that takes only these packages, not what they depend on: a group that took
 * their dependencies would take libraries the app shares with them, such as Zod, and the app would then load the AI
 * chunks at start, which the content security policy and MVP S13.1 forbid.
 * @param id - The module's path.
 * @returns The chunk's name for an AI library, or `null` for anything else.
 */
export function aiChunkGroup(id: string): string | null {
  return groupOf(AI_GROUPS, id);
}

// The group a module's package belongs to, if any.
function groupOf(groups: readonly (readonly [name: string, packages: RegExp])[], id: string): string | null {
  const name = packageOf(id);
  if (name === undefined) return null;
  return groups.find(([, packages]) => packages.test(name))?.[0] ?? null;
}

/** The part of a built file the size check reads. */
type BuiltFile = { readonly type: "chunk"; readonly code: string } | { readonly type: "asset" };

/**
 * The chunks heavier than {@link CHUNK_LIMIT}, or {@link AI_CHUNK_LIMIT} for an AI chunk.
 *
 * @param bundle - The built files, by name.
 * @returns Each oversized chunk's name and size in bytes; empty when all fit.
 */
export function oversizedChunks(bundle: Readonly<Record<string, BuiltFile>>): string[] {
  const encoder = new TextEncoder();
  return Object.entries(bundle).flatMap(([name, file]) => {
    if (file.type !== "chunk") return [];
    const bytes = encoder.encode(file.code).length;
    const limit = AI_CHUNK.test(name) ? AI_CHUNK_LIMIT : CHUNK_LIMIT;
    return bytes > limit ? [`${name} (${String(bytes)} bytes)`] : [];
  });
}

/**
 * A Vite plugin that fails the build when a chunk passes its limit.
 *
 * @remarks Vite only warns; this keeps the split from quietly growing back.
 * @returns The plugin, applied to builds only.
 */
export function chunkSizeLimit(): Plugin {
  return {
    name: "pharoam-chunk-size-limit",
    apply: "build",
    generateBundle(_options, bundle) {
      const oversized = oversizedChunks(bundle);
      if (oversized.length > 0) this.error(`Chunks over their size limit: ${oversized.join(", ")}`);
    },
  };
}

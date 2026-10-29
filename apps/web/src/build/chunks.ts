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

// The package a module belongs to, from the last `node_modules/` in its path, with its scope if it has one.
function packageOf(id: string): string | undefined {
  const at = id.lastIndexOf("node_modules/");
  if (at === -1) return undefined;
  const [first = "", second = ""] = id.slice(at + "node_modules/".length).split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}

/**
 * The chunk a module goes in.
 *
 * @param id - The module's path.
 * @returns The chunk's name for a library in one of the groups, or `null` to leave it where Vite puts it.
 */
export function chunkGroup(id: string): string | null {
  const name = packageOf(id);
  if (name === undefined) return null;
  return GROUPS.find(([, packages]) => packages.test(name))?.[0] ?? null;
}

/** The part of a built file the size check reads. */
type BuiltFile = { readonly type: "chunk"; readonly code: string } | { readonly type: "asset" };

/**
 * The chunks heavier than {@link CHUNK_LIMIT}.
 *
 * @param bundle - The built files, by name.
 * @returns Each oversized chunk's name and size in bytes; empty when all fit.
 */
export function oversizedChunks(bundle: Readonly<Record<string, BuiltFile>>): string[] {
  const encoder = new TextEncoder();
  return Object.entries(bundle).flatMap(([name, file]) => {
    if (file.type !== "chunk") return [];
    const bytes = encoder.encode(file.code).length;
    return bytes > CHUNK_LIMIT ? [`${name} (${String(bytes)} bytes)`] : [];
  });
}

/**
 * A Vite plugin that fails the build when a chunk passes {@link CHUNK_LIMIT}.
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
      if (oversized.length > 0)
        this.error(`Chunks over ${String(CHUNK_LIMIT)} bytes: ${oversized.join(", ")}`);
    },
  };
}

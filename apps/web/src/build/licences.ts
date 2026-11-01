/**
 * The third-party licences of everything the built app contains, written beside it as one plain-text file.
 *
 * @remarks The libraries' MIT, ISC and similar licences ask for their notice in every copy, and minifying strips the
 * notices from the bundled code, so the build writes them out instead: each bundled package's licence, the licence of
 * each typeface the build ships, and the notices of the skill vocabulary and pathways compiled into the app
 * (LICENSING.md, THIRD_PARTY_NOTICES.md). Pharoam's own code is left out: it is AGPL, in the source. Runs in Node,
 * from the Vite config.
 * @packageDocumentation
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { LICENCES_FILE } from "./licences-file.ts";

/** One licence or notice in the file: what it covers, and its text. */
export interface LicenceNotice {
  /** What it covers, such as `react 19.3.1 (MIT)`. */
  readonly title: string;
  /** The licence or notice, as its authors wrote it. */
  readonly text: string;
}

/** A part of the file, such as the libraries, with its notices. */
export interface LicencePart {
  /** The part's heading. */
  readonly heading: string;
  /** Its notices, in order. */
  readonly notices: readonly LicenceNotice[];
}

/** What a library's folder says about it. */
export interface PackageReader {
  /** The package's name, version and declared licence, or `undefined` when its folder has no `package.json`. */
  readonly packageJson: (
    dir: string,
  ) => { readonly name: string; readonly version: string; readonly license?: string } | undefined;
  /** The text of its licence file, or `undefined` when it has none. */
  readonly licenceText: (dir: string) => string | undefined;
}

/** The files a licence may be kept in, as packages and typefaces name them. */
const LICENCE_FILE = /^(?:licen[cs]e|copying|ofl)(?:[.-].*)?$/i;

/**
 * The folder of the package a bundled module belongs to.
 *
 * @param moduleId - The module's path, as the bundler names it.
 * @returns The package's folder, from the last `node_modules/` in the path and with its scope if it has one; or
 * `undefined` for the app's own modules, the workspace packages and virtual modules, which are Pharoam's code.
 */
export function packageRoot(moduleId: string): string | undefined {
  const marker = "/node_modules/";
  const at = moduleId.lastIndexOf(marker);
  if (moduleId.startsWith("\0") || at === -1) return undefined;
  const [first = "", second = ""] = moduleId.slice(at + marker.length).split("/");
  const name = first.startsWith("@") ? `${first}/${second}` : first;
  return moduleId.slice(0, at + marker.length) + name;
}

/**
 * The licence of each package with modules in the bundle.
 *
 * @param moduleIds - Every module in the bundle.
 * @param read - Reads a package's folder.
 * @returns One notice per package and version, sorted by name; a package with no licence file says what licence it
 * declares instead.
 */
export function bundledLibraries(moduleIds: Iterable<string>, read: PackageReader): LicenceNotice[] {
  const notices = new Map<string, LicenceNotice>();
  for (const id of moduleIds) {
    const dir = packageRoot(id);
    const data = dir === undefined ? undefined : read.packageJson(dir);
    if (dir === undefined || data === undefined) continue;
    const declared = data.license?.trim() ?? "no licence";
    const key = `${data.name}@${data.version}`;
    if (notices.has(key)) continue;
    notices.set(key, {
      title: `${data.name} ${data.version} (${declared})`,
      text:
        read.licenceText(dir) ?? `The package has no licence file. Its package.json declares: ${declared}.`,
    });
  }
  return [...notices.values()].sort((a, b) => a.title.localeCompare(b.title, "en"));
}

/**
 * The licence of each typeface whose files the build ships.
 *
 * @param files - The source paths of the files the build ships.
 * @param fontsDir - The folder that holds one folder per typeface, each with its licence.
 * @param licenceText - Reads the licence in a typeface's folder.
 * @returns One notice per typeface, titled by its folder, in the order first shipped.
 */
export function shippedTypefaces(
  files: Iterable<string>,
  fontsDir: string,
  licenceText: (dir: string) => string | undefined,
): LicenceNotice[] {
  const notices = new Map<string, LicenceNotice>();
  for (const file of files) {
    const relative = path.relative(fontsDir, file);
    const [family] = relative.split(path.sep);
    if (family === undefined || relative.startsWith("..") || notices.has(family)) continue;
    const text = licenceText(path.join(fontsDir, family));
    if (text !== undefined) notices.set(family, { title: family, text });
  }
  return [...notices.values()];
}

/**
 * The licences file's text.
 *
 * @param parts - Its parts, in order; a part with no notices is left out.
 * @returns Plain text: a title and a note, then each part under its heading and each notice under its title.
 */
export function licenceDocument(parts: readonly LicencePart[]): string {
  const intro = [
    "Third-party licences",
    "",
    "Pharoam's own code is licensed under AGPL-3.0-only, and its source is public. The built app also contains the",
    "work of others, listed here with their licences. The Pharoam name and brand are not licensed (TRADEMARKS.md).",
  ].join("\n");
  const body = parts
    .filter((part) => part.notices.length > 0)
    .map(
      (part) =>
        `== ${part.heading} ==\n\n${part.notices.map((notice) => `-- ${notice.title} --\n\n${notice.text.trim()}\n`).join("\n")}`,
    );
  return [intro, ...body].join("\n\n");
}

// The text of the licence file in a folder, if it has one.
function licenceIn(dir: string): string | undefined {
  const file = readdirSync(dir).find((name) => LICENCE_FILE.test(name));
  return file === undefined ? undefined : readFileSync(path.join(dir, file), "utf8");
}

// A package's name, version and declared licence, from its package.json.
function packageJsonIn(dir: string): ReturnType<PackageReader["packageJson"]> {
  try {
    const data = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
      name?: unknown;
      version?: unknown;
      license?: unknown;
    };
    if (typeof data.name !== "string" || typeof data.version !== "string") return undefined;
    return {
      name: data.name,
      version: data.version,
      ...(typeof data.license === "string" ? { license: data.license } : {}),
    };
  } catch {
    return undefined;
  }
}

/** What the licences plugin needs to know about the repository. */
export interface LicenceOptions {
  /** The folder of typefaces, each in its own folder with its licence. */
  readonly fontsDir: string;
  /** Material compiled into the app under its own licence, such as the skill vocabulary, with its notice files. */
  readonly compiled: readonly { readonly title: string; readonly files: readonly string[] }[];
}

/**
 * A Vite plugin that writes {@link LICENCES_FILE} beside the built app.
 *
 * @remarks The development server answers the same address with a note, since the list is only known once built.
 * @param options - Where the typefaces and the compiled material's notices are.
 * @returns The plugin.
 */
export function thirdPartyLicences(options: LicenceOptions): Plugin {
  return {
    name: "pharoam-third-party-licences",
    configureServer(server) {
      server.middlewares.use(`/${LICENCES_FILE}`, (_request, response) => {
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end("Third-party licences\n\nThis list is written when the app is built (pnpm build).\n");
      });
    },
    generateBundle(_options, bundle) {
      const files = Object.values(bundle);
      const moduleIds = files.flatMap((file) => (file.type === "chunk" ? file.moduleIds : []));
      const shipped = files.flatMap((file) => (file.type === "asset" ? file.originalFileNames : []));
      const parts: LicencePart[] = [
        {
          heading: "Libraries",
          notices: bundledLibraries(moduleIds, { packageJson: packageJsonIn, licenceText: licenceIn }),
        },
        { heading: "Typefaces", notices: shippedTypefaces(shipped, options.fontsDir, licenceIn) },
        {
          heading: "Skill vocabulary and pathways",
          notices: options.compiled.map(({ title, files: notices }) => ({
            title,
            text: notices.map((file) => readFileSync(file, "utf8").trim()).join("\n\n"),
          })),
        },
      ];
      this.emitFile({ type: "asset", fileName: LICENCES_FILE, source: licenceDocument(parts) });
    },
  };
}

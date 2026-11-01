import { describe, expect, it } from "vitest";
import { bundledLibraries, licenceDocument, packageRoot, shippedTypefaces } from "./licences.ts";

describe("packageRoot", () => {
  it("finds a module's package from the last node_modules in its path, with its scope", () => {
    expect(packageRoot("/r/node_modules/.pnpm/react@19.3.1/node_modules/react/cjs/react.js")).toBe(
      "/r/node_modules/.pnpm/react@19.3.1/node_modules/react",
    );
    expect(packageRoot("/r/node_modules/@tanstack/react-query/build/index.js")).toBe(
      "/r/node_modules/@tanstack/react-query",
    );
  });

  it("leaves out the app's own modules and the workspace packages, which are Pharoam's AGPL code", () => {
    expect(packageRoot("/r/apps/web/src/app.tsx")).toBeUndefined();
    expect(packageRoot("/r/packages/core/src/index.ts")).toBeUndefined();
    expect(packageRoot("\0virtual:pharoam/content-pack")).toBeUndefined();
  });
});

describe("bundledLibraries", () => {
  const packages: Record<string, { name: string; version: string; license?: string }> = {
    "/r/node_modules/react": { name: "react", version: "19.3.1", license: "MIT" },
    "/r/node_modules/zod": { name: "zod", version: "4.6.7", license: "MIT" },
  };
  const read = {
    packageJson: (dir: string) => packages[dir],
    licenceText: (dir: string) => (dir.endsWith("react") ? "MIT License\n\nCopyright Meta" : undefined),
  };

  it("lists each bundled package once, by name and version, with its licence text, sorted by name", () => {
    const libraries = bundledLibraries(
      ["/r/node_modules/zod/index.js", "/r/node_modules/react/index.js", "/r/node_modules/react/jsx.js"],
      read,
    );
    expect(libraries.map((library) => library.title)).toEqual(["react 19.3.1 (MIT)", "zod 4.6.7 (MIT)"]);
    expect(libraries[0]?.text).toBe("MIT License\n\nCopyright Meta");
  });

  it("says so when a package ships no licence file, naming the licence it declares", () => {
    const [zod] = bundledLibraries(["/r/node_modules/zod/index.js"], read);
    expect(zod?.text).toBe("The package has no licence file. Its package.json declares: MIT.");
  });
});

describe("shippedTypefaces", () => {
  it("gives the licence of each typeface whose files the build ships, once per typeface", () => {
    const typefaces = shippedTypefaces(
      [
        "/r/fonts/figtree/figtree-latin.woff2",
        "/r/fonts/figtree/figtree-latin-ext.woff2",
        "/r/brand/seal.svg",
      ],
      "/r/fonts",
      (dir) => (dir === "/r/fonts/figtree" ? "SIL Open Font License 1.1" : undefined),
    );
    expect(typefaces).toEqual([{ title: "figtree", text: "SIL Open Font License 1.1" }]);
  });
});

describe("licenceDocument", () => {
  it("puts each part under its heading, and each notice under its title, in plain text", () => {
    const text = licenceDocument([
      { heading: "Libraries", notices: [{ title: "react 19.3.1 (MIT)", text: "MIT License" }] },
      { heading: "Typefaces", notices: [] },
    ]);
    expect(text).toMatch(/^Third-party licences\n/);
    expect(text).toContain("== Libraries ==\n\n-- react 19.3.1 (MIT) --\n\nMIT License\n");
    // A part with nothing in it is left out.
    expect(text).not.toContain("Typefaces");
  });
});

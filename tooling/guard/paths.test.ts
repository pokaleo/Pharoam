import { describe, expect, it } from "vitest";
import { canonicalPath } from "./paths.ts";

// A fake file system: existing paths and the symlinks among them.
const realpathIn = (existing: Record<string, string>) => (path: string) => existing[path];

describe("resolving symlinks in a path that may not exist yet", () => {
  const realpath = realpathIn({
    "/": "/",
    "/repo": "/repo",
    "/repo/link": "/repo/tooling/guard",
    "/repo/tooling": "/repo/tooling",
    "/repo/tooling/guard": "/repo/tooling/guard",
    "/tmp": "/private/tmp",
  });

  it("resolves an existing path", () => {
    expect(canonicalPath("/repo/link", realpath)).toBe("/repo/tooling/guard");
  });

  it("resolves the nearest existing folder of a new file", () => {
    expect(canonicalPath("/repo/link/new.ts", realpath)).toBe("/repo/tooling/guard/new.ts");
    expect(canonicalPath("/tmp/a/b.txt", realpath)).toBe("/private/tmp/a/b.txt");
  });

  it("normalises . and .. first", () => {
    expect(canonicalPath("/repo/x/../link/./a.ts", realpath)).toBe("/repo/tooling/guard/a.ts");
  });
});

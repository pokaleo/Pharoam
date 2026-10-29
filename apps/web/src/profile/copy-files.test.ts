import { describe, expect, it, vi } from "vitest";
import { copyName, downloadCopy, filesFromFolder } from "./copy-files.ts";

function picked(path: string, text: string): File {
  const file = new File([text], path.split("/").at(-1) ?? path);
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

describe("filesFromFolder", () => {
  it("reads each file with its path inside the folder the person picked", async () => {
    const files = await filesFromFolder([picked("copy/pharoam.md", "a"), picked("copy/evidence/b.md", "b")]);
    expect(files.map((file) => [file.path, new TextDecoder().decode(file.bytes)])).toEqual([
      ["pharoam.md", "a"],
      ["evidence/b.md", "b"],
    ]);
  });

  it("leaves out hidden files and folders, such as an editor's settings", async () => {
    const files = await filesFromFolder([
      picked("copy/.obsidian/app.json", "{}"),
      picked("copy/.DS_Store", ""),
      picked("copy/pharoam.md", "a"),
    ]);
    expect(files.map((file) => file.path)).toEqual(["pharoam.md"]);
  });
});

describe("copyName", () => {
  it("names the copy by the day it was made", () => {
    expect(copyName(new Date(2026, 9, 29, 23, 59))).toBe("pharoam-2026-10-29.zip");
  });
});

describe("downloadCopy", () => {
  it("offers the zip as a download, and lets the browser forget it afterwards", () => {
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: () => "blob:copy", revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadCopy(
      [{ path: "pharoam.md", bytes: new TextEncoder().encode("a") }],
      new Date(2026, 9, 29),
      document,
    );

    expect(click.mock.contexts[0]).toMatchObject({ href: "blob:copy", download: "pharoam-2026-10-29.zip" });
    expect(revoke).toHaveBeenCalledWith("blob:copy");
    expect(document.querySelector("a[download]")).toBeNull();
    click.mockRestore();
  });
});

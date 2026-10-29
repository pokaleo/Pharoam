import { describe, expect, it } from "vitest";
import { supportsFolderAccess } from "./browser-support.ts";

describe("supportsFolderAccess (MVP §3)", () => {
  it("is true where the browser can open a folder the person chooses", () => {
    expect(supportsFolderAccess({ showDirectoryPicker: () => Promise.resolve() })).toBe(true);
  });

  it("is false in browsers without the File System Access API, such as Firefox and Safari", () => {
    expect(supportsFolderAccess({})).toBe(false);
  });

  it("is false when the name exists but isn't a function", () => {
    expect(supportsFolderAccess({ showDirectoryPicker: undefined })).toBe(false);
  });
});

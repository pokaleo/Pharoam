import { describe, expect, it } from "vitest";
import { storageKind } from "./browser-support.ts";

const opfs = { storage: { getDirectory: () => Promise.resolve() } };

describe("storageKind (MVP §3, ADR-0020)", () => {
  it("is a folder where the browser can open one the person chooses, as Chromium browsers can", () => {
    expect(storageKind({ showDirectoryPicker: () => Promise.resolve(), navigator: opfs })).toBe("folder");
  });

  it("is the browser's own storage where it can't, as in Safari and Firefox", () => {
    expect(storageKind({ navigator: opfs })).toBe("browser");
    expect(storageKind({ showDirectoryPicker: undefined, navigator: opfs })).toBe("browser");
  });

  it("is nothing in browsers with neither, which see the not-supported page", () => {
    expect(storageKind({})).toBeUndefined();
    expect(storageKind({ navigator: {} })).toBeUndefined();
    expect(storageKind({ navigator: { storage: {} } })).toBeUndefined();
  });
});

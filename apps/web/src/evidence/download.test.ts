import { describe, expect, it } from "vitest";
import { fileSize } from "./download.ts";

describe("a file's size as people read it", () => {
  it("is in bytes, kB or MB, whichever reads best", () => {
    expect(fileSize(1, "en")).toBe("1 byte");
    expect(fileSize(14, "en")).toBe("14 bytes");
    expect(fileSize(2048, "en")).toBe("2 kB");
    expect(fileSize(1.4 * 1024 * 1024, "en")).toBe("1.4 MB");
  });
});

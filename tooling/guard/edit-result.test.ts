import { describe, expect, it } from "vitest";
import { resultingContent } from "./edit-result.ts";

describe("resulting content of an edit tool call", () => {
  it("uses Write content as-is", () => {
    expect(resultingContent("Write", { file_path: "a.ts", content: "new" }, "old")).toBe("new");
  });

  it("applies an Edit to the first occurrence", () => {
    expect(resultingContent("Edit", { file_path: "a.ts", old_string: "a", new_string: "b" }, "a a")).toBe(
      "b a",
    );
  });

  it("applies an Edit with replace_all", () => {
    expect(
      resultingContent(
        "Edit",
        { file_path: "a.ts", old_string: "a", new_string: "b", replace_all: true },
        "a a",
      ),
    ).toBe("b b");
  });

  it("applies MultiEdit edits in order", () => {
    const input = {
      file_path: "a.ts",
      edits: [
        { old_string: "one", new_string: "two" },
        { old_string: "two", new_string: "three" },
      ],
    };
    expect(resultingContent("MultiEdit", input, "one")).toBe("three");
  });

  it("treats a missing file as empty", () => {
    expect(resultingContent("Edit", { file_path: "a.ts", old_string: "", new_string: "x" }, undefined)).toBe(
      "x",
    );
  });
});

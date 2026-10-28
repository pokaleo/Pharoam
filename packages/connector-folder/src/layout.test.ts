import { createRecordFile } from "@pharoam/core";
import { describe, expect, it } from "vitest";
import { recordPath } from "./layout.ts";

const ID = "0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d";
const path = (top: Readonly<Record<string, unknown>>): string =>
  recordPath(createRecordFile({ id: ID, ...top }, ""));

describe("folder layout (data model §8)", () => {
  it("keeps the central record at the top", () => {
    expect(path({ schema: "pharoam/1" })).toBe("pharoam.md");
  });

  it("names skill files by skill slug", () => {
    expect(path({ schema: "skill-record/1", skill: "python" })).toBe("skills/python.md");
    expect(path({ schema: "skill-record/1", skill: "custom-kdb-q" })).toBe("skills/custom-kdb-q.md");
  });

  it("names a gap by its pathway, without the pack version", () => {
    expect(path({ schema: "gap/1", pathway: "pharoam-core@0.1.0:ml-engineer" })).toBe("gaps/ml-engineer.md");
  });

  it("names evidence by title, organisation and the random end of its ID", () => {
    expect(path({ schema: "evidence/1", title: "Backend Engineer", organisation: "Example Co" })).toBe(
      "evidence/backend-engineer-example-co--6a7b8c9d.md",
    );
  });

  it("gives records made in the same minute different names", () => {
    // UUIDv7s made close together share their first digits, which are a timestamp.
    const first = recordPath(createRecordFile({ schema: "evidence/1", id: ID, title: "Notes" }, ""));
    const second = recordPath(
      createRecordFile(
        { schema: "evidence/1", id: "0192f3a1-7c2e-7b44-9a1d-000000000001", title: "Notes" },
        "",
      ),
    );
    expect(first).not.toBe(second);
  });

  it("makes titles safe and readable as file names", () => {
    expect(path({ schema: "evidence/1", title: "Développeuse — C++ & Rust!" })).toBe(
      "evidence/developpeuse-c-rust--6a7b8c9d.md",
    );
    expect(path({ schema: "evidence/1", title: "../../etc/passwd" })).toBe(
      "evidence/etc-passwd--6a7b8c9d.md",
    );
    expect(path({ schema: "evidence/1", title: "x".repeat(200) })).toBe(
      `evidence/${"x".repeat(60)}--6a7b8c9d.md`,
    );
  });

  it("falls back to the record type for a title with no Latin letters or digits", () => {
    expect(path({ schema: "evidence/1", title: "后端工程师" })).toBe("evidence/evidence--6a7b8c9d.md");
  });

  it("puts other record types in a folder named after the type", () => {
    expect(path({ schema: "aspiration/1", title: "Lead a team" })).toBe(
      "aspirations/lead-a-team--6a7b8c9d.md",
    );
  });

  it("never builds a path from unsafe field values", () => {
    expect(path({ schema: "skill-record/1", skill: "../pharoam" })).toBe("skills/pharoam.md");
    expect(path({ schema: "gap/1", pathway: "x@1:../../a" })).toBe("gaps/a.md");
  });
});

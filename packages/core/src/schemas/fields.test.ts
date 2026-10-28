import { describe, expect, it } from "vitest";
import {
  AiProvenance,
  CalendarDateField,
  HttpUrlField,
  IntegrityField,
  InventorySkillSlugField,
  LanguageTagField,
  LevelField,
  PartialDateField,
  ProfileRecordIdField,
  SkillSlugField,
  SpdxIdField,
  TextField,
  TimestampField,
} from "./fields.ts";

describe("record fields", () => {
  it.each([0, 1, 2, 3, 4])("accepts level %s", (level) => {
    expect(LevelField.safeParse(level).success).toBe(true);
  });

  it.each([-1, 5, 2.5, "2", null])("rejects level %j", (level) => {
    expect(LevelField.safeParse(level).success).toBe(false);
  });

  it.each(["2026-10-24T14:02:11Z", "2026-10-24T14:02:11.250Z", "2026-10-24T15:02:11+01:00"])(
    "accepts the timestamp %s",
    (value) => {
      expect(TimestampField.safeParse(value).success).toBe(true);
    },
  );

  it.each(["2026-10-24", "2026-10-24 14:02:11", "2026-02-30T10:00:00Z", "yesterday"])(
    "rejects the timestamp %s",
    (value) => {
      expect(TimestampField.safeParse(value).success).toBe(false);
    },
  );

  it("accepts a calendar date and rejects an impossible one", () => {
    expect(CalendarDateField.safeParse("2026-10-24").success).toBe(true);
    expect(CalendarDateField.safeParse("2026-02-30").success).toBe(false);
  });

  it.each(["2024", "2024-09", "2024-09-30", "2024-02-29"])("accepts the partial date %s", (value) => {
    expect(PartialDateField.safeParse(value).success).toBe(true);
  });

  it.each(["24", "2024-13", "2024-9", "2023-02-29", "2024-09-31", "Sept 2024"])(
    "rejects the partial date %s",
    (value) => {
      expect(PartialDateField.safeParse(value).success).toBe(false);
    },
  );

  it.each(["https://example.com/a?b=c", "http://localhost:8080/"])("accepts the link %s", (value) => {
    expect(HttpUrlField.safeParse(value).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "example.com", "data:text/html,hi"])(
    "rejects the link %s",
    (value) => {
      expect(HttpUrlField.safeParse(value).success).toBe(false);
    },
  );

  it("brands IDs and slugs after checking them", () => {
    expect(ProfileRecordIdField.safeParse("0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d").success).toBe(true);
    expect(ProfileRecordIdField.safeParse("0192F3A1-7C2E-7B44-9A1D-3E5F6A7B8C9D").success).toBe(false);
    expect(SkillSlugField.safeParse("custom-kdb-q").success).toBe(true);
    expect(SkillSlugField.safeParse("C++").success).toBe(false);
  });

  it("keeps custom- slugs out of the inventory (MVP S8.3)", () => {
    expect(InventorySkillSlugField.safeParse("python").success).toBe(true);
    expect(InventorySkillSlugField.safeParse("custom-kdb-q").success).toBe(false);
  });

  it.each(["en", "en-GB", "zh-Hant-TW"])("accepts the language tag %s", (value) => {
    expect(LanguageTagField.safeParse(value).success).toBe(true);
  });

  it.each(["EN", "english", "en_GB"])("rejects the language tag %s", (value) => {
    expect(LanguageTagField.safeParse(value).success).toBe(false);
  });

  it("names licences by SPDX identifier", () => {
    expect(SpdxIdField.safeParse("CC-BY-SA-4.0").success).toBe(true);
    expect(SpdxIdField.safeParse("CC BY-SA 4.0").success).toBe(false);
  });

  it("accepts an integrity fingerprint under any rule name", () => {
    expect(IntegrityField.safeParse(`sha256-c1:${"0".repeat(64)}`).success).toBe(true);
    expect(IntegrityField.safeParse(`sha256-c2:${"f".repeat(64)}`).success).toBe(true);
    expect(IntegrityField.safeParse(`sha256-c1:${"F".repeat(64)}`).success).toBe(false);
    expect(IntegrityField.safeParse("sha256-c1:abc").success).toBe(false);
  });

  it("reads text that YAML wrote as a number as text", () => {
    expect(TextField.parse(1984)).toBe("1984");
    expect(TextField.parse("2:1")).toBe("2:1");
    expect(TextField.safeParse("   ").success).toBe(false);
  });

  it("requires an AI block's task to name a registered task and version", () => {
    const block = {
      task: "normalise-evidence@1",
      model: "anthropic/claude-sonnet-5-5",
      at: "2026-10-24T14:02:11Z",
    };
    expect(AiProvenance.safeParse(block).success).toBe(true);
    expect(AiProvenance.safeParse({ ...block, task: "normalise-evidence" }).success).toBe(false);
    expect(AiProvenance.safeParse({ ...block, model: "" }).success).toBe(false);
  });
});

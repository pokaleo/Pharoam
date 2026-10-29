import { describe, expect, it } from "vitest";
import { createI18n } from "./i18n.ts";

describe("createI18n (hard rule 12, PRD N9)", () => {
  it("is ready in English as soon as it returns", () => {
    const i18n = createI18n();
    expect(i18n.language).toBe("en");
    expect(i18n.t("app.name")).toBe("Pharoam");
    expect(i18n.t("app.locale")).toBe("en-GB");
  });

  it("chooses the plural form by count, including none", () => {
    const { t } = createI18n();
    expect(t("evidence.lead", { count: 0 })).toMatch(/^Records of things you did/);
    expect(t("evidence.lead", { count: 1 })).toMatch(/^1 record of something you did/);
    expect(t("evidence.lead", { count: 3 })).toMatch(/^3 records of things you did/);
  });

  it("leaves text as given, since React escapes it when rendering", () => {
    const { t } = createI18n();
    expect(t("evidence.deleted", { title: "<b>Payments</b>" })).toBe(
      "<b>Payments</b> was deleted from your folder.",
    );
  });

  it("gives each app its own instance, so a language change in one never reaches another", async () => {
    const one = createI18n();
    const two = createI18n();
    await one.changeLanguage("de");
    expect(two.language).toBe("en");
  });
});

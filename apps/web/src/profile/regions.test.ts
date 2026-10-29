import { describe, expect, it } from "vitest";
import { REGION_CODES, regionOptions } from "./regions.ts";

describe("regionOptions (MVP S1.2)", () => {
  it("offers every ISO 3166-1 country, by code", () => {
    expect(REGION_CODES).toHaveLength(249);
    expect(new Set(REGION_CODES).size).toBe(249);
    expect(REGION_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });

  it("names each country in the person's language, sorted by name", () => {
    const options = regionOptions("en-GB");
    expect(options.find((o) => o.code === "GB")?.name).toBe("United Kingdom");
    const names = options.map((o) => o.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("en-GB").compare));
    expect(regionOptions("de").find((o) => o.code === "DE")?.name).toBe("Deutschland");
  });
});

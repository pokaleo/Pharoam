import { expect, test } from "./fixtures.ts";
import { PHAROAM } from "./files.ts";

test("S3: edits the person's fields and brings the overview up to date, leaving their own words as written", async ({
  app,
  page,
}) => {
  await app.start();
  await app.put("pharoam.md", PHAROAM);
  await app.choose();
  await page.getByRole("link", { name: "About you" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "About you" })).toBeVisible();
  await app.expectAccessible("about you");
  await page.getByLabel("Headline").fill("Backend developer moving into ML");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved to pharoam.md.")).toBeVisible();
  await page.getByRole("button", { name: "Bring the overview up to date" }).click();
  await expect(page.getByText("The overview in pharoam.md is up to date.")).toBeVisible();

  const text = (await app.read("pharoam.md")) ?? "";
  expect(text).toContain("headline: Backend developer moving into ML");
  expect(text).toMatch(/updated: \d{4}-\d{2}-\d{2}T/);
  expect(text).toContain("# About me\n\nI like small teams.\n\n<!-- pharoam:overview -->\n## Overview");
});

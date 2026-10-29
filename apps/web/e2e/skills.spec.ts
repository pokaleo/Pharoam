import { expect, test } from "./fixtures.ts";
import { PAYMENTS_API, PHAROAM } from "./files.ts";

test("S6–S9: records, corrects and retracts levels, adds the person's own skill, and lists them", async ({
  app,
  page,
}) => {
  await app.start();
  await app.put("pharoam.md", PHAROAM);
  await app.put("evidence/payments-api--0192f3a1.md", PAYMENTS_API);
  await app.choose();
  await page.getByRole("link", { name: "Skills" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Skills" })).toBeVisible();
  await app.expectAccessible("skills, empty");

  await page.getByRole("link", { name: "Record a level" }).click();
  await page.getByLabel("Skill").fill("Python");
  await expect(page.getByText(/Writes clear, idiomatic, tested Python/)).toBeVisible();
  await app.expectAccessible("record a level");
  await page.getByRole("radio", { name: /^Proficient/ }).check();
  await page.getByRole("checkbox", { name: "Payments API" }).check();
  await page.getByRole("button", { name: "Record my level" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Python" })).toBeVisible();
  await page.getByRole("button", { name: /^Correct Proficient/ }).click();
  await page.getByRole("radio", { name: /^Working/ }).check();
  await app.expectAccessible("correct a level");
  await page.getByRole("button", { name: "Save the correction" }).click();
  await expect(page.locator("[data-shown-level]")).toContainText("Working");
  await expect(page.getByText("Corrected")).toBeVisible();
  await app.expectAccessible("skill page with history");

  await page.getByRole("button", { name: /^Retract Working/ }).click();
  await app.expectAccessible("retract a level");
  await page.getByRole("button", { name: "Retract it" }).click();
  await expect(page.getByText("No level counts for this skill now.")).toBeVisible();
  const python = (await app.read("skills/python.md")) ?? "";
  expect(python).toMatch(/supersedes: [0-9a-f-]{36}/);
  expect(python).toMatch(/decision: retract/);

  await page.getByRole("link", { name: "Skills" }).click();
  await page.getByRole("link", { name: "Add your own skill" }).click();
  await app.expectAccessible("add your own skill");
  await page.getByLabel("Name").fill("Kdb+");
  await page.getByRole("button", { name: "Add the skill" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kdb+" })).toBeVisible();
  await page.getByRole("link", { name: "Record a level" }).click();
  await page.getByRole("radio", { name: /^Beginner/ }).check();
  await page.getByRole("button", { name: "Record my level" }).click();
  await expect(page.locator("[data-shown-level]")).toContainText("Beginner");

  await page.getByRole("link", { name: "Skills" }).click();
  await expect(page.getByRole("row", { name: /Kdb\+/ })).toContainText("Your own skill");
  await page.getByLabel("Search your skills").fill("pyth");
  await expect(page.getByRole("row")).toHaveCount(2);
  await app.expectAccessible("skills overview");
});

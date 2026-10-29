import { expect, test } from "./fixtures.ts";
import { PHAROAM } from "./files.ts";

test("S4, S5: records evidence after a preview, renders it safely, edits it and deletes it", async ({
  app,
  page,
}) => {
  await app.start();
  await app.put("pharoam.md", PHAROAM);
  await app.choose();
  await page.getByRole("link", { name: "Evidence" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Evidence" })).toBeVisible();
  await app.expectAccessible("evidence list, empty");

  await page.getByRole("link", { name: "Add evidence" }).click();
  await page.getByRole("radio", { name: "Job" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
  await app.expectAccessible("evidence form, with errors");

  await page.getByLabel("Title").fill("Backend engineer");
  await page.getByLabel(/Organisation/).fill("Example Co");
  await page.getByLabel(/Started/).fill("2023-01");
  await page.getByLabel(/Links/).fill("https://example.com/team");
  await page.getByLabel("Find a skill").fill("Python");
  await page.getByRole("button", { name: "Add skill" }).click();
  await page
    .getByLabel(/What you did/)
    .fill(
      "Ran the **billing** service. <img src=x onerror=alert(1)> ![chart](https://example.com/chart.png)",
    );
  await page.getByRole("button", { name: "Continue" }).click();

  const preview = page.getByRole("region", { name: "The file as it will be stored" });
  await expect(preview).toBeVisible();
  await app.expectAccessible("evidence preview");
  const previewed = await preview.textContent();
  expect(await app.list("evidence")).toEqual([]);

  await page.getByRole("button", { name: "Save evidence" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Backend engineer" })).toBeVisible();
  const [file = ""] = await app.list("evidence");
  expect(file).toMatch(/^backend-engineer-example-co--[0-9a-f]{8}\.md$/);
  expect(await app.read(`evidence/${file}`)).toBe(previewed);
  await expect(page.getByRole("link", { name: "https://example.com/team" })).toBeVisible();
  await expect(page.getByText("billing", { exact: true })).toHaveJSProperty("tagName", "STRONG");
  await expect(page.getByText("Image not loaded: chart")).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  await app.expectAccessible("evidence page");

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Title").fill("Senior backend engineer");
  await app.expectAccessible("evidence edit");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Senior backend engineer" })).toBeVisible();
  expect(await app.read(`evidence/${file}`)).toContain("title: Senior backend engineer");

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog", { name: "Delete Senior backend engineer?" })).toBeVisible();
  await app.expectAccessible("evidence delete confirmation");
  await page.getByRole("button", { name: "Delete it" }).click();
  await expect(page.getByText("Senior backend engineer was deleted from your folder.")).toBeVisible();
  expect(await app.list("evidence")).toEqual([]);
});

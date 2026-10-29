import { expect, test } from "./fixtures.ts";
import { BROKEN, PHAROAM } from "./files.ts";

test("S12: lists a broken file and shows both versions of a file edited in the folder, keeping the one chosen", async ({
  app,
  page,
}) => {
  await app.start();
  await app.put("pharoam.md", PHAROAM);
  await app.put("evidence/broken.md", BROKEN);
  await app.choose();
  await expect(page.getByRole("link", { name: "Needs attention 1" })).toBeVisible();

  await page.getByRole("link", { name: "About you" }).click();
  await page.getByLabel("Headline").fill("Written in Pharoam");
  const edited = PHAROAM.replace("Backend developer", "Written in an editor");
  await app.put("pharoam.md", edited);
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("link", { name: "Compare the two versions" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Needs attention" })).toBeVisible();
  const conflict = page.getByRole("region", { name: "Two versions of pharoam.md" });
  await expect(conflict.getByRole("region", { name: "In your folder" })).toContainText(
    "Written in an editor",
  );
  await expect(conflict.getByRole("region", { name: "From Pharoam" })).toContainText("Written in Pharoam");
  await expect(page.getByRole("listitem", { name: "evidence/broken.md" })).toContainText("isn't valid YAML");
  await app.expectAccessible("needs attention");
  expect(await app.read("pharoam.md")).toBe(edited);

  await conflict.getByRole("button", { name: "Keep the version in your folder" }).click();
  await expect(conflict).toHaveCount(0);
  expect(await app.read("pharoam.md")).toBe(edited);
  expect(await app.read("evidence/broken.md")).toBe(BROKEN);
});

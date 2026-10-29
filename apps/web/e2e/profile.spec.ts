import { expect, test } from "./fixtures.ts";
import { PHAROAM } from "./files.ts";

test("S1: creates a profile in a folder the person chooses, leaving its other files alone", async ({
  app,
  page,
}) => {
  await app.start();
  await app.expectAccessible("start page");
  await app.put("notes.txt", "my own notes");

  await app.choose();
  await expect(
    page.getByRole("heading", { level: 1, name: "Create your profile in my-profile" }),
  ).toBeVisible();
  await app.expectAccessible("create profile");
  await page.getByLabel("Headline").fill("Backend developer moving into ML");
  await page.getByLabel("What are you doing now?").selectOption("working");
  await page.getByLabel(/In which field/).fill("Fintech");
  await page.getByLabel(/Country/).selectOption("GB");
  await page.getByRole("checkbox", { name: "Machine-learning engineer" }).check();
  await page.getByRole("button", { name: "Create my profile" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Backend developer moving into ML" }),
  ).toBeVisible();
  await app.expectAccessible("profile home");
  const pharoam = await app.read("pharoam.md");
  expect(pharoam).toMatch(/^---\nschema: pharoam\/1\nid: [0-9a-f-]{36}\n/);
  expect(pharoam).toContain("region: GB");
  expect(await app.read("notes.txt")).toBe("my own notes");
  for (const folder of ["skills", "evidence", "gaps"]) expect(await app.list(folder)).toEqual([]);
});

test("S2: offers the folder again after a reload, reads it only when asked, and forgets it on disconnecting", async ({
  app,
  page,
}) => {
  await app.start();
  await app.put("pharoam.md", PHAROAM);
  await app.choose();
  await expect(page.getByRole("heading", { level: 1, name: "Backend developer" })).toBeVisible();

  await page.reload();
  const reopen = page.getByRole("button", { name: "Open my-profile again" });
  await expect(reopen).toBeVisible();
  await reopen.click();
  await expect(page.getByRole("heading", { level: 1, name: "Backend developer" })).toBeVisible();

  await page.getByRole("button", { name: "Disconnect my-profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your skills, in files you own" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Choose a folder" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open my-profile again" })).toHaveCount(0);
});

test("browsers that can't open a folder see the not-supported page (MVP §3)", async ({ app, page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showDirectoryPicker");
  });
  await page.goto("./");

  await expect(
    page.getByRole("heading", { level: 1, name: "This browser isn't supported yet" }),
  ).toBeVisible();
  await app.expectAccessible("not supported");
});

test("an unknown address says so, in the person's language", async ({ app, page }) => {
  await page.goto("./#/nowhere");

  await expect(
    page.getByRole("heading", { level: 1, name: "There's nothing at this address" }),
  ).toBeVisible();
  await app.expectAccessible("not found");
});

test("a pharoam.md that can't be read is never offered for replacement (hard rule 3)", async ({
  app,
  page,
}) => {
  await app.start();
  const broken = "---\nschema: pharoam/1\nid: [broken\n---\n";
  await app.put("pharoam.md", broken);
  await app.choose();

  await expect(
    page.getByRole("heading", { level: 1, name: "pharoam.md in my-profile can't be read" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create my profile" })).toHaveCount(0);
  await app.expectAccessible("unreadable profile");
  expect(await app.read("pharoam.md")).toBe(broken);
});

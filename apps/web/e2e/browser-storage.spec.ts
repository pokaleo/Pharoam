// Run in Safari's WebKit and in Firefox, which can't open a folder, so the profile is kept in the browser (ADR-0020).
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "./fixtures.ts";
import { PAYMENTS_API, PHAROAM } from "./files.ts";

test.use({ picker: false });
// WebKit shares its private file system between test profiles, so these run one after another.
test.describe.configure({ mode: "serial" });

test("keeps a profile in the browser, reopens it, and downloads every file as a .zip", async ({
  app,
  page,
}) => {
  await app.start();
  await expect(
    page.getByText(/keeps your profile in the browser's own storage on this device/),
  ).toBeVisible();
  await app.expectAccessible("start page, browser storage");

  await page.getByRole("button", { name: "Keep my profile in this browser" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Create your profile in this browser" }),
  ).toBeVisible();
  await page.getByLabel("Headline").fill("Backend developer");
  // A native select works under the content security policy, in WebKit too (see fixtures.ts).
  await page.getByLabel(/Country/).selectOption("GB");
  await page.getByRole("button", { name: "Create my profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Backend developer" })).toBeVisible();
  expect(await app.read("pharoam.md")).toContain("headline: Backend developer");
  expect(await app.read("pharoam.md")).toContain("region: GB");

  const copy = page.getByRole("region", { name: "Keep a copy somewhere safe" });
  await expect(copy).toBeVisible();
  await app.expectAccessible("profile home, browser storage");
  const downloading = page.waitForEvent("download");
  await copy.getByRole("button", { name: "Download a copy (.zip)" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^pharoam-\d{4}-\d{2}-\d{2}\.zip$/);
  const zip = await readFile(await download.path());
  expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(zip.toString("utf8")).toContain("headline: Backend developer");

  await page.reload();
  await page.getByRole("button", { name: "Open my profile again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Backend developer" })).toBeVisible();
  await page.getByRole("button", { name: "Close the profile in this browser" }).click();
  await expect(page.getByRole("button", { name: "Open my profile again" })).toBeVisible();
  expect(await app.read("pharoam.md")).toContain("headline: Backend developer");
});

test("starts from a folder the person picks, copying its files in", async ({ app, page }) => {
  const folder = await mkdtemp(path.join(tmpdir(), "pharoam-copy-"));
  await mkdir(path.join(folder, "evidence"));
  await writeFile(path.join(folder, "pharoam.md"), PHAROAM);
  await writeFile(path.join(folder, "evidence", "payments-api--0192f3a1.md"), PAYMENTS_API);

  await app.start();
  await page.getByLabel("Start from a folder").setInputFiles(folder);

  await expect(page.getByRole("heading", { level: 1, name: "Backend developer" })).toBeVisible();
  expect(await app.read("pharoam.md")).toBe(PHAROAM);
  expect(await app.read("evidence/payments-api--0192f3a1.md")).toBe(PAYMENTS_API);
  await page.getByRole("link", { name: "Evidence" }).click();
  await expect(page.getByRole("link", { name: "Payments API" })).toBeVisible();
  await app.expectAccessible("evidence, browser storage");
  await rm(folder, { recursive: true, force: true });
});

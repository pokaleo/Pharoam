import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures.ts";
import { PAYMENTS_API, PAYMENTS_API_ID, PDF_BYTES, PHAROAM } from "./files.ts";

const FOLDER = `evidence/_attachments/${PAYMENTS_API_ID}`;

test("S14: attaches files to evidence, downloads them byte for byte, and deletes them only when asked", async ({
  app,
  page,
}) => {
  await app.start();
  await app.put("pharoam.md", PHAROAM);
  await app.put("evidence/payments-api--0192f3a1.md", PAYMENTS_API);
  await app.choose();
  await app.nav("Evidence").click();
  await page.getByRole("link", { name: "Payments API" }).click();
  await expect(page.getByText(/No files yet/)).toBeVisible();

  const attach = page.getByLabel("Attach a file");
  await attach.setInputFiles({
    name: "Certificate.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(PDF_BYTES),
  });
  await expect(page.getByText("Certificate.pdf was attached.")).toBeVisible();
  expect(await app.readBytes(`${FOLDER}/Certificate.pdf`)).toEqual(PDF_BYTES);
  expect(await app.read("evidence/payments-api--0192f3a1.md")).toContain(
    "attachments:\n  - Certificate.pdf\n",
  );
  // A file named like a page is only ever downloaded, never shown inside the app (hard rule 10).
  await attach.setInputFiles({
    name: "notes.html",
    mimeType: "text/html",
    buffer: Buffer.from("<script>alert(1)</script>"),
  });
  await expect(page.getByText("notes.html was attached.")).toBeVisible();
  await expect(page.locator("main iframe, main embed, main object")).toHaveCount(0);
  await app.expectAccessible("evidence page with files");

  await attach.setInputFiles({
    name: "big.zip",
    mimeType: "application/zip",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.getByText("big.zip is over 10 MB, so it wasn't attached.")).toBeVisible();
  expect(await app.list(FOLDER)).toEqual(["Certificate.pdf", "notes.html"]);

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Certificate.pdf" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("Certificate.pdf");
  expect([...(await readFile(await download.path()))]).toEqual(PDF_BYTES);

  await page.getByRole("button", { name: "Remove notes.html" }).click();
  await app.expectAccessible("removing a file");
  await page
    .getByRole("group", { name: "Delete notes.html from your folder?" })
    .getByRole("button", { name: "Delete it" })
    .click();
  await expect(page.getByText("notes.html was removed.")).toBeVisible();
  expect(await app.list(FOLDER)).toEqual(["Certificate.pdf"]);

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete Payments API?" });
  await expect(confirm.getByText("Certificate.pdf")).toBeVisible();
  await app.expectAccessible("evidence delete confirmation with files");
  await confirm.getByRole("checkbox", { name: "Also delete its files from your folder" }).check();
  await confirm.getByRole("button", { name: "Delete it" }).click();
  await expect(page.getByText("Payments API was deleted from your folder.")).toBeVisible();
  expect(await app.list("evidence")).toEqual(["_attachments"]);
  expect(await app.list("evidence/_attachments")).toEqual([]);
});

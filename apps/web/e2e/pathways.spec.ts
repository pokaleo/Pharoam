import { expect, test } from "./fixtures.ts";
import { PAYMENTS_API, PHAROAM, sqlRecord } from "./files.ts";

test("S10, S11: browses pathways and stores the gap to one, with no score", async ({ app, page }) => {
  await app.start();
  await app.put("pharoam.md", PHAROAM);
  await app.put("evidence/payments-api--0192f3a1.md", PAYMENTS_API);
  await app.put("skills/sql.md", sqlRecord(3));
  await app.choose();
  await page.getByRole("link", { name: "Pathways" }).click();

  await expect(page.getByRole("list", { name: "Pathways" }).getByRole("link")).toHaveCount(4);
  await app.expectAccessible("pathways");
  await page.getByRole("link", { name: "Backend engineer" }).click();
  await expect(page.getByText(/Drafted with AI \(anthropic\/claude-opus-5-5\)/)).toBeVisible();
  await app.expectAccessible("pathway");

  await page.getByRole("link", { name: "See my gap to this pathway" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your gap to Backend engineer" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Claimed" })).toContainText("SQL");
  await expect(page.getByRole("region", { name: "Nothing in your profile yet" })).toBeVisible();
  await expect(page.getByText("Updated just now")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/verified|score|%|\btotal\b|rank/i);
  await app.expectAccessible("gap");

  const gap = (await app.read("gaps/backend-engineer.md")) ?? "";
  expect(gap).toMatch(/pathway: pharoam-core@\d+\.\d+\.\d+:backend-engineer\n/);
  expect(gap).toContain("## Your gap to Backend engineer");
});

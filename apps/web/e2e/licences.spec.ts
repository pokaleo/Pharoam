import { expect, test } from "./fixtures.ts";

test("links every page to the third-party licences of what the built app contains", async ({ app, page }) => {
  await app.start();
  const href = await page.getByRole("link", { name: "Third-party licences" }).getAttribute("href");
  expect(href).not.toBeNull();

  const response = await page.request.get(new URL(href ?? "", page.url()).toString());
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toMatch(/^text\/plain/);
  const text = await response.text();
  // A bundled library, the icons, a typeface the theme loads, and the skill vocabulary's source.
  expect(text).toContain("-- react ");
  expect(text).toContain("-- lucide-react ");
  expect(text).toContain("-- figtree --");
  expect(text).toContain("MIND Tech Ontology");
});

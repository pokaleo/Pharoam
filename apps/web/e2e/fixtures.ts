/**
 * What every end-to-end test runs with: a folder the app can open, and the checks every page must pass.
 *
 * @remarks Each test gets a fresh browser context, so its folder and remembered folder start empty. The folder is
 * a real directory handle in Chromium's origin private file system, offered by the folder picker; Playwright can't
 * drive the browser's own picker dialog. Every test fails if its page logs a console error or warning, such as a
 * content security policy or Trusted Types violation, or requests anything outside the app itself (MVP S1.5).
 * @packageDocumentation
 */
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/** The folder the picker offers, inside the origin private file system. */
const FOLDER = "my-profile";

/** The WCAG 2.2 A and AA rules, and axe's best practices, as the component tests run them (ADR-0015). */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** The running app in one test, with its folder. */
export class App {
  /** The page the app runs in. */
  readonly page: Page;

  /**
   * Wraps the test's page.
   *
   * @param page - The page the app runs in.
   */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Writes a file into the folder, as another app such as an editor would.
   *
   * @param path - Where, relative to the folder, such as `skills/sql.md`.
   * @param text - The file's text.
   */
  async put(path: string, text: string): Promise<void> {
    await this.page.evaluate(
      async ({ folder, path, text }) => {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true });
        const parts = path.split("/");
        const name = parts.pop() ?? path;
        for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
        const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
        await writable.write(text);
        await writable.close();
      },
      { folder: FOLDER, path, text },
    );
  }

  /**
   * Reads a file in the folder.
   *
   * @param path - Where, relative to the folder.
   * @returns Its text, or `undefined` when there is no such file.
   */
  async read(path: string): Promise<string | undefined> {
    return this.page.evaluate(
      async ({ folder, path }) => {
        try {
          let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
          const parts = path.split("/");
          const name = parts.pop() ?? path;
          for (const part of parts) dir = await dir.getDirectoryHandle(part);
          return await (await (await dir.getFileHandle(name)).getFile()).text();
        } catch {
          return undefined;
        }
      },
      { folder: FOLDER, path },
    );
  }

  /**
   * Lists the files in one of the folder's folders.
   *
   * @param path - The folder inside the profile's folder, such as `evidence`.
   * @returns The files' names, sorted; empty when there is no such folder.
   */
  async list(path: string): Promise<string[]> {
    return this.page.evaluate(
      async ({ folder, path }) => {
        try {
          const dir = await (
            await (await navigator.storage.getDirectory()).getDirectoryHandle(folder)
          ).getDirectoryHandle(path);
          const names: string[] = [];
          for await (const name of dir.keys()) names.push(name);
          return names.sort();
        } catch {
          return [];
        }
      },
      { folder: FOLDER, path },
    );
  }

  /** Opens the start page, so files can be put in the folder before choosing it. */
  async start(): Promise<void> {
    await this.page.goto("./");
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  /** Chooses the folder from the start page and waits for the profile to open. */
  async choose(): Promise<void> {
    await this.page.getByRole("button", { name: "Choose a folder" }).click();
  }

  /**
   * Checks the page with axe, in the light theme and the dark one (MVP §5 quality bar).
   *
   * @remarks Unlike the component tests, this runs in a real browser, so colour contrast is checked too.
   * @param screen - The screen's name, for the failure message.
   */
  async expectAccessible(screen: string): Promise<void> {
    for (const colorScheme of ["light", "dark"] as const) {
      await this.page.emulateMedia({ colorScheme });
      // Colours fade between themes; check them once settled, not halfway.
      await this.page.evaluate(() =>
        Promise.allSettled(document.getAnimations().map((animation) => animation.finished)).then(
          () => undefined,
        ),
      );
      const results = await new AxeBuilder({ page: this.page }).withTags(AXE_TAGS).analyze();
      const found = results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.help}\n${violation.nodes
            .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary ?? ""}`)
            .join("\n")}`,
      );
      expect(found, `${screen}, ${colorScheme} theme`).toEqual([]);
    }
    await this.page.emulateMedia({ colorScheme: null });
  }
}

/** Playwright's test, with the app and its checks. */
export const test = base.extend<{ app: App }>({
  app: async ({ page, baseURL }, use) => {
    const problems: string[] = [];
    const outside: string[] = [];
    const origin = new URL(baseURL ?? "http://localhost").origin;
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith("http") && url.origin !== origin) outside.push(request.url());
    });
    await page.addInitScript((folder) => {
      Object.assign(window, {
        showDirectoryPicker: async () =>
          (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true }),
      });
    }, FOLDER);

    await use(new App(page));

    expect(problems, "console errors and warnings").toEqual([]);
    expect(outside, "requests outside the app (MVP S1.5)").toEqual([]);
  },
});

export { expect };

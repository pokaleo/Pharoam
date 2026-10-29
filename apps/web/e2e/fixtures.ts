/**
 * What every end-to-end test runs with: a folder the app can open, and the checks every page must pass.
 *
 * @remarks Each test gets a fresh browser context, so its folder and remembered folder start empty. The folder is
 * a real directory handle in Chromium's origin private file system, offered by the folder picker; Playwright can't
 * drive the browser's own picker dialog. Every test fails if its page logs a console error or warning, such as a
 * content security policy or Trusted Types violation, or requests anything outside the app itself (MVP S1.5).
 * @packageDocumentation
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/** The folder the picker offers, inside the origin private file system. */
const FOLDER = "my-profile";

/** Where the app keeps a profile in browser storage (src/composition/browser-places.ts). */
export const BROWSER_PROFILE = "pharoam-profile";

/** The WCAG 2.2 A and AA rules, and axe's best practices, as the component tests run them (ADR-0015). */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** The running app in one test, with its folder. */
export class App {
  /** The page the app runs in. */
  readonly page: Page;
  /** The profile's directory in the origin private file system. */
  readonly folder: string;

  /**
   * Wraps the test's page.
   *
   * @param page - The page the app runs in.
   * @param folder - The profile's directory in the origin private file system.
   */
  constructor(page: Page, folder: string) {
    this.page = page;
    this.folder = folder;
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
      { folder: this.folder, path, text },
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
          return new TextDecoder().decode(
            await (await (await dir.getFileHandle(name)).getFile()).arrayBuffer(),
          );
        } catch {
          return undefined;
        }
      },
      { folder: this.folder, path },
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
          for await (const entry of dir.values()) names.push(entry.name);
          return names.sort();
        } catch {
          return [];
        }
      },
      { folder: this.folder, path },
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

/**
 * WebKit's own `<select>` control applies a built-in stylesheet that the content security policy refuses, with this
 * message, on any page with a select, Pharoam's or not. Nothing of Pharoam's is refused and the control works (the
 * WebKit journey chooses from one and checks the file), so only this message, only in WebKit, is let through. Allowing
 * inline styles to quiet it would weaken the policy everywhere.
 */
const WEBKIT_SELECT_STYLE =
  "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive";

/** The test's options: whether the browser offers a folder picker, as Chromium does, or keeps profiles itself. */
interface Options {
  /** True to offer a folder in the private file system through the picker; false to test browser storage. */
  readonly picker: boolean;
}

/** Playwright's test, with the app and its checks. */
export const test = base.extend<Options & { app: App }>({
  picker: [true, { option: true }],

  // WebKit keeps no files in a throwaway session, as Safari keeps none in a private window, so its tests get a
  // persistent profile, as a normal Safari window has. Its storage is shared, so they also run one at a time.
  page: async ({ page, browserName, playwright, baseURL }, use) => {
    if (browserName !== "webkit") {
      await use(page);
      return;
    }
    const profile = await mkdtemp(path.join(tmpdir(), "pharoam-webkit-"));
    const context = await playwright.webkit.launchPersistentContext(profile, {
      ...(baseURL === undefined ? {} : { baseURL }),
    });
    const webkitPage = context.pages()[0] ?? (await context.newPage());
    // Playwright's WebKit shares the private file system between profiles, so each test starts by emptying it.
    await webkitPage.goto(baseURL ?? "/");
    await webkitPage.evaluate(`(async () => {
      const root = await navigator.storage.getDirectory();
      for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
    })()`);
    await use(webkitPage);
    await context.close();
    await rm(profile, { recursive: true, force: true });
  },

  app: async ({ page, baseURL, picker, browserName }, use) => {
    const problems: string[] = [];
    const outside: string[] = [];
    const origin = new URL(baseURL ?? "http://localhost").origin;
    page.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      if (browserName === "webkit" && message.text().startsWith(WEBKIT_SELECT_STYLE)) return;
      problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith("http") && url.origin !== origin) outside.push(request.url());
    });
    if (picker) {
      await page.addInitScript((folder) => {
        Object.assign(window, {
          showDirectoryPicker: async () =>
            (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true }),
        });
      }, FOLDER);
    }

    await use(new App(page, picker ? FOLDER : BROWSER_PROFILE));

    expect(problems, "console errors and warnings").toEqual([]);
    expect(outside, "requests outside the app (MVP S1.5)").toEqual([]);
  },
});

export { expect };

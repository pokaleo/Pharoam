/**
 * Renders the whole app for tests, with a profile kept in memory instead of a folder or the browser's storage.
 *
 * @packageDocumentation
 */
import { err, ok, type StorageConnector } from "@pharoam/core";
import type { MemoryConnector } from "@pharoam/core/testing";
import { createMemoryHistory } from "@tanstack/react-router";
import { render, type RenderResult } from "@testing-library/react";
import { App } from "../app.tsx";
import { loadContentPack } from "../content.ts";
import type { PlaceError, PlaceKind, Places, StoredFile } from "../profile/places.ts";

/** How the place's storage and the browser answer, in a test. */
export interface TestFolder {
  /** The folder's name. */
  readonly name: string;
  /** The profile's files, in memory. */
  readonly memory: MemoryConnector;
  /** Where the profile is kept: a folder by default, or the browser's own storage. */
  readonly kind?: PlaceKind;
  /** How the browser answers when the person chooses or reopens the place; the place by default. */
  readonly answer?: PlaceError;
  /** Whether the folder was chosen on an earlier visit; for browser storage, whether files are there decides. */
  readonly remembered?: boolean;
  /** Whether the browser agreed to keep browser storage. */
  readonly persisted?: boolean;
  /** Whether the browser can keep a profile at all; true by default. */
  readonly supported?: boolean;
}

/** The rendered app, and what the test can inspect. */
export interface RenderedApp extends RenderResult {
  /** How many times the profile's storage was listed: zero means nothing was read. */
  readonly lists: () => number;
  /** Whether the remembered folder was forgotten. */
  readonly forgotten: () => boolean;
}

const encoder = new TextEncoder();

/**
 * Renders the app with one place the person can open.
 *
 * @param folder - The place and how the browser answers.
 * @param path - The address to start at.
 * @returns The rendered app.
 */
export function renderApp(folder: TestFolder, path = "/"): RenderedApp {
  let lists = 0;
  let remembered = folder.remembered ?? false;
  let forgotten = false;
  const storage: StorageConnector = {
    ...folder.memory.connector,
    list: () => {
      lists++;
      return folder.memory.connector.list();
    },
  };
  const place = () =>
    Promise.resolve(folder.answer === undefined ? ok({ name: folder.name, storage }) : err(folder.answer));
  const stored = async (): Promise<StoredFile[]> => {
    const listed = await folder.memory.connector.list();
    const files: StoredFile[] = [];
    for (const ref of listed.ok ? listed.value : []) {
      files.push({ path: ref.location, bytes: encoder.encode((await folder.memory.readOutside(ref.location)) ?? "") });
    }
    return files;
  };

  const folderPlaces: Places = {
    kind: "folder",
    remembered: () => Promise.resolve(remembered ? folder.name : undefined),
    reopen: place,
    choose: async () => {
      const chosen = await place();
      if (chosen.ok) remembered = true;
      return chosen;
    },
    forget: () => {
      remembered = false;
      forgotten = true;
      return Promise.resolve();
    },
  };
  const browserPlaces: Places = {
    kind: "browser",
    remembered: async () => ((await stored()).length > 0 ? folder.name : undefined),
    reopen: place,
    choose: place,
    forget: () => {
      forgotten = true;
      return Promise.resolve();
    },
    bringIn: async (files) => {
      if ((await stored()).length > 0) return err({ kind: "not-empty" });
      for (const file of files) await folder.memory.putOutside(file.path, new TextDecoder().decode(file.bytes));
      return place();
    },
    copy: async () => ok(await stored()),
    persisted: () => Promise.resolve(folder.persisted ?? false),
  };

  const history = createMemoryHistory({ initialEntries: [path] });
  const rendered = render(
    <App
      history={history}
      supported={folder.supported ?? true}
      places={folder.kind === "browser" ? browserPlaces : folderPlaces}
      content={loadContentPack}
    />,
  );
  return { ...rendered, lists: () => lists, forgotten: () => forgotten };
}

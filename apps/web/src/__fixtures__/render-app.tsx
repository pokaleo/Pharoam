/**
 * Renders the whole app for tests, with a profile kept in memory instead of a folder.
 *
 * @packageDocumentation
 */
import { err, ok, type StorageConnector } from "@pharoam/core";
import type { MemoryConnector } from "@pharoam/core/testing";
import { createMemoryHistory } from "@tanstack/react-router";
import { render, type RenderResult } from "@testing-library/react";
import { App } from "../app.tsx";
import { loadContentPack } from "../content.ts";
import type { PlaceError, Places } from "../profile/places.ts";

/** How the folder picker and permission prompt answer, in a test. */
export interface TestFolder {
  /** The folder's name. */
  readonly name: string;
  /** The profile's files, in memory. */
  readonly memory: MemoryConnector;
  /** How the browser answers when the person chooses or reopens the folder; the folder by default. */
  readonly answer?: PlaceError;
  /** Whether the folder was chosen on an earlier visit. */
  readonly remembered?: boolean;
  /** Whether the browser can open folders; true by default. */
  readonly supportsFolders?: boolean;
}

/** The rendered app, and what the test can inspect. */
export interface RenderedApp extends RenderResult {
  /** How many times the profile's storage was listed: zero means nothing was read. */
  readonly lists: () => number;
  /** Whether the remembered folder was forgotten. */
  readonly forgotten: () => boolean;
}

/**
 * Renders the app with one folder the person can choose.
 *
 * @param folder - The folder and how the browser answers.
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
  const places: Places = {
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
  const history = createMemoryHistory({ initialEntries: [path] });
  const rendered = render(
    <App
      history={history}
      supportsFolders={folder.supportsFolders ?? true}
      places={places}
      content={loadContentPack}
    />,
  );
  return { ...rendered, lists: () => lists, forgotten: () => forgotten };
}

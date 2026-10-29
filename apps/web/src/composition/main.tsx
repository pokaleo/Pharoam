/**
 * Starts the app in the browser: the composition root, where the folder connector is plugged in.
 *
 * @remarks The only place the web app touches a connector (ADR-0003, AGENTS.md rule 11). Where the browser can open
 * a folder, the profile is a folder the person chooses; where it can't, as in Safari and Firefox, the same files are
 * kept in the browser's own storage (ADR-0020).
 * @packageDocumentation
 */
// First, before the core's schemas are built.
import "./jitless.ts";
import favicon from "@brand/favicon.svg";
import { createFolderMemory, type FolderHandle } from "@pharoam/connector-folder";
import { createHashHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../app.tsx";
import { storageKind } from "../browser-support.ts";
import { loadContentPack } from "../content.ts";
import type { Places } from "../profile/places.ts";
import "../styles.css";
import { createBrowserPlaces } from "./browser-places.ts";
import { createFolderPlaces } from "./folder-places.ts";

// The parts of the File System Access API the app uses, typed as the folder connector reads them. TypeScript's DOM
// types don't include the picker yet, and type the private file system's handles more loosely.
declare global {
  interface Window {
    showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<FolderHandle>;
  }
  interface StorageManager {
    getDirectory(): Promise<FolderHandle>;
  }
}

// The icon comes from @brand like the rest of the artwork; Vite doesn't resolve aliases in index.html.
document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute("href", favicon);

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");

const kind = storageKind(window);

const places: Places =
  kind === "browser"
    ? createBrowserPlaces({
        getDirectory: () => navigator.storage.getDirectory(),
        persist: () => navigator.storage.persist(),
        persisted: () => navigator.storage.persisted(),
      })
    : createFolderPlaces({
        pick: () => {
          if (window.showDirectoryPicker === undefined) return Promise.reject(new Error("No folder picker"));
          return window.showDirectoryPicker({ mode: "readwrite" });
        },
        memory: createFolderMemory(indexedDB),
      });

createRoot(root).render(
  <StrictMode>
    <App
      history={createHashHistory()}
      supported={kind !== undefined}
      places={places}
      content={loadContentPack}
    />
  </StrictMode>,
);

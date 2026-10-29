/**
 * Starts the app in the browser: the composition root, where the folder connector is plugged in.
 *
 * @remarks The only place the web app touches a connector (ADR-0003, AGENTS.md rule 11).
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
import { supportsFolderAccess } from "../browser-support.ts";
import { loadContentPack } from "../content.ts";
import "../styles.css";
import { createFolderPlaces } from "./folder-places.ts";

// The File System Access API's picker, which TypeScript's DOM types don't include yet.
declare global {
  interface Window {
    showDirectoryPicker?: (options: { mode: "readwrite" }) => Promise<FolderHandle>;
  }
}

// The icon comes from @brand like the rest of the artwork; Vite doesn't resolve aliases in index.html.
document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute("href", favicon);

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");

const places = createFolderPlaces({
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
      supportsFolders={supportsFolderAccess(window)}
      places={places}
      content={loadContentPack}
    />
  </StrictMode>,
);

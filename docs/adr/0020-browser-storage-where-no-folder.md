# ADR-0020: Browser storage where a folder can't be opened

- **Status:** Accepted
- **Date:** 2026-10-29
- **Covers:** AD1, MVP §3, PRD A1–A3, N8

## Context
v0.1 kept the profile in a local folder through the File System Access API, which only desktop Chromium browsers have. Safari and Firefox users saw a "not supported yet" page, which shuts out a large share of desktop users, Mac users especially, for no reason they can act on.

Safari and Firefox can't let a web page write into a folder on the computer. Both do have the **origin private file system** (OPFS): a file system the browser keeps for each site, on the device, with directory and file handles of the same shape as a folder's. Checked in Playwright's WebKit (Safari 27's engine) and Firefox 157: creating, writing, reading and listing files all work, as do `navigator.storage.persist()` and picking a folder with `<input type="file" webkitdirectory>`. In WebKit it fails in a throwaway session, as in Safari's private windows.

## Decision
- **Where the browser can open a folder, the profile is a folder** the person chooses, as before.
- **Where it can't, the profile is kept in the browser's own storage**: the same Markdown files, in the same layout ([data model](../design/data-model.md) §8), in a `pharoam-profile` directory of the site's private file system. The **folder connector is used unchanged**: a private-file-system directory handle is a folder handle, so every connector check, conflict rule and file format applies as it is.
- The files **never leave the device** (AGENTS.md hard rule 1). They are not visible in Finder or Obsidian, so the person can:
  - **start from a folder** they pick: its files are copied into an empty store, hidden files left out, and nothing is ever written over a profile already there;
  - **download a copy** as a `.zip` of every file, made in the browser. The zip is stored, not compressed, by a short writer in the app, so no compression library is added.
- **The browser is asked to keep the files** (`navigator.storage.persist()`), without waiting for its answer, as Firefox asks the person. The profile's home always asks the person to keep a copy, more calmly once the browser has agreed. Closing the profile keeps its files: closing isn't deleting.
- A private window, where the browser keeps no files, is explained in plain words.
- The end-to-end tests run the browser-storage journeys in **WebKit and Firefox**, besides the folder journeys in Chromium.

## Alternatives rejected
- **Open a folder read-only and download each change:** the folder would stay the master copy, but every save becomes a manual step, and changes made outside Pharoam can't be detected reliably (AD10).
- **A Git or GitHub connector first:** works in every browser and in Obsidian through git, but needs the network spike (S1), token handling and network rules. It stays a later connector.
- **Keep Chromium only for v0.1:** simplest, but leaves Safari and Firefox users with nothing to do.

## Consequences
- **The browser can delete the files.** Safari may clear a site's storage after seven days without a visit, unless the site is added to the Dock; any browser may clear it when the person clears site data. The copy reminder and `persist()` reduce the risk; they don't remove it.
- Files in browser storage aren't readable in other apps until downloaded, so exit criterion 3 (files readable in Obsidian) holds in a folder, and through a downloaded copy here.
- WebKit's own `<select>` control applies a built-in stylesheet that the content security policy refuses, with a console message, on any page with a select. Nothing of Pharoam's is refused, the control works, and allowing inline styles would weaken the policy everywhere, so the policy is unchanged and the end-to-end check lets that one WebKit message through.
- Mobile browsers have the private file system too, but the app isn't designed for phones yet (MVP §7).

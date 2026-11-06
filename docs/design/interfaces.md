# Interfaces

| | |
|---|---|
| **Version** | 0.1 (in discussion) |
| **Source** | [Architecture](../ARCHITECTURE.md) · [Data model](data-model.md) |
| **Status** | The contracts between Pharoam's parts. Code signatures are illustrative; exact types are settled during implementation. |

## 1. Storage connectors

**Connectors exchange records in the standard shape, not raw files.** File-based connectors (local folder, Obsidian, Git, and the browser's own storage where a folder can't be opened, [ADR-0020](../adr/0020-browser-storage-where-no-folder.md)) share one **Markdown codec** that turns a record into a `.md` file (top block plus body) and back. The Notion connector maps records to database properties and page content. The core never knows which backend it is using.

```ts
interface StorageConnector {                         // packages/core/src/core-service.ts; every call is async
  initialise(): Result<void>                          // prepares a new profile, e.g. skills/, evidence/, gaps/; changes nothing
  list(): Result<StoredRef[]>                         // every record, valid or not: location + version token
  read(location): Result<{ file, version }>           // not-found, or unreadable with the codec's error
  create(file): Result<StoredRef>                     // where the layout puts it; never over an existing record
  write(location, file, expectedVersion): Result<VersionToken>  // conflict if changed since read (AD10)
  delete(location, expectedVersion): Result<void>     // conflict if changed since read
  attachments(recordId): Result<StoredAttachment[]>   // files kept with a record: name, version token, size
  readAttachment(recordId, name): Result<{ bytes, version }>
  addAttachment(recordId, name, bytes): Result<StoredAttachment>          // never over a file already there
  deleteAttachment(recordId, name, expectedVersion): Result<void>         // conflict if changed since listed
  // Later: capabilities
}
```

- **Changes are listed through version tokens** (AD10a): a token stays the same until its record changes, so comparing two listings shows what was added, changed or removed. This works for a folder, which has no change feed; a connector with one, such as Notion, may add a faster `changesSince` later.
- **Records are addressed by location, not by ID.** A location is a path for file connectors and a page for Notion, and the core treats it as opaque. A broken record has no readable ID but must still be listed under "Needs attention", so the core maps IDs to locations only after reading. Records are passed as record files: the top block's fields and the body, with what Pharoam doesn't know kept.

- The **version token** detects conflicts: a file's modified time or content hash, or Notion's last-edited time.
- **A local folder has no atomic compare-and-swap.** The connector checks the token again just before writing, and the browser commits the new content in one step, but an edit landing between that check and the write can still be lost. The window is kept as short as possible, and the connector suite tests it.
- **Attachments are addressed by their record's ID and their name** (MVP S14), not by location, so a record can move without losing its files. They are bytes, kept exactly, and never listed as records. Their version token is their size and modified time, so listing them reads no file; a file changed outside Pharoam is never deleted (AD10). As with records, adding a file has a short window between checking that the name is free and creating the file, in which a file saved there from outside could be replaced. The core makes every name safe before storage sees it, and connectors refuse any other name, or an ID that isn't a record ID, so no name can reach outside the record's own folder.
- A connector may have a **relay part** where its service blocks browsers (AD12). The interface is the same either way.

## 2. AI task definitions

Every AI feature is one task definition in `packages/core`, shared by the app and the relay (AD4):

```ts
defineTask({
  name: "normalise-evidence", version: 1,
  input:  z.object({ text: z.string().max(20_000) }),   // Zod (AD7), checked before anything is sent
  output: z.object({ records: z.array(NormalisedEvidence) }),  // checked before the user sees the answer
  instructions: (input) => "…",                           // Pharoam's own text only, never the person's
  data: ({ text }) => [{ kind: "pasted-text", text }],    // all the task reads (PRD D4)
})
```

- **`data` is exactly what the task reads**: for example pasted text, or one skill's evidence, found through the evidence records' skill links. `prepareCall` builds the request without sending it, so the app can show the parts and their size first (PRD D4). The person's material goes only into the prompt, each part inside `<data>` tags, with instructions to treat it as data (security §3).
- **The label and disclaimer are interface text**, so they live in the web app's translation files under the task's name, not in the core (hard rule 12).
- **`runTask` sends the prepared request and checks the answer** against `output`, then against the task's own `check`, if it has one: what a fixed schema can't, such as a level judgement citing evidence it wasn't sent (MVP S16.3). A task may answer in its material's language (`answerIn`) where the answer is the person's own words. Every call, answered or not, comes back with a call record (§3).

Validation, transparency and the relay's allow-list all come from this one definition.

## 3. Model providers

A thin interface over LangChain chat models (AD11a):

```ts
interface ModelProvider {
  id: string                                          // "anthropic", "openai-compatible", …
  listModels(): Promise<Result<ModelInfo[], ProviderError>>
  complete(request: ModelRequest, { model }): Promise<Result<unknown, ProviderError>>   // unchecked JSON
}
```

A provider only sends what the core prepared and returns the parsed answer. **The core's `runTask` checks it** against the task's schema and makes the call record, so no provider can skip either. There is no cancelling a call in flight in v0.2: a scan stops between calls (MVP S16.5).

- The user configures the provider type, base URL (OpenRouter, Ollama, LM Studio), key and model.
- Every call produces a **call record** (task, model, time, data sent). It is shown in the transparency view, and its summary goes into the resulting record's AI block.

## 4. Workflows

Workflows (AI-led diagnostic, profile update, later CVs and interview practice) are LangGraph graphs defined in the core. The question-bank diagnostic runs the same way with plain-logic nodes only, so it needs no AI. Each workflow declares:
- `name@version`, with nodes that are either **plain logic** or **registered tasks** (§2);
- **approval points** where the user must confirm before anything is written (interrupts, R5). A diagnostic writes its result when it ends, without an approval point (ADR-0019);
- **every step appends an entry to the readable session log** ([data model](data-model.md) §10);
- **resuming means replaying the log** to rebuild the working state;
- **records are written only through the core service** (§5), at approval points or when the workflow finishes.

## 5. Core service

The UI never calls connectors or providers directly. One core service layer:
- **loads and queries** the profile, upgrading old formats when reading;
- **saves records**: validate → encode → connector → handle conflicts (AD10);
- runs **integrity checks** and keeps the **"Needs attention"** list;
- emits **change events**. A batched **regeneration step** listens to them and updates proficiency summaries (the shown level), gaps and the `pharoam.md` overview, always showing the "recalculating" status;
- manages the **local cache** and the **offline queue** (AD9).

## 6. Content sources

```ts
interface ContentSource {
  listPacks(): PackSummary[]
  loadPack(nameAtVersion): Pack
}
```

- Three implementations: **bundled** (in the app), **URL** and **connector** (packs in the user's own storage).
- Every pack is validated against its manifest and `min_app_version`.
- Loading a pack from a URL needs **the user's explicit confirmation**, showing its name, version, publisher and licences.

## 7. Relay HTTP API

Small and fixed:

| Endpoint | Purpose |
|---|---|
| `POST /tasks/{name}@{version}` | Runs **registered tasks only** (PRD L3), with the operator's key or the user's own |
| `/connectors/{name}/…` | The relay part of a connector, for example Notion calls and OAuth callbacks |
| `POST /fetch` | Fetches a public web page (job ads, course pages). Requests to private or internal network addresses are refused. |
| `GET /health` | Health check |

- Nothing else is exposed.
- **Localhost relay:** accepts calls only from the Pharoam app's own address (origin), and only after **pairing**. It shows a pairing code when it first starts, and the user enters it in the app once. That stops other web pages in the browser from using it.
- **Operator relay:** the operator's sign-in (PRD L1) issues a short-lived session token.
- **The user's own key on an operator deployment** is sent with each request, used only for that call, and never stored.

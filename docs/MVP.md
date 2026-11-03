# Pharoam MVP and release plan

| | |
|---|---|
| **Version** | 0.2 (draft) |
| **Date** | 3 November 2026 |
| **Source** | [PRD](PRD.md) (what the whole product does) · [Charter](CHARTER.md) (why) |
| **Status** | Agreed scope for the first release, and a draft of the second (§8, for the founder's sign-off). Stories and acceptance criteria are the definition of done: each criterion becomes a failing test first (ENGINEERING §1). §7 records everything the MVP leaves out, so later work can resume from it. |

## 1. What the MVP proves

**Pharoam can hold a real, evidence-based skills profile in the person's own folder, and show the honest gap to a career pathway, with no AI and no server.**

- **Map + a thin slice of Explore.** Map alone would be a structured notebook; the gap view is the first thing only Pharoam does.
- **Minimal mode only.** It tests the foundations everything else stands on (file format, connector, data model, gap logic) before AI is added. AI waits for spike S2 anyway.
- **Built for the founder first** (Charter §2). v1 validation means the founder using it on their own profile (§4).

## 2. Releases

| Release | Adds | Main PRD areas |
|---|---|---|
| **v0.1 MVP** | Profile in a local folder, evidence by forms, skill records, skill view, 4 pathways, gap view | A, B, C, F (part), I (part) |
| **v0.2** | AI-assisted mode: model settings, normalising pasted text, AI judgements of levels and skill links from evidence, explaining a gap; attachments; the transparency view (§8) | D, B2, B3, B5, B6, J1, J3 |
| **v0.3** | Diagnostics: adaptive question bank (no AI) and AI-led diagnostics with open answers and practical tasks | E |
| **v0.4** | Learning plans and aspirations; pathway comparison | G, F2 |
| **Later** | Career readiness, more connectors and browsers, offline app, sharing, operator toolkit | H, A3, K, L |

Order after v0.1 can change as v0.1 teaches us; §7 keeps the full list.

## 3. v0.1 scope

**In:**
- **One connector: a local folder**, chosen with the browser's File System Access API, in desktop Chromium browsers (Chrome, Edge, Brave, Arc). An Obsidian vault is just a folder.
- **Safari and Firefox keep the profile in the browser's own storage** on the device, as the same files, through the same connector ([ADR-0020](adr/0020-browser-storage-where-no-folder.md)). The person can start from a folder they pick and download a copy as a `.zip`, and is reminded to keep one. Browsers with neither see a clear "not supported yet" page.
- **Profile records:** `pharoam.md`, evidence, skill records and stored gap analyses, in the folder layout of [data model](design/data-model.md) §8.
- **Evidence by structured forms** for five kinds: project, job, course or module, certificate, other. Links, no attachments.
- **Observations** labelled `self-reported` only, optionally citing evidence records. Corrections and retractions are appended, never edited.
- **Skill vocabulary:** a curated subset (about 200–300 skills) of the MIND Tech Ontology fork, with stable Pharoam slugs. One shared description of levels 0–4, plus skill-specific descriptions for the skills the 4 pathways require. **Custom skills** for anything missing, marked as the person's own.
- **4 pathways:** frontend engineer, backend engineer, machine-learning engineer, applied AI engineer. Each has a summary, requirements (skill, level, core or helpful), a source for every requirement, and a review record. AI-drafted, founder-reviewed (PRD I3), stored in `content/` and compiled into the built-in bundle (AD16).
- **Gap view** for any one pathway, saved as `gaps/<pathway>.md` and updated automatically.
- **Safety rules from day one:** edits made outside Pharoam are detected and never overwritten (AD10); invalid files go to "Needs attention"; sanitised Markdown rendering; all interface text translatable; WCAG 2.2 AA.
- **Deployment:** the static app on GitHub Pages (Personal model).

**Gap grouping (PRD F3)**, for a requirement of skill S at level L, using S's shown level (PRD C4):

| Group | Rule |
|---|---|
| **supported** | the shown level is tested (`demonstrated` or `ai-correlated`) and ≥ L |
| **claimed** | the shown level is a claim (`self-reported` or accepted `ai-judged`) and ≥ L |
| **below** | the shown level is < L |
| **unknown** | S has no shown level |

Related skills never count for each other (no hidden inference, R4 and R6). Requirements show as core or helpful. There is no score or total (R1).

**v0.1 has only `self-reported` levels**, so every requirement is *claimed*, *below* or *unknown*. *Supported* first appears with diagnostics in v0.3.

## 4. Exit criteria

v0.1 is done when **the founder has used it for their own profile for 2 weeks** and:
1. the profile holds **at least 20 evidence records and at least 30 skills**;
2. the gap view for at least one pathway is **judged accurate by the founder**;
3. **every file is readable and editable in Obsidian**, and the profile is understandable without Pharoam;
4. a file **edited outside Pharoam is detected, not overwritten**, in real use;
5. **every story's acceptance criteria pass** as automated tests, and **axe accessibility checks pass** on every screen;
6. `pnpm check` and CI are green.

**Outcome, 3 November 2026:** v0.1 was closed without the two-week founder trial, so that AI assistance could start sooner. Criteria 5 and 6 are met. **Criteria 1–4 were not checked in real use.** The founder keeps using the app alongside v0.2; what that turns up is fixed as it comes, rather than holding back the release.

## 5. Stories and acceptance criteria

Each story lists the PRD requirements it implements. Criteria use Given/When/Then; IDs like `S1.2` are referenced from tests.

### S1. Create a profile in a folder I choose
*As a user, I want to create my profile in a folder I choose, so that my data stays on my machine in files I own.* Implements A1, A2, A3, A4.

- **S1.1** Given an empty folder, when I choose it and create a profile, then Pharoam writes `pharoam.md` with `schema: pharoam/1`, a UUIDv7 `id` and `created`, plus the folders `skills/`, `evidence/` and `gaps/`.
- **S1.2** Given the profile form, when I fill in headline, situation, optional country and focus, then those fields are saved in `pharoam.md`, and the form offers **no** field for name, photo, contact details or exact location (hard rule 8).
- **S1.3** Given a folder that already contains other files, when I create a profile there, then no existing file is changed or deleted.
- **S1.4** Given I deny the browser's folder permission, when creation is attempted, then nothing is written and I see why the permission is needed.
- **S1.5** Given any action in v0.1, when it runs, then the app makes **no network request** other than loading the app itself.

### S2. Open my existing profile
*As a user, I want to reopen my profile later, so that I can keep building it over time.* Implements A1, A3, J2.

- **S2.1** Given a folder with a valid profile, when I open it, then every record is listed and nothing is written.
- **S2.2** Given I've opened a folder before, when I return to the app, then it offers that folder again and asks the browser for permission; it reads nothing until permission is granted.
- **S2.3** Given a folder without `pharoam.md`, when I open it, then I'm offered to create a profile there (S1) instead of an error.
- **S2.4** Given an open profile, when I disconnect it, then the app forgets the folder and holds no profile data afterwards.

### S3. Keep "about me" in my own words
*As a user, I want to edit my headline, situation and "About me", so that the profile describes me as I see myself.* Implements the `pharoam` record (data model §10).

- **S3.1** Given an open profile, when I edit headline, situation, country or focus, then `pharoam.md` is updated and its `updated` time changes.
- **S3.2** Given I wrote my own text in the body of `pharoam.md`, when Pharoam refreshes the overview, then only the marked overview section changes; my own text is byte-for-byte unchanged.
- **S3.3** Given the overview section, when evidence or skills change, then it is regenerated with counts of evidence and skills and the date of the last change.

### S4. Record evidence with a form
*As a user, I want to record what I've studied and done in a structured form, so that it's stored the same way every time.* Implements B1, B4, B5 (forms only), B6 (skill links by hand).

- **S4.1** Given the evidence form, when I pick a kind (project, job, course or module, certificate, other), then the form shows the common fields plus that kind's extra fields (data model §7).
- **S4.2** Given a filled form, when I continue, then I see a **preview** of the record exactly as it will be stored, and nothing is written until I confirm.
- **S4.3** Given I confirm, then one file is written to `evidence/` named from the title plus a short ID, with `schema: evidence/1`, a UUIDv7 `id`, `source: manual`, and `ai: null`.
- **S4.4** Given a required field is missing or a date is invalid, when I continue, then the form explains what to fix, in plain words, next to the field.
- **S4.5** Given links in the form, when the record is written, then each link is stored and later rendered as a link; any HTML typed into text fields is shown as text, never run (hard rule 10).
- **S4.6** Given I tag skills on the evidence, then the record lists them by inventory slug (data model §9).

### S5. Edit or delete evidence
*As a user, I want to correct or remove evidence, so that my profile stays true.* Implements A5, data model §4.

- **S5.1** Given existing evidence, when I edit and confirm it, then the file is rewritten with the same `id` and a new `updated` time, and fields Pharoam doesn't recognise are kept unchanged.
- **S5.2** Given evidence referenced by an observation, when I delete it, then the file is removed and the observation shows the reference as "removed" without an error.
- **S5.3** Given I delete evidence, then Pharoam asks me to confirm first and says which observations refer to it.

### S6. Say what I can do
*As a user, I want to record my own rating of a skill, optionally citing evidence, so that every level says where it came from.* Implements C1, C2, C5.

- **S6.1** Given a skill from the vocabulary, when I record a level 0–4, then an observation with `provenance: self-reported` is **appended** to `skills/<slug>.md`, creating the file if needed.
- **S6.2** Given I cite one or more evidence records, when I record a level, then the observation lists the evidence IDs and is still `self-reported`. The form says the level is my own rating and that citing evidence doesn't test it.
- **S6.3** Given levels, then the form shows the shared description of each level, or the skill-specific one where it exists.
- **S6.4** Given any new observation, then it carries `id`, `level`, `provenance`, `observed_at` and an `integrity` fingerprint, and existing entries in the file are byte-for-byte unchanged.
- **S6.5** Given the form, then it offers no choice of provenance: a level recorded by hand is always `self-reported`.

### S7. Correct or retract what I said
*As a user, I want to correct or withdraw a level I recorded, so that mistakes are fixed without erasing history.* Implements C3.

- **S7.1** Given an observation, when I correct the level, then a new observation is appended with `supersedes` pointing to the old one, and the old entry is unchanged.
- **S7.2** Given an observation, when I retract it, then a review entry with `decision: retract` is appended, and the observation stops counting in the skill and gap views.
- **S7.3** Given a skill's history, when I view it, then every entry is shown newest first, including superseded and retracted ones, clearly marked, with the entry behind the shown level marked (PRD C6).

### S8. Add a skill that isn't in the vocabulary
*As a user, I want to add a skill the vocabulary is missing, so that my profile isn't limited by Pharoam's list.* Implements C5.

- **S8.1** Given a name the search doesn't find, when I add it as a custom skill, then a skill record is created whose slug starts with `custom-` and which holds the name and an optional description.
- **S8.2** Given a custom skill, then it is marked "your own skill" everywhere it appears and works like any other skill in observations.
- **S8.3** Given a custom skill, then it never matches a pathway requirement, which always names inventory skills.

### S9. See what I can do
*As a user, I want one view of my skills, each with one level and where it came from, so that I can see my profile at a glance.* Implements C4, C6.

- **S9.1** Given skills with observations, when I open the skill view, then each skill shows **one level**, its source and since when, chosen by the order in PRD C4. In v0.1 that is the latest self-reported level.
- **S9.2** Given a skill file changes, then its `proficiency` block (data model §6) is regenerated so the summary is readable in Obsidian.
- **S9.3** Given the view, when I filter by domain or search by name, then the list narrows accordingly.

### S10. Browse pathways
*As a user, I want to read about the pathways Pharoam knows, so that I can pick one to compare myself with.* Implements F1 (part).

- **S10.1** Given the built-in content, when I open pathways, then the 4 pathways are listed with their summaries.
- **S10.2** Given a pathway, when I open it, then I see each requirement with skill, level, core or helpful, and its source, plus who reviewed the pathway and when.
- **S10.3** Given a pathway drafted with AI, then it says so and shows the reviewer (PRD D6, I3).

### S11. See my gap to a pathway
*As a user, I want to see how my profile compares to a pathway's requirements, so that I know where I stand and what to work on.* Implements F3, F4.

- **S11.1** Given a pathway and my observations, when I open the gap view, then each requirement is grouped as *supported*, *claimed*, *below* or *unknown* by the rules in §3.
- **S11.2** Given a requirement, then the view shows the skill's shown level and its source next to the group, with a link to the skill's history.
- **S11.3** Given the gap view, then there is **no score, percentage, total or ranking** anywhere (R1).
- **S11.4** Given I open a gap view, then `gaps/<pathway>.md` is written with the pathway pinned to its version and a readable summary in the body.
- **S11.5** Given my observations change, then the stored gap is regenerated and the view shows "Updated just now"; a refresh button does the same by hand.
- **S11.6** Given any pathway, including one where most requirements are *below* or *unknown*, then I can still choose to explore it (R2).
- **S11.7** Given a requirement grouped as *claimed*, then the view and `gaps/<pathway>.md` label the level by its source (in v0.1, my own rating) and list any evidence it cites; the word "verified" appears nowhere (R6).

### S12. Never lose an edit made outside Pharoam
*As a user who also edits these files in Obsidian, I want Pharoam to notice my changes, so that it never overwrites them.* Implements AD10, hard rule 3.

- **S12.1** Given a file changed on disk since Pharoam read it, when Pharoam is about to write it, then it writes nothing and shows both versions so I choose.
- **S12.2** Given a file with broken YAML or a missing required field, then it appears in **"Needs attention"** with a plain explanation, is left out of calculations, and is never rewritten or deleted.
- **S12.3** Given a skill file whose existing entries were changed by hand, then the affected entries are labelled "edited outside Pharoam" and still used.
- **S12.4** Given a file with fields Pharoam doesn't know, when Pharoam rewrites it, then those fields are kept with their values and order.

### Quality bar for every story
- Every screen passes **axe** checks (WCAG 2.2 AA) and works by keyboard.
- No hard-coded interface text; everything is in translation files (hard rule 12).
- Markdown renders with raw HTML disabled and sanitised; remote images are blocked (hard rule 10).
- No telemetry, analytics or third-party scripts (hard rule 7).

## 6. Built before the stories

- **No spikes are needed for v0.1.** Each one runs before the release that needs it: S1 (CORS) before v0.2, whose model providers are the first outside calls; S2 (LangGraph resuming from a readable log) before v0.3, whose diagnostics are the first workflows that pause and resume; and S3 (WebAuthn PRF) with the app lock and remembered keys, later.
- **The order of work is in the [implementation plan](ROADMAP.md).** In short: foundations, core, folder connector and content, then every story's behaviour in the core; **the interface waits for the founder's design system**, then the screens are built on it.

## 7. Not achieved in the MVP

Everything here is part of the product (PRD) but left out of v0.1 on purpose. Each row says where it resumes and what to know when it does. **Keep this table current**: when an item ships, delete its row; when a release drops something, add it.

| Item | PRD / ADR | Planned | Notes for resuming |
|---|---|---|---|
| AI-assisted mode: model settings and keys | D5, J1, AD11 | v0.2 (§8, S13) | Session-only keys by default; strict CSP; the provider interface already exists in the design |
| Normalising pasted text (CVs, module lists) | B3, B4, B5 | v0.2 (§8, S15) | Registered task `normalise-evidence`; keep the original input as an attachment; preview and confirm already exist from S4.2 |
| AI judgements from evidence (`ai-judged`) and proposed skill links | B6, D1, D2, C1 | v0.2 (§8, S16) | Accept, adjust or skip, one by one or in a batch, from a readable review session; accepting appends the observation, which the S6 append logic and the C4 order already cover. In v0.2, adjusting means recording my own level; the diagnostic option arrives with v0.3 |
| Transparency view (what was read, sent, written) and the whole-profile send notice | D4, J3 | v0.2 (§8, S17) | Mostly meaningful once data is sent to a model |
| File attachments on evidence | B2 | v0.2 (§8, S14) | `evidence/_attachments/<id>/`; needed for the original input of pasted text |
| AI explanation of a gap ("What this gap might mean") | D3, D6 | v0.2 (§8, S18) | The gap view already shows the card as a placeholder in the AI frame; an accepted explanation needs a record of its own, since the stored gap is regenerated |
| Importers (LinkedIn export, GitHub, transcripts) | B3 | Later | Each one normalises into the standard evidence shape |
| Diagnostics: adaptive question bank (`demonstrated`) and AI-led with open answers and practical tasks (`ai-correlated`) | E1–E9, ADR-0019 | v0.3 | The question bank first (it needs no AI); diagnostic records are never edited; sessions with readable logs (spike S2) |
| Learning plans | G1–G4 | v0.4 | Progress comes from new observations, not checkboxes |
| Aspirations (interests, goals, constraints) | Data model §10 | v0.4 | With learning plans |
| Pathway comparison side by side | F2 | v0.4 | The gap logic from S11 is reused per pathway |
| Pathway detail: time and cost with sources, prerequisites, uncertainties, transferable skills, ESCO occupations | F1, I2 | v0.4 | Every figure needs a cited source |
| Skill-specific level descriptions for all skills | Data model §11 | Ongoing | v0.1 covers only the skills the 4 pathways require |
| Full skill-vocabulary pipeline: ESCO, Wikidata and GitHub-topic cross-references, quarterly refresh | I1 | Later | [Research](research/skills-inventory.md); data licences stay in `data/` |
| More pathways and fields beyond computer science | I2, Charter §5 | Later | AI-drafted, founder-reviewed, then community contributions |
| Learning resources | I4 | Later | Sources still an open question (PRD §8) |
| More connectors: Git, Notion, cloud drives | A3, ADR-0013 | Later | Each passes the shared connector suite; Notion needs the relay |
| Mobile browsers | N8 | Later | Browser storage works there too (ADR-0020), and the screens follow the design system's phone layout, but phones aren't tested or supported yet |
| Encrypted local cache, offline app, app lock, remembered keys | AD9, AD11, AD20, security §8 | Later | v0.1 reads the folder directly; the cache is never the master copy. Spike S3 (WebAuthn PRF) first |
| Career readiness: job-search literacy, CV guidance, job analysis, interview practice, jobs bank, generated CVs | H1–H7 | Later | Only from real evidence (R9); never bulk applications (R8) |
| Self-hosted and operator-hosted deployments, relay | N4, L1–L5, ADR-0013 | Later | v0.1 is the Personal model on GitHub Pages only |
| Sharing | K1–K2 | Future | Depends on verifiable diagnostic results |
| Signed diagnostic results | Charter §6 | Future | `signature: null` is reserved in the format |
| Translations beyond English | N9 | Later | All text is already in translation files |
| Discovery with users beyond the founder | Charter §2, §9 | Before v0.2 or later audiences | v1 validation is the founder's own use (§4) |

## 8. v0.2: AI assistance

**The person can let a model of their choice do the slow parts of building a profile (turning a CV into evidence, suggesting skill links and levels) while deciding everything themselves, seeing what was sent, and never sending anything to Pharoam.**

### Scope

**In:**
- **Model settings** for Anthropic and any OpenAI-compatible API on a fixed list of addresses: OpenAI, OpenRouter, and a local server such as Ollama or LM Studio on `localhost` (ADR-0011). The key lasts for the session only, in memory.
- **Registered tasks only** (ADR-0004), each a single call through LangChain chat models behind Pharoam's provider interface. v0.2 has no workflow that pauses and resumes, so it uses no LangGraph (ADR-0012).
- **File attachments** on evidence, in both connectors.
- **Normalising pasted text** into evidence, with the original kept as an attachment. Pasted text only: reading PDF or Word files waits for importers (§7).
- **An evidence scan** in two steps: suggested skill links for each evidence record, then, when the person asks, a suggested level (`ai-judged`) for each skill from its linked evidence. Both are decided in a readable review session.
- **The transparency view** and the notice before every send.
- **An explanation of a gap**, filling the gap view's placeholder card. It may move to the next release if the rest is ready first.

**Order of work:** model settings and the task foundations first, then attachments and normalising pasted text, then the evidence scan, the transparency view and the gap explanation ([implementation plan](ROADMAP.md) §4). Every pull request delivers a whole working slice: a story's screens and buttons appear only in the change that completes it, with no feature flags, since every merge to `main` goes live.

### Exit criteria

v0.2 is done when:
1. the founder has turned their own CV into evidence records and decided a scan of them, with a real model;
2. **the hand-run check passes**: a small fixed set of example inputs (two CVs, a module list, a few evidence records and one gap), each with what a good answer must and mustn't contain, run by hand against a real model, with the results recorded in the release PR. It never runs in CI, so CI needs no key;
3. spike S1 has confirmed which providers a browser can call directly, and the content security policy allows only those;
4. with no model set up, the app loads no AI code and makes no request beyond loading itself;
5. **every story's acceptance criteria pass** as automated tests, and **axe accessibility checks pass** on every new screen. Core tests use a fake provider; the end-to-end journeys answer the provider's real address with canned replies, so they cover the adapter, the security policy and the key handling;
6. `pnpm check` and CI are green.

### Quality bar for every v0.2 story

Everything in the v0.1 quality bar (§5), and:
- Every AI call goes through a registered task; its output is checked against the task's schema before the person sees it (hard rule 5).
- All AI output is labelled, names its model and carries the disclaimer, and is written only when the person accepts it (hard rule 6, PRD D6).
- Before every send, the person sees what will be sent and its size in characters, never a price or a token count (PRD D4).
- The person's text goes to the model as clearly marked data, apart from the instructions (security §3).
- Tasks answer in English until the interface has other languages (PRD N9).
- No confidence scores anywhere (hard rule 9).

### S13. Set up a model
*As a user, I want to use a model I choose, with my own key, so that AI help works without my data going anywhere else.* Implements D5, J1, AD11.

- **S13.1** Given no model is set up, then the app loads no AI code and makes no network request beyond loading itself (S1.5 still holds), and every AI action offers to set up a model instead.
- **S13.2** Given the model settings, when I choose a provider from the list and enter a key where it needs one, then I pick a model from the provider's own list, or type its ID where the provider has no list; Pharoam chooses no model for me.
- **S13.3** Given a model, then a test call says whether it works, or why not in plain words.
- **S13.4** Given I entered a key, then it is kept only in memory: nothing is written to my storage or the browser's, and reloading the page, closing the profile or closing the tab forgets it.
- **S13.5** Given an address that isn't on the list, then it is refused with an explanation, and the content security policy blocks any call to it.
- **S13.6** Given a browser that blocks the app from calling a local server, then the settings say that local models don't work in this browser; there is no workaround.
- **S13.7** Given the model settings, then they say in plain words that what I send goes to the chosen provider under its own terms, not Pharoam's, with a link to its data policy.
- **S13.8** Given I remove the model, then no further AI calls are made and AI actions offer to set one up again.

### S14. Attach files to evidence
*As a user, I want to keep files with my evidence, such as a certificate or my original CV, so that the proof stays with the record.* Implements B2.

- **S14.1** Given an evidence record, when I attach a file of any type up to 10 MB, then it is stored in `evidence/_attachments/<id>/` under its own name, and the record lists it under `attachments`.
- **S14.2** Given an attachment, then I can open or download it; it is never shown inside the page (hard rule 10).
- **S14.3** Given a file over 10 MB, or one the storage can't hold, then it is refused with a plain explanation and the record is unchanged.
- **S14.4** Given I delete evidence that has attachments, then I am shown them and asked whether to delete them too; nothing else is deleted.
- **S14.5** Given either connector, then attachments pass the shared connector suite, including a file changed outside Pharoam (AD10).

### S15. Turn pasted text into evidence
*As a user, I want to paste my CV or a module list and get evidence records from it, so that I don't retype what I've already written.* Implements B3, B4, B5, D4, D6.

- **S15.1** Given pasted text and a model, when I ask Pharoam to read it, then I'm shown what will be sent (the pasted text only) and its size before the task `normalise-evidence@1` runs.
- **S15.2** Given the model's answer, then it is checked against the evidence schema, and each record it finds is shown in the preview from S4.2, labelled as AI-normalised with the model's name and the disclaimer; nothing is written until I confirm.
- **S15.3** Given a draft record, then I can edit it in the evidence form, or leave it out, before confirming.
- **S15.4** Given a draft that matches a record I already have by kind, title and organisation, then it is marked as looking like that record and left out unless I put it back.
- **S15.5** Given I confirm, then each record is written with `source: paste`, an `ai` block with `confirmed_by_user` (data model §5) and the disclaimer at the top of its body, and **each record keeps its own copy** of the pasted text as an attachment named in `original_input`, unless I chose to discard it.
- **S15.6** Given the call fails or its answer doesn't match the schema, then nothing is written, I'm told why in plain words, and my pasted text is still there.
- **S15.7** Given pasted text that contains instructions to the model, then they are treated as data: the answer still has to match the schema, and nothing is written without my confirmation (security §3).
- **S15.8** Given normalised evidence, then it carries no level (R4).

### S16. Let AI suggest skill links and levels
*As a user, I want AI to read my evidence and suggest which skills it shows and at what level, so that my profile fills in faster, with every decision still mine.* Implements B6, C1, C4, D1, D2, D4, D6.

- **S16.1** Given evidence and a model, when I ask for skill links on one record, several or all of them, then I'm shown what will be sent and its size first, and all of them needs my explicit confirmation (D4). The task `suggest-skill-links@1` runs once per record.
- **S16.2** Given a skill with evidence I've confirmed is linked to it, when I ask AI for its level, on that skill or on every such skill, then only that skill's linked evidence is sent, once per skill, by the task `judge-skill-level@1`. Levels are never judged without my asking.
- **S16.3** Given a judged level, then it names which of the evidence it was sent supports it, with an explanation and its limits; an answer that cites evidence it wasn't sent is rejected by the schema.
- **S16.4** Given a scan, then its suggestions are written to a review session of its own in `sessions/`, each with its `ai` block; no observation or link is written yet, and nothing shows a confidence.
- **S16.5** Given a running scan, then it shows its progress and can be stopped; suggestions from finished calls are kept, and a failed call sets aside only its own record or skill.
- **S16.6** Given pending suggestions, then the Review screen lists them from every session, and the sidebar's Review link shows how many wait.
- **S16.7** Given a suggestion, then I can **accept** it, **skip** it (it stays pending and never counts, R5) or **discard** it (dropped, noted in the session, nothing else written); several at once, too. For a suggested level I can also **adjust** it, which records my own level instead and drops the suggestion.
- **S16.8** Given I accept a suggested link, then the skill is added to the evidence record's `skills` and listed under `ai-skill-links` with its task, model, time and `confirmed_by_user`.
- **S16.9** Given I accept a suggested level, then an `ai-judged` observation citing its evidence is appended to the skill record (S6 append logic).
- **S16.10** Given evidence that changed after the scan read it, then the suggestions built on it are marked as such and can't be accepted, only scanned again.
- **S16.11** Given a suggestion that names a skill neither in the vocabulary nor among my custom skills, or that would change nothing (a link already there, a level equal to the shown one), then it is not offered; the session lists the second kind as already so.
- **S16.12** Given an accepted AI level, when the skill's linked evidence changes later, then the skill page offers "Ask AI again"; Pharoam never judges again on its own.
- **S16.13** Given a skill with an accepted `ai-judged` level and a `self-reported` one, then its shown level is the newer of the two (C4), and the gap view labels it by its source.
- **S16.14** Given a session with nothing pending, then it is marked complete and kept as a readable record, unless I delete it.

### S17. See what was read, sent and written
*As a user, I want to see exactly what each AI call sent and what came of it, so that I can trust what happens to my data.* Implements D4, J3.

- **S17.1** Given any AI call, then it has a call record: the task, the model, the time, exactly what was sent, and whether the answer was accepted, rejected by the schema or discarded.
- **S17.2** Given the transparency view, then it lists this session's calls, newest first, and shows each one's call record in full.
- **S17.3** Given call records, then they are kept in memory for the session only, so nothing sent is copied into my storage; each record written from a call carries its summary in its `ai` block (hard rule 2).

### S18. Ask what my gap might mean
*As a user, I want an explanation of my gap to a pathway, with places I could start, so that I know what to do next.* Implements D3, D6.

- **S18.1** Given a gap and a model, when I ask for an explanation, then I'm shown what will be sent (the gap, the pathway and the titles of the evidence my levels cite) and its size before the task `explain-gap@1` runs.
- **S18.2** Given the answer, then the gap view's card shows it labelled, with the model's name and the disclaimer; the places to start name only the pathway's requirements; it changes no level and shows no score (R1).
- **S18.3** Given the explanation, then I can accept it as a note, edit it, or discard it, and nothing is written until I accept.
- **S18.4** Given I accept it, then a `note/1` record is written to `notes/` with the pathway pinned to its version and the time of the gap it explained (data model §10); it is never rewritten, and asking again writes a new note.
- **S18.5** Given a note, then the gap view shows the latest one, and says so when my profile has changed since the gap it explained.

# Pharoam MVP and release plan

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Date** | 25 October 2026 |
| **Source** | [PRD](PRD.md) (what the whole product does) · [Charter](CHARTER.md) (why) |
| **Status** | Agreed scope for the first release. Stories and acceptance criteria are the definition of done: each criterion becomes a failing test first (ENGINEERING §1). §7 records everything the MVP leaves out, so later work can resume from it. |

## 1. What the MVP proves

**Pharoam can hold a real, evidence-based skills profile in the person's own folder, and show the honest gap to a career pathway, with no AI and no server.**

- **Map + a thin slice of Explore.** Map alone would be a structured notebook; the gap view is the first thing only Pharoam does.
- **Minimal mode only.** It tests the foundations everything else stands on (file format, connector, data model, gap logic) before AI is added. AI waits for spike S2 anyway.
- **Built for the founder first** (Charter §2). v1 validation means the founder using it on their own profile (§4).

## 2. Releases

| Release | Adds | Main PRD areas |
|---|---|---|
| **v0.1 MVP** | Profile in a local folder, evidence by forms, skill records, capability view, 4 pathways, gap view | A, B, C, F (part), I (part) |
| **v0.2** | AI-assisted mode: model settings, normalising pasted text, proposed observations, overall level, AI view in gaps; attachments | D, B3, B5, C4, J1 |
| **v0.3** | Assessments: multiple-choice, open-answer and practical (AI review) | E |
| **v0.4** | Learning plans and aspirations; pathway comparison | G, F2 |
| **Later** | Career readiness, more connectors and browsers, offline app, sharing, operator toolkit | H, A3, K, L |

Order after v0.1 can change as v0.1 teaches us; §7 keeps the full list.

## 3. v0.1 scope

**In:**
- **One connector: a local folder**, chosen with the browser's File System Access API. An Obsidian vault is just a folder.
- **Desktop Chromium browsers only** (Chrome, Edge, Brave, Arc). Other browsers see a clear "not supported yet" page.
- **Profile records:** `pharoam.md`, evidence, skill records and stored gap analyses, in the folder layout of [data model](design/data-model.md) §8.
- **Evidence by structured forms** for five kinds: project, job, course or module, certificate, other. Links, no attachments.
- **Observations** labelled `self-reported` or `evidenced` only. Corrections and retractions are appended, never edited.
- **Skill vocabulary:** a curated subset (about 200–300 skills) of the MIND Tech Ontology fork, with stable Pharoam slugs. One shared description of levels 0–4, plus skill-specific descriptions for the skills the 4 pathways require. **Custom skills** for anything missing, marked as the person's own.
- **4 pathways:** frontend engineer, backend engineer, machine-learning engineer, applied AI engineer. Each has a summary, requirements (skill, level, core or helpful), a source for every requirement, and a review record. AI-drafted, founder-reviewed (PRD I3), stored in `content/` and compiled into the built-in bundle (AD16).
- **Gap view** for any one pathway, saved as `gaps/<pathway>.md` and updated automatically.
- **Safety rules from day one:** edits made outside Pharoam are detected and never overwritten (AD10); invalid files go to "Needs attention"; sanitised Markdown rendering; all interface text translatable; WCAG 2.2 AA.
- **Deployment:** the static app on GitHub Pages (Personal model).

**Gap grouping (PRD F3)**, for a requirement of skill S at level L, using the latest level from each source:

| Group | Rule |
|---|---|
| **supported** | an `evidenced` (later also `demonstrated`) level ≥ L |
| **claimed** | not supported, but a `self-reported` (later also accepted AI) level ≥ L |
| **below** | S has observations, but none reach L |
| **unknown** | no observations for S |

The rules are checked from the top; the first that applies decides the group. So evidenced 2 and self-reported 3 against L = 3 is *claimed*, and the view shows both levels. Related skills never count for each other (no hidden inference, R4 and R6). Requirements show as core or helpful. There is no score or total (R1).

## 4. Exit criteria

v0.1 is done when **the founder has used it for their own profile for 2 weeks** and:
1. the profile holds **at least 20 evidence records and at least 30 skills**;
2. the gap view for at least one pathway is **judged accurate by the founder**;
3. **every file is readable and editable in Obsidian**, and the profile is understandable without Pharoam;
4. a file **edited outside Pharoam is detected, not overwritten**, in real use;
5. **every story's acceptance criteria pass** as automated tests, and **axe accessibility checks pass** on every screen;
6. `pnpm check` and CI are green.

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
*As a user, I want to record what I've studied and done in a structured form, so that it's stored the same way every time.* Implements B1, B4, B5 (forms only).

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
*As a user, I want to record my level in a skill, either from my own judgement or backed by evidence, so that every claim says where it came from.* Implements C1, C2, C5.

- **S6.1** Given a skill from the vocabulary, when I record a level 0–4 as my own judgement, then an observation with `provenance: self-reported` is **appended** to `skills/<slug>.md`, creating the file if needed.
- **S6.2** Given I link one or more evidence records, when I record a level, then the observation has `provenance: evidenced` and lists the evidence IDs. An `evidenced` observation without evidence can't be saved.
- **S6.3** Given levels, then the form shows the shared description of each level, or the skill-specific one where it exists.
- **S6.4** Given any new observation, then it carries `id`, `level`, `provenance`, `observed_at` and an `integrity` fingerprint, and existing entries in the file are byte-for-byte unchanged.
- **S6.5** Given the skill list, then only `self-reported` and `evidenced` can be chosen; `demonstrated` and `ai-inferred` aren't offered in v0.1.

### S7. Correct or retract what I said
*As a user, I want to correct or withdraw a level I recorded, so that mistakes are fixed without erasing history.* Implements C3.

- **S7.1** Given an observation, when I correct the level, then a new observation is appended with `supersedes` pointing to the old one, and the old entry is unchanged.
- **S7.2** Given an observation, when I retract it, then a review entry with `decision: retract` is appended, and the observation stops counting in the capability and gap views.
- **S7.3** Given a skill's history, when I view it, then every entry is shown in time order, including superseded and retracted ones, clearly marked.

### S8. Add a skill that isn't in the vocabulary
*As a user, I want to add a skill the vocabulary is missing, so that my profile isn't limited by Pharoam's list.* Implements C5.

- **S8.1** Given a name the search doesn't find, when I add it as a custom skill, then a skill record is created whose slug starts with `custom-` and which holds the name and an optional description.
- **S8.2** Given a custom skill, then it is marked "your own skill" everywhere it appears and works like any other skill in observations.
- **S8.3** Given a custom skill, then it never matches a pathway requirement, which always names inventory skills.

### S9. See what I can do
*As a user, I want one view of my skills and what each source says, so that I can see my profile at a glance.* Implements C4 (without the AI overall level).

- **S9.1** Given skills with observations, when I open the capability view, then each skill shows its latest level **for each source** and since when, with no combined or overall level.
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
- **S11.2** Given sources that disagree, then the view shows every source's level for that skill next to the group.
- **S11.3** Given the gap view, then there is **no score, percentage, total or ranking** anywhere (R1).
- **S11.4** Given I open a gap view, then `gaps/<pathway>.md` is written with the pathway pinned to its version and a readable summary in the body.
- **S11.5** Given my observations change, then the stored gap is regenerated and the view shows "Updated just now"; a refresh button does the same by hand.
- **S11.6** Given any pathway, including one where most requirements are *below* or *unknown*, then I can still choose to explore it (R2).

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

- **No spikes are needed for v0.1.** S1 (CORS) matters only for outside calls, S2 (LangGraph in the browser) only for AI, and S3 (WebAuthn PRF) only for the app lock. They come before v0.2.
- In this order:
  1. **Workspace packages:** `packages/core`, `packages/connector-folder`, `apps/web`, plus `content/` and `data/`.
  2. **Core first:** Zod schemas and codecs for `pharoam`, `evidence`, `skill-record`, `gap`, `skill` and `pathway`, with round-trip tests (ENGINEERING §4).
  3. **The shared connector test suite**, then the folder connector against it.
  4. **Content:** the skill-vocabulary subset and the 4 pathways, compiled into the built-in bundle.

## 7. Not achieved in the MVP

Everything here is part of the product (PRD) but left out of v0.1 on purpose. Each row says where it resumes and what to know when it does. **Keep this table current**: when an item ships, delete its row; when a release drops something, add it.

| Item | PRD / ADR | Planned | Notes for resuming |
|---|---|---|---|
| AI-assisted mode: model settings and keys | D5, J1, AD11 | v0.2 | Session-only keys by default; strict CSP; the provider interface already exists in the design |
| Normalising pasted text (CVs, module lists) | B3, B4, B5 | v0.2 | Registered task `normalise-evidence`; keep the original input as an attachment; preview and confirm already exist from S4.2 |
| Proposed observations (`ai-inferred`) | D1, D2, C1 | v0.2 | Accept, correct or reject as review entries; the S6 append logic already supports new provenance labels |
| AI overall level per skill | C4, ADR-0016 | v0.2 | AI-only, batched auto-refresh, dismiss or "I disagree"; add to S9 and the gap view's "AI view" |
| Transparency view (what was read, sent, written) | D4, J3 | v0.2 | Mostly meaningful once data is sent to a model |
| File attachments on evidence | B2 | v0.2 | `evidence/_attachments/<id>/`; needed for the original input of pasted text |
| Importers (LinkedIn export, GitHub, transcripts) | B3 | Later | Each one normalises into the standard evidence shape |
| Assessments: multiple-choice, open-answer, practical | E1–E7 | v0.3 | `demonstrated` observations; assessment evidence is never edited; sessions with readable logs (spike S2) |
| Learning plans | G1–G4 | v0.4 | Progress comes from new observations, not checkboxes |
| Aspirations (interests, goals, constraints) | Data model §10 | v0.4 | With learning plans |
| Pathway comparison side by side | F2 | v0.4 | The gap logic from S11 is reused per pathway |
| Pathway detail: time and cost with sources, prerequisites, uncertainties, transferable skills, ESCO occupations | F1, I2 | v0.4 | Every figure needs a cited source |
| Skill-specific level descriptions for all skills | Data model §11 | Ongoing | v0.1 covers only the skills the 4 pathways require |
| Full skill-vocabulary pipeline: ESCO, Wikidata and GitHub-topic cross-references, quarterly refresh | I1 | Later | [Research](research/skills-inventory.md); data licences stay in `data/` |
| More pathways and fields beyond computer science | I2, Charter §5 | Later | AI-drafted, founder-reviewed, then community contributions |
| Learning resources | I4 | Later | Sources still an open question (PRD §8) |
| More connectors: Git, Notion, cloud drives | A3, ADR-0013 | Later | Each passes the shared connector suite; Notion needs the relay |
| Firefox, Safari and mobile browsers | N8 | Later | Need a connector that doesn't depend on the File System Access API |
| Encrypted local cache, offline app, app lock | AD9, AD20, security §8 | Later | v0.1 reads the folder directly; the cache is never the master copy |
| Career readiness: job-search literacy, CV guidance, job analysis, interview practice, jobs bank, generated CVs | H1–H7 | Later | Only from real evidence (R9); never bulk applications (R8) |
| Self-hosted and operator-hosted deployments, relay | N4, L1–L5, ADR-0013 | Later | v0.1 is the Personal model on GitHub Pages only |
| Sharing | K1–K2 | Future | Depends on verifiable assessment results |
| Signed assessment results | Charter §6 | Future | `signature: null` is reserved in the format |
| Translations beyond English | N9 | Later | All text is already in translation files |
| Discovery with users beyond the founder | Charter §2, §9 | Before v0.2 or later audiences | v1 validation is the founder's own use (§4) |

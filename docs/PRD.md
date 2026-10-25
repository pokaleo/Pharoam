# Pharoam PRD

| | |
|---|---|
| **Version** | 0.1 (draft) |
| **Date** | 24 October 2026 |
| **Source** | [Charter](CHARTER.md) |
| **Status** | Blueprint of the whole product. It records what Pharoam does, not how it is built. The order of delivery, the MVP's stories and acceptance criteria, and what the MVP leaves out are in [MVP and release plan](MVP.md). Items marked **[Q]** are open. |

## 1. Goal

Pharoam helps a person build an evidence-based picture of their skills, see which career pathways are open to them, understand the gap to the one they choose, and learn toward it. The person decides throughout, and their profile stays entirely in storage they control (Charter §1).

## 2. Users

| Audience | Who | Notes |
|---|---|---|
| **First** | Technical, self-directed people, starting with the founder | Comfortable with Markdown, their own storage and bringing their own model key |
| **Next** | Adult CS students, recent graduates, early-career learners | Will need simpler storage and model options |
| **Later** | Professionals and career changers; anyone who needs basic AI literacy | Under-18s only after a safeguarding and privacy review |

### Deployment models

All three are first-class. The core product behaves the same in each.

| Model | Who runs it | Who pays for AI |
|---|---|---|
| **Personal** | Nobody: the user opens the static app | The user, with their own key |
| **Self-hosted** | An individual or team, on their own domain | Whoever configures the key |
| **Operator-hosted** | An organisation (charity, university, bootcamp) for its users | The operator, through the relay. Users can still bring their own key instead. |

### Modes

| Mode | Includes |
|---|---|
| **Minimal** (no AI; also covers offline) | Reading the existing profile and evidence through connectors · manual entry of evidence and observations · capability and gap views · browsing and comparing pathways · multiple-choice assessments (and, in future, automatically checked practical tasks) · learning plans |
| **AI-assisted** | Everything in Minimal, plus: normalising new free-form input into the standard shape and storing it · proposed observations · judging open-answer assessments · pathway explanations · resource suggestions |

The user can switch modes at any time. AI-assisted mode is available whenever a model is configured, either the user's own key or one provided by the operator. An operator may run a deployment as minimal-only.

## 3. Principles

Every requirement must satisfy the Charter's design rules **R1–R16**. In short: the person chooses (R1–R3); evidence and inference are kept apart (R4–R7); Pharoam teaches understanding, not application volume (R8–R10); the profile belongs to the person (R11–R14); the profile is lifelong and incremental (R15–R16).

## 4. Product map

| Area | Journey step | Purpose | First release ([MVP](MVP.md)) |
|---|---|---|---|
| A. Profile and storage | — | The user-owned profile and how Pharoam reaches it | v0.1 (local folder) |
| B. Evidence | Map | What the person has studied and done | v0.1 (forms); v0.2 (pasted text, attachments) |
| C. Observations and capabilities | Map | What there is reason to believe about their skills, and from which source | v0.1; v0.2 (AI overall level) |
| D. AI assistance | all steps | Proposals, explanations and suggestions, always gated by the user | v0.2 |
| E. Assessments | Assess | Turn claims into demonstrated evidence | v0.3 |
| F. Pathways and gaps | Explore | Career directions and how the person compares to them | v0.1 (gap view); v0.4 (comparison, full detail) |
| G. Learning plans | Learn | Steps toward a chosen pathway, with progress tracking | v0.4 |
| H. Career readiness | Prepare | CV, job analysis and interview practice, built only on real evidence | Later |
| I. Content | — | Skill vocabulary, pathways, assessment items and learning resources | v0.1 (subset, 4 pathways) |
| J. Settings and trust | — | Model choice, connections and transparency | v0.1 (connections); v0.2 (models, transparency) |
| K. Sharing *(future)* | — | User-controlled sharing with chosen people | Future |
| L. Operator toolkit *(lower priority)* | — | Safeguards for organisations hosting Pharoam for others | Later |

## 5. Functional requirements

### A. Profile and storage
- **A1** The user creates a profile, or opens an existing one, in storage they choose.
- **A2** The profile is human-readable files (Markdown first) and these files are the master copy. It stays fully usable without Pharoam.
- **A3** Pharoam reaches storage only through connectors, for example a local folder or Obsidian vault, a Git repository, Notion or a cloud drive. Connections can be revoked.
- **A4** No profile or evidence data is stored on any infrastructure running Pharoam.
  - On operator-hosted deployments, AI requests pass through the operator's relay but are never stored there.
  - The operator may hold only the minimal account data needed to run the service: an account identifier, eligibility status and usage counts.
  - *Details to be confirmed at implementation.*
- **A5** The profile keeps its history: what was believed, when, and on what basis.

### B. Evidence (Map)
- **B1** Record evidence: degrees, modules, certificates, jobs, projects, repositories, publications, reflections and other items.
- **B2** Evidence can carry descriptions, links and file attachments. Attachments are stored with the profile in the user's storage.
- **B3** Input can take many forms: manual entry, pasted text (a CV or module list), and dedicated importers (for example a LinkedIn export, GitHub or transcripts).
- **B4** Whatever the input, evidence is **normalised into one standard evidence shape before it is stored**. That gives the same structure for processing and the same readable layout for people.
  - Manual entry uses structured forms that write the standard shape directly, so minimal mode needs no AI for it.
  - AI is needed only for free-form input (pasted CVs, messy text).
  - *Exact form design: to be detailed at implementation.*
- **B5** The user previews and confirms normalised evidence before it is stored. The original input is kept, attached as the record's source, unless the user chooses to discard it.

### C. Observations and capabilities (Map)
- **C1** An observation records one skill, at one level, from one source, with exactly one provenance label: `self-reported`, `evidenced`, `demonstrated` or `ai-inferred` (R4).
- **C2** Levels use a single scale: 0 aware · 1 beginner · 2 working · 3 proficient · 4 expert.
- **C3** Observations are never silently changed. Corrections and retractions are recorded as history.
- **C4** A capability view shows, for each skill, what each provenance label says and when. In AI-assisted mode, an optional **overall level** judged by AI is also shown. It is labelled and explained, recalculated visibly when the skill changes, and can be dismissed or marked "I disagree". It is never calculated by a hidden formula (R4, R6).
- **C5** Skills come from a shared vocabulary (see I1).

### D. AI assistance (all steps)
- **D1** AI can propose observations from evidence. Each proposal comes with an explanation, its limits and the AI disclaimer (D6). **There are no confidence levels anywhere in Pharoam**: the user's decision is the only gate.
- **D2** Proposals count only after the user accepts them. The user can also correct or reject them (R5).
- **D3** AI can explain pathways, suggest learning resources and draft assessment feedback. All of it is advisory and labelled as AI output.
- **D4** Only the data a task needs is sent to the model (R12). The user can inspect what was sent and what came back.
- **D5** The user chooses the model provider, including self-hosted models.
- **D6** Everything AI generates or judges (proposals, normalised evidence, assessment judgements, explanations) is **labelled as AI-made, names the model used, and carries a clear disclaimer**.

### E. Assessments (Assess)
- **E1** Three formats: multiple-choice knowledge checks, practical tasks (for example coding exercises) and open-answer questions judged by AI. Practical tasks start with **AI review**. Automatic checking by running code in a sandbox is a future feature.
- **E2** **Every assessment attempt is recorded as evidence**, in the standard evidence shape (B4). The record holds the questions, the answers, the judgement and what made the judgement, so the result can be checked later.
- **E3** For open answers, the AI analyses the answer first. Its judgement is stored in the evidence record together with the full questions and answers.
- **E4** Results from all three formats are **treated equally**, with no confidence weighting. Every AI judgement is labelled and disclaimed (D6).
- **E5** Assessment results produce `demonstrated` observations that link to the assessment evidence.
- **E6** Assessments complement what the user has declared rather than repeating it back (R7).
- **E7** Results can't be verified independently at first (honour system).

### F. Pathways and gaps (Explore)
- **F1** Browse career pathways. Each has requirements (skill, level, importance), prerequisites, an estimated time and cost investment with cited sources, known uncertainties, and transferable skills.
- **F2** Compare two or more pathways side by side.
- **F3** The gap view shows each requirement as *supported* (demonstrated or evidenced), *claimed* (self-reported or accepted AI inference only), *below* or *unknown*. *Supported* never means verified (R6): the view says what it rests on, either evidence the user linked themselves or an assessment Pharoam recorded, and keeps the two apart. There is never a fit score (R1).
- **F4** The user can choose any pathway, including a low-fit or demanding one (R2).

### G. Learning plans (Learn)
- **G1** Create a plan toward a chosen pathway, with target levels per skill and steps.
- **G2** Steps link to materials, exercises and reviews.
- **G3** Progress comes from new observations (ideally demonstrated ones), not checkboxes alone.
- **G4** Plans can be revised, abandoned or switched to another pathway at any time.

### H. Career readiness (Prepare)
- **H1** Job-search literacy: how to read job ads and what employers actually assess.
- **H2** CV guidance grounded in the person's evidence. Pharoam never invents experience (R9).
- **H3** Job-specific analysis against an employer's published requirements.
- **H4** Interview practice tailored to the person's evidence and the role.
- **H5** No bulk or automated applications (R8).
- **H6** *(Deferred)* A **jobs bank**: the person searches, filters and saves job postings to their profile, so they can analyse them against their evidence (H3). It is for considered applications, never volume (R8).
- **H7** *(Deferred)* **Generated CVs** are saved to the profile as versioned records, built only from the person's evidence (H2).

### I. Content
- **I1** A Pharoam-owned skill inventory that links modules, evidence, observations and pathways, built by combining open sources ([research](research/skills-inventory.md)):
  - **forked from the MIND Tech Ontology** (MIT), with stable Pharoam IDs;
  - each skill **cross-referenced** to ESCO, Wikidata and GitHub-topic IDs where they exist;
  - **ESCO** as the layer of occupations and transferable skills that pathways build on;
  - **refreshed on a regular cycle** (for example quarterly) by comparing against GitHub Explore topics, with additions accepted through reviewed changes;
  - **data licences kept separate from the AGPL code**, in a `data/` area with its own LICENSE and NOTICE files and the required ESCO attribution.
- **I2** Pathway content, versioned and reviewable, with sources for every figure.
- **I3** Pathways and assessment items are AI-drafted, human-reviewed and founder-curated, and later open to community contributions. Each has a clear licence.
- **I4** Learning resources may come from many channels. **[Q] Sources to be explored later.**

### J. Settings and trust
- **J1** Configure model providers and keys. Keys stay under the user's control. On operator-hosted deployments, users can use their own key instead of the operator's.
- **J2** Manage storage connections.
- **J3** A transparency view: what Pharoam has read, sent and written.
- **J4** No telemetry or analytics, ever.
- **J5** Diagnostics, privacy first:
  - **Personal and Self-hosted deployments:** completely private. Diagnostics stay in a local log in the browser. The user can export it, with personal content removed, to attach to an issue. Nothing is ever sent automatically. The only outbound traffic is AI calls to the model provider the user chose, and there is none at all with a local model.
  - **Operator-hosted deployments:** the relay keeps a metadata-only audit log (see L4).

### L. Operator toolkit (lower development priority)
- **L1** Access control chosen by the operator: sign-in, invite codes or eligibility rules.
- **L2** Usage limits: quotas and rate limits per user, an overall spending cap, and a kill switch for operator-funded AI.
- **L3** The relay accepts only Pharoam's own AI tasks, never arbitrary prompts, so it can't be used as a free general-purpose chatbot.
- **L4** Audit log, metadata only: time, pseudonymous user ID, task type, tokens used and status. No content, and a configurable retention period.
- **L5** Templates for an acceptable-use policy, terms of service and a privacy notice. Legal compliance remains the operator's responsibility; Pharoam provides tools and templates, not legal advice.

### K. Sharing (future)
- **K1** The user can selectively share parts of their profile with people they choose, such as mentors or employers, as an export they control or a time-limited link. This depends on verifiable assessment results.
- **K2** There is never a public profile directory or a searchable database of people.

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| N1 | **Privacy.** No profile data on any infrastructure running Pharoam (A4). Data minimisation (R12). No training on user records (R13). |
| N2 | **Portability.** The profile is readable and usable without Pharoam. |
| N3 | **Model-agnostic.** No dependence on a single provider. |
| N4 | **Self-hostable.** Anyone can run their own copy. |
| N5 | **Accessibility.** WCAG 2.2 AA. |
| N6 | **Longevity.** The profile format stays stable and versioned for years. |
| N7 | **Licence.** AGPL-3.0-only. Content licences are compatible and recorded. |
| N8 | **Modes and devices.** Every feature except those listed under AI-assisted in §2 Modes works in minimal mode, including offline. Desktop first, readable on mobile. |
| N9 | **Languages.** English first, built for translation from the start: no hard-coded interface text, and content packs can carry translations. |

## 7. Non-goals

These are permanent, not just out of scope for now (Charter §5):
- bulk or automated job applications;
- hiring, placement or recruiter-side tooling;
- rankings or "employability" scores;
- promises of jobs, salaries or outcomes;
- dependence on a single AI model provider;
- holding user data on Pharoam infrastructure.

## 8. Open questions

1. Learning resource channels (I4). Deferred.

**Deferred to implementation:** the design of the evidence forms (B4) and the details of operator account data (A4).

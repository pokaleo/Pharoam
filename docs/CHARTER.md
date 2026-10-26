# Pharoam Charter & Product Vision

| | |
|---|---|
| **Version** | 0.2 (draft) |
| **Date** | 25 October 2026 |
| **Licence** | AGPL-3.0-only |
| **Status labels** | **Agreed**: direction chosen. **Proposed**: working position, open to change. **Open**: not yet decided. |

This is Pharoam's founding document. It says what Pharoam is, what it refuses to be, the idea at its centre, and how the project is run. The README, design records, roadmap and website are all derived from it. When they disagree with it, either fix them or change this document deliberately.

---

## 1. What Pharoam is

Pharoam is an open-source, self-hostable web application that keeps no user data of its own. It helps people understand what they know, what they can show, which career paths are open to them, and what it would take to follow the path they choose.

Its centre is a **personal knowledge profile**. The profile grows over a person's life with their learning, work, projects and reflection, and it records where each claim about them came from. Pharoam uses the profile to explain options. It never chooses for the person.

### The name

**Pharos** + **roam**. The Pharos of Alexandria was the lighthouse of the ancient world. A lighthouse doesn't steer the ship. It shows what's there so the person at the helm can choose. *Roam* is the freedom to explore, change direction and take the long way round.

> The lighthouse does not choose the road. It helps people see it.

### Goals

*Agreed. What Pharoam is for; §8 says how we'll know.*

1. **An honest picture.** Give each person an evidence-based, portable picture of their skills, where every claim says where it came from.
2. **Honest options.** Show the real gap to any pathway the person chooses, without scores, rankings or promises.
3. **Learning that shows.** Help them learn toward a chosen pathway, with progress shown in evidence and assessments rather than ticked off.
4. **Ownership without compromise.** Prove that this works with the person's data only in storage they control, and no server holding it.

---

## 2. The problem and who it's for

AI and the wider changes in technology are making careers harder to read. Students struggle to see how their courses, assessments and projects connect to real work. Working professionals struggle to see which of their skills carry over to a new role, and what they would need to learn.

Existing tools each cover part of this. Courses teach, CV builders format, job boards list, and interview bots drill. None of them builds a continuous, evidence-based picture of the person. Many push toward volume: more applications, more keywords, more noise. A [comparison with existing tools](research/discovery.md) found the same: each covers one slice, most reduce the person to a score or ranking, and almost none lets the person hold their own data.

**v1 users** (Agreed): **technical, self-directed people like the founder.** They are comfortable with Markdown, their own storage and bringing their own AI model key. The founder builds for themselves first and tests every v1 decision on their own real situation; **v1 validation is the founder's own use** ([MVP](MVP.md) §4). This is a deliberately biased starting sample, and later audiences need their own discovery before they are targeted.

**Next users** (Proposed): adult computer-science students, recent graduates and early-career learners exploring technical careers, including less technical users who will need simpler storage and model options.

**Later users** (Proposed):
- engineers, data and AI practitioners, and career changers who want to understand where they could go next and what it would take;
- anyone who needs basic AI literacy to make informed choices about learning and work.

The first release assumes adult users (18+). Supporting younger learners would need a dedicated safeguarding and privacy review first.

---

## 3. Principles and design rules

Each principle comes with rules that a design or a pull request can be checked against. A feature that breaks a rule needs an explicit change to this charter, not an exception.

### 3.1 The person chooses
- **R1.** Pharoam never presents a single "best career" or an overall ranking of a person.
- **R2.** A user can pick any path, including one Pharoam rates as a weak fit or demanding. Pharoam's job is then to make clear what lies ahead, not to discourage them.
- **R3.** A recommendation is always advisory and shown with its reasoning and limits.

### 3.2 Evidence and inference are kept apart
- **R4.** Every observation in a profile has exactly one **provenance** label:
  - `self-reported`: the user said so;
  - `evidenced`: the user linked it to one or more evidence records (a certificate, transcript, repository, job or work sample). The level is still the user's claim; Pharoam doesn't check that the evidence shows it;
  - `demonstrated`: shown in a Pharoam assessment or practical task;
  - `ai-inferred`: proposed by a model from other evidence.
  A capability shown to the user is built from its observations and always shows the breakdown by provenance. A blended overall level may exist **only as an AI judgement**: labelled, explained, dated and based on stated inputs, and never calculated silently by a hidden formula or required. Without AI, only the breakdown is shown.
- **R5.** Every `ai-inferred` observation carries an explanation, its known limits and a clear AI disclaimer. There are no confidence scores. It counts only after the user accepts it, and the user can also correct or reject it.
- **R6.** Nothing is presented as independent verification unless someone independent checked it: not model output, and not a user's own link between a claim and evidence. The interface keeps evidence the user linked apart from performance Pharoam recorded.
- **R7.** Assessments complement what the user has declared rather than repeating it back. They test, they don't echo.

### 3.3 Teach understanding, not application volume
- **R8.** No one-click bulk job applications, now or later.
- **R9.** Career-readiness features (CV help, job analysis, interview practice), when they arrive, are built on the person's real evidence and the employer's published requirements. They never invent experience.
- **R10.** Success is never measured by engagement time, application count or "fit scores" (see §8).

### 3.4 The profile belongs to the person
- **R11.** No infrastructure running Pharoam stores profile data. An organisation hosting Pharoam for others may hold only the minimal account data needed to run the service. The profile lives in storage the user chooses, as readable, portable files (Markdown first). The user can read, correct, move and delete it directly, with or without Pharoam.
- **R12.** Collect only what the feature needs. Data isn't collected just because a model could use it.
- **R13.** User records are never used to train models by default. Any such use would require a separate, explicit opt-in design.
- **R14.** Pharoam reads and writes the profile only through **connectors** to storage the user chooses (for example a local folder or Obsidian vault, a Git repository, Notion or cloud drives). Each connection is the user's choice and can be revoked.

### 3.5 Lifelong and incremental
- **R15.** The profile is a living record with history, not a one-off snapshot. Claims can strengthen, weaken or expire over time.
- **R16.** Start small and measure. Each feature must be useful on its own before the platform grows wider.

---

## 4. The core idea: the personal knowledge profile

*Agreed. The concept; the specification is the [data model](design/data-model.md).*

```
Profile (user-owned files)
 ├─ Evidence ───────────────┐   artefacts: degree, module, certificate, job,
 │                           │   project, repository, reflection
 ├─ Observation ◀────────────┘   "at time T, from source S: skill K at level L"
 │    · one provenance (R4) · immutable · may supersede earlier observations
 ├─ Review                       accept / reject / retract an observation
 ├─ Aspiration                   interests, goals, constraints
 └─ Learning plan ───▶ steps toward a chosen Pathway

Generated (stored for readability, regenerated by Pharoam)
 ├─ Capability   per skill: latest effective level for each provenance
 └─ Gap          pathway requirement vs capability, grouped by how well supported

Pathway (versioned content packs, not personal data)
   requirements · prerequisites · learning investment ·
   time and cost (sourced) · uncertainties
```

Key relationships:
- **Observations** link to the **evidence** behind them. One piece of evidence can support many observations.
- **Levels** use one five-step scale: 0 aware · 1 beginner · 2 working · 3 proficient · 4 expert.
- A **gap** is always shown with the provenance of the observations involved. It is never shown as a single score.
- A **skill inventory** (the shared vocabulary linking modules, evidence, observations and pathways) is a foundational dependency. **Agreed:** Pharoam keeps its own inventory, forked from the MIND Tech Ontology and cross-referenced to ESCO, Wikidata and GitHub topics (PRD I1). Profiles reference skills by Pharoam slug only; people can add custom skills of their own.

---

## 5. Scope

### The user journey
1. **Map**: bring in what you've studied and done (degree modules, projects, jobs, certificates) and state your interests.
2. **Assess**: knowledge checks, structured self-assessment and practical tasks that turn claims into demonstrated evidence.
3. **Explore**: compare two or more plausible pathways, with their prerequisites, gaps, learning investment and trade-offs, without suitability ever presented as certain.
4. **Learn**: a personal learning plan with materials, exercises and reviews, and progress tracked against real outcomes.
5. **Prepare** *(later)*: job-search literacy, evidence-based CV guidance and interview practice.

### First version (Agreed)
Steps 1–4, narrowed to computer-science and adjacent technical pathways, running as a browser-based web app over a profile in the user's own storage. It is delivered in small releases ([MVP and release plan](MVP.md)):
- **v0.1, the MVP:** Map plus the gap view of Explore, with no AI, over a local folder;
- **v0.2:** AI assistance; **v0.3:** assessments (Assess); **v0.4:** learning plans and pathway comparison (Learn, the rest of Explore).

What each release leaves out is recorded in MVP §7, so nothing is dropped silently.

### Later
Step 5, more fields, multi-language support, more connectors and browsers, and larger deployments.

### Constraints
*Agreed. The limits every plan has to fit.*
- **One developer**, the founder, working with AI coding agents. Scope stays small (R16), and machine-checked standards take the place of much of the review a team would do ([Engineering standards](ENGINEERING.md)). What a machine can't check, such as whether tests were written first, is still the founder's review (ENGINEERING §10).
- **No servers holding user data, and none run by the project** (R11). The official app is a static site on GitHub Pages, so running costs stay near zero.
- **No AI cost to the project.** Users bring their own model key, or an operator pays for its own users.
- **Browser limits.** Storage reached directly from the browser depends on browser support; the first connector (a local folder) works in desktop Chromium browsers only.
- **Licences.** Code is AGPL-3.0-only. Skill and occupation data keep their own licences (MIT for the MIND fork, ESCO's attribution terms), kept apart in `data/`.
- **Closed to outside pull requests** until contributor terms exist (§7).
- **Accessible and translatable from the start:** WCAG 2.2 AA and English first, with no hard-coded interface text.

### Non-goals
- Bulk or automated job applications (R8).
- Hiring, job placement or recruiter-side tooling.
- Overall "employability" scores or rankings of people (R1).
- Promising any job, salary or outcome.
- Dependence on a single AI model provider.

---

## 6. Technical direction

*Direction only. The concrete choices are in [Architecture](ARCHITECTURE.md) (AD1–AD23) and its design records under `docs/adr/`.*

- **No profile data on any infrastructure running Pharoam** (Agreed): the profile lives in storage the user chooses and is reached through connectors (R11, R14). Pharoam has no profile database. Operator-hosted deployments may hold only minimal account data.
- **Form** (Agreed): a web application whose core **runs entirely in the browser** and can be served as a static site. Self-hosting it is as simple as hosting static files.
- **Optional relay** (Agreed): a small, self-hostable service that **stores nothing between requests**. It can be added later for things a browser can't do alone, such as OAuth sign-in to some connectors, passing model calls through, and signing assessment results.
- **Canonical data format** (Agreed): the profile is human-readable files (Markdown first) in the user's storage. They are the master copy, not an export.
- **Model-agnostic** (Agreed): model calls go through an abstraction layer. The user (or a relay operator) chooses the provider and supplies the key, including self-hosted models. Model calls can be inspected by the user.
- **Inference behind a gate** (Agreed): model output enters the profile only as `ai-inferred` observations awaiting the user's review (R5). It never directly changes `evidenced` or `demonstrated` observations.
- **Assessment integrity** (Agreed for v1): honour system. `demonstrated` means "recorded by a Pharoam assessment" and is not tamper-proof. The format reserves a signature field for later.
- **Data minimisation** (Agreed): features declare which data they read, and nothing is sent to a model provider beyond what the feature needs.
- **Accessibility** (Agreed): WCAG 2.2 AA as the baseline for the web interface.
- **Decided since:** TypeScript throughout, React + Vite, LangChain.js + LangGraph.js behind Pharoam's own interfaces (ADR-0002, 0008, 0012); the **local folder connector first**, the others tracked as issues (MVP §7); the relay's scope (ADR-0013).

---

## 7. Licence, ownership and contributions

- **Licence** (Agreed): GNU Affero General Public License v3.0 only (SPDX `AGPL-3.0-only`), using the unmodified official text in `LICENSE`. Commercial use is allowed. Anyone running a modified version as a network service must offer its source code to that service's users.
- **Copyright** (Agreed): held by the original author(s). Contributors would keep copyright in their own contributions unless they explicitly agree otherwise.
- **Contributions** (Agreed): **closed to outside pull requests for now.** Issues, ideas and discussion are welcome. Before outside code is accepted, the project will adopt written contributor terms.
- **DCO or CLA** (Open, decide before the first outside contribution): a Developer Certificate of Origin (DCO) only confirms that a contributor may submit their code under AGPL-3.0-only. It gives no one the right to relicense it, so a proprietary or dual-licensed version would then need every contributor's agreement. Keeping that option needs a Contributor Licence Agreement (CLA) or another written licence grant **from the first outside contribution**, because rights are hard to collect afterwards. Forking an AGPL repository does not remove its obligations.
- **Who would hold the rights** (Open): if a CLA is chosen, who receives the grant (the founder personally, a company or a charity), and how conflicts of interest are handled when these are different people or organisations.
- **Funded or commissioned work** (Open): before any organisation funds or commissions work on Pharoam, a written agreement says who owns the copyright, that the work is released under AGPL-3.0-only and the project's contributor terms, and how conflicts of interest are declared.
- **Name and logo** (Proposed): the code licence does not cover the Pharoam name or logo. A short trademark-use policy will be written before the project is promoted publicly.
- **Pending, first:** confirm that no employment contract or third-party agreement claims rights in the founder's work on Pharoam. This affects code that already exists, so it comes before the other open points.

---

## 8. What success means

Pharoam succeeds when people understand themselves and their options better, not when they use it more.

**Signals we care about:**
- users can name their strengths and gaps, and say where each claim came from;
- learning progress shown in assessments, not just claimed;
- awareness of more than one viable pathway and its trade-offs;
- confidence in a self-chosen plan;
- accessibility and satisfaction.

Outcomes are reported only in aggregate, with their uncertainty and possible bias, and are never presented as proven causal effects.

**v1 success criteria** (Agreed). Checkable, and none of them counts usage (R10):
1. **The MVP exit criteria are met** ([MVP](MVP.md) §4): the founder keeps their real profile in Pharoam for 2 weeks, and judges the gap view to a pathway accurate.
2. **The profile stands on its own:** every file is readable and editable without Pharoam, and no edit made outside it is ever lost.
3. **Every claim has a source:** for each skill in the profile, the founder can say where each level came from, from the capability view alone.
4. **Each later release adds its own check**, written into the MVP plan before it's built (for example: v0.3 shows progress in assessments, not just claims).
5. **No user data on any server**, confirmed by the app making no requests in v0.1 beyond loading itself.

---

## 9. Roadmap of foundational deliverables

| # | Deliverable | Status |
|---|---|---|
| 1 | This charter | Draft (v0.2) |
| 2 | `README.md` derived from the charter | Done |
| 3 | [PRD](PRD.md): the whole product blueprint | Draft |
| 3a | [MVP and release plan](MVP.md): stories, acceptance criteria, what's deferred | Done |
| 4 | [Architecture](ARCHITECTURE.md): decisions AD1–AD23, ADRs 0001–0018, data model, interfaces, security | Decided; design system deferred; spikes S1–S3 pending (none needed for v0.1) |
| 4c | [Engineering standards](ENGINEERING.md) and agent instructions, enforced by hooks and CI | Done; waiting to be merged |
| 4b | [Implementation plan](ROADMAP.md) and GitHub project | Plan done; GitHub project next |
| 4a | Storage connectors: one issue per connector | Local folder in v0.1; the rest after |
| 5 | Skill-inventory decision (§4) | Decided (PRD I1) |
| 6 | Discovery: a [comparison with existing tools](research/discovery.md), then talking to target users before each new audience | Comparison done; v1 validation is the founder's own use |
| 7 | Landing page: a static site (Astro) in `site/`, deployed to GitHub Pages. It starts as a manifesto-style page and grows into a full product page once something ships | Proposed |
| 8 | Trademark-use policy and contributor terms (§7) | Trademark policy before promotion; employment-rights check now; DCO or CLA, rights holder and funded-work terms before the first outside PR or funded work |

---

## 10. Decision register

| ID | Decision | Status |
|---|---|---|
| P01 | Name: Pharoam (*pharos* + *roam*) | Agreed. Mark and domain checks pending |
| P02 | Licence: AGPL-3.0-only | Agreed and applied in `LICENSE` |
| P03 | Outside pull requests not accepted yet; DCO/CLA before any are | Agreed |
| P04 | Form: web app whose core runs in the browser (static site), plus an optional relay that stores nothing | Agreed |
| P05 | Provenance labels on every observation (R4) | Agreed |
| P06 | No bulk applications, rankings or outcome promises (§5 non-goals) | Agreed |
| P07 | Model-provider agnostic; no training on user data by default | Agreed |
| P08 | v1 users: technical, self-directed people like the founder. CS students and early-career learners come next. | Agreed |
| P09 | First-version scope: journey steps 1–4, delivered as v0.1–v0.4; v0.1 is Map plus the gap view, with no AI ([MVP](MVP.md)) | Agreed |
| P10 | Landing page: static Astro site on GitHub Pages | Proposed |
| P11 | Stack, connector order, relay scope, skill inventory | Agreed: see §4, §6 and [Architecture](ARCHITECTURE.md) |
| P12 | No profile data on any infrastructure running Pharoam; the profile lives in user-chosen storage via connectors. Operators may hold only minimal account data. | Agreed |
| P13 | Two-layer model: immutable observations with one provenance each → derived capability views | Agreed |
| P14 | One five-step level scale (0 aware … 4 expert) | Agreed |
| P15 | `demonstrated` uses the honour system in v1; signature field reserved | Agreed |
| P16 | Goals (§1), constraints (§5) and v1 success criteria (§8) | Agreed |
| P17 | v1 validation is the founder's own use; each new audience gets its own discovery first | Agreed |
| P18 | Contributor terms: DCO or CLA, who holds any granted rights, terms for funded or commissioned work (§7) | Open. Decide before the first outside PR or funded work |

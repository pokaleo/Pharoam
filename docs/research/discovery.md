# Research: existing tools and where Pharoam differs

| | |
|---|---|
| **Date** | 25 October 2026 |
| **Question** | Who already helps people understand their skills and career options, and what would Pharoam do that they don't? |
| **Method** | A desk scan of public product pages, docs and a research paper. Light by design: v1 is built for the founder, and each later audience gets its own discovery first ([Charter](../CHARTER.md) §2, P17). |

## Existing tools

| Category | Example | What it does | Where it stops |
|---|---|---|---|
| **Learning roadmaps** | [roadmap.sh](https://roadmap.sh/about) | Role-based and skill-based roadmaps listing what to learn; progress tracking with an account | Progress is ticked off, not evidenced; no assessment is confirmed; your data lives in their account |
| **Professional network profiles** | [LinkedIn](https://www.linkedin.com/help/linkedin/answer/94427) | Skills on a profile, linked to jobs, projects and credentials. **Skill Assessments have been discontinued.** Career Explorer (launched 2020) shows transferable skills as a **% match** to job titles | A % match is exactly the kind of score Pharoam rules out (R1); the data is LinkedIn's; Career Explorer's current status is unconfirmed |
| **Enterprise skill verification** | [Workera](https://www.workera.ai/platform/ai-agent/skills-assessments) | AI-led assessments rated against expert rubrics; verified proficiency fed into HR systems such as Workday; proctoring for hiring | Built for employers and hiring decisions, not for the person; scores flow to HR |
| **Job-search tools** | [Teal](https://www.toolsforhumans.ai/ai-tools/teal) | Job tracker, AI resume builder, a match score of resume against a job's keywords | Optimises applications and keywords, the volume Pharoam avoids (R8); no skills picture of the person |
| **Public career matchers** | [CareerOneStop Skills Matcher](https://cloudfront.careeronestop.org/Toolkit/Skills/skills-matcher-help.aspx) | Free; rate yourself on 40 skills, get a **ranked list** of 900+ O*NET occupations with pay and outlook | Self-rating only; a hidden statistical formula ranks you; US-only; nothing kept over time |
| **AI career coaches** | [Steve](https://ojs.aaai.org/index.php/AAAI/article/view/42376) (AAAI 2026 research), commercial tools such as Universal Skill Bridge | From a resume and a chat, a skill gap report against a role, with gaps ranked, and a learning plan | One-off analyses from a resume; AI judgement presented without the evidence behind each claim; data held by the service (commercial claims unverified) |
| **Learning and employment record (LER) wallets** | [LearnCard](https://github.com/learningeconomy/LearnCard) (Learning Economy Foundation, open source), [LER.me](https://about.ebsco.com/news-center/press-releases/ebscoed-expands-lerme-free-open-access-ler-talent-marketplace) (EBSCOed) | Person-held wallets for credentials, badges, skills and work history, on open standards | Store and share credentials; they don't assess, explain gaps or plan learning |
| **Open-source CV builders** | [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume) (MIT) | Self-hostable CV builder, no tracking, AI optional with your own key | A document generator, not a living skills record |

## What the scan shows

- **Each tool covers one slice**, as the Charter suggests: roadmaps teach, CV tools format, job tools track, matchers rank, wallets store.
- **Scores and rankings are the norm.** LinkedIn (% match), CareerOneStop (ranked occupations), Teal (match score) and the AI coaches (ranked gaps) all reduce the person to a number or an order.
- **Evidence and judgement are blurred.** Self-ratings, AI analysis and verified results are mixed, or only one kind is used. No tool shown here keeps them apart for each claim.
- **The data belongs to the service.** Only the LER wallets and Reactive Resume let the person hold their own data, and neither builds a skills picture.
- **Verification is hard to sustain.** LinkedIn dropped its skill assessments. Workera's verification serves employers and needs proctoring. Pharoam's honour-system `demonstrated` (P15) is the realistic start.
- **The gap-report idea is validated.** The AAAI 2026 Steve paper builds role gap reports and learning plans, which supports the PRD's direction. Pharoam's difference is in *how*: evidence per claim, no ranking, user-held data.

## Pharoam's differentiation

**Pharoam is the only tool here that keeps a lifelong, evidence-based skills profile in files the person owns, labels every claim with where it came from, and shows honest gaps to the pathways the person chooses, with no score, no ranking and no server holding their data.**

In detail, against the tools above:

| Pharoam | Instead of |
|---|---|
| Every claim has one provenance label: self-reported, evidenced, demonstrated or AI-inferred (R4) | Self-ratings, AI analysis and verified results mixed together |
| Gaps grouped as supported, claimed, below or unknown; no score (R1) | % matches, ranked occupations, match scores |
| A living record with history (R15) | One-off analyses of a resume |
| Markdown files in the person's own storage, readable without Pharoam (R11) | Data held in the service's account |
| AI optional, labelled, with the user's own key and the user as the only gate (R5) | AI judgement presented as fact |
| Understanding over volume (R8) | Optimising applications and keywords |
| Open source, AGPL, self-hostable | Closed commercial platforms |

## Risks this raises

- **Manual entry is work.** Tools that read a resume in seconds set the expectation. v0.2's pasted-text normalising matters; v0.1's 2-week founder test will show how tedious forms are.
- **"No score" may feel less helpful at first.** People are used to a number. The gap view must make the four groups clear enough to act on (MVP S11).
- **Pathway content is the hard part.** Matchers draw on O*NET's 900+ occupations; Pharoam starts with 4 hand-reviewed pathways. Quality over breadth, but breadth will be asked for.
- **Overlap with LER wallets later.** Sharing (PRD K) and signed results could use the open standards they build on (Open Badges, comprehensive learner records) rather than a format of our own.

## Validation plan

- **v1:** the founder's own use, against the MVP exit criteria ([MVP](../MVP.md) §4).
- **Before targeting the next audience** (CS students, early-career learners; Charter §2): talk to a handful of them about the journey and test whether the four gap groups are understood without a score.

## Not verified

- Product claims come mostly from vendors' own pages and third-party directories, not hands-on use. Commercial AI coach claims in particular are unverified.
- LinkedIn Career Explorer's current availability, and LearnCard's licence, weren't confirmed.
- The scan is not exhaustive; it covers one well-known example per category.

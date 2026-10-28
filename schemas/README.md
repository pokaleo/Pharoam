# Schemas

JSON Schemas for Pharoam's file formats, so any tool can check Pharoam's files without Pharoam (ADR-0007, data model §0).

Each record file names its format in its top block, for example `schema: evidence/1`. The schema for that format is `evidence-1.schema.json`. Each one describes the **top block** (the YAML between the `---` lines), not the Markdown body.

| Format | File | What it is |
|---|---|---|
| `pharoam/1` | [pharoam-1.schema.json](pharoam-1.schema.json) | The central record about the person, `pharoam.md` |
| `evidence/1` | [evidence-1.schema.json](evidence-1.schema.json) | Something the person studied or did |
| `skill-record/1` | [skill-record-1.schema.json](skill-record-1.schema.json) | One skill's history and shown level |
| `gap/1` | [gap-1.schema.json](gap-1.schema.json) | A stored gap analysis for one pathway |
| `skill/1` | [skill-1.schema.json](skill-1.schema.json) | An entry in the skill inventory |
| `pathway/1` | [pathway-1.schema.json](pathway-1.schema.json) | A career pathway |
| `pack/1` | [pack-1.schema.json](pack-1.schema.json) | A content pack's manifest |

## What they check

- **The file as written**, before Pharoam fills in defaults: a field Pharoam defaults, such as `ai`, may be left out.
- **Fields Pharoam doesn't know are allowed**, as Pharoam keeps them.
- **Values are read with YAML 1.2**, so `yes` and `2026-10-24` are strings.
- **Some rules can't be written in JSON Schema** and are checked only by Pharoam: an end date after its start, a name for a custom skill, a replacement for a deprecated skill, each pathway skill required once, and investment ranges from low to high.

## Licence

**CC0 1.0** (public domain dedication), not the AGPL that covers the code. See [LICENSE](LICENSE). Use them in any tool, open or closed, with no conditions.

## Changing them

Don't edit these files by hand. They are generated from the Zod schemas in `packages/core/src/schemas/`, and a test fails when they no longer match. After changing a Zod schema, regenerate them with `pnpm test -u` and commit the result. A changed file means a changed format: check whether the format needs a new version.

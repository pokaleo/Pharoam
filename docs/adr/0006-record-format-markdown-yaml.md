# ADR-0006: One data shape; Markdown files with a YAML top block

- **Status:** Accepted
- **Date:** 2026-10-24
- **Covers:** AD6, AD19

## Context
The profile lives in storage the user chooses: folders, Obsidian, Git, Notion and others. It must be exact enough to calculate with, readable by people, and a single consistent shape.

## Decision
- **One standard data shape per record type**: exact fields plus free text. The core only ever sees this shape.
- **File connectors:** each record is **one `.md` file**. The exact fields go in the YAML block between the `---` lines at the top (which Obsidian shows as Properties), and the free text goes in the Markdown body.
- **The Notion connector** maps the same shape to database properties and page content.
- Parsing uses **`yaml`** (YAML 1.2). Pharoam edits the document in place, so comments, field order and unknown fields survive.
- **Re-printing a parsed document can still change its layout** (line folding, quoting, indentation, where comments sit). Where a story promises bytes stay the same (MVP S3.2, S6.4), Pharoam **inserts text** instead of re-printing, then parses the result and checks that everything it didn't mean to change is byte-for-byte the same. If not, it writes nothing and reports the bug.
- Rendering uses **`react-markdown` + `rehype-sanitize`** with raw HTML disabled.

## Alternatives rejected
- **Plain Markdown only:** fields would be buried in prose, so every calculation would need AI. Minimal mode would be impossible.
- **Markdown and YAML in separate files:** one record becomes two files that can drift apart, and Obsidian wouldn't show the fields.
- **Pure JSON:** not readable by people (PRD N2).

## Consequences
YAML needs strict parsing and validation. Every connector must map the shape faithfully in both directions.

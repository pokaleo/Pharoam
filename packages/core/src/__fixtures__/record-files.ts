// Real-world record files for the codec tests (ENGINEERING §4). Kept as strings, not .md files, so line endings,
// byte-order marks and tabs stay exactly as written: git and editors would otherwise normalise them.

export interface CorpusFile {
  readonly name: string;
  readonly text: string;
}

const BOM = "\uFEFF";
const crlf = (text: string): string => text.replaceAll("\n", "\r\n");

/** Files that parse: each must survive read → write with its values, comments, field order and body intact. */
export const VALID_FILES: readonly CorpusFile[] = [
  {
    name: "written by Pharoam",
    text: `---
schema: evidence/1
id: 0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d
created: 2026-10-24T14:02:11Z
updated: 2026-10-24T14:02:11Z
ai: null
kind: project
title: Shell history search tool
skills:
  - python
  - sqlite
---
Built a small tool that indexes shell history into SQLite.
`,
  },
  {
    name: "edited in Obsidian",
    text: `---
schema: evidence/1
id: 0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d
created: 2026-10-24T14:02:11Z
kind: job
title: Data engineer at a logistics firm
tags:
  - work
  - "#career"
aliases: [Logistics job]
related: "[[Python]]"
cssclasses: wide-page
skills: [python, postgres, airflow]
---
# Data engineer

> [!note] Context
> Two years, mostly batch pipelines.

---

- Moved the nightly jobs to Airflow.
- [[Python]] and [[PostgreSQL]] every day.
`,
  },
  {
    name: "exported from Notion",
    text: `---
schema: evidence/1
id: 0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9e
created: 2026-10-24T14:02:11Z
kind: certificate
title: "AWS Certified Solutions Architect – Associate 🎓"
Created time: October 24, 2026 2:02 PM
Status: Done
Tags: Cloud, AWS, Architecture
URL: https://www.notion.so/AWS-Certified-Solutions-Architect-0192f3a17c2e7b449a1d3e5f6a7b8c9e
Notes: A very long property value that Notion exported on a single line, well past eighty characters, which must not be folded.
---
# AWS Certified Solutions Architect – Associate 🎓

| Domain | Score |
| --- | --- |
| Résilience | 86% |
`,
  },
  {
    name: "Windows line endings",
    text: crlf(`---
schema: evidence/1
id: 0192f3a1-7c2e-7b44-9a1d-3e5f6a7b8c9d
title: Written on Windows # a comment
---
Line one.
Line two.
`),
  },
  {
    name: "byte-order mark",
    text: `${BOM}---
schema: evidence/1
title: Saved by a Windows editor
---
Body.
`,
  },
  {
    name: "byte-order mark and Windows line endings",
    text: `${BOM}${crlf(`---
schema: evidence/1
title: Both
---
Body.
`)}`,
  },
  {
    name: "YAML 1.1 values",
    text: `---
schema: evidence/1
answer: yes
negative: no
switch: on
letter: y
octal_looking: 010
hex: 0x1F
octal: 0o17
sexagesimal: 1:20
date: 2026-10-24
nothing: ~
also_nothing: Null
capital: True
big: 12345678901234567890
exponent: 1e3
decimal: 0.10
plus: +12
infinite: .inf
---
`,
  },
  {
    name: "anchors and aliases",
    text: `---
schema: evidence/1
defaults: &defaults
  visibility: private
  reviewed: false
first: *defaults
second:
  <<: *defaults
  reviewed: true
---
`,
  },
  {
    name: "comments, blank lines and block scalars",
    text: `---
# Written by hand.
schema: evidence/1 # the record type

# What it was.
title: Thesis
summary: |
  Two lines
  kept as written.
abstract: >-
  Folded text
  on two lines.
kept: |+
  Trailing newlines kept.

# Trailing comment.
---
Body after comments.
`,
  },
  {
    name: "flow collections and quoted strings",
    text: `---
schema: evidence/1
skills: [python, sql]
meta: {source: import, version: 2}
quoted: "line one\\nline two"
single: 'it''s'
empty: ""
colon: "a: b"
---
`,
  },
  {
    name: "tabs inside values",
    text: "---\nschema: evidence/1\ntitle: a\ttabbed\tvalue\n---\n\tIndented body line.\n",
  },
  {
    name: "no newline at the end",
    text: "---\nschema: evidence/1\ntitle: Last line\n---\nNo newline at the end",
  },
  {
    name: "empty body",
    text: "---\nschema: evidence/1\n---\n",
  },
  {
    name: "a __proto__ field",
    text: "---\nschema: evidence/1\n__proto__:\n  polluted: true\n---\n",
  },
  {
    name: "an unknown tag",
    text: "---\nschema: evidence/1\ncustom: !mytag value\n---\n",
  },
  {
    name: "fences with trailing spaces",
    text: "---  \nschema: evidence/1\n--- \nBody.\n",
  },
];

/** Files that must be reported, never repaired or rewritten (data model §4, Needs attention). */
export const INVALID_FILES: readonly (CorpusFile & { readonly kind: string })[] = [
  { name: "an empty file", text: "", kind: "no-top-block" },
  { name: "a plain note", text: "# Notes\n\nNo top block here.\n", kind: "no-top-block" },
  { name: "a top block not on the first line", text: "\n---\nschema: evidence/1\n---\n", kind: "no-top-block" },
  { name: "a missing closing ---", text: "---\nschema: evidence/1\ntitle: Open\n\nBody.\n", kind: "unclosed-top-block" },
  { name: "tabs as indentation", text: "---\nschema: evidence/1\nmeta:\n\tsource: import\n---\n", kind: "invalid-yaml" },
  { name: "duplicate keys", text: "---\nschema: evidence/1\ntitle: One\ntitle: Two\n---\n", kind: "invalid-yaml" },
  { name: "an unclosed quote", text: '---\nschema: evidence/1\ntitle: "Open\n---\n', kind: "invalid-yaml" },
  { name: "bad indentation", text: "---\nmeta:\n  a: 1\n b: 2\n---\n", kind: "invalid-yaml" },
  { name: "an unknown alias", text: "---\nschema: evidence/1\nfirst: *missing\n---\n", kind: "invalid-yaml" },
  { name: "an empty top block", text: "---\n---\nBody.\n", kind: "not-fields" },
  { name: "a comment-only top block", text: "---\n# nothing yet\n---\n", kind: "not-fields" },
  { name: "a list", text: "---\n- python\n- sql\n---\n", kind: "not-fields" },
  { name: "a single value", text: "---\njust text\n---\n", kind: "not-fields" },
  {
    name: "an alias bomb",
    text: `---
a: &a [x, x, x, x, x, x, x, x, x, x]
b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]
c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]
d: [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]
---
`,
    kind: "too-many-aliases",
  },
];

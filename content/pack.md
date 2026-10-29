---
schema: pack/1
name: pharoam-core
version: 0.1.0
min_app_version: 0.1.0
publisher: The Pharoam authors
licences:
  - source: "Pharoam skill vocabulary (data/), including material from the MIND Tech Ontology"
    licence: MIT
    attribution: "Copyright (c) 2025 or-mihai-or-gheorghe; Copyright (c) 2026 The Pharoam authors"
    url: https://github.com/pokaleo/Pharoam/tree/main/data
  - source: "Pharoam content (content/): pathways"
    licence: CC-BY-SA-4.0
    attribution: "Pharoam content, by the Pharoam authors, CC BY-SA 4.0"
    url: https://github.com/pokaleo/Pharoam/tree/main/content
translations: [en]
---
# The built-in content pack

The manifest of the content pack that ships with Pharoam (ADR-0005, AD16). `pnpm content:build` compiles it with the
skill vocabulary in `data/` and the pathways in `content/` into one versioned JSON file, and fills in `contents` with
every skill and pathway it holds.

Raise `version` whenever the content changes. Raise `min_app_version` only when the pack uses something an older app
can't read.

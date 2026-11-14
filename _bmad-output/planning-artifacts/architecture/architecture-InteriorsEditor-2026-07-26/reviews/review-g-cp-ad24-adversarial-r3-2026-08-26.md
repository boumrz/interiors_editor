---
title: "AD-24 adversarial interoperability re-review R3"
review_type: focused-adversarial-architecture-gate
reviewed: 2026-08-26
prior_review: review-g-cp-ad24-adversarial-r2-2026-08-26.md
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../catalog-control-plane-alpha-decision-2026-08-26.md
  - ../../../../../contracts/catalog-control-plane/catalog-envelope-v1.schema.json
  - ../../../../../contracts/catalog-control-plane/catalog-envelope-v1.semantic.md
  - ../../../../../contracts/catalog-control-plane/fixtures/manifest.json
reviewed_snapshot:
  architecture_spine_sha256: a942b3d1891e92836b36c132ff1723cf37de00ae4bd60b31a1b34c7ac86163ae
  ad24_decision_sha256: 6d7b6345cb6b0752880199eded9b0e4f148cf3a7e3c2693d78bedc1e1aa1cb37
  envelope_schema_sha256: b7dbfa80392010d9e5ae475034599d48e46e5361087cf1d67e751b23dadf5e25
  semantic_profile_sha256: 3c1e1bd2663a18616dfb8341186d705099558f385847a76245332f01062acf01
  fixture_manifest_sha256: 45552243d3d1d318310fa0201573ba9a52954eb3859afc40e0b63c11c291d08b
verdict: CHANGES_REQUIRED
source_mutations: none
---

# AD-24 adversarial interoperability re-review R3

## Verdict

`CHANGES_REQUIRED`. The schema split, one-slot model, RFC 8785 storage,
semantic/HTTP/DDL profile, separate commands and narrowed Spine claim close the
named R2 contradictions. The remaining blockers are narrower, but they still
prevent one deterministic cross-language implementation and its required
negative corpus.

## Remaining blockers

- PNG admission requires “dimension/decode limits” without selecting pixel-width, pixel-height, decoded-byte, color/interlace or decompression limits. Kotlin seed validation and browser validation can therefore accept different exact thumbnail bytes. Fix the numeric PNG profile and one shared positive/hostile byte corpus.

- “Static-GLB preflight” is still a reference by name rather than a language-neutral algorithm. The current TypeScript implementation and a new Kotlin publisher can disagree on chunk grammar, URI/extension allowlists and decoded limits while both claim conformance. Name the normative GLB contract revision and provide identical binary fixtures/reason expectations for both implementations.

- A `color` variant carries only `#RRGGBB`; it does not define which model materials/primitives receive the color or the deterministic renderer transformation. The one-slot restriction removes composition ambiguity but not the effect itself. Define a whole-model tint/material rule or exclude color effects from this control-plane slice.

- The section labelled “Exact PostgreSQL data schema” is not exact enough to generate equivalent migrations: most table columns have no SQL types, nullability, defaults, foreign-key actions or literal check predicates. The prose “enum/limit checks” permits materially different accepted rows. Adopt normative SQL DDL or enumerate every column and constraint completely.

- Runtime startup must perform Flyway validation, but the runtime role is otherwise SELECT-only on catalog tables with a fixed `search_path`; no grant/search path is defined for `catalog_migration.flyway_schema_history`. One compliant role cannot validate, while another gains undeclared migration-schema access. Specify the runtime’s exact `USAGE`/`SELECT` needed only for Flyway history or move validation to a separate pre-run command with an explicit handoff.

- The publisher has direct `INSERT` on catalog tables, while hash/GLB/PNG/envelope correctness is enforced only by the Gradle process. The same credential can bypass that process and insert mismatched `bytea`, envelope bytes or metadata, so the required database negative corpus cannot prove such data “cannot” be persisted. Either make publisher-process validation the stated trust boundary and narrow the DB claim, or add database-enforced integrity/admission that remains compatible with the object allowlist.

- The no-Project negative claim remains content-impossible for free labels and opaque ids: a valid catalog label/id can contain a Project name or identifier without violating any structural schema. Evidence can prove absence of Project-shaped fields and request flows, not classify arbitrary text provenance. Rewrite the seed/database assertion structurally so it has a decidable pass condition.

- The external HTTP matrix says any `Cookie`/`Authorization` returns `400`, but the Rspack proxy is required to strip those headers before Ktor sees them. Through the actual smoke origin, the same prohibited request can become a successful anonymous GET. The proxy must reject with the fixed `400`, or forward unchanged for Ktor rejection; stripping alone contradicts the contract.

- Conditional resource `HEAD` is contradictory: one rule requires every bodyless/range-less `HEAD` to return full `200` headers, while another gives exact non-range `If-None-Match` a `304`. Select the result for `HEAD + If-None-Match` and add it to the shared HTTP corpus.

- The adapter may send a fixed `Accept` header, but neither allowed values nor server behavior for absent, mismatched, wildcard or multi-value `Accept` are defined. Metadata, GLB and PNG requests can therefore negotiate differently across Ktor and web tests. Fix exact request headers and rejection/ignore semantics.

- The timestamp grammar still delegates “real instant” to host parsers. It permits lexemes whose handling differs across Java and JavaScript, including leap seconds, year zero and boundary dates. Define the allowed year range, calendar validity and second range explicitly and add shared boundary fixtures.

- The mandatory fixture manifest does not exercise the newly blocking semantics: it has no valid color/model variant, duplicate/unsorted ids, footprint mismatch, invalid real date, RFC 8785 golden bytes/ETag, PNG/GLB byte admission, HTTP matrix or normalized-row round trip. Until those fixtures exist, the claim that Kotlin, TypeScript, fake and proxy smoke consume one conformance corpus is not executable.

A focused R4 need only verify these media, DDL/privilege, edge-HTTP and corpus
items; the R2 findings already closed do not need another full replay.

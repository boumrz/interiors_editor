---
title: "InteriorsEditor — rubric review: unified-root delivery and documentation layout"
review_type: architecture-rubric-layout
status: complete
reviewed: 2026-08-04
reviewer: "independent architecture rubric walker"
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../../../../../../AGENTS.md
  - ../../../../../../docs/index.md
  - ../.memlog.md
verdict: pass-with-follow-up
---

# Rubric review: unified-root delivery and documentation layout

## Verdict

**PASS WITH FOLLOW-UP.** AD-16 gives independently implemented web and
Catalog Control Plane units one compatible repository contract: the product is
one root delivery, `apps/*` are internal build roots rather than separately
shipped projects, JavaScript tooling has one frozen workspace boundary, and
the Kotlin/PostgreSQL unit cannot acquire User Project data. It also preserves
the phase boundary: neither a waiver nor an `S-*` experiment can own or seed
production code, manifests, tests, assets, or configuration.

`docs/index.md` correctly reconciles the owner's desired single human-facing
entry point with the current authority model. It does **not** falsely claim
that BMAD provenance has already been physically consolidated or migrated.
The spine lint passed with zero findings.

## Rubric results

| Dimension | Result | Evidence |
| --- | --- | --- |
| Compatible delivery units | Pass | AD-16 fixes root ownership, `apps/web`, `apps/catalog-control-plane`, JS lockfile/toolchain and test responsibilities; AD-17 retains the local-first data boundary. |
| No accidental S-* promotion | Pass | AD-16 expressly prohibits copying prototype source into production; `AGENTS.md` and `docs/index.md` preserve the waiver/evidence-only boundary. |
| Root delivery vs. documentation request | Pass | The structural seed puts the future product at repository root and makes `docs/index.md` the curated entry point while `_bmad-output/` remains non-runtime provenance. |
| Readiness integrity | Pass | AD-16 says bootstrap begins only after readiness authorization; this review makes no `READY`, production, device, or waiver-expansion claim. |
| Migration/provenance governance | Follow-up | The future physical consolidation of BMAD sources has no approved path-mapping manifest, owner, authority-switch record, or link/ID verification procedure yet. |

## Follow-up findings

### LAY-01 — Documentation migration must be an explicit provenance change

**Severity:** Medium — defer until a post-`READY` documentation migration
package; do not move files now.

Two implementation units can safely use `docs/index.md` today because it
points at the authoritative BMAD sources. They could nevertheless diverge when
one later relocates a PRD/SPEC/architecture artifact or rewrites relative
companion links without a shared mapping. Before physical consolidation, name a
single owner and approve a mapping from every authoritative source to its new
path, with stable `CAP-*`/`FR-*`/`NFR-*`/`AD-*` identifiers, frontmatter and
companion-link validation, and an explicit authority-switch record. Append-only
memlogs must remain governed by `memlog.py`; installer-owned files remain out
of scope. Until then, `_bmad-output/` is the correct provenance location.

### LAY-02 — Cross-build orchestration stays deliberately deferred

**Severity:** Medium — resolve in the existing Catalog Control Plane/build ADR
before a production CI or release package.

AD-16 appropriately refuses to invent a Kotlin build system or assign Kotlin
tests to the JavaScript runner. To keep the two internal build roots compatible
once bootstrap is authorized, that ADR must select the Kotlin build/test entry
point and define the root-level invocation/contract-test handoff without
introducing a second JavaScript lockfile or widening AD-17's data boundary.

## Boundary retained

This is an architecture-document review only. The current official readiness
verdict remains `NOT_READY`; S-* roots remain isolated evidence experiments,
and no production-root scaffold, documentation migration, or commit is
authorized by this verdict.

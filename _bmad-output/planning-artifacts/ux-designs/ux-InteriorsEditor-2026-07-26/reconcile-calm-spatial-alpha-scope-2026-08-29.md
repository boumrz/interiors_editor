---
title: "Reconciliation — Calm Spatial Studio and Alpha scope"
status: open
updated: 2026-08-29
owners:
  ux: EXPERIENCE.md and DESIGN.md
  product: PRD
  specification: SPEC and companions
---

# Decision recorded by UX

The approved Calm Spatial Studio redesign excludes Focus/native fullscreen,
surface finish pickers, ceiling editing, AR, AI, accounts, cloud sync and Door
navigation from Alpha. It preserves exact-mm Plan authoring, local-first
durability, recovery and accessible DOM alternatives.

This is an interaction and visual decision only. It neither changes CAP, FR,
NFR, AD nor authorizes implementation.

# Source conflicts to reconcile

| Source | Conflict | Required owner action |
|---|---|---|
| SPEC companion editor-interaction-and-grid-contract.md, ToolRail section | Still lists Focus although AD-15 and the current PRD retire Focus/native fullscreen. | Specification owner removes or marks the obsolete UI route retired. |
| Same companion, acceptance evidence | Still refers to a Room finish override although Alpha excludes floor/wall finish flows. | Specification owner replaces the obsolete evidence with an Alpha-valid interaction check. |

# Interim rule

Until the source-owner reconciliation is complete, DESIGN.md and EXPERIENCE.md
take the stricter current PRD/SPEC/architecture interpretation: no new design
or mock may reintroduce either route. The conflict blocks final UX status but
does not block review of the six reference surfaces.

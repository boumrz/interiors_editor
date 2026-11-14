---
title: "Reconciliation — adopted AD-7 and delegated geometry policy"
date: 2026-08-05
intent: "bmad-prd update"
scope: "PRD-owned user-facing behavior only; no SPEC, UX, Architecture, code, or readiness mutation"
input_prd_sha256: "221fe38468a3e320b05111b790752be76a1df21bf635ece4d810c9c1654c551c"
architecture_spine_sha256: "a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7"
change_proposal_sha256: "78ddbb5797b448e17c926c79abaf7fef36e8c9a4d1965194348d5921f70e6d92"
---

# Reconciliation — adopted AD-7 and delegated geometry policy

## Change signal

`AD-7` is now canonically adopted after its independent canonical reviews.
The Product Owner's delegated decisions `D-011`, `D-012`, and `D-013`, plus
the valid-exact-X working default, must therefore be reconciled into the
product-owned requirements. This update does not claim a production geometry
kernel, device evidence, a completed spike, or `G-READY`.

## Source extraction and PRD outcome

| Source | Canonical finding relevant to the PRD | PRD outcome |
| --- | --- | --- |
| Delegated change proposal §§4.2–4.3.1 | The visible editor grid is not persisted geometry; a 100-mm gesture candidate is relative to the active origin; visual cells adapt by zoom; valid integer-mm numeric input may be off-grid; 45° length input discloses quantisation; an otherwise valid exact X is split atomically. | Make these observable user behaviors explicit in UJ-2 and FR-7–FR-9; preserve the numeric alternative and avoid a global-lattice promise. |
| Architecture Spine `AD-7` | Touch and numeric paths share a detached complete candidate, full invariant validation and all-or-nothing outcome. Exact T and valid exact X contacts are fully partitioned before a command/revision mutation. One product-owned measurement formatting policy serves preview, 2D, 3D and export. | Clarify FR-9, FR-12 and FR-13 without copying parser, token, `ChangeSet`, geometry-library or rendering details that belong to Architecture/SPEC. |
| PRD before this update | `FR-9` said broadly that a geometric intersection creates a shared Vertex, while Geometry Contract §6 still permitted an exact-X reject. Its numeric and diagonal behavior did not state the approved off-grid/active-origin boundary. | Replace the broad intersection sentence with exact T/X and invalid-contact behavior; state numeric off-grid input and shared diagonal display behavior at the product level. |
| SPEC geometry contract | Integer-mm endpoints, allowed directions and a quantised 45° preview are already source-owned; exact-X wording and parser/reason-code details still require a later `bmad-spec` re-derivation. | Do not edit or overrule the companion. Record this as a downstream conflict/handoff, not a false alignment claim. |
| UX experience/design | The visible interaction contract still labels grid, off-grid numeric input and related policy as unresolved. | Do not edit UX; record an owner handoff for candidate priority, tolerance/ties/hysteresis, error presentation and measurement precision/locale. |

## Prior-decision conflicts surfaced before application

1. `geometry-contract.md` §6 still presents valid X as an open choice, while
   adopted `AD-7` and the delegated product policy require an otherwise valid
   exact X to create one shared Vertex and four canonical pieces. This update
   corrects the PRD side only; `bmad-spec` owns the companion correction.
2. PRD §10 still lists the now-approved grid/off-grid/diagonal policy as a
   phase blocker. The update moves that policy to a resolved decision and
   preserves the unresolved `D-022` policy set separately.
3. The current UX documents retain older open-policy wording. They are not
   silently amended by a PRD workflow.

## Deliberately unresolved after this update

- `D-022`: geometry-kernel/library choice, concrete screen-space tolerance,
  eligibility/equal-candidate ties, relative-step selection and visual-grid
  hysteresis;
- Room identity/metadata policy for split and merge;
- Opening relocation or rejection policy after Wall resize/delete;
- measurement precision and locale, despite the requirement for one shared
  formatted diagonal value;
- UX continuity details for T/X selection and merge consequences.

These are not implementation defaults and remain prerequisites for the
appropriate owner workflows and later readiness work.

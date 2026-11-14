---
title: "D-022 R7 source-owner decision options"
date: 2026-08-05
authority: advisory-only
scope: "Minimal source-aligned choices for reconciling a future R7 D-022 draft with current canonical product, geometry, durability, and UX contracts"
reviewed_r6_sha256: 276a7c7224c5b33a2554fbc7b34811a85178e6d9b7a6ae6e65230e61fc3bb6fa
canonical_adoption: false
---

# D-022 R7 source-owner decision options

## Purpose and reading boundary

This is an advisory for the source owners. It does not change a canonical
contract, accept a draft, or assess implementation readiness.

It uses the current canonical sources and the frozen R6/R6 reports as
diagnostic input. A frozen report that identifies itself as R5-based or shows
a different reviewed hash is treated only as an option generator, not as
evidence that a proposal is bound to the R6 file above. The current source
documents remain controlling:

- the PRD for FR-* and NFR-*;
- the SPEC for CAP-* and its companion contracts;
- the Architecture Spine for AD-*;
- the domain model and UX contracts for their current detailed semantics.

The minimal direction for R7 is to be a reconciliation ledger over those
contracts. It should not create a second canonical geometry, ID, Room,
resource, or history format in a decision draft.

Relevant anchors are the Geometry Contract sections on integer geometry,
candidate selection, usable joins, Room reconciliation, placement, and stable
reasons; the Project/Backup Contract limits and recovery sections; SPEC
CAP-2/CAP-3/CAP-6/CAP-8 and its constraints/open questions; PRD
FR-7 through FR-20, FR-28, FR-35, FR-38, and the relevant NFRs; Architecture
Spine AD-3/AD-4/AD-6/AD-7/AD-8; the domain model's Room, placement, command,
history, and policy sections; and the Experience contract's candidate,
DraftCommand, measurement, and reconciliation states.

## Source-aligned decision matrix

"Adopt unchanged" means that R7 may restate the current contract and point to
its source; it does not mean that R7 becomes the new owner. "New owner
decision" means that R7 should leave the item explicitly open until the listed
contract owners make the change.

| Topic | R7 may adopt unchanged now | New owner decision required before R7 can close it |
| --- | --- | --- |
| Stable reasons and outcome states | Keep the current geometry reason union: ZERO_LENGTH, DUPLICATE_SEGMENT, UNSUPPORTED_DIRECTION, SELF_INTERSECTION, AMBIGUOUS_INTERSECTION, OPENING_OUT_OF_BOUNDS, OPENING_OVERLAP, ROOM_IDENTITY_AMBIGUOUS, PROJECT_BOUNDS_EXCEEDED, INVALID_DIMENSION, DIAGONAL_LENGTH_QUANTIZED, USABLE_POLYGON_COLLAPSED, HOST_SURFACE_REMOVED, and ANCHOR_REHOST_AMBIGUOUS. Keep the existing project-resource reasons, including PROJECT_HISTORY_RESOURCE_LIMIT, and the current rejected/pending/durable and recovery routes. A coordinate-bound failure is PROJECT_BOUNDS_EXCEEDED; malformed canonical numeric input is INVALID_DIMENSION. | Any new D022_R7_* code, a new durable candidate/outcome state, or a different UI error mapping needs one source-owned reason/outcome matrix spanning geometry, persistence, and UX. The existing UI condition that a candidate is not yet determined preserves DraftCommand; R7 must not turn it into a new durable outcome or a reason to discard the draft. |
| C3 and selection | Preserve the source priority: eligible exact existing Vertex, eligible exact intersection/end, constrained-direction candidate, then the origin-relative 100-mm candidate. Preserve the UX rule that unresolved selection retains the DraftCommand; selection policy is not a geometry-library default. | Define the actual C3 generator, C1/C2/C3/C4 eligibility and tolerance behavior, candidate ties, origin-relative k, hysteresis, and the corpus that proves them. An empty C3 cannot be declared as a local R7 convenience: it changes CAP-2, FR-7, AD-7, the Geometry Contract, and the UX candidate model. |
| Usable-polygon joins: miter and bevel | Use the current Geometry Contract: construct inward offsets with a miter join; cap a miter at four half-max-wall-thicknesses; then use the deterministic bevel. Retain USABLE_POLYGON_COLLAPSED for the established usable-polygon validity condition. | A miter-only rule, thickness-step rejection, a different cap, or a new rounding/join failure outcome requires an explicit geometry/product decision and corpus. R7 should not convert the existing bevel fallback into an unowned rejection. |
| Room continuity | Preserve Room identity when the face is unchanged or when a geometrically changed face has a unique correspondence. Preserve name, height, and surface data in that case; for a split, merge, or ambiguous correspondence, use the current preview/no-silent-distribution rule. | Define the exact correspondence predicate, split/merge allocation rule, confirmation UX, and golden cases. Automatic only when byte-identical would replace the current unambiguous-geometric-continuity rule and therefore needs owner changes rather than a D-022 draft assertion. |
| Rehost and orphan experience | Preserve semantic hosts: floor, wall, and ceiling placements keep their current host address; wall-side semantics are WallSegmentId plus AdjacentRoomId or ExteriorSide. A unique lineage transfer remains available. When a host is deleted or a mapping is ambiguous, require an explicit rehost/delete/orphan preview; never silently leave an asset in world space. Continue using the current host/anchor reasons where applicable. | Decide deterministic cross-root transfer, two-exterior representation, ceiling-to-wall/floor transitions, and the exact user choice set and confirmation semantics. R7 must not make cross-root means delete or a new automatic transfer rule into a default without the placement, topology, and UX owners. |
| ID format and ordering | Keep IDs as opaque branded strings generated through IdPort, with the current canonical project/project.json serializer as the durable boundary. Do not introduce raw-token OpaqueIdV1, a new byte sort, or a new digest order in R7 durable material. | A binary ID codec, reversible text-to-token adapter, byte-ordering rule, schema version, serializer migration, and retained replay compatibility must be defined by the ID/persistence owners before any bundle or hash relies on it. |
| Room schema and commands | Keep the current Room model and its sole editable height source, Room.heightMm. Keep derived faces and usable polygons non-authoritative. Use the currently defined Room property/assignment model rather than adding field-class unsets or a second Room payload. | A canonical CoreMetadata/field-class schema, a new Room record encoding, migration, surface-assignment identity model, or a named ChangeWallThickness command primitive needs an owner decision. FR-10 requires thickness-edit behavior, but it does not authorize an unowned replacement of the current command/schema contract. |
| Resources, durable history, and recovery | Keep the existing boundary: a validated change is not durable until atomic publication; current/undo/redo referenced resources remain roots; retention may reject a new command but may not break existing history; exact repair or explicit DiscardSessionHistory handles healthy-current history-only corruption. Use the current ResourceIssue scope and project-resource failure paths. Keep BigInt out of Project, Revision, History, Command payload, and Portable Backup. | An inline transition bundle, retained policy payload, patch applier, history codec, bundle-local material table, historical resource root, or new recovery route is a cross-owner design change. It must reconcile AD-3/AD-4, the domain HistoryEntry, the Project/Backup Contract, the Geometry Contract exact-arithmetic boundary, retention limits, and migration/recovery semantics before it can be presented as a closed R7 rule. |
| Holes | Do not infer a no-hole alpha rule. Retain the current planar-face/usable-polygon invariants and use the existing topology corpus, which includes holes as a required case, to expose the intended behavior. | If alpha is to prohibit holes, define valid candidate behavior, existing/imported-project handling, preview/rejection state, history/export/backup compatibility, and any migration. A topology incompatibility is not, by itself, a resource-corruption recovery condition. |
| Measurement formatter | Keep one MeasurementFormatPolicy seam. The same exact source values must drive preview, 2D, 3D, and export; formatted text is never command input. | Precision, rounding, locale, unit labels, ASCII/token grammar, and formatter-version compatibility require a product/UX/serialization decision. R7 should not introduce mm/2, area/volume tokens, or byte-level formatter requirements as stable output until those owners adopt them. |
| Performance and limits | Use the current source-owned limits, including the hard wall-segment limit of 300 and the existing ProjectLimits/ChangeSet limits. Keep the current interaction and main-thread budgets; do not invent a smaller wall, candidate, pair, row, or transition cap in R7. | Any new cap, C2/C3 algorithmic bound, worker requirement, or performance claim needs measured evidence against the PRD NFRs and Performance Budget Contract. If a lower cap is necessary, it belongs in ProjectLimits plus the product, performance, and UX contracts—not only in D-022. |

## Minimal owner decision package

The following is the smallest useful set of new decisions. Each should be
recorded by its existing source owner before an R7 draft claims the associated
issue is settled.

1. **Selection kernel package.** Define C3 generation, all candidate
   eligibility/tolerance/tie/hysteresis rules, and a source-owned golden corpus.
   Align the Geometry Contract, CAP-2, FR-7/FR-8/FR-9, AD-7, and the UX
   DraftCommand behavior.

2. **Topology continuity package.** Define the formal Room correspondence,
   split/merge semantics, opening-fit policy, usable-offset rounding, and
   miter/bevel behavior only where it differs from the current contract. Align
   the Geometry Contract, CAP-3, FR-14/FR-15/FR-19, AD-6/AD-7, the domain
   model, and preview UX.

3. **Host-transfer package.** Define the unresolved cross-root, exterior, and
   ceiling cases plus the confirmed rehost/delete/orphan interaction. Align
   placement semantics in the Geometry Contract, CAP-6, FR-28/FR-35, AD-8,
   the domain model, and UX.

4. **Durability extension package, only if needed.** If deterministic replay
   truly needs more than the current command/inverse HistoryEntry, define one
   source-owned durable representation, ID codec, patch-application boundary,
   resource rooting, retention accounting, exact-repair behavior, and
   compatibility/migration plan. Otherwise, R7 should explicitly defer a
   transition-bundle design rather than emulate one in a noncanonical draft.

5. **Product-shape package.** Decide whether holes are supported, specify the
   measurement formatter, and establish any revised performance caps with
   evidence. These are product/UX/performance decisions, not implementation
   defaults.

## Recommended R7 reconciliation pattern

R7 can remain compact and source-aligned by doing all of the following:

1. Cite the unchanged rules in the table instead of renaming or serializing
   them.
2. Mark every unresolved row with its source owner and the canonical documents
   that must change.
3. Keep project/project.json, opaque string IDs, the existing Room model, and
   the current HistoryEntry/recovery boundary unchanged unless and until the
   relevant owner package is adopted.
4. Treat R6 transition-bundle, raw-ID, private-cap, miter-only, automatic
   byte-identical-only Room, and no-hole sketches as noncanonical options, not
   implicit R7 defaults.

That approach supplies a useful R7 reconciliation record without creating
silent source-of-truth drift.

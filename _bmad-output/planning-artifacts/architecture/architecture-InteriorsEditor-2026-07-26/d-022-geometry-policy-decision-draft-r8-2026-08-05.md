---
title: "D-022 — source-owner reconciliation package, R8"
decision_id: D-022
revision: R8
status: draft
noncanonical: true
canonical: false
implementation_ready: false
readiness: NOT_READY
scope: "Owner-routed decisions and corpus needed before canonical adoption of geometry, topology, resource and interaction policy"
created: 2026-08-05
updated: 2026-08-05
predecessor:
  path: d-022-geometry-policy-decision-draft-r7-2026-08-05.md
  revision: R7
  sha256: 026b4bc9e524ecc2cb8895eb7345d00c667f63b88a9490a957042c2bdceca3ac
  disposition: rejected-external-review-evidence-do-not-edit
frozen_review_inputs:
  - path: reviews/review-d022-r7-exact-geometry-external-2026-08-05.md
    sha256: 2358fb0571b066235ff098590dc06f2193dcfbe41a465ad1e2bf27575ecf1a2f
  - path: reviews/review-d022-r7-topology-data-integrity-external-2026-08-05.md
    sha256: 0dcfedc1f944907902924d9670fb5bb025ed48825b483ddbbae357774cbefa3e
  - path: reviews/review-current-source-d022-r7-external-2026-08-05.md
    sha256: 42aa2290079184d3aeb5eaaa99bd06de8cd639d6bb3329ec5e878d7fa398f814
canonical_destinations:
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ARCHITECTURE-SPINE.md
  - domain-model.md
  - solution-design.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
---

# D-022 — source-owner reconciliation package, R8

## 0. Status and non-negotiable boundary

R8 is a reconciliation package, not a new geometry implementation contract.
It translates the frozen R7 review findings into concrete canonical-owner work.
It changes no source document, schema, diagnostic union, test or production
code. Canonical owner adoption, versioned corpus evidence, a fresh readiness
assessment and an explicit `READY` verdict remain prerequisites for any
production scaffold or implementation.

No R8 proposal may create a second durable model. A `ChangeSet` and its inverse
are validated command inputs; they are not independently durable records. Only
a successful atomic publication creates the Durable Revision and then the
current source `HistoryEntry { label, command, inverse, beforeRevisionId,
afterRevisionId }`. Exact arithmetic, selection, measurement, previews,
diagnostics, derived faces and renderer objects remain disposable projections.

## 1. Decisions to adopt through named source owners

The following ten packages are the product owner's chosen direction. Each row
must be committed through the listed canonical documents and their append-only
memlogs using the relevant BMAD workflow; it is not adopted by this table.

| Package | Chosen direction | Canonical owner and workflow | Corpus / adoption exit |
| --- | --- | --- | --- |
| D22-01 Selection and transform seam | Define one *ephemeral, fakeable* `PlanProjectionPort`: coordinate convention, forward projection, inverse hit conversion, finite/invertible contract, equality/tie/hysteresis inputs and failure result. C1/C2 use an inclusive hit square, C3 accepts only an exact integer-mm constrained endpoint, then C4 is origin-relative 100 mm. A projection failure is a transient `SelectionUnavailable`/retry state retaining the current draft, not `INVALID_DIMENSION`, a Command or a Durable result. | Geometry Contract §4/§11 + PRD FR-7/FR-8/FR-12 + UX `DraftCommand`/error states; update through `bmad-spec`, `bmad-prd`, `bmad-ux` and architecture reconciliation. | Browser-independent vectors for each edge/corner, equal candidates, C3/C4 boundaries, T/X continuity, stale transform result, non-invertible transform and the same selected candidate in DOM/canvas alternatives. |
| D22-02 Faces, holes and usable geometry | Preserve valid holes rather than silently rejecting them. Define a Room face as one simple outer ring plus zero or more simple, strictly-contained, non-touching void rings; the usable polygon is derived from this face under the existing inward-offset/miter-then-bevel rule. Repeated bounded walks, touching/nested rings or non-simple components are not Rooms and yield an existing source-owned topology outcome with no partial mutation. Repeated vertices/darts on the unbounded exterior remain separately allowed where the planar embedding requires them. | Geometry Contract faces/usable geometry/reasons + `domain-model.md` Room/face model + PRD FR-14/FR-15 + UX preview/error state; `bmad-spec`, `bmad-architecture`, `bmad-prd`, `bmad-ux`. | Golden plans for exterior articulation, multiple Rooms, hole, hole-offset/collapse, repeated bounded walk, nested/touching rings and import/recovery validation; each declares exact Room/usable post-state or no-mutation result. |
| D22-03 Paired measurement operation | Add an ephemeral `MeasurementRequest` bound to one revision/checksum and containing a named operation plus one or two typed targets: vertex/plan point, wall centerline, Room inner boundary, or Item footprint boundary. Define boundary locator/tie/nearest-point semantics without a traversal ordinal unless that order is canonically published. A stale result is discarded with visible reselection/retry state, never persisted. One `MeasurementFormatPolicy` owns the identical preview/2D/3D/export text. | Geometry Contract metrics + PRD FR-13 + UX measurement state + AD-12 job fence; `bmad-spec`, `bmad-prd`, `bmad-ux`, `bmad-architecture`. | Exact two-target vectors: wall length, Room dimensions/area/perimeter, point-to-boundary, footprint-to-boundary, boundary-to-boundary, ties, stale result and one formatted output across all four surfaces. |
| D22-04 Conflict preview and re-entry | A Room, host or Opening conflict is not a rejected completed candidate. The application enters `ConflictPreview/AwaitingUserOutcome`, captures only a transient choice request, and waits. On confirm it rechecks base Revision and writer fence, reruns discovery/validation, then creates exactly one complete Command/ChangeSet/inverse; on cancel/fence loss/stale base it creates none. | PRD FR-11/FR-15/FR-19/FR-28 + domain-model state machine + Solution Design write route + UX conflict flows; `bmad-prd`, `bmad-architecture`, `bmad-ux`. | Race vectors for confirm after base change/fence loss, cancel, split/merge Room choices, Opening resize/delete/relocation, host rehome/delete/orphan choice, and exact Project/Revision/History/root inventories. |
| D22-05 Total fence-bound allocation and lineage | Discovery is allocation-free. A transient allocation intent is bound to project, base revision/checksum, observed fence and cancellation token at every consumer. After D22-04 re-entry it deterministically covers add/move/delete/split/merge, exact T/X contacts, shared Vertex creation, Wall children, Room lineage and inverses. IdPort allocates opaque strings only at materialization; failed/retried/stale work allocates no durable identity. | Geometry Contract topology + domain model Command/ChangeSet/inverse + Solution Design IdPort/repository route + Architecture AD-12; `bmad-spec` and `bmad-architecture`. | Every command kind, shared Vertex, T and X, allocation failure/retry, split survivor, new root, exterior articulation, stale intent and replay/inverse fixtures. |
| D22-06 Semantic replay and publication | Keep a semantic, versioned ChangeSet/inverse grammar separate from the pure replay and resource-admission transaction. `CanonicalPatchApplier` (if retained) receives only declared canonical Project records and semantic operations; `RevisionCoordinator` receives verified resource/manifest admission through explicit ports, stages atomic publication and only then creates Revision/History. No private Patch/CB3 format or independently durable ChangeSet is introduced. | SPEC Project/Backup companion + domain model + Solution Design + Architecture Spine AD-3/AD-8; `bmad-spec` and `bmad-architecture`. | Deterministic forward/inverse replay for nested Room surfaces and implementation-variable Opening storage; duplicate/conflicting target rejection; fault injection before/after stage and pointer swap; no partial History/Revision. |
| D22-07 Asset placements and surface assignments | Separate `AssetPlacement` reconciliation from `SurfaceAssignment` reconciliation. The latter has exhaustive addresses `Floor(RoomId)`, `Ceiling(RoomId)` and available `WallSide(WallSegmentId, adjacent Room|Exterior)`. A cross-anchor or cross-root transfer requires compatible asset metadata and D22-04 confirmation; otherwise preview rehome/delete/orphan. The inventory must cover both item placements and floor/ceiling/wall finishes. | Geometry Contract host addresses + domain model surface assignments + PRD FR-28/FR-34–FR-36 + UX flows; `bmad-spec`, `bmad-architecture`, `bmad-prd`, `bmad-ux`. | Split/merge/reverse/delete Wall; Floor/ceiling assignment; shared Wall sides; compatible/incompatible rehost; cross-root choice and complete forward/inverse evidence. |
| D22-08 Resource admission and pin lifecycle | Catalog references require a human-approved `AssetUsageGrant`; custom GLB references require the source custom `assetUsageDeclaration`. Both require exact pinning and backup feasibility, but their proof routes are discriminated. Create a recoverable repository-local staging/pin lease root atomically with newly pinned bytes; define success, reject, cancel, fence-loss, crash recovery and GC lifecycle. It is not Project, History or Portable Backup state. | Project/Backup and Asset Import companions + Solution Design resource/repository route + PRD FR-28/FR-37/FR-44/FR-52 + UX resource states; `bmad-spec`, `bmad-architecture`, `bmad-prd`, `bmad-ux`. | Forced-GC/crash vectors from pin through publish; catalog grant and custom declaration acceptance/rejection; redo roots; envelope failures; exact root inventory before and after every exit. |
| D22-09 Recovery and history-only repair | Publish a separate fenced transition contract for `ResourceRecoveryRequired`, complete `RecoveryChangeSet`, and explicit `DiscardSessionHistory`. The latter first proves the current Project healthy, drops both history branches atomically without a Project Revision, gives a visible new boundary and never happens automatically. | Project/Backup companion + domain model + Solution Design + UX recovery flows; `bmad-spec`, `bmad-architecture`, `bmad-ux`. | Each `ResourceIssue` variant and scope, repair/cancel, history-only corruption, current-health check, RecoveryChangeSet, history discard confirmation and root accounting. |
| D22-10 Stable outcomes, owners and traceability | Correct all source citations and establish an owner register whose rows name exact canonical artifact, stable section/ID, BMAD workflow, required corpus and exit. Add source-owned stale-base and transform/selection transient outcomes; do not overload `INVALID_DIMENSION` or create `D022_*` reason codes. | `project-context.md` ownership references, SPEC/PRD/Architecture/UX documents above and `epics.md`/roadmap follow-up; `bmad-spec`, `bmad-prd`, `bmad-architecture`, `bmad-ux`, then stories. | A reviewable trace from CAP/FR/NFR/AD to each corpus vector and E2E journey; every unlisted outcome is rejected from implementation until its owner publishes it. |

## 2. Required canonical sequence

1. Record the ten accepted directions in the affected PRD, architecture and UX
   memlogs through `memlog.py`.
2. Update the owned source documents and companion contracts; re-derive
   `SPEC.md` only through `bmad-spec`.
3. Reconcile epics/stories, especially FR-7–FR-9, FR-13, FR-15 and FR-19.
4. Add versioned fixture/corpus ownership and rerun independent source,
   geometry and topology reviews against the changed canonical hashes.
5. Run a fresh official implementation-readiness assessment. A `READY` result,
   not this document, permits production implementation.

## 3. Explicit non-results

- R8 does not approve a renderer library, package manifest, database schema,
  network transport, production scaffold or test suite.
- R8 does not weaken physical-device, performance, licensing, privacy,
  Portable Backup or focus-mode evidence gates.
- R8 does not change Alpha+ scope or make desktop authoring an Alpha target.

## 4. Freeze verification

Before a later review, verify the predecessor and all three input review hashes
from this frontmatter, then verify the canonical owner documents actually
contain the adopted rule and corpus reference. A review of R8 without those
canonical changes is expected to remain `NOT_READY`.

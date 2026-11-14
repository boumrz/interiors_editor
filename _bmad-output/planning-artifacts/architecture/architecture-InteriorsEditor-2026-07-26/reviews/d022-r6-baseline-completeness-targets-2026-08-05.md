---
title: "D-022 R6 — advisory baseline-completeness targets"
date: 2026-08-05
review_type: "independent preflight scope-completeness advisory"
reviewed_artifact: "../d-022-geometry-policy-decision-draft-r6-2026-08-05.md"
reviewed_sha256: "7837e387f8799c49340d373212e0cd2ad50857b9ef9fef3dab3896e85eb5e0ab"
predecessor_evidence:
  artifact: "../d-022-geometry-policy-decision-draft-r5-2026-08-05.md"
  sha256: "c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c"
  disposition: "frozen-rejected-external-review-evidence"
authority: "advisory-only"
canonical_adoption: false
implementation_readiness: "not assessed"
---

# D-022 R6 — targets for baseline completeness

## Boundary of this advisory

This is a preflight coverage aid for the R6 author, not an independent
accept/reject review, source-owner decision, readiness result, or
implementation authorization. It does not alter R5, R6, canonical sources,
memlog, code, configuration, or tests.

R6 calls itself a standalone successor (§0) and says that the full selection
policy is not inherited from R5 (§4.3). Accordingly, a prior D-022 rule is
considered covered only when R6 either:

1. states the complete deterministic rule, including inputs, ordering,
   output/reason and durable effect; or
2. explicitly preserves one named, current source-owned rule by immutable
   document/section and schema/policy version, states that it is unchanged,
   and binds its precedence and stable reason.

The phrases “existing complete metric key”, “ordinary ProjectLimits”, “current
product owners”, or “source Plan has passed validation” are useful intent, but
are not themselves an inheritance contract for an R5-only D-022 decision.
R5 is frozen rejected evidence, so it cannot be silently used as a normative
fallback.

## Deliberate R6 replacements that are already visible

The following are explicit choices rather than accidental omissions. They still
need the source-owner decisions listed in R6 §8, but do not need R6 to retain
the R5 behavior.

| R5 baseline area | R6 treatment | Why it is an explicit replacement |
| --- | --- | --- |
| Imported/existing hole read-only compatibility | Replaced by candidate-only no-holes gate | R6 §0(5) expressly removes the imported-hole state and says existing/imported open, writer, History, export and recovery behavior are unchanged. |
| Floor/ceiling strict containment during topology transition | Replaced by Level-hosted FloorPlacement invariant | R6 §0(6), §6.1 explicitly remove the unowned claim and keep collision with current owners. |
| R5-local count and arithmetic caps | Replaced by derived source policy bounds / termination proofs | R6 §0(7), §2 and §2.2 deliberately eliminate R5's independent caps. |
| Cross-root explicit rehost | Replaced by named deterministic rejection plus explicit deletion/inverse | R6 §0(4), §6.3 make this a safe, visible policy choice rather than an unreachable R5 route. |
| CB2 UUID forms and detached history construction | Replaced by CB3 opaque-ID, typed-content and TransitionBundle model | R6 §§3–4 state the new model and route it in §8. |

## Coverage matrix

“Explicit” below means the R6 SHA contains enough of the baseline rule to
serve as the next draft's own contract. “Partial” means that an intention or
some formula exists but a deterministic branch is still absent. “Missing” is
an accidental loss unless the author adds an explicit source-preservation
reference or a deliberate replacement.

| Baseline behavior to preserve or deliberately replace | R6 evidence | Coverage | Actionable target before fresh review |
| --- | --- | --- | --- |
| CSS-U units, exact binary64 ingress, C1 class order and full C1 winner key | §4.3 repeats U, Z, H_U, inverse/screen equations, class order and C1 key | Explicit, with outcome gap | Keep this text. Add the named source-owned result for non-finite/unsupported-transform/nonpositive-scale ingress and for stale origin; §1 currently has neither row. Preserve R5's raw-field order or explicitly say why it is not observable. |
| C2/RayProbe row count, eight directions, exact intersection/collinear arithmetic and C1 pre-emption | §§2.1, 4.4 | Partial | Define the complete C2 candidate/witness byte form for point and interval groups: class ordinal, exact screen distance, witness coordinates, direction, source key and tie fields. Bind NoProbe, integral contact, non-integral blocker and collinear blocker to exact §1/source reasons. State the no-positive-direction proof/branch rather than leaving an empty rank set implicit. |
| C4 threshold-before-direction, score, multiplier and no fallback | §4.4 | Explicit math, partial outcome contract | Keep the 50-mm test and lower-half tie. Add the exact source/draft outcome rows for below-minimum and out-of-bounds, including no mutation/history/import/export semantics; “named” and “source-owned” alone are not a stable mapping. |
| Exact contact normalisation as the input to face traversal | §5.1 invokes it | Conditional source reference only | Either cite the precise Geometry Contract §6 / current schema version and its output invariants/reasons, or restate the required normalized result: one shared Vertex per contact group, all affected segments partitioned to non-zero pieces, no zero/duplicate/overlap/unsplit contact. R6 needs this because later dart, atom and host proofs depend on it. |
| Deterministic darts, successor, orbit walk, bridge treatment and exterior | §5.1 | Partial | Preserve the R5 invariant that successor is a permutation, define canonical dart bytes and exact C8 direction order, and define bridge-bearing, bridge-pair selection, open-tail/exterior classes and orbit canonicalization. Register every referenced form: BoundaryPointV2, SideTableRowV2, exterior class and its enum. |
| Ring containment, twin boundaries and no false hole error for ordinary adjacent Rooms | §5.3 | Partial / internally ambiguous | Retain original signed orientation before any CCW byte normalization: §5.3 currently says every ring is normalized to CCW and later distinguishes positive/negative rings. Define strict-interior witness, TwinBoundary, exact containment, and NestedCandidate; only a non-twin nested contact may yield TOUCHING_RINGS. This preserves the R5 safeguard that normal shared-room adjacency is not misclassified as a hole. |
| Expanded root atoms / stable boundary ordinals | §5.2 | Explicit core rule | Keep virtual-point, interval and one-based ordinal rules. Add the complete input shape for WallSnapshot root/current intervals, the old-and-new face relation needed for correspondence, and the exact reason precedence with traversal/ring failure. |
| Miter-only usable-polygon construction | No construction section: §5.4 is absent; §5.5 only lists outcomes | Missing | Restore a standalone construction clause before diagnostics: cyclic run formation; equal-direction collapse; thickness-step/backtrack tests; cardinal and diagonal inward Q2 offsets; exact line-line miter equation; cap distanceSquared <= (2*maxThickness)^2; adjacent cleanup; minimum edge count, positive area and simple-ring checks. Then §5.5 may define the ordered subtype scan. This is necessary for the statement that the “only miter division” has non-zero determinant to be evaluable. |
| Exact Q2 contact predicates and ordered usable diagnostics | §5.5 | Partial | Define each predicate, cyclic/index/pair ordering, Q2 segment contact classification and witness encoding. The list alone does not establish which simultaneous failure wins. Keep removal of unreachable Q2_INVERSE_ZERO as an explicit replacement. |
| Closed metric target language: PlanPoint, MetricEdge versus MetricWholeBoundary, source keys and stale selection | §5.6 only says “complete target key” / “existing complete metric key” | Missing | Reintroduce or explicitly replace R5 §3.5: enumerate legal target variants, edge/whole-boundary expansion, canonical edge ordinal, Asset/usable admission, target/source-key bytes and stale/unresolvable result. “Existing complete metric key” is not an allowed inherited rule. |
| Exact metric enumeration and unique overlap witness | §5.6 | Partial | The overlap endpoint rule is a good closure. Define the full candidate set: intersection/overlap, endpoint-on-segment, strict projection, endpoint pair; the complete comparison key; and witnesses for every kind. State source-order reversal and edge-versus-whole-boundary behavior in the rule, not only the fixture name. |
| Normalized metric footprint and C8 yaw | Registry type 8 and §2 asset-snapshot sentence | Partial | Restore exact admission: finite simple Q2 ring, CCW normalization/reversal, anchor basis, allowed yaw only and digest equation. Define C8 rotation and reject path for unsupported reflection/scale/yaw. The current text names a footprint digest but does not give the normalization that makes it reproducible. |
| RootQ2/DirectQ2 formatting, unit/precision, exact half-cell and common output token | §2.2 | Missing | Add a formatter clause defining accepted forms, decimal scale, Length/Perimeter and Area precision if retained, half-cell bounds, exact half-even comparison, exactAtPrintedPrecision, bracket/binary-search procedure and Preview/2D/3D/export token. q and “decimal scale” are otherwise undefined in R6. |
| Changed-face identity: automatic unchanged only; confirmed partial-injective survivor map only for changed faces | §4.2 phase mentions maps; registry/§7 do not define them | Missing | Add a FaceLineageRelation / RoomSurvivorMap section and registered CB3 types. It needs the exact route table: byte-identical face automatic retain; valid confirmed changed-face map retain; no map means allocated seed; supplied invalid/stale/non-injective map rejects. No geometry score/nearest/area fallback may reappear. |
| Complete side-aware lineage from old/new atom ownership | §5.2 has ordinals only | Missing | Preserve the R5 atomic-root partition rule: form old/new endpoints per rootWall and physicalSide, partition non-zero atoms, require exactly one owner per side, exhaustively classify retained/removed/created, enforce complete sorted supplied relation and all old/new occurrence coverage. Bind transition enum to normalized effect. |
| Seed, field disposition and loss acknowledgement | §7.1 and registry types 24–28 | Partial | Keep typed value bytes and inverse references, but define the source/target slot grammar, eight FieldClass completeness rules, retained-versus-lost row requirements, resource bindings and exact projection DAG. Add the route tying NewRoomSeedV4 allocated Room ID to AllocationPlanV4; no implicit default of name/type/metadata/surfaces/height. |
| One complete host inventory and exact host transfer after topology | §§6.1–6.4 | Partial | Define pre/post inventory equality: exactly one resolution per pre Opening/WallPlacement/WallFinish and no orphan/extra post row. Restore local-basis/span normalization and the same-ID changed-wall, split-contained-child (a <= s < e <= b, child-local interval), crossing rejection, clone/coalesce and merge rules or explicitly replace each. Cross-root rejection alone does not close same-root transfer. |
| Opening is centerline-hosted, both-side height/Door-adjacency proof | §6.2 | Explicit conceptual route, partial grammar | Keep the two-side rule. Register OpeningPayloadV2, OpeningSideProofV2, NoWalkEdge, Door/Window discriminator, exact proof ordering and source/target inventory relation; all are referenced but absent from the compact registry. |
| Stable semantic wall surface versus physical-side proof | §§6.1, 6.3 | Partial | Keep the tagged SurfaceAddressV3 branches and source/target parity separation. Register WallSurfaceAddressV2, SideProofV3 and the interior/exterior proof branch; state the exact mapping between pre/post side tables, root side and persisted WallSegmentId plus adjacentRoomId/exteriorSide. |
| Floor and ceiling behavior | §§6.1, 6.4 | Explicit policy, partial integration | Floor's Level-hosted no-transfer choice is explicit. Ceiling's matrix is good; add its scope/inventory record grammar, exact user-ack form for deletion and equality to asset patches/resource manifest/candidate set. |
| Exact resource pinning, AssetUsageGrant/notices, BackupFeasibilityPolicy and retention | §3.2 resource paragraph, registry type 37, §7.3 | Partial | Define one closed resource-manifest entry with semantic slot, exact local blob hash, media/provenance, grant ID, notice evidence, pin result and successful BackupFeasibility result. State that every new referenced asset/finish is rejected before PendingDurability if any prerequisite fails; bind current PROJECT_RESOURCE and backup reasons and current+undo+redo retention roots. A sorted manifest name is not proof of successful admission. |
| Atomic patches, durable fences and no-silent history loss | §§4.2, 7.2–7.3 | Explicit core route, registry gap | Keep replayable Absent/Present patches and TransitionBundle history roots. Define all referenced subordinate record types and exact BundleMaterial reachability; the registry claims every live form is closed but omits several. Preserve exact repair versus confirmed DiscardSessionHistory, never a missing-resource fallback or GC deletion. |
| Complete source-owned diagnostic/recovery semantics | §1, §8 | Partial | Make a row for every result emitted by §§4–7, including source-code reference, phase precedence, UX state, no-mutation/history effect and import/export effect. Do not use a wildcard such as D022_R6_Q2_* or prose “source-owned” where a current stable reason is required. Keep §0.1's no-R6-production-code boundary. |

## Concrete missing registry closure

R6 §3.3 says that every live transition form has a closed type, but several
forms used by its normative clauses are not registered with fields, union
constraints or enum members. This is a mechanical completion target, not a
request to invent semantic defaults:

- BoundaryPointV2, SideTableRowV2, exterior classification and its enum;
- TopologyIdReservationV1 slot-kind/ordinal binding form;
- OpeningPayloadV2, OpeningSideProofV2, WallSurfaceAddressV2,
  SideProofV3, target/source host-action records;
- target-slot/value/resource-binding forms beneath FieldProjectionV3,
  FieldDispositionV3, RoomLossAcknowledgementV4 and NewRoomSeedV4;
- FaceLineageRelation, root-occurrence correspondence, transition enum and
  RoomSurvivorMap;
- concrete TransitionResourceManifest entry, pin/backup/grant/notice evidence
  and BundleMaterialTable relation.

For each form, give field IDs, discriminator constraints, collection order,
digest root/equation, and a nonrecursive content-reference direction. If a
form is deliberately source-owned rather than CB3, identify the exact source
serializer/schema version and its digest rule instead.

## Suggested R6 completion outline

The author can preserve R6's successful R5 corrections without copying the
whole predecessor by adding these self-contained clauses:

1. Section 4.3a — selection result contract: raw-field ingress, C1/C2/C4
   result forms, every named source/rejected outcome and tie-byte encoding.
2. Section 5.1a — planar input/exterior contract: exact normalized-contact
   reference, C8 order, canonical dart/orbit bytes, bridge/open-tail/exterior
   classification and side-table row grammar.
3. Section 5.3a — ring predicates: original winding, twins, witness,
   containment, nested-contact precedence and no-holes gate.
4. Section 5.4 — usable Q2 construction: restore runs, offsets, miter/cap,
   cleanup and simple-polygon proof before §5.5 diagnostics.
5. Sections 5.6a–b — metric language and formatter: target unions/expansion,
   normalized footprint/yaw, full witness key, RootQ2/DirectQ2 formatting and
   shared formatted token.
6. Section 7.0 — Room reconciliation: registered lineage/map/identity routes,
   complete field/loss closure and allocation linkage.
7. Section 6.0 or 6.5 — host inventory and resource admission: full transfer
   matrix, including same-root split/merge, plus pinned/granted/noticed/
   backup-feasible resource manifest before durable publication.
8. Sections 1 and 8 — outcome and owner matrix: one exact row per
   diagnostic/state and one owner decision per deliberate source delta.

The existing §10 fixture matrix should then be updated only after the rules
above exist. Fixtures are evidence of a closed rule; they cannot supply a
missing target union, miter formula, lineage route, manifest admission
predicate or stable reason by implication.

## Author checklist before external review

1. Re-read this advisory against the exact R6 SHA above and record whether each
   Partial/Missing row was completed, explicitly source-inherited, or
   deliberately replaced.
2. For every explicit inheritance, add a precise current-source reference and
   prove it cannot pull in a rejected R5-only D-022 decision.
3. Recalculate the CB3 registry closure: no named subtype, row, digest,
   content ref, enum or evidence value may rely on prose-only shape.
4. Check that every §10 fixture cites a clause that actually defines its
   inputs, winner/reason and expected bytes.
5. Freeze a new SHA only after those checks; then obtain fresh independent
   exact-geometry, topology/data-integrity and current-source reviews.

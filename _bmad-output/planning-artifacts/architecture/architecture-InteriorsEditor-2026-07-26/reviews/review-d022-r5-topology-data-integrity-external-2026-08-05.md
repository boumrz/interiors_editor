---
title: "External topology and data-integrity review — D-022 R5"
date: 2026-08-05
review_type: independent-external
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r5-2026-08-05.md
reviewed_artifact_sha256: c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c
verdict: REJECT_FOR_PRECANONICAL_INPUT
scope: "Frozen D-022 R5 topology/data-integrity review against current SPEC companions, PRD, Architecture Spine, domain model, and project context"
---

# Verdict

`REJECT_FOR_PRECANONICAL_INPUT`

The reviewed R5 SHA-256 matches the frozen target exactly:
`c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c`.

R5 improves the explicitness of several formerly open decisions, but it does
not yet define one total, serializable, reversible topology state transition.
The defects below are internal closure defects in the proposed policy, rather
than merely its explicitly labelled source-owner deltas. Each must be resolved
before this draft can be used as pre-canonical reconciliation input. This
review makes no readiness or canonical-adoption claim.

## Required-area assessment

| Required area | Result | Blocking reason |
| --- | --- | --- |
| Dart traversal, exterior and rings | Not closed | An exterior proof names an unregistered digest root; merged-root boundary atomization is unspecified. |
| Face lineage | Not closed | A merged current wall has no canonical `FaceKeyV3` occurrence expansion, and topology output identity is not serializable. |
| Context and allocation direction | Not closed | R5 places topology identity reservation both before the singleton context and in the later allocation plan. |
| Seeds and losses | Not closed | Explicit field replacements/loss targets carry digests, not values or resolvable immutable references. |
| Wall/ceiling transfer | Not closed | The uniform host record misrepresents `Opening`; side, exterior, rehost, and ceiling direction cases remain under-specified. |
| Preflight and patches | Not closed | `PatchV2` cannot represent absence for `Add`/`Remove`, and patch rows contain only hashes. |
| History and undo/redo | Not closed | The wire schema does not bind the context/allocation/patches it says history binds, nor close the retained-policy resource. |

## Findings requiring correction

1. **`PatchV2` has no representation for entity absence, so neither `Add` nor `Remove` is serializable.** R5 §2.2 defines both `beforeBytes` and `afterBytes` as required `Digest` fields of `PatchV2`, while §2.3 admits `Add`, `Replace`, and `Remove`; §2.3 also says no `Null` field is legal. No registered absent/tombstone variant exists. Consequently a topology command that adds a shared Vertex or removes a Wall cannot form the required forward and inverse patch sets in §8.2. This contradicts the source ChangeSet requirement to describe added/updated/removed IDs and an inverse (Domain Model §6) and CAP-8's complete reversible ChangeSet.

   Required correction: make before/after a closed `Absent | CanonicalRecordRef` union (or use distinct operation records), constrain it by operation, and register the exact byte grammar.

   Required fixture: `PATCH-ADD-REMOVE-ROUNDTRIP` must cover an exact X (add Vertex, remove two old segments, add four replacements), its inverse, and a DeleteWallSegment case with byte-identical pre-state restoration.

2. **The alleged patch sets are commitments, not serializable/replayable patches.** R5 §2.2 stores only hashes in `PatchV2`; §8.2 calls `ForwardPatchSetV3` and `InversePatchSetV3` complete while requiring a validator to reconstruct a candidate, but defines neither record bytes nor a typed, immutable, history-rooted content reference from which those bytes can be obtained. A digest cannot itself apply a replacement after the detached candidate has been discarded. The same gap prevents §8.3 undo/redo from being a self-contained directional transition.

   Required correction: include canonical pre/post record bytes in the patch payload, or define an immutable content-addressed record store with typed refs, availability rules, retention/GC roots, and exact equality between those refs and both state digests.

   Required fixture: `PATCH-REPLAY-AFTER-CANDIDATE-DISCARD` must persist only the specified durable history material, discard the in-memory candidate, replay forward and reverse, and prove both canonical Project byte states.

3. **The CanonicalBytesV2 registry is not closed for active topology digests.** `ExteriorFaceTargetV1` and `WallSideProofV2` require an `exteriorOrbitDigest` (R5 §2.2 types 26 and 48; §4.3), but R5 §2.2 explicitly says `PlanFaceTraversalV1` is not a CanonicalBytesV2 value or digest root. Likewise, `WallHostResolutionSetV2.targetInventoryDigest`, `HostRecordV2.recordKey`, and `HistoryCommitmentV2.retainedResourceDigest` have no declared record root or field relation. The special rule naming only the *pre* host inventory root does not define a post inventory root. Thus exterior, host inventory, and retained-policy proofs cannot be independently recomputed from registered bytes.

   Required correction: add typed canonical roots and digest equations for every live digest field, including an exterior-orbit record, host-record key, post-host inventory, and retained-history resource. The side table must say exactly which source and target roots each proof references.

   Required fixture: `CB2-DIGEST-ROOT-CLOSURE` must encode/decode and independently recompute every digest field used by an exterior wall side, bridge/open-tail exterior, target host inventory, and retained policy resource; no unregistered structure may be hashed.

4. **`FaceKeyV3` does not define canonical root-atom expansion for a merged current segment.** R5 §4.3 says a face boundary item carries one root interval, while `WallSnapshotV1` permits a current WallSegment to carry a set of root occurrences. R5 §6.2 then requires complete atom coverage and ordinal correspondence. It never states whether a single geometric edge spanning two roots is represented by one or two boundary occurrences, how `boundaryOrdinal` relates to `ccwVertices`, or where the eliminated collinear join coordinate occurs. Different encoders can therefore form different face digests and lineage maps for the same merge.

   Required correction: specify a single expansion from every current face edge into ordered root atoms, including virtual split points if needed; bind occurrence ordinals one-to-one to that expanded boundary and state its effect on `FaceKeyV3`.

   Required fixture: `LINEAGE-MERGE-TWO-ROOTS-ONE-EDGE` must merge two collinear source walls into one current WallSegment and pin the output FaceKey, all atom rows, side-table rows, survivor decision, and inverse.

5. **The context/allocation order has an unresolved identity cycle.** R5 §6.1 says `NormalizedTopologyEffectV2` contains a topology-only output Wall/**Vertex** identity reservation before `SingletonContextV2`; its wire type contains Wall snapshots and contact points but no output Vertex identity. R5 §8.1 then says the allocation plan is built only after maps, seeds, host rows, and ceiling actions and includes every new Vertex/Wall ID. If IDs are already reserved before the context, that allocation is omitted from the context discipline; if they are not, the output wall IDs used by `FaceKeyV3` and the effect are not fixed. Either route defeats the claimed map-independent, replayable ordering.

   Required correction: choose one explicit model: command-supplied immutable topology IDs outside allocation, or typed symbolic topology slots resolved by one declared allocation phase. Serialize output Vertex identity and require one consistency equation between effect slots, allocation entries, face keys, and patches.

   Required fixture: `CTX-ALLOC-X-WITH-ROOM-SEED` must add an X that allocates a Vertex and replacement walls while also creating a new Room seed; it must pin a single valid phase order and reject a changed allocation ID at every phase boundary.

6. **Seeds and loss acknowledgements do not carry the values they claim to preserve or explicitly replace.** `NewRoomSeedV3` can contain a `SeedValuePayloadV1`, but `FieldDispositionV2` and `RoomLossAcknowledgementV3` record only projection/value digests and `TargetSlotV2.valueDigest` (R5 §2.2 types 19–21; §6.4). For `SetExplicitTarget`, clone, or replacement of a name, metadata, finish, or wall-side assignment, no closed payload or resolvable immutable value reference is present. This leaves precisely the silent or invented value route that R5 §6.4 and CAP-3/FR-15 prohibit.

   Required correction: bind each non-base value to typed canonical payload bytes or to a retained typed value record; make the field disposition and corresponding loss acknowledgement reference the same payload, target slot, context, and inverse value.

   Required fixture: `ROOM-FIELD-REPLACE-AND-LOSS-ROUNDTRIP` must split a finished Room, explicitly replace one child name and clone one wall finish to another, then prove all eight source classes, forward values, inverse values, resource bindings, and undo restoration.

7. **The uniform wall-host record mis-models `Opening` as one physical-side host and omits the opening state that must be validated.** `HostRecordV2` requires one `physicalSide` for all `WallHostKind`s (R5 §2.2 type 25), and §§7.1–7.3 apply one root-side proof to each `Opening`, `WallPlacement`, and `WallSideAssignment`. An `Opening` in the current domain is attached to a WallSegment, not a side (Domain Model §2; Geometry Contract §§2 and 8); a shared opening must remain valid against both adjacent Rooms, including the minimum available height. The record does not close `kind`, width, height, sill, offset, both side targets, or derived Door adjacency. One arbitrary side proof cannot establish the required two-sided validity.

   Required correction: use discriminated host records. Model an Opening as one centerline attachment with complete opening payload/span plus a closed set of all applicable side/height/adjacency proofs; retain physical-side records only for wall placements and wall finishes.

   Required fixture: `OPENING-SHARED-WALL-TWO-SIDE-HEIGHT` must preserve a Door on a same-ID wall while one adjacent Room changes height, then cover valid retention, invalid min-height rejection, conversion to exterior, and exact inverse adjacency restoration.

8. **`WallSideProofV2` cannot independently prove source and target side orientation/table membership.** The proof has one `orientationParity` and one `wallSideTableDigest` (R5 §2.2 type 26), although R5 §7.1 derives root side separately from the source and target orientations. A target may reverse relative to its root even when the source did not. In addition, R5 includes the pre side table in `preRoomFaceInventoryDigest` (§6.1), but the impact envelope does not contain a separately named post side-table root; §4.3's single table wording does not resolve this. This makes reverse/split/exterior proof validation depend on an unstated lookup.

   Required correction: encode source and target orientation parity/table/occurrence roots separately (or a closed pair root) and require equality with the source and candidate side tables. Define the exterior-orbit branch through the registered root from finding 3.

   Required fixture: `WALL-SIDE-REVERSE-SOURCE-TARGET-PROOF` must reverse a descendant segment relative to its root, retain a wall finish on the semantic same side, and demonstrate both interior/exterior target variants and inverse proof verification.

9. **`SurfaceAddressV2` is not a closed discriminated representation of the source-owned wall/exterior address.** Its optional `wallSegmentId`, `roomId`, and `physicalSide` fields have no conditional-presence rules (R5 §2.2 type 22). In particular, it has no explicit `AdjacentRoom | ExteriorSide` tag, despite the persistent semantic address in R5 §7.2 and the Geometry Contract/Domain Model definition `WallSide(WallSegmentId, AdjacentRoomId | ExteriorSide)`. An absent `roomId` can therefore be an invalid partial record or an exterior side, and Floor/Ceiling can carry irrelevant wall fields.

   Required correction: replace this shape with a closed union for Floor, Ceiling, WallSide-to-Room, and WallSide-to-Exterior; require HostRecord surface, TargetSide proof, and patch payload to agree exactly.

   Required fixture: `SURFACE-ADDRESS-EXTERIOR-TAGGED` must reject every illegal optional-field combination and round-trip a Floor, Ceiling, interior wall side, and exterior wall side through forward and inverse patches.

10. **The named explicit rehost path is unreachable for a different root wall.** R5 §7.1 permits a target side only if its derived root side is the same as the source; §7.3 nevertheless offers `MoveExplicit` as the fallback after changed/deleted host geometry. An explicitly user-selected compatible target on another root has no same-root comparison and therefore no valid route. This conflicts with the current atomic rehost/delete preview boundary (Geometry Contract §3 invariant 15 and Domain Model §2) and leaves the policy's stated `rehost` alternative undefined.

   Required correction: either explicitly reject all cross-root rehosts and remove the misleading route, or specify a distinct user-confirmed cross-root rehost record with full target validation, resource/notice preflight, inverse, and no false lineage proof.

   Required fixture: `HOST-EXPLICIT-CROSS-ROOT-REHOST` must delete a source wall and present an explicit rehost of a compatible wall placement to another wall; it must pin the accepted transition or the named deterministic reject, then prove undo.

11. **Ceiling resolution is not directionally total.** R5 §7.4 includes every explicit post-topology ceiling target in `CeilingInventoryV2`, including an existing AssetInstance that is moved from Floor or Wall to Ceiling. Yet the only described `ChangePlacementKind` direction is Ceiling to Floor/Wall with an inverse ceiling placement; `CreateAsset` is only for an explicit post target, and §8.1 does not explicitly allocate the newly created asset. `CeilingSlotV2` and `CeilingResolutionV2` again contain placement digests rather than the placement data and do not state pre/post-kind constraints. A valid explicit post ceiling target therefore has no closed action in several directional cases.

   Required correction: define a complete pre-kind × post-kind action table, exact placement payload/ref and inverse for every cell, allocation requirements for create, and equality between ceiling inventory, resolution rows, asset patches, and resource roots.

   Required fixture: `CEILING-POST-TARGET-DIRECTION-MATRIX` must cover Ceiling→Keep/Move/Delete/Floor/Wall, Floor→Ceiling, Wall→Ceiling, and Create→Ceiling, with one row per slot and replayable inverses.

12. **The serialized history commitment does not bind the information §8.3 says it binds.** The wire schema for `HistoryCommitmentV2` contains directional revision/state fences, `PolicyBundleRefV2`, and an untyped `retainedResourceDigest` only (R5 §2.2 type 36). It has no context digest, allocation digest, forward patch-set digest, inverse patch-set digest, or reference to a retained history envelope, despite §8.3 claiming both directions bind all of them. `PolicyBundleRefV2` embeds bytes but supplies neither a policy-bundle grammar nor an equation/typed resource for `retainedResourceDigest`; it also does not state that policy bytes count in `SessionRetentionPolicy` and history GC roots. Thus `HISTORY_POLICY_UNAVAILABLE`, exact repair, and safe undo/redo cannot be mechanically distinguished from a dangling or mismatched policy reference, contrary to CAP-8, AD-4, and the Project/Backup Contract's no-silent-history-loss rule.

   Required correction: make the history entry reference one closed, retained transition bundle containing context, allocation, both patch sets, policy bytes/version/parser identity, and all resource roots; define its hash/availability/GC accounting and exact repair versus `DiscardSessionHistory` behavior.

   Required fixture: `HISTORY-POLICY-BINDING-AND-LOSS` must undo/redo a topology change after a policy upgrade, reject a corrupt/missing retained policy without mutation, prove the entry remains a GC root, then exercise exact repair and the separately confirmed history-discard route.

## Minimum re-review evidence

Re-review should use the corrected exact artifact SHA and the twelve fixtures above,
including their complete CanonicalBytesV2 roots, forward/inverse Project bytes,
resource/notice roots, and unchanged prior Durable Revision for every reject.

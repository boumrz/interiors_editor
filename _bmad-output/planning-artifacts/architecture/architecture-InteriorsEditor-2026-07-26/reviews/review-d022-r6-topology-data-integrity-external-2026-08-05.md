---
title: "Independent topology and data-integrity review — D-022 R6"
date: 2026-08-05
reviewed_artifact: d-022-geometry-policy-decision-draft-r6-2026-08-05.md
reviewed_sha256: 276a7c7224c5b33a2554fbc7b34811a85178e6d9b7a6ae6e65230e61fc3bb6fa
scope: "Frozen noncanonical R6 only; topology, canonical-byte grammar, identities, host transfer, patches, history, resources, and replayability"
verdict: REJECT_FOR_PRECANONICAL_INPUT
---

# Independent topology and data-integrity review — D-022 R6

The reviewed file matches the required SHA-256 exactly. This review did not
read or rely on prior R5/R6 reviews or advisory inputs.

## Verdict

**REJECT_FOR_PRECANONICAL_INPUT.** R6 is appropriately labelled noncanonical,
but its claimed closed transition format cannot yet be decoded, constructed,
or replayed unambiguously. Several allowed transition paths have no complete
identity or host-proof route, and some proposed history semantics conflict with
the current source contracts.

## Findings

- `TypedContentRefV2` is not a closed type. R6 §3.2 says its `schemaId` names a registered CB3 type or a named source grammar, while §3.3 supplies only free `Text` and an unnamed “role enum” (lines 286–292, 372). Neither candidate enum resolves this: `SourceRecordRole` is limited to source leaves, while `RootKind` is not attached to the field and omits registered live forms such as `ContextV4`, lineage/maps, seeds, dispositions, host resolutions, ceiling transitions, state fences, and the material table (lines 452–463). The purported positive `CB3-PATCH-PRESENT` vector also uses unregistered `schemaId` `test/1` with payload `AA` (lines 494–500). A decoder therefore has no authoritative role/schema acceptance rule or material-table key. Publish a versioned schema/role registry, including every source grammar and test fixture grammar, before treating CB3 as closed.

- The CB3 wire grammar and compact registry are still descriptive rather than executable. §3.1 never fixes the byte layout for scalar magnitude/count framing and collections, and §3.3 omits registered record grammars for required nested values such as a topology-reservation binding, field-projection slot, Room/Face inventory row, and material-table row (for example lines 358–435 and 506–510). Because a CB3 `Record` must carry a registered type and unknown types reject, independent implementations cannot encode or validate those mandatory structures from the draft alone.

- `PolicyArtifactV2` creates an unresolved hash self-reference. Its registry row makes “policy digest” a required field (line 405 under the all-fields-required rule at lines 360–364), yet §3.2 defines `policyDigest` as `Digest(PolicyArtifactV2)`, including the policy’s parser and payload (line 313), without excluding that field from the encoded value. This requires a SHA-256 fixed point. Make the digest derived/out-of-band, or define a distinct digest-free payload type and exact hash equation.

- The stated DAG order does not provide a valid resource-reference route. §3.2 puts resource manifest content after reconciliation/Room/host/ceiling records (lines 294–301), but `NewRoomSeedV4` contains resources (line 398), requires grant/notice/backup evidence (lines 1101–1111), and §7.4 requires exactly one `ResourceAdmissionV3` row for resources reached from seeds, field values, host resolutions, and placement snapshots (lines 1363–1371). No earlier admission/reference form is registered. A direct admission reference is a forbidden forward edge; duplicating it as bytes undermines the declared single row and typed closure. The draft must define one acyclic, typed resource-admission edge and its ownership/order.

- Opaque-ID canonicalisation is not reproducible from the current source model. The Architecture Spine defines IDs as opaque branded strings (`ARCHITECTURE-SPINE.md`, line 497), while R6 changes sorting and hashing to domain plus raw token bytes and delegates text-to-token conversion to an unspecified `IdPort` adapter (R6 lines 270–278). No codec/version, bijection, source-string round trip, or retained codec reference is included in the intent, policy, or bundle. An adapter change can therefore alter face/map/patch ordering and digest roots for the same durable Project. Bind a versioned, reversible ID codec to the source serializer and retain it with every replayed bundle.

- The advertised allocation order has no registered pre-allocation decision form. The fixed phase places Room maps/seeds and host/ceiling decisions before `AllocationPlanV4` (lines 524–535), but the only `NewRoomSeedV4` form already contains an allocated Room ID (line 398), and its final identity/field value is only described after allocation (lines 1101–1111). The same gap exists for a new Opening host and a create-to-ceiling asset: the prose refers to an untyped “selected source payload” (lines 545–551), not a closed, hashed pre-allocation record. Define purpose-keyed intent records and an exact conversion/coverage rule to the allocated final records; otherwise implementations can inject identities at different phases.

- Root lineage has no normative origin rule for topology-created walls. `FaceLineageRelationV3` partitions every atom by `baseRootWallId` and requires old/new occurrences to resolve to that same base root (lines 1037–1066), while `AddWallSegment` is expressly a changed-face transition (lines 1068–1079) and a newly created wall only has a reserved output ID (lines 506–522). `WallSnapshotV3`/`RootIntervalV2` carry a base-root ID but do not say whether a new wall becomes a new root, how that root is distinguished from a base-revision root, or how its created atoms are bound in the inverse. Without that rule, the required complete correspondence cannot be independently derived for a face created or split by a new wall.

- Patch replay is not specified down to the canonical state boundary it hashes. `PatchV3` names an entity kind/ID and before/after source records, but R6 supplies no versioned `project/project.json` collection/path applier, source serializer rule, replacement semantics for aggregate metadata, or rejection of two patches with the same `(EntityKind, entityId)` (lines 399–404 and 1302–1318). A CB3 Set only rejects duplicate complete values; two different writes to the same entity are distinct values, and the stated sort has no tie rule. Consequently “base plus PatchSetV4 replay” cannot reliably prove the exact candidate JSON digest required by `StateSnapshotRefV2` (lines 311 and 349–356). Define a retained patch-applier/schema version, strict target-key uniqueness, base-before matching, and aggregate collection mutation rules.

- The host inventory equality is internally inconsistent for more than one host. R6 requires one `WallHostResolutionV3` for each Pre host and no other resolution, then says each resolution’s target records “must byte-equal the complete HostInventoryV4 Post set” (lines 1213–1220). With two independent source hosts, each resolution would have to claim the entire post set; the draft never defines a disjoint union, target ownership, or collision rule. This makes `CloneFullSide`, coalescing, and ordinary multi-host replay ambiguous. State that the ordered, disjoint union of all resolutions equals Post, and bind every Post key to exactly one source/action or a defined creation route.

- The allowed `Ceiling → Wall` matrix row has no legal way to satisfy the preceding wall-host closure. `CeilingTransitionV3` permits `MoveFromCeilingToWall` (line 1272), but a ceiling asset is not a Pre wall host, and §6.3.1 forbids a `WallHostResolutionV3` for any key other than a Pre wall host (lines 1213–1218). Its new wall placement must nevertheless appear in HostInventory Post, so it is necessarily an orphan under the stated rule. Extend the resolution source union/creation route to ceiling-originating wall placements, or remove the matrix row until a complete inverse host proof exists.

- The Opening model contradicts its own closed registry. The `OpeningHostV2` registry fields omit the required `inverseSource` specified by §6.2 (lines 385 and 1154–1165), despite the registry’s assertion that displayed fields are required and exhaustive. Further, the prose says the no-walk branch can name an invalid Opening, but `DoorAdjacencyKind` contains only `RoomPair`, `NoWalkEdgeWindow`, and `NoWalkEdgeExterior` (lines 467–468 and 1168–1176). The draft cannot serialise all claimed forward/inverse Opening states or determine whether an invalid Door is rejected versus encoded. Reconcile the type fields and enum with one explicit validity/rejection route.

- R6 makes mutually incompatible replay claims for resources. It says no global content store participates in undo/redo replay (lines 1337–1344), while the resource manifest deliberately retains only blob-store references and does not embed the bytes (lines 334–337 and 1392–1396). A bundle can replay JSON patches while the exact asset bytes it requires live outside it; that is valid only if replay is explicitly state-only and checks the retained blob roots/recovery state. Define that boundary rather than claiming that the bundle alone contains all material needed for both directions.

- Persisting the CB3 envelope in `HistoryEntryV3` conflicts with the current exact-arithmetic boundary. R6 explicitly stores Q2 values in CB3 records (lines 105–111) and retains the full bundle inline in session History (lines 1320–1354). The current Geometry Contract forbids `BigInt` in Revision, History, Command payload, and Portable Backup (`geometry-contract.md` §1, lines 23–24), and the Project/Backup Contract repeats that boundary (lines 123–126). Calling the data “detached” and excluding it only from Project JSON does not reconcile a persisted session-history representation of arbitrary `SInt`/Q2 values. A source owner must either define a permitted bounded/history representation or prohibit those values from retained History.

- The durable-publication fence is absent from the proposed transition proof. R6 fences a base Revision/state digest but has no writer-lease/fencing-token record or publication check; the only uses of “writer” concern rejected candidates (lines 82–84 and 99–103). AD-4 requires one writer lease with a fencing token (`ARCHITECTURE-SPINE.md`, lines 117–123). A stale context can retain the same base Revision while a takeover changes only the fencing epoch, so revision equality alone cannot prevent stale publication. Bind the source-owned writer fence at staging/pointer-swap and state whether it is an external durable check or a retained bundle fence.

A fresh independent review is warranted only after the revised proposal has a
complete registry/wire corpus, one acyclic resource graph, a deterministic
patch applier, and exhaustive host/ceiling/opening transition fixtures that
demonstrate the stated forward and inverse byte results.

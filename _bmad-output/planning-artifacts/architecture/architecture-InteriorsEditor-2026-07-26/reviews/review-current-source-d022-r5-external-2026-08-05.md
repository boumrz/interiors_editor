---
title: "External current-source ownership review — D-022 R5"
date: 2026-08-05
review_type: current-source-ownership-and-readiness
reviewer: external-independent
target:
  artifact: ../d-022-geometry-policy-decision-draft-r5-2026-08-05.md
  sha256: c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c
verdict: REJECT_FOR_PRECANONICAL_INPUT
implementation_ready: false
readiness: NOT_READY
canonical_sources_changed: false
---

# D-022 R5 — independent current-source ownership review

## Scope and verdict

The SHA-256 of the reviewed frozen R5 artifact is
`c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c`, which
matches the requested target.

This review read the required current sources: `SPEC.md` and every declared
companion, the PRD, Architecture Spine, and `project-context.md`. It did not
use prior D-022 reviews, advisories, or an R5 evidence plan.

**Verdict: `REJECT_FOR_PRECANONICAL_INPUT`.** R5 is candid about several major
policy deltas, and its non-adoption boundary is sound. It is nevertheless not
safe to hand to source owners as a complete reconciliation input yet: two
unrouted caps already reject configurations that the current source envelope
allows, and several records advertised as closed/complete have no total
representation. Those gaps would make a source owner unknowingly narrow
`FR-13` or the topology/host/history obligations of `FR-9`, `FR-15`, `FR-19`,
`FR-35`, and `FR-38`.

This is neither a `READY` finding nor an adoption decision. R5, a POC, a
waiver, this review, or a later source-owner discussion grants no permission
to create implementation artifacts. The existing phase gate remains in force.

## Classifications R5 gets substantially right

R5 does not silently present the following as compatible with current owners:

- C1–C4/RayProbe selection, its units/ties, and new draft outcomes are called
  source deltas rather than library defaults.
- `NoHolesAlphaV1`, imported-hole read-only handling, miter-only usable
  geometry, changed-face Room mapping/seeding/loss, `CanonicalBytesV2`, C8
  yaw/metric formatting, host/ceiling transfer, and retained historic policy
  are all identified as proposals in R5 §§0, 4–9.
- The draft preserves integer-mm canonical Plan state, detached exact
  intermediates, atomic rejection, local pinning/backup feasibility, writer
  fencing, and no-silent-history-loss. These are compatible intentions, not
  implementation authorization.

The findings below concern deltas that are missing, incompletely routed, or
not actually closed despite being required for a complete preflight.

## Findings and minimum corrections

1. **The 64-edge / 4,096-pair metric cap silently narrows `FR-13`.** R5 §0.2
   caps a metric boundary at 64 edges and §3.5 lets `MetricWholeBoundary`
   expand an entire usable ring. The current `ProjectLimitsPolicy` permits up
   to 300 `WallSegment`s and has no 64-edge Room limit; `FR-13` requires Room
   perimeter and exact measurements under documented rounding. A valid
   one-Room 65-edge Plan can therefore become unmeasurable solely due to R5.
   R5 §1 also does not give this boundary/pair cap a stable, exact outcome;
   its metric row names only formatter exhaustion. **Minimum correction:**
   either prove caps at least as large as every currently valid metric input
   (or use a bounded exact algorithm without materialising all pairs), or
   explicitly propose a changed Project/metric product limit. Route that
   choice to PRD `FR-13` and `NFR-1`–`NFR-4`, SPEC Geometry Contract §§7 and
   12, `performance-budgets.md`, UX metric/error behavior, and the stable
   reason-code owner.

2. **The 1,200-record transfer/ChangeSet cap contradicts R5's own mandatory
   inventories under current hard limits.** R5 §6.4 requires one field row for
   every base Room × eight classes: 50 allowed Rooms already require 400 rows.
   R5 §7.1 requires every existing Opening, WallPlacement, and
   WallSideAssignment: the current limits allow 200 + 250 + 400 = 850 such
   rows. That is 1,250 records before face rows, ceiling work, allocation,
   resources, or forward/inverse patches, while R5 §0.2 caps the complete
   transfer/ChangeSet at 1,200. This rejects an otherwise valid current Project
   before any user-intent validation, contrary to the complete atomic paths in
   `FR-9`, `FR-15`, `FR-19`, `FR-35`, and `FR-38`. **Minimum correction:**
   remove/raise the cap using a demonstrated worst-case envelope for all
   required R5 rows, or explicitly change the owning `ProjectLimitsPolicy`,
   PRD behavior, and UX rejection path. The existing 2 MiB ChangeSet limit is
   not a substitute for a missing record-count proof.

3. **`NoHolesAlphaV1` is labelled a delta, but its owner route is incomplete.**
   R5 §4.2 would reject new hole/nested/contacting-ring candidates and make a
   readable existing/imported hole Project exportable read-only. That is a
   material change from the current derived-face contract, not merely a test
   model: it affects PRD `FR-14` and `FR-45`, `NFR-1`–`NFR-4` and `NFR-13`,
   Geometry Contract §§7/10, and Architecture AD-4/AD-7. R5 §9's phrase “PRD
   test model” does not name those product owners, and current read-only
   recovery is specifically resource-corruption based. **Minimum correction:**
   add an explicit source-delta row that defines compatibility/import,
   durable/export, writer/history, and UI semantics for hole Plans, with those
   exact owners; or remove the read-only compatibility state from R5.

4. **Floor/ceiling strict containment is introduced but neither defined nor
   classified as a source delta.** R5 §5.2 says the normalised footprint is
   used for “floor/ceiling strict-containment,” yet R5 has no complete floor
   inventory/transfer rule. The current Geometry Contract §9 leaves
   outside-room collision as a product decision, and PRD `FR-28`/`FR-31`
   distinguish valid, warning, and invalid placement rather than requiring
   strict containment. **Minimum correction:** either remove that claim until
   a source owner selects it, or add a material delta for `FR-28`/`FR-29`/
   `FR-31`, Geometry Contract §9, AD-8, and UX, including exact containment,
   topology-change, rejection, and recovery semantics.

5. **The advertised “total topology-host transfer” omits the current
   `FloorPlacement` case.** R5 §§7.1–7.4 inventory Openings, WallPlacement,
   WallSideAssignment, and CeilingPlacement, but not the third discriminated
   placement form. Current sources require stable floor/wall/ceiling host
   addresses and predictable topology response. If a floor placement is
   deliberately Level-hosted and unaffected, R5 must say so and reconcile it
   with §5.2's strict-containment statement; otherwise a topology-changing
   candidate has an unhandled host path. **Minimum correction:** add an
   explicit `FloorPlacement` invariant/identity route or explicitly state the
   compatible no-transfer rule with its source proof.

6. **`CanonicalBytesV2` quietly fixes all opaque IDs to UUIDs.** R5 §2.2
   defines every `Id` as RFC-4122 `Uuid`, including Project, Revision, Room,
   Wall, and allocation IDs. Architecture conventions and `project-context.md`
   currently require opaque branded IDs from `IdPort`, not UUID-shaped IDs.
   The generic `CanonicalBytesV2` row in R5 §9 does not explicitly identify
   this representation change. **Minimum correction:** encode the
   source-owned opaque ID representation in a closed grammar, or make UUID an
   explicit Architecture/schema/backup source delta before it appears in any
   digest root.

7. **The claimed closed byte protocol leaves semantic value bytes open.**
   `SeedValuePayloadV1` carries arbitrary `valueBytes` for name, type,
   metadata, and SurfaceAssignment, while `PolicyBundleRefV2` carries arbitrary
   policy bytes. R5 supplies neither a canonical grammar nor a validation rule
   linking those bytes to their declared schema/digest. Thus two
   implementations cannot prove that a seeded field, policy, or inverse means
   the same thing, despite R5's no-default and byte-identical claims.
   **Minimum correction:** allocate closed, source-owned encodings for every
   payload (or restrict them to already-validated canonical records with an
   explicit byte grammar and digest rule), then add vectors for each branch.

8. **`PatchV2` cannot encode `Add` or `Remove` as written.** R5 §2.2 requires
   both `beforeBytes Digest` and `afterBytes Digest`; its registry permits no
   `Null`, optional field, or canonical `Absent` value, yet `PatchOperation`
   includes `Add` and `Remove`. The “complete forward/inverse patch sets” in
   R5 §8.2 consequently lack a total representation for entities created or
   deleted by the very topology commands under review. **Minimum correction:**
   define a closed `Present(recordDigest) | Absent` union (or an equally
   unambiguous canonical absence record), constrain it by operation, and add
   add/remove vectors before asking owners to reconcile the protocol.

9. **The preflight cannot bind the candidate Revision ID deterministically.**
   `HistoryCommitmentV2` requires candidate revision IDs in R5 §2.2 and is
   part of the R5 impact envelope before confirmation, but R5 §8.1's
   `AllocationPlanV3` allocates no candidate Revision ID and gives no other
   stable source. A storage-generated ID after confirmation cannot be part of
   the claimed pre-confirmation digest. **Minimum correction:** allocate the
   candidate Revision ID as a fenced, declared allocation purpose before the
   envelope is hashed, or remove it from that preflight commitment and state
   the post-publication binding separately.

10. **R5 has an unresolved history-boundary contradiction.** R5 §0.1 says
    `CanonicalBytesV2` intermediates never enter History payload, while R5
    §8.3 requires full immutable policy bytes and `HistoryCommitmentV2` to be
    retained so undo/redo can parse and enforce them. Calling the bytes a
    “History resource root” does not define whether they are durable history
    data, how they migrate, whether they are backed up, or how their corruption
    enters the existing history-only recovery state. **Minimum correction:**
    choose and name one storage boundary, then route it to AD-3/AD-4, the
    Project/Backup Contract's History/GC/recovery clauses, `FR-38`, `NFR-13`,
    and UX before treating it as a compatible extension.

11. **The new outcome registry needs an explicit stable-reason reconciliation,
    not only a generic statement that new codes are proposed.** R5 adds
    `CANDIDATE_UNDETERMINED/*`, `GEOMETRY_EXACT_LIMIT/*`, hole read-only,
    host, room, byte, and history outcomes. Current Geometry Contract §11,
    Project/Backup stable errors, PRD `NFR-24`, and UX error/recovery flows own
    their stable semantics. Several R5 outcomes are state transitions rather
    than reason codes, and the metric-cap outcome noted above is not fully
    registered. **Minimum correction:** create a complete owner-facing mapping
    for every new code/state, including phase precedence, user-visible status,
    persistence/history effect, and import/export behavior; do not leave a
    slash subtype or a generic phase name as an implementation choice.

12. **The cap set as a whole is a ProductLimitsPolicy change, not merely an
    exact-arithmetic implementation detail.** Raw presentation bit caps,
    RayProbe/face/Q2/metric caps, record count, and encoded-content caps can
    turn a currently valid user gesture or Project into a rejection. The
    current source assigns such limits to `ProjectLimitsPolicy` and device
    evidence, and forbids implementation from selecting them independently.
    R5 §0.2 calls them fixed but R5 §9 does not route them as one source delta.
    **Minimum correction:** add a distinct limits row covering every cap,
    proof of compatibility with existing hard limits, stable errors, and the
    owners in the Project/Backup Contract, PRD, performance budgets, UX, and
    Architecture.

## Required disposition before a later review

1. Resolve findings 1 and 2 first. Until then, R5 can reject a source-valid
   Room metric or a source-valid complete topology ChangeSet solely due to its
   unowned caps.
2. Amend R5's source-delta table so the hole compatibility state, containment
   policy, floor placement treatment, ID representation, and all caps have
   named owner clauses rather than umbrella labels.
3. Close the protocol defects in findings 7–10 and update the required corpus;
   a source owner cannot assess a supposedly complete confirmation/inverse
   policy while its add/remove, semantic payload, revision-ID, and retained
   policy representations are undefined.
4. Obtain the separately owned PRD/SPEC/Architecture/UX reconciliations and
   executable evidence only after the corrected draft receives a fresh
   independent review. Nothing here declares those reconciliations complete.


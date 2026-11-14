---
title: "D-022 R6 — limits and topology-host source targets"
date: 2026-08-05
status: advisory-noncanonical
purpose: "Precise non-narrowing targets for the R6 author; no source-owner decision or implementation authorization."
reviewed_r5:
  artifact: ../d-022-geometry-policy-decision-draft-r5-2026-08-05.md
  sha256: c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c
inputs:
  - review-current-source-d022-r5-external-2026-08-05.md
  - review-d022-r5-topology-data-integrity-external-2026-08-05.md
  - review-d022-r5-exact-geometry-external-2026-08-05.md
source_mutations: none
canonical_adoption: false
implementation_ready: false
readiness: NOT_READY
---

# D-022 R6: limits, compatibility and topology-host targets

## Boundary

This is read-only advice for a new R6 successor. It does not amend R5, an
`AD-*`, SPEC, PRD, UX, the portable JSON format, stable reasons, history, or
readiness. R6 must still label every proposed schema/reason/state below as a
source delta until its owner reconciles it.

`Compatible` means “does not reject a Project/Command that the current active
source policy accepts”; it is not adoption. Where the current source lacks a
finite bound, the only safe R6 result is **no independent cap**, or a named
source delta with the missing bound and UX/recovery contract.

## 1. Authoritative current envelopes

`project-and-backup-contract.md` §1 is the only current owner of these hard
limits. Let `W=300`, `R=50`, `O=200`, `A=250`, `S=400`, and `C=2 MiB` denote
the hard counts for WallSegment, Room, Opening, AssetInstance,
Surface/material assignment, and one Durable ChangeSet respectively.

| Needed R6 quantity | Source-derived bound | Important gap |
|---|---:|---|
| RayProbe rows | `8 × W = 2,400` | none for a current-valid Plan. |
| One Room/usable boundary from current WallSegments | `<= W = 300` geometric edges | Root-lineage atoms must not become extra metric geometry edges. |
| Two whole Plan/usable boundaries | `W × W = 90,000` candidate pairs | Pairwise materialisation is optional; rejection at `64`/`4,096` is narrowing. |
| Wall host source records | `O + A + S = 850` | at most one WallPlacement per AssetInstance. |
| Room-field decisions | `8 × R = 400` | current Room fields include floor/ceiling/wall-side assignments. |
| Old + new wall-side table rows | `2W + 2W = 1,200` | exactly two physical sides per wall per state. |
| Ceiling transition identity union | `A + A = 500` | pre/post IDs may be disjoint. |
| Durable ChangeSet bytes | `C` | current source has no record-accounting grammar, Vertex cap, or footprint-edge cap. |

The first four mandatory categories alone can coexist as `400 + 850 + 1,200
+ 500 = 2,950` distinct logical rows, before lineage, seeds, allocations,
forward/inverse patches, resource commitments, or values. R5's `1,200`
record cap is therefore already narrowing.

There is no current hard limit for isolated Vertex count, asset-footprint edge
count, or a definition of what one nested ChangeSet “record” counts. A finite
`maxChangeSetRecords` cannot be honestly derived until the source owner adds
all three. The existing `2 MiB` byte limit is not a substitute for an invented
row count, but it is the only current ChangeSet ceiling.

## 2. Exact non-narrowing caps

### 2.1 RayProbe

**Safe R6 result.** Define `maxRayProbeRows = 8 * activeProjectLimits.maxWallSegments`.
Under the current active policy it is exactly `2,400`; equality is accepted.
Rows are generated in the fixed direction/WallSegment order and counted before
allocation. A Plan with `wallSegmentCount > 300` is handled by the existing
Project-limit path, not by a new selection-specific cap. Thus a current-valid
Plan never returns `CANDIDATE_UNDETERMINED/RAY_PROBE_LIMIT`.

**Owners/compatibility.** Compatible with Project/Backup §1, Geometry Contract
§§3–6, PRD FR-7–FR-9 and AD-7. A lower RayProbe limit, including one chosen
for device performance, is a material delta to those clauses plus performance
budgets and UX candidate/error behaviour.

**Fixture.** `LIMIT-RAYPROBE-W300`: 300 current walls produce exactly 2,400
ordered rows and no limit result; 301 is classified by the existing project
limit before selection.

### 2.2 Metrics

**Safe R6 result.** `MetricWholeBoundary` over Plan/usable geometry accepts up
to 300 geometric edges per selected source and considers up to `90,000` ordered
edge-pairs when two whole boundaries are compared. The implementation target is
an exact streaming minimum reducer: it may enumerate this finite set in
canonical order but must not materialise all pairs merely to enforce a smaller
cap. `MetricEdge` remains exactly one geometric edge. Base-root expansion is
lineage evidence only and never multiplies a usable/metric boundary.

The current contracts do not bound `FootprintPolygon` edge count. For an
asset-footprint metric R6 must therefore either (a) use a terminating exact
stream over the already admitted finite footprint without an independent
edge/pair reject, or (b) propose `maxFootprintEdges` plus the corresponding
catalog admission, ProjectLimits, FR-13/FR-28–31, Geometry §9, AD-8 and UX
delta. It must not report a generic metric-cap error for a source-valid asset.

**Owners/compatibility.** The Plan part is compatible with FR-13 and the
current `W` limit. Any finite asset-footprint cap, formatter work cap, or
smaller metric boundary cap is a source delta to the clauses above and
`performance-budgets.md`.

**Fixtures.** `LIMIT-METRIC-ROOM-W300` (300-edge whole boundary);
`LIMIT-METRIC-PAIR-90000` (two 300-edge sources); and
`LIMIT-METRIC-FOOTPRINT-UNBOUNDED-BY-SOURCE` (proves no R6 count rejection;
the later owner decision supplies any admission cap).

### 2.3 ChangeSet

**Safe R6 result.** Remove `maxTransferRecords` entirely. R6 may reject only
on existing final Project counts, `BackupFeasibilityPolicy`,
`SessionRetentionPolicy`, and the current `C=2 MiB` Durable ChangeSet limit;
all proposed impact/lineage/host data must be streamed or otherwise handled
without an independent count reject. The byte measurement must be the
source-owned durable ChangeSet representation, not a larger private
CanonicalBytes helper.

**Precise required delta if an implementation needs a count cap.** Add, in one
versioned `ProjectLimitsPolicy` change: `maxVertexCount`,
`maxFootprintEdgesPerAssetDefinition`, `ChangeSetRecordAccountingV1` (what
counts, including nested forward/inverse rows), `maxChangeSetRecords`, stable
reason and actual/limit fields. Reconcile Project/Backup §1, Geometry §§3/5/10,
PRD FR-9/15/19/35–38 and NFR-1–4/NFR-13, AD-3/4/7/8, performance budgets and
UX. Until that route is complete R6 must not emit
`GEOMETRY_EXACT_LIMIT/TRANSFER_RECORDS`.

**Fixture.** `LIMIT-CHANGESET-MANDATORY-2950`: one legal fenced candidate
contains the four row categories in §1 and is not rejected by count; a separate
fixture proves the existing 2 MiB source-owned byte outcome leaves the prior
Durable Revision and History unchanged.

## 3. Hole compatibility is a separate, non-corruption state

`NoHolesAlphaV1` is a material source delta: Geometry Contract §12 currently
asks for hole goldens, while Project/Backup §6 reserves
`ResourceRecoveryRequired` for missing/corrupt resources. R6 must not call a
readable hole Project corrupt or use `RecoveryChangeSet` to change it.

**Proposed exact compatibility route (not adopted):**

1. New candidate: after exact face/ring derivation and before Room identity,
   reject `PLAN_HOLE_UNSUPPORTED/{HAS_INNER_RING|NESTED_RING|TOUCHING_RINGS}`.
   It creates no PendingDurability, Revision, History, autosave or projection.
2. Open/import: after raw/schema/limit validation, detect the same ring set
   without rewriting canonical bytes. A readable, otherwise healthy Project
   enters `TopologyCompatibilityReadOnly { reason: IMPORT_PLAN_HOLE_READ_ONLY,
   ringKind }`. It is not `ResourceRecoveryRequired` and is not a migration.
3. In that state normal Commands, undo/redo, autosave replacement and writer
   publication are disabled; existing History/GC roots remain untouched.
   Read-only 2D/3D, diagnostics, Trash/restore and complete Portable Backup of
   an otherwise healthy current Project remain available. Import still creates
   a new Project ID and carries the same compatibility state. No auto-delete,
   simplify, rehost, data loss or “repair” exists in R6.
4. If a resource issue also exists, `ResourceRecoveryRequired` has operational
   priority. Exact resource repair returns to `TopologyCompatibilityReadOnly`,
   not to editable Healthy.

**Owner route.** Geometry Contract §§7/10–12; Project/Backup §§2/4/6 and its
stable errors/state machine; PRD FR-14, FR-38, FR-45 and NFR-1–4/NFR-13;
Domain Model §§2/7/9/12; Architecture AD-3/4/7; UX DESIGN status banner and
EXPERIENCE recovery/read-only flow. A later owner may instead adopt full
multi-ring support or an explicitly confirmed topology migration, but neither
may be silently selected by R6.

**Fixture.** `HOLE-COMPAT-ROUNDTRIP`: import/open/export/reimport preserves
the same geometry and enters the named state; edit, undo/redo and autosave are
unavailable; resource repair returns to the same state.

## 4. Floor, ceiling and containment

Current `FloorPlacement { levelId, xMm, zMm, elevationMm, yawStep }` is
**Level-hosted**, not Room-hosted. `SurfaceAddress.Floor(RoomId)` is a finish
address and must never be confused with floor AssetPlacement.

**Safe R6 disposition.** Remove the R5 claim of floor/ceiling *strict*
footprint containment. Current Geometry §9 and PRD FR-28/FR-31 leave outside
room/collision severity as a product policy and promise valid/warning/invalid
preview, not strict containment.

* A topology-only ChangeSet leaves every FloorPlacement byte-identical when
  its one `levelId` remains the Project Level. It gets no host-transfer,
  rehome, Room-identity, or ceiling-inventory row. A simultaneous user asset
  command is an explicit ordinary asset patch, never an inferred topology move.
* A CeilingPlacement is Room-hosted. `KeepExact` is allowed only when its
  complete placement bytes and room ID remain valid; if the Room ID disappears
  or changes, it needs an explicit move, change-kind, or delete with inverse.
  A changed usable polygon can feed the existing collision/placement preview,
  but does not silently move or delete the asset.
* Strict floor or ceiling footprint containment is allowed only after a
  material policy delta naming the exact boundary (centerline/usable), contact
  rule, candidate outcome, topology response and recovery semantics.

**Owners.** Geometry §9; Domain `PlacementPolicy`/`CollisionPolicy` and
SurfaceAddress; PRD FR-28/29/31/34/36; AD-8; UX placement preview. The exact
strict-containment proposal must also route to ProjectLimits/performance if it
adds a footprint cap.

**Fixtures.** `FLOOR-LEVEL-HOST-TOPOLOGY-NOOP`,
`CEILING-ROOM-REMOVED-EXPLICIT-ONLY`, and
`CONTAINMENT-NOT-IMPLICIT-COLLISION-PREVIEW`.

## 5. Base-relative root atoms and face expansion

R6 should make roots **transition-relative**, not an unbounded historical
field. In the fenced base Revision every current WallSegment contributes one
`BaseRootAtom { baseWallSegmentId, start=0/1, end=1/1,
basePhysicalOrientation }`. This is detached evidence, not persisted Project
state.

For each output wall, intersect its normalized topology lineage with those
base atoms, split at every base-wall endpoint/contact projected onto that
output wall, drop zero intervals, and sort by the output wall's traversal
direction. A merge of `n` collinear base walls therefore has exactly `n`
ordered virtual atoms; a non-merged wall has one. Atoms cover each output wall
once with no gap/overlap and carry a source and target orientation parity.

`FaceKey` expansion is then unique: replace each geometric current edge by its
ordered atoms, insert their virtual split coordinates into the CCW vertex walk,
and set `boundaryOrdinal` to the contiguous one-based index in this *expanded*
array. Metrics/usable geometry still use the original geometric edge. Every
old/new atom has exactly one owner per physical side, and all atom rows are
derived from the base/current face tables; no historical root chain can grow.

This is a proposed Geometry/Domain/FR-15 schema detail. It is bounded by
`2W=600` root-side atoms per state under the current wall limit, so old+new
coverage is at most 1,200 rows. It fixes merged-wall face digest and lineage
without narrowing a current Project.

**Fixture.** `LINEAGE-MERGE-TWO-ROOTS-ONE-EDGE`: pins virtual coordinates,
expanded ordinals, old/new side tables, atom coverage, digest and inverse.

## 6. Discriminated topology hosts and semantic surface address

Replace R5's uniform `HostRecordV2` with the following closed proposal. No
variant may carry fields of another variant.

```text
TopologyHostV3 =
  | OpeningHost {
      openingId, wallSegmentId, opening:{kind,offsetMm,widthMm,heightMm,sillMm},
      centerlineSpan, sideProofs: exactly [Left,Right], inverseOpening
    }
  | WallPlacementHost {
      assetInstanceId, placement:WallPlacement, footprintSpan,
      sourceSideProof, targetSideProof, resourceCommitment, inversePlacement
    }
  | WallFinishHost {
      surface:WallSurfaceAddress, assignmentValue, sourceSideProof,
      targetSideProof, resourceCommitment, inverseAssignment
    }
```

An Opening is centreline-attached, never a one-side host. Its two side proofs
must exactly match the source/target wall-side tables. Its payload retains
kind, offset, width, height and sill; validation applies span, overlap, and
minimum shared-Room-height rules before derived Door adjacency is recomputed.
Opening transfer may be KeepExact, explicit same-root/contained-child transfer,
explicit cross-root rehost, or explicit delete; a split-crossing span rejects.

WallPlacement and WallFinish are side-attached. Only they carry a semantic wall
surface. Their target proof contains no nearest Room/renderer inference; a
wall with two exterior physical sides cannot accept either variant because the
current one-token `ExteriorSide` address would collapse two distinct sides.

The persistent address must be the closed union:

```text
SurfaceAddressV3 =
  | FloorSurface { roomId }
  | CeilingSurface { roomId }
  | WallSideRoom { wallSegmentId, adjacentRoomId }
  | WallSideExterior { wallSegmentId, exteriorSide: ExteriorSideMarkerV1 }
```

All fields are required by their tag and forbidden otherwise. `PhysicalSide`
is evidence only. `WallSideProofV3` contains separate source and target
records, each with wall snapshot digest, side-table digest, physical side,
occurrence-or-exterior root and orientation parity. For a same-root transfer,
derive `rootSide = physicalSide` for `SameAsRoot` and `opposite(physicalSide)`
for `ReversedFromRoot`, then require equal root side and matching base-root
atom. The semantic `WallSideRoom/Exterior` must equal the referenced table
target on each side. This proves reverse preservation without persisting
left/right.

**Owners/delta.** Geometry §§8–9, Domain Model §§2–3/6/10, PRD FR-17–19 and
FR-35–38, AD-6/8 and UX conflict confirmation own this durable union/proof
extension. It is not compatible merely because its intent is safe.

**Fixtures.** `OPENING-SHARED-WALL-TWO-SIDE-HEIGHT`,
`WALL-SIDE-REVERSE-SOURCE-TARGET-PROOF`,
`SURFACE-ADDRESS-EXTERIOR-TAGGED`, and `TWO-EXTERIOR-WALL-HOST-REJECT`.

## 7. Cross-root rehost: explicit and reversible only

R6 should retain no cross-root automatic move. It may permit one separate
`CrossRootRehostExplicit` action for Opening, WallPlacement, or WallFinish
only after direct user confirmation. The row contains full source and target
payloads, target wall/side proof (both opening sides where applicable), anchor
compatibility, fit/height/overlap checks, resource/notice commitments, a
confirmation digest, and the complete inverse source payload. It deliberately
does **not** claim same-root lineage or parity equality.

If this record is absent, deleted source host gives the current conflict/orphan
preview and needs explicit delete/reassign; no nearest compatible wall, world
transform, default Room or offset is inferred. This fulfills the current
explicit-preview intent of Geometry §§8–9 and PRD FR-19 while keeping a new
durable action as a source delta.

**Fixture.** `HOST-EXPLICIT-CROSS-ROOT-REHOST`: delete the source wall,
confirm one compatible target, then prove exact undo; the omitted-confirmation
case produces no candidate Durable mutation.

## 8. Ceiling transition matrix

Build `CeilingTransitionInventoryV3` from the explicit pre/post placement
declarations, before candidate allocation: its universe is exactly IDs for
which `preKind=Ceiling OR postKind=Ceiling`. Each receives one row containing
full canonical pre/post placement payloads (or typed retained record refs),
action, inverse, resource commitment and allocation when `Absent -> Ceiling`.
Rows for a Wall side must cross-reference the one Wall host resolution; they
are not two independent moves.

| Pre kind | Post kind | Required R6 action |
|---|---|---|
| Absent | Ceiling | `CreateToCeiling`: explicit complete AssetInstance/placement, allocation, inverse Absent. |
| Floor | Ceiling | `MoveFloorToCeiling`: explicit target CeilingPlacement, inverse full FloorPlacement. |
| Wall | Ceiling | `RehostWallToCeiling`: explicit target, source Wall proof, inverse wall placement. |
| Ceiling | Ceiling, byte-identical | `KeepExact`. |
| Ceiling | Ceiling, otherwise | `MoveWithinCeiling`: explicit target/inverse; no nearest Room. |
| Ceiling | Floor | `MoveCeilingToFloor`: explicit target/inverse. |
| Ceiling | Wall | `MoveCeilingToWall`: explicit target side proof/inverse. |
| Ceiling | Absent | `DeleteFromCeiling`: confirmed delete/inverse full placement. |

Pairs with neither side Ceiling do not occur in this inventory and are ordinary
asset or wall-host transitions. Missing, duplicated, stale, kind-mismatched or
payload-free rows reject before PendingDurability. R6 must not use placement
digests alone: replay requires canonical payload bytes or a typed immutable
history-rooted reference.

**Owners/delta.** Domain AssetInstance placement union and ChangeSet, Geometry
§§3/9, PRD FR-28/29/38, AD-3/4/8, Project/Backup history/resource roots and UX
confirmation. Full directional serialization is a source extension.

**Fixture.** `CEILING-POST-TARGET-DIRECTION-MATRIX` covers every table row,
allocation for create, source/target payload equality, Wall cross-reference,
and forward/reverse replay after candidate disposal.

## 9. Complete outcome/state mapping within this R6 scope

All names marked “proposed” require the listed owner route; R6 cannot treat
them as existing stable codes. No slash subtype is an implementation choice.

| Token | Kind and precedence | Durable/history effect | Import/export | Owner route |
|---|---|---|---|---|
| `PROJECT_BOUNDS_EXCEEDED` | existing static ProjectLimit reject before R6 selection | no mutation/history | import uses existing `BACKUP_PROJECT_LIMIT` | Project/Backup §1, Geometry §11 |
| `PROJECT_CHANGESET_BYTES_LIMIT` (proposed) | only source-owned `2 MiB` durable ChangeSet outcome; never a private CB2-size outcome | reject before PendingDurability; prior Durable/History untouched | not an import alias | Project/Backup §1, PRD FR-38/NFR-13, AD-3/4, UX |
| `CANDIDATE_UNDETERMINED/RAY_PROBE_LIMIT` | deliberately unreachable for a current-valid `W<=300` Plan | Draft only | n/a | only if a future lower limit is adopted |
| metric/transfer count cap | deliberately no R6 outcome | n/a | n/a | requires the explicit limits delta in §2 |
| `PLAN_HOLE_UNSUPPORTED/{HAS_INNER_RING,NESTED_RING,TOUCHING_RINGS}` (proposed) | candidate face reject before Room/host | no mutation/history | n/a | Geometry, PRD FR-14, UX |
| `IMPORT_PLAN_HOLE_READ_ONLY` (proposed) | persistent compatibility state, lower operational priority than ResourceRecovery | disables edit/undo/redo; preserves current/history roots | complete healthy export allowed; import creates new ID in same state | all owners named in §3 |
| `HOST_SURFACE_REMOVED`, `ANCHOR_REHOST_AMBIGUOUS` | existing source semantics for missing/ambiguous host; R6 surfaces confirmation rather than guessing | no mutation until explicit resolution | n/a | Geometry §11, PRD FR-19/28, UX |
| `OPENING_OUT_OF_BOUNDS`, `OPENING_OVERLAP` | existing opening fit/overlap rejects | no mutation/history | n/a | Geometry §11, PRD FR-17–19 |
| `WALL_HOST_RESOLUTION_INVALID`, `TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED`, `CEILING_RESOLUTION_REQUIRED`, `CEILING_RESOLUTION_INVALID` (proposed) | typed preflight reject after topology/Room, before allocation | no mutation/history | n/a | Geometry/Domain/PRD/AD/UX owner route in §§6–8 |
| `CrossRootRehostConfirmationRequired` (proposed) | non-durable confirmation state, not a reject fallback | no PendingDurability/history until confirmed row validates | n/a | Geometry §9, PRD FR-19/28, UX |

The required ordering is: raw/import limits → candidate selection → topology and
face gate → Room identity → discriminated host/ceiling inventory → allocation,
resource/byte envelope → PendingDurability. `ResourceRecoveryRequired` keeps
its existing integrity precedence; it must never be relabelled as a hole or
ordinary host conflict.

## Non-disposition

These targets close neither the R5 review findings nor the official readiness
gate. They create no source, code, tests, configurations, schema migration,
or implementation permission.

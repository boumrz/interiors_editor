---
title: "D-022 — source-aligned geometry policy decision draft, R7"
decision_id: D-022
revision: R7
status: draft
noncanonical: true
canonical: false
architecture_spine_changed: false
memlog_changed: false
implementation_ready: false
readiness: NOT_READY
scope: "Noncanonical source-aligned replacement direction for detached exact geometry, topology transition, state fencing and owner reconciliation"
created: 2026-08-05
updated: 2026-08-05
predecessor:
  path: d-022-geometry-policy-decision-draft-r6-2026-08-05.md
  revision: R6
  sha256: 276a7c7224c5b33a2554fbc7b34811a85178e6d9b7a6ae6e65230e61fc3bb6fa
  disposition: frozen-rejected-external-review-evidence-do-not-edit
frozen_review_inputs:
  - path: reviews/review-d022-r6-exact-geometry-external-2026-08-05.md
    sha256: c7ac9dbbcfe2bdd27a0c187eca38430ca0e60a70fccd96107658c6c248e5423f
  - path: reviews/review-current-source-d022-r6-external-2026-08-05.md
    sha256: 575f63e1016bfe35120b8eb615994baf2f8ec2bb5d2a0da3a07ebf74d02d41ce
  - path: reviews/review-d022-r6-topology-data-integrity-external-2026-08-05.md
    sha256: 183fa0552822e8701010326d6e99cbda97c0f0902735f6ad63729e1a153f5767
advisory_input:
  path: reviews/d022-r6-registry-outcome-preflight-2026-08-05.md
  sha256: adb41641a1ddba3c775969a630ee87509f29589c211adb877647231cd8c50f0b
frozen_source_inputs:
  - path: ../../../specs/spec-interiors-editor-alpha/SPEC.md
    sha256: ce903b5aa4bf3f59efbd08d030dc7c292491315a1280cf1203f3114e517169ed
  - path: ../../../specs/spec-interiors-editor-alpha/glossary.md
    sha256: 3762338e349293863176f802d7ee1a783b62ef28d081b96155a11598da894156
  - path: ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
    sha256: ca0efcc9126ac8ff92fa76eeafa32ac8dd3d13311d8d66758a68219b52cefbb0
  - path: ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
    sha256: 91ecfb9ac4cb7bc21e2e0205442b960713e70a2aaf3384a40645db2fff8d7157
  - path: ../../../specs/spec-interiors-editor-alpha/performance-budgets.md
    sha256: 4063badb4ac950fb1811297d2d87cbfcdc21ffa54754201a3ceb190bbecc3547
  - path: ../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
    sha256: a2515ee47c029516643e33a6c90453a6ebafcbbd1110048ec1dbbd8e1ad99c56
  - path: ../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
    sha256: c3b06f9967630fb1e66754463acb97d5dda9a3209ac1cade418f33e770b8a48c
  - path: ../../../project-context.md
    sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
  - path: ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
    sha256: 48bd0a416dad0e78ac65d3f616da7ded36500726ff2e0026650d7f93814d47eb
  - path: ARCHITECTURE-SPINE.md
    sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  - path: domain-model.md
    sha256: 80eed557aeafaaf97dfef974e3f639efb887b1d28fe50b878722e813913e5395
  - path: solution-design.md
    sha256: 4bf3bf635868fd7b1aada6ef8d4d199a18a91bb1633e428aba2445f82f6c917c
  - path: ../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
    sha256: 02c18269245a71ea6a7058daead2268e56e81ef11c5bb459a40b294f09b02289
  - path: ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
    sha256: ac20ff129bee180509fe3d83f2537f35672904c17a3fd5ae34eb9a407310cb29
---

# D-022 — source-aligned geometry policy decision draft, R7

## 0. Статус и граница

Это самостоятельный noncanonical successor замороженного R6. Он не изменяет
SPEC, PRD, Architecture Spine, UX или companion contracts. Задача R7 —
устранить архитектурные противоречия R6, не создавая вторую модель Project,
History или Portable Backup.

R7 не наследует как fallback отклонённые R6 CB3, typed content reference,
Q2-format, private reason-code или transition bundle. Нормативным становится
только правило, принятое владельцем соответствующего canonical source с
versioned corpus. До этого статусы документа: draft, noncanonical, NOT_READY.
Этот draft не даёт разрешения на scaffold, production code, test artifact или
schema change.

### 0.1. Принятые направления

1. Rational/Q2-арифметика, exact selection и exact metric существуют только
   в detached validation, worker job или fixture evaluator. Они не попадают в
   Project JSON, Command, ChangeSet, HistoryEntry, resource manifest, writer
   fence, Portable Backup или Durable Revision. В durable History нет CB3,
   Q2, BigInt-представления или inline transition bundle.
2. Каждый ID остаётся opaque branded string из IdPort. R7 не задаёт binary ID
   transport и не меняет строковое значение ID во время canonical
   serialization.
3. Пока R7 явно не даёт узкий source-owner proposal, сохраняется current
   baseline: C3 constrained direction, miter с deterministic bevel после cap,
   доступные Exterior wall-side placements, отсутствие candidate-only запрета
   holes и единый MeasurementFormatPolicy.
4. Все findings R6 закрываются точным R7 rule либо immutable source reference
   и owner action. Нельзя закрывать finding ссылкой на отклонённый R6 fallback.

### 0.2. Единственная durable граница

Единственными durable данными остаются source-owned:

- versioned canonical Project JSON и immutable Revision;
- source Command, complete ChangeSet и inverse;
- current session HistoryEntry с полями label, command, inverse,
  beforeRevisionId, afterRevisionId;
- revision resource manifest и pinned bytes в user-owned blob store;
- repository writer lease/fencing metadata, отдельно от Project JSON и
  Portable Backup.

Derived faces, usable polygons, spatial indices, renderer meshes, selection,
metric values, preview, diagnostics и worker-local exact values —
recomputable projections. R7 не добавляет им durable schema, serializable
content reference, policy digest или backup member.

### 0.3. Immutable source reference

Path, stable section/ID и hash в frontmatter фиксируют baseline, который
проверил R7. Они не замораживают canonical source навсегда. Если владелец
изменяет правило, он делает versioned canonical update и corpus, затем
reconciles D-022. R7 не становится альтернативным authority.

## 1. Source-aligned outcome crosswalk

R7 не создаёт reason-code с префиксом D022. Draft всегда означает
current-session UI state, а не Command, CandidateUndetermined или
NoDraftCommand.

| Ситуация | Фаза и владелец | Stable outcome и witness | Project, History и UX |
| --- | --- | --- | --- |
| malformed, fractional, nonfinite, unsafe или negative interactive dimension | Geometry Contract §8 | INVALID_DIMENSION; field/context и safe suggestion | Rejected до candidate; last Durable и History без изменения; UI retains field/raw draft and reason context |
| nonfinite or non-invertible presentation/pointer transform | UX + Geometry Contract input route | INVALID_DIMENSION; transform/pointer witness | Rejected gesture without candidate; UX retains field/raw input and source preview/context, with no durability effect |
| zero segment | Geometry Contract §8 | ZERO_LENGTH; endpoint witness | Rejected без PendingDurability, autosave или history |
| forbidden direction | AD-7 + Geometry Contract §8 | UNSUPPORTED_DIRECTION; signed delta | Rejected без mutation |
| integer value outside Project bounds | Geometry Contract §8 | PROJECT_BOUNDS_EXCEEDED; actual/allowed | Rejected без mutation; R7 не подменяет код |
| wall/entity count or size limit | ProjectLimitsPolicy / Project & Backup §1 | source-owned stable project-limit reason; actual/allowed | Rejected до Durable; R7 не вводит private cap/code |
| no eligible screen candidate | UX + SnapPolicy | DraftCommand and source-owned visible hint | Ни Command, ни Rejected reason, ни persistence |
| topology, Plan, Room, Opening или host invariant fails | Geometry Contract §§6–8 | existing source reason, например SELF_INTERSECTION, OPENING_OUT_OF_BOUNDS, ROOM_IDENTITY_AMBIGUOUS, HOST_SURFACE_REMOVED или ANCHOR_REHOST_AMBIGUOUS | Rejected; no partial candidate/projection |
| resource pin, backup или history admission fails | Project & Backup §§1–2 | PROJECT_RESOURCE_PIN_FAILED, PROJECT_RESOURCE_ENTRY_LIMIT, PROJECT_RESOURCE_BYTES_LIMIT, PROJECT_BACKUP_ENVELOPE_EXCEEDED или PROJECT_HISTORY_RESOURCE_LIMIT; hash/count/bytes | Rejected before Durable; redo roots intact |
| referenced current resource missing/corrupt | Project & Backup §6 | PROJECT_REFERENCED_RESOURCE_MISSING or PROJECT_REFERENCED_RESOURCE_CORRUPT | ResourceRecoveryRequired; exact repair or complete RecoveryChangeSet only |
| history-only corruption | Project & Backup §6 | current recovery reason and History scope | healthy current remains backupable; exact repair or explicit DiscardSessionHistory only |
| stale writer fence | Solution Design §7 | PROJECT_WRITE_LOCK_LOST; project/baseRevision/fence witness | no candidate publication or History change; read-only until takeover/retry |
| validation passed but durability write fails | AD-3 and SPEC CAP-8 | current source persistence-failure state and repository diagnostic | previous Durable/History remain current; candidate only retry/recovery export; next mutation fenced |
| import/recovery cannot establish a valid state | Project & Backup §§4, 6 | existing BACKUP or RESOURCE_RECOVERY reason | no overwrite of current Project |

An unlisted failure must enter the relevant source discriminated union and
corpus before implementation. A log label, localized string, worker exception
or raw library error is never a new semantic outcome.

## 2. Ephemeral exact-session contract

### 2.1. General rule

Exact arithmetic may use arbitrary-width integers, rationals and a+b√2 only
inside one detached validation execution or fixture evaluator. It ends at:

1. a safe integer-mm canonical output accepted by the source domain; or
2. an ephemeral exact result consumed by preview/MeasurementFormatPolicy.

No exact value crosses the durable boundary. The R7 tuples below are in-process
function values only: they are not bytes, cache keys, logs, cross-context
messages or a fixture file format. If a worker is used, it uses the
source-owned AD-12 job envelope and a separately adopted transfer contract;
the R7 tuples are never that transfer payload. Any worker result must match
the base revision/state fence before it affects UI. A stale result is discarded;
it is never auto-rebased.

### 2.2. Selection request and result V1

The following is a semantic same-process tuple, not JSON schema, transport
format or fixture encoding. Its positional order fixes structural comparison
inside one validation execution; it makes no byte-encoding claim.

~~~
SelectionRequestV1 =
  ["D022.SelectionRequestV1",
   projectId: IdPortString,
   baseRevisionId: IdPortString,
   baseRevisionChecksum: SourceRevisionChecksum,
   projectSchemaVersion: SourceSchemaVersion,
   origin: OriginAtVertex | OriginAtPoint,
   input: PointerInput | NumericEndpointInput | NumericLengthInput]

OriginAtVertex = ["vertex", vertexId: IdPortString, xMm: SafeInteger, zMm: SafeInteger]
OriginAtPoint  = ["point", xMm: SafeInteger, zMm: SafeInteger]
PointerInput   = ["pointer", hitSquare: HitSquare]
HitSquare      = ["closed-square", centerXCssPx: FiniteNumber,
                  centerYCssPx: FiniteNumber, halfSideCssPx: FiniteNonNegativeNumber]
NumericEndpointInput = ["numeric-endpoint", xMm: SafeInteger, zMm: SafeInteger]
NumericLengthInput   = ["numeric-length", lengthMm: SafePositiveInteger,
                        quadrant: SourceQuadrant]
~~~

SourceRevisionChecksum is the existing checksum of the canonical snapshot, not
a R7 digest algorithm. IdPortString is the unchanged opaque source ID string.
The active screen-to-plan transform is an invocation-local UX callback, not a
member of this record and not a serializable input.

~~~
SelectionResultV1 =
  ["D022.SelectionResultV1",
   projectId, baseRevisionId, baseRevisionChecksum, projectSchemaVersion,
   result]

result =
  ["existing-vertex", vertexId]
  | ["exact-contact", xMm: SafeInteger, zMm: SafeInteger]
  | ["constrained-direction", direction: SourceConstrainedDirection,
     endpointXMm: SafeInteger, endpointZMm: SafeInteger]
  | ["origin-relative-step", direction: SourceConstrainedDirection,
     stepK: SafePositiveInteger]
  | ["unresolved"]
  | ["rejected", reasonCode: SourceReasonCode, witness: SourceDiagnostic]
~~~

SourceDiagnostic remains source-owned and transient. It cannot carry arbitrary
policy, inline bundle, exact-number payload or raw ID bytes. Structural
comparison is only same variant tag plus same ordered source strings and exact
SafeInteger values inside the same base snapshot. It may never be used as
cross-boundary byte comparison.

### 2.3. C1–C4 selection proposal

This is an R7 source-owner proposal, not canonical adoption. The retained
class order is:

1. C1 — eligible exact existing Vertex;
2. C2 — eligible exact contact/intersection/end;
3. C3 — one exact constrained gesture endpoint;
4. C4 — origin-relative 100-mm fallback.

For C1 and C2, eligible includes this precise predicate. The target can rank
only when its projected point is inside the current closed HitSquare:

~~~
centerXCssPx - halfSideCssPx <= targetXCssPx <= centerXCssPx + halfSideCssPx
centerYCssPx - halfSideCssPx <= targetYCssPx <= centerYCssPx + halfSideCssPx
~~~

The predicate is inclusive and applies to integer and non-integer projected
contacts. A geometrically exact but remote contact is ignored by C1/C2. It
does not silently become the selected target.

C3 is proposed only when inverse pointer coordinates resolve to an exact
integer-mm endpoint, and the delta from origin is a permitted non-zero
orthogonal or 45-degree integer delta. C3 returns that one exact endpoint; it
does not round it, search an alternate lattice point or persist a selection
policy. If that condition is not true, C4 alone proposes the 100-mm
origin-relative candidate after direction selection. An unresolved selection
stays DraftCommand. Valid integer-mm numeric input bypasses this gesture
selection, but never contact normalization or full validation; a valid endpoint
outside bounds remains PROJECT_BOUNDS_EXCEEDED.

Screen tolerance, equal-tie, hysteresis, T/X continuity and relative-step-k
interaction still require source-owner adoption in §10. No implementation may
substitute library defaults meanwhile.

### 2.4. Metric target state fence and tuple

Every metric begins from one immutable source snapshot:

~~~
MeasurementTargetSnapshotV1 =
  ["D022.MeasurementTargetSnapshotV1",
   projectId: IdPortString,
   baseRevisionId: IdPortString,
   baseRevisionChecksum: SourceRevisionChecksum,
   projectSchemaVersion: SourceSchemaVersion,
   target]

target =
  ["existing-vertex", vertexId, xMm, zMm]
  | ["wall-centerline", wallSegmentId,
     startVertexId, endVertexId, startXMm, startZMm, endXMm, endZMm]
  | ["usable-boundary", roomId, faceFingerprint,
     usableGeometryDigest, edgeOrdinal]
  | ["asset-footprint", assetInstanceId, placementDigest,
     footprintDigest, edgeOrdinal]
~~~

All IDs remain strings and all coordinates source-valid safe integer-mm values.
edgeOrdinal is zero-based in the source-owned canonical derived boundary order
of this exact snapshot. The two digests identify that derived projection; they
do not prescribe a hash, serialization or durable storage. Variants have no
nullable field or implicit target. Target equality is same variant tag and
same ordered field values in one base snapshot only; it is not byte comparison
or an inter-context protocol.

Before display or export, the app compares both baseRevisionId and
baseRevisionChecksum with current state. Any mismatch discards the result and
marks the measurement stale; UI requires reselection instead of measuring a
different wall, boundary or asset. That comparison changes neither Command nor
History.

An exact result may be rational/Q2 only in memory or a fixture evaluator. It
flows to the one source-owned MeasurementFormatPolicy. Precision and locale
are deliberately not frozen here: they require PRD/SPEC/UX adoption.

## 3. Detached topology discovery, identity and faces

### 3.1. Fixed phase order

This phase order removes the R6 pre-reservation cycle. Every phase uses the
same fenced base snapshot; rejection ends the flow with no candidate
publication.

1. Read current Revision and writer fence; reject stale base.
2. Build DraftCommand and perform C1–C4/numeric normalization.
3. Run PreflightDiscovery on a detached canonical Project snapshot. Group exact
   contacts, partition affected wall interiors, derive candidate faces, find
   affected hosts/openings and enumerate needed identities.
4. Build an ephemeral TopologyAllocationIntent from discovery. It contains
   semantic generation roles and deterministic order, not generated IDs, a
   Project field or History record.
5. Call IdPort only after discovery, allocate strings in that order and
   materialize source Command/ChangeSet/inverse.
6. Validate Plan, bounded faces, Room reconciliation, Opening, host, resource
   admission and history retention on the complete candidate.
7. Only a complete candidate may enter PendingDurability and §8 durability.

The source owner publishes the allocation comparator over entity kind, lineage
root, exact normalized interval and generation role. R7 never byte-encodes an
opaque string or derives an ID from the order. Later failure may leave an
unused opaque ID but cannot create an invisible durable reservation.

### 3.2. Lineage roots and split identity

LineageRoot is an ephemeral discovery relation only; it is not a WallSegment,
Room, History or backup field.

For an existing WallSegment split at one or more interior contacts:

- order fragments along the existing segment’s canonical source orientation;
- the non-zero child incident to old startVertexId retains the existing
  WallSegment ID;
- every other child receives a fresh IdPort string after discovery;
- that old ID is the ExistingLineageRoot.

For a newly drawn wall that itself is partitioned:

- the DraftCommand direction is provisional root orientation;
- the non-zero child incident to provisional start receives the first newly
  allocated WallSegment ID and becomes the real CreatedLineageRoot;
- every other child receives its own new ID;
- no invisible root-only WallSegment exists.

An unchanged wall retains its ID. A discovery result without the required
start-incident child is invalid. The inverse source ChangeSet restores exact
pre-command records and removes only created records, so undo has no root
collision.

### 3.3. Faces, articulation exterior and holes

Preflight builds the half-edge embedding from all normalized centerlines.
Every derived bounded face proposed as a Room must satisfy the source Plan
invariants: simple, non-self-intersecting, positive area and source-required
usable geometry. The unbounded exterior is not a Room.

Exterior traversal may repeat articulation vertices or darts. This repeat is
valid by itself and must not reject a candidate whose bounded faces are valid.
It also never becomes a Room. A repeat/self-intersection in a bounded face
remains invalid under the source contract.

R7 creates no candidate-only no-holes rule. Holes and multiple bounded faces
are accepted or rejected solely by the same source topology/Room rules that
apply to every candidate and golden plan.

### 3.4. Room identity proposal

This is an R7 source-owner proposal that narrows automatic retention. Unchanged
derived Rooms outside topology scope remain verbatim. A changed affected Room
automatically preserves ID, name, height and surface assignments only when
there is a complete one-to-one lineage correspondence: exactly one old Room
maps to exactly one new derived Room and exactly that new Room maps back to
that old Room.

- a no-predecessor derived Room follows the canonical source new-Room route;
- split, merge or any ambiguous/non-one-to-one correspondence shows explicit
  preview and requires a user-selected source-defined outcome;
- no name/height/finish is silently distributed in these cases.

The source-owned predicate, preview and metadata outcomes remain SO-R7-02.
R7 does not invent an eight-field Room schema, a manual map or a private
matching algorithm.

## 4. Usable geometry, formatting and performance

R7 preserves Geometry Contract §7.1:

- each usable line offsets an oriented centerline inward by half thickness;
- adjacent usable lines use miter;
- miter is limited to four half-units of the greater thickness;
- after cap, the source deterministic bevel applies.

Calculations may use exact transient arithmetic. They cannot save half-mm Q2,
a join policy object or a new miter reason in Project/History. Usable-polygon
rounding/collapse continues to use source reason USABLE_POLYGON_COLLAPSED.

The source performance budget, not an undocumented R7 max-edge/intersection
count, governs cancellation/responsiveness. Worker jobs remain bounded and
cancellable under AD-12 and Performance Budgets. Any actual limit must be
adopted by ProjectLimitsPolicy with actual/allowed witness and fixture evidence.

## 5. Source ChangeSet, patch replay and target uniqueness

### 5.1. No new R7 patch or transport schema

R7 defines no PatchV3, TypedContentRef, CB3, registry payload or arbitrary
content field. Durable command/inverse remain source ChangeSet/History records.
Before implementation, the source owner must publish one versioned
CanonicalPatchApplier contract for any ChangeSet representation requiring
replay.

### 5.2. Required CanonicalPatchApplier behaviour

Its only input is:

~~~
(projectSchemaVersion, base canonical Project record collection,
 source ChangeSet or inverse representation)
~~~

For every mutable source collection, target uniqueness is:

~~~
(entity-kind ordinal, source canonical record key)
~~~

For Vertex, WallSegment, Opening, Room, AssetInstance and AssetDefinitionRef,
the record key is the opaque string ID. For a source collection without an ID,
such as a surface assignment, the source contract must publish its stable
canonical address key first. R7 never derives an address from bytes, object
identity or renderer order.

The adopted applier must:

1. impose source canonical target-key order and reject a duplicate target in
   one ChangeSet;
2. allow only Add, Replace and Remove on a named source record;
3. require Add to find absence, Replace to find a canonical record exactly
   equal to its declared before-record, and Remove to find that before-record;
4. use the source canonical serializer for equality/checksum, not runtime
   object comparison;
5. rebuild derived facts and validate full Project/Plan/Room/Opening/host/
   resource invariants before Durable publication.

The post-state inventory is the disjoint union of retained, once-replaced and
once-created records. A duplicate target or unequal before-record fails source
validation rather than invoking best-effort merge. The rule applies to inverse
replay too and protects undo/redo without an inline History bundle.

## 6. Hosts, finishes, openings and Walk

### 6.1. Post-host inventory proposal

For each topology command, PreflightDiscovery constructs transient HostOrigin:

~~~
HostOrigin =
  ["existing-wall-host", source asset-or-assignment key, source SurfaceAddress]
  | ["existing-ceiling-host", source assetInstanceId, source roomId]
  | ["existing-floor-host", source assetInstanceId, source levelId]
  | ["new-placement", source command intent key]
  | ["orphan-preview", source asset-or-assignment key, source host reason]
~~~

For a durable candidate, each post placement/assignment has exactly one
origin/action, and every non-preview origin has exactly one durable
post-resolution. The union is disjoint and covers the affected inventory.
orphan-preview is UI only and cannot become silently floating durable state.

Automatic transfer is allowed only for a legal exact same-root lineage. A
deleted host, cross-root host or ambiguous host enters an explicit
rehost/delete/orphan preview and needs a confirmed source-defined outcome.
This is an R7 source-owner proposal, not a new durable host schema. It keeps
the baseline promise of preserve/rehost/orphan-preview while forbidding silent
cross-root transfer.

### 6.2. Wall sides and ceiling-to-wall transition

Wall-side addresses remain WallSegmentId plus AdjacentRoomId or ExteriorSide.
A valid available exterior side may receive wall placement or finish. R7 bans
neither two available exterior sides nor source-authorized exterior placement.

A ceiling-to-wall transition has one explicit route:

~~~
["existing-ceiling-host", assetInstanceId, oldRoomId]
  -> ["wall-placement", newWallSegmentId, adjacentRoomId or exteriorSide,
      offsetMm, elevationMm, normalOffsetMm, orientation]
~~~

The forward source ChangeSet contains complete post WallPlacement; its inverse
contains complete pre CeilingPlacement. The same origin/target rule applies to
all floor/wall/ceiling transitions.

### 6.3. Opening and derived Door semantics

Opening remains the source record:

~~~
Opening { id, kind: Door | Window, wallSegmentId,
          offsetMm, widthMm, heightMm, sillMm }
~~~

After topology and Room reconciliation, source OpeningFitPolicy validates the
host/interval. The exact relocation/resizing/deletion policy for changed walls
still requires source-owner adoption. R7 adds neither OpeningHost patch field
nor a Door enum.

A valid Door on a final WallSegment bordering exactly two resolved Rooms derives
one WalkEdge. Window, exterior Door, invalid Door or a Door without exactly
two resolved Rooms derives no WalkEdge and no transition. If the Opening record
cannot be valid, reject the whole candidate with existing source reason; no
WalkEdge is not permission to retain an invalid durable Opening.

## 7. Resource admission, History and recovery

### 7.1. Admission without a resource ordering cycle

Resource admission runs on the complete detached candidate before
PendingDurability:

1. determine exactly referenced resources from candidate source Project records;
2. verify AssetUsageGrant and pin exact bytes in user-owned blob store for each
   new reference;
3. build/check source resource manifest and BackupFeasibilityPolicy;
4. check SessionRetentionPolicy over current, undo and redo roots;
5. only then admit the complete ChangeSet to durability.

This uses current canonical Project/resource manifests only. It cannot place a
temporary preflight object, policy or content reference in History. Browse
cache alone never satisfies pinning.

### 7.2. Roots and recovery

History retains only its source fields. Revision manifests and blob store retain
exact resource roots for current, recovery, trash, staging, custom definitions
and both active undo/redo branches. No exact validation math, worker payload,
policy digest, inline resource bytes or transition bundle is replayed from
History.

Current-resource missing/corrupt remains read-only ResourceRecoveryRequired
until verified exact-byte repair or one complete atomic RecoveryChangeSet.
If only History is corrupt while current Project is healthy, the only
non-repair route is explicit DiscardSessionHistory. It is not a Project
Revision and cannot run automatically.

## 8. Writer fence and durable publication

Writer fencing belongs to repository writerLeases metadata, not Project JSON,
HistoryEntry, ChangeSet or Portable Backup. The authoritative lease contains
the source project identity, context identity, fencing token and expiry; exact
adapter storage remains source-owned.

For every mutating command, RevisionCoordinator must:

1. check lease/token before detached validation;
2. bind validation snapshot to observed fence and base Revision;
3. recheck the token immediately before staging;
4. make staging checksum verification and atomic current-pointer swap
   conditional on current token and base Revision.

A lost/mismatched token returns PROJECT_WRITE_LOCK_LOST. It cannot publish a
candidate, change Durable Revision, replace redo roots or write HistoryEntry.
A post-validation persistence failure likewise leaves prior Durable/History
current. The candidate is only retry/recovery-export material; next mutation
remains fenced. Web Locks may optimize but cannot replace persisted lease/fence
correctness.

## 9. Required future fixture corpus

The following are evidence requirements, not a claim that runnable tests
already exist. Each future fixture names adopted source version, canonical
input Project/Command, expected outcome/state and exact durable post-state.
Rational/Q2 fixture values stay inside the evaluator and never become a
Project/History format.

| Fixture family | Minimum cases |
| --- | --- |
| Selection eligibility | C1/C2 point on each closed-square boundary; remote finite/non-integer C2 ignored; C3 exact inverse endpoint; C4 fallback; numeric off-grid bypass |
| Selection outcomes | malformed/fractional/unsafe, zero, forbidden direction, bounds and ProjectLimits actual/allowed; DraftCommand versus Rejected |
| Discovery/all contacts | endpoint/Vertex, T, X, multiple contacts, grouping, whole-candidate reject without partial mutation |
| Allocation/lineage | existing start-child ID, fresh other children, real created root, forward/inverse target uniqueness |
| Planar embedding | repeated exterior articulation accepted; bounded self-intersection rejected; holes/multiple faces use ordinary rules |
| Usable geometry | miter below cap, bevel after cap, collapse reason, no durable exact intermediate |
| Rooms | complete one-to-one automatic preservation; new Room; split/merge preview and explicit choice |
| Metrics | wall tuple, usable/asset target tuple, stale revision/checksum discard, one formatter seam in Preview/2D/3D/export |
| Patch replay | duplicate target, unequal before-record, Add/Replace/Remove conditions, forward/inverse checksum and derived validation |
| Hosts | legal same-root retain, cross-root/deleted/ambiguous preview, exterior sides, ceiling-to-wall full inverse, disjoint inventory |
| Openings/Walk | changed-wall source policy, valid interior Door one WalkEdge, exterior/invalid Door no edge/no new state |
| Resources/History | pin/backup/history limit rejects, redo roots, current/history-only corruption, repair and RecoveryChangeSet |
| Writer/durability | fence loss before validation, before stage, at pointer swap; persist failure; no durable/history change |
| Performance | source-budget cancellation/stale worker discard; no undocumented D-022 cap |

The canonical test owner converts these into domain, integration and Playwright
evidence only after readiness authorization. R7 creates no test file and does
not assert a green suite.

## 10. Source-owner reconciliation register

Each row must become a canonical update, source version/hash and corpus. R7 is
not final authority for any row.

| ID | Owner | Required adopted content | Why R7 cannot decide alone |
| --- | --- | --- | --- |
| SO-R7-01 | Geometry Contract + UX | screen tolerance, equal-tie, hysteresis, T/X continuity, C3/C4 interaction and visible DraftCommand | interaction/product policy remains deferred |
| SO-R7-02 | Geometry Contract + domain model | complete one-to-one Room lineage predicate, split/merge preview and metadata disposition | FR-15 needs documented matching |
| SO-R7-03 | Geometry Contract + domain model + UX | Opening-after-wall edit policy and diagnostics | FR-19 blocks silent host/offset change |
| SO-R7-04 | Geometry Contract + PRD + UX | usable rounding boundary and MeasurementFormatPolicy precision/locale | R7 preserves miter/bevel but cannot invent display policy |
| SO-R7-05 | SPEC Project/Backup + domain/application | versioned ChangeSet/inverse replay grammar, collection/address keys, CanonicalPatchApplier | prevents R7 private patch/content schema |
| SO-R7-06 | domain/application + IdPort | allocation comparator and root/child materialization corpus | discovery must precede allocation without raw-ID encoding |
| SO-R7-07 | ProjectLimitsPolicy + performance budgets | hard limits, cancellation model, measurements and actual/allowed witnesses | private R7 cap would change product semantics |
| SO-R7-08 | ProjectRepositoryPort + UX | lease/takeover/persist-failure UX and token predicate evidence | writer correctness is adapter-bound and user-visible |

Until every applicable row is adopted, implementation readiness remains
NOT_READY. This is neither waiver nor R6 fallback.

## 11. Disposition of frozen R6 review findings

This table records closure direction, not reviewer acceptance.

| Finding | R7 disposition |
| --- | --- |
| R6-EXACT-01 remote C2 eligibility | §2.3 closed HitSquare predicate; remote contact ignored |
| R6-EXACT-02 selection reason/state conflict | §1 and §2 use source reason/DraftCommand only |
| R6-EXACT-03 reservation before discovery | §3.1 allocation intent after discovery |
| R6-EXACT-04 missing root lineage | §3.2 existing/created root plus inverse |
| R6-EXACT-05 CB3 grammar | §§0 and 5 remove CB3 from durable path |
| R6-EXACT-06 open typed refs | §§0 and 5 retain source records only |
| R6-EXACT-07 articulation exterior | §3.3 accepts repeated exterior traversal |
| R6-EXACT-08 miter divergence | §4 retains source miter then bevel |
| R6-EXACT-09 wall metric target | §2.4 wall-centerline tuple |
| R6-EXACT-10 stale metric | §2.4 revision/checksum fence |
| R6-EXACT-11 formatter incomplete | §2.4 and SO-R7-04 source owner |
| R6-EXACT-12 changed Rooms | §3.4 complete one-to-one only |
| R6-EXACT-13 fixture claim | §9 future evidence only |
| R6-SOURCE-01 bounds code drift | §1 uses PROJECT_BOUNDS_EXCEEDED |
| R6-SOURCE-02 count/private code | §1 and SO-R7-07 source limit witness |
| R6-SOURCE-03 candidate state drift | §1 DraftCommand versus Rejected |
| R6-SOURCE-04 C3 lost | §2.3 retains exact C3 |
| R6-SOURCE-05 bevel lost | §4 retains bevel |
| R6-SOURCE-06 auto room retain lost | §3.4 preserves only complete one-to-one |
| R6-SOURCE-07 cross-root reject-only | §6 explicit preview route |
| R6-SOURCE-08 exterior-side ban | §6.2 retains exterior sides |
| R6-SOURCE-09 invented Door state | §6.3 source WalkEdge only |
| R6-SOURCE-10 raw ID encoding | §§0, 2, 5 string IdPort |
| R6-SOURCE-11 invented ChangeWallThickness | R7 adds no command; FR-10 owner action |
| R6-SOURCE-12 invented Room schema | §3.4 source Room fields only |
| R6-SOURCE-13 inline History bundle | §§0, 5, 7 source History/manifests |
| R6-SOURCE-14 no-holes rule | §3.3 rejects candidate-only ban |
| R6-SOURCE-15 formatter drift | §2.4 source ownership |
| R6-SOURCE-16 private performance cap | §4 and SO-R7-07 source evidence |
| R6-TOPO-01 typed/schema registry | §§0, 5 remove registry |
| R6-TOPO-02 wire gap | §§0, 5 remove CB3 wire |
| R6-TOPO-03 policy digest self-reference | §§0, 2, 7 no policy digest |
| R6-TOPO-04 resource ordering cycle | §7.1 detached candidate then admission |
| R6-TOPO-05 ID transport conflict | §§0, 2, 3, 5 string IDs |
| R6-TOPO-06 allocation form | §3.1 non-durable intent |
| R6-TOPO-07 new root lineage | §3.2 real created root |
| R6-TOPO-08 patch replay | §5.2 source applier preconditions |
| R6-TOPO-09 host inventory equality | §6.1 disjoint coverage |
| R6-TOPO-10 ceiling-to-wall | §6.2 explicit origin/inverse |
| R6-TOPO-11 Opening inverse/invalid route | §6.3 canonical Opening and Walk rules |
| R6-TOPO-12 resource/history roots | §7.2 manifests/blob roots |
| R6-TOPO-13 persisted BigInt/Q2 | §§0, 2, 4 ephemeral only |
| R6-TOPO-14 writer fence | §8 all three checks/atomic predicate |
| R6-REG-01 CB3 value grammar | §§0 and 5 remove CB3 |
| R6-REG-02 content-ref registry | §§0 and 5 source schemas only |
| R6-REG-03 session grammar | §§2.2 and 2.4 fixed transient tuples |
| R6-OUT-01 outcome crosswalk absent | §1 owner/phase/witness/durability/UX |
| R6-OUT-02 durability/history edge outcomes | §§1, 7 and 8 |

## 12. Readiness statement

R7 resolves replacement direction: exact geometry is ephemeral; canonical
Project/ChangeSet/History/manifest/fence records are sole durable state; source
baselines are preserved; remaining choices have named owners.

It does not establish a completed geometry policy, adopted corpus, canonical
patch grammar, owner reconciliation or implementation authorization. D-022
therefore remains NOT_READY until §10 and the independent readiness gate pass.

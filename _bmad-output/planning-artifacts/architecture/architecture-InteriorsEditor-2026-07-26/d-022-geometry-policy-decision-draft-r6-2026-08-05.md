---
title: "InteriorsEditor — D-022: closed exact-geometry transition policy, revision 6"
date: 2026-08-05
revision: 6
status: draft
noncanonical: true
canonical: false
architecture_spine_changed: false
memlog_changed: false
implementation_ready: false
readiness: NOT_READY
scope: "Pre-canonical total policy input for detached exact geometry, reversible topology transition and source-owner reconciliation"
predecessor:
  artifact: d-022-geometry-policy-decision-draft-r5-2026-08-05.md
  revision: 5
  sha256: c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c
  disposition: frozen-rejected-external-review-evidence-do-not-edit
frozen_r5_review_evidence:
  reviews/review-d022-r5-exact-geometry-external-2026-08-05.md:
    sha256: 8aaf5051890cd7d3296a5317efe000fbb3238165a60b6da5e2bfddf99b7aa000
    verdict: REJECT_FOR_PRECANONICAL_INPUT
  reviews/review-current-source-d022-r5-external-2026-08-05.md:
    sha256: 3b61a3547ff25a3c86ba56cb436727f880b3379215c00f11682aaa59ef743ec6
    verdict: REJECT_FOR_PRECANONICAL_INPUT
  reviews/review-d022-r5-topology-data-integrity-external-2026-08-05.md:
    sha256: 0265bb7cbefb2c1c5867058cf6f0b90bf304dffe9117591f9fa6f45cd9e07b1c
    verdict: REJECT_FOR_PRECANONICAL_INPUT
advisory_inputs:
  reviews/d022-r6-transition-bundle-targets-2026-08-05.md:
    sha256: 267078829d1f5f6874fc17937ffb67b932e7e218c75172613a829be9cc6cf7d1
    authority: advisory-only
  reviews/d022-r6-limits-hosts-source-targets-2026-08-05.md:
    sha256: dbca1d02da2e219c04e4b530343c11b2dbe6b6ae54af9bde022a11b61856e218
    authority: advisory-only
  reviews/d022-r6-baseline-completeness-targets-2026-08-05.md:
    sha256: 623f554f6f6b7ccf17d43e91bdb9c482562a44ef0bf8e3f49c4871a7ab0dcdca
    authority: advisory-only
sources:
  - ARCHITECTURE-SPINE.md
  - domain-model.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../specs/spec-interiors-editor-alpha/performance-budgets.md
  - ../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
proposed_architecture_route:
  - "Fresh independent review of this exact R6 SHA"
  - "Explicit source-owner decisions for every row in §9"
  - "Executable byte/fixture corpus in §10, self-check in §11, and device/performance evidence owned by current sources"
  - "Only then a new official readiness assessment; this file authorizes no implementation"
---

# D-022 — closed working policy package, revision 6

## 0. Status, boundary, and deliberate safe choices

R6 is a new, standalone, non-canonical successor. It preserves R5 and all
three R5 external reports byte-for-byte as frozen evidence named above. It
changes no AD, SPEC, PRD, UX, memlog, source code, configuration, test,
durable Project, readiness result, or waiver. G-READY remains NOT READY.

R6 makes the following deliberately conservative choices. A source owner may
adopt, alter, or reject them, but an implementation may not fill a missing
branch with a library default.

1. Canonical Project state remains integer-mm Project JSON. CanonicalBytesV3
   below is a detached preflight and session-history envelope; it is not an
   alias for project/project.json and does not change Portable Backup.
2. Every topology-created Vertex and WallSegment ID is supplied in
   an immutable command reservation before topology normalization. R6 never
   allocates a topology identity after the context exists.
3. Every other new identity, including Opening, candidate Revision, new Room,
   and Create-to-Ceiling AssetInstance identity, is allocated once in the
   declared AllocationPlan before the impact envelope is hashed.
4. Cross-root wall rehost has no automatic or explicit acceptance route in R6.
   A user can choose an explicit deletion with inverse; a cross-root target
   receives the named draft reject in §1.
5. R6 removes R5's imported-hole read-only compatibility proposal. It only
   rejects a newly constructed topology candidate at the no-holes gate. It
   does not alter existing/imported Project open, writer, History, export, or
   recovery behavior.
6. R6 removes the unowned floor/ceiling strict-containment rule. Floor,
   ceiling, and collision behavior stay with their current product owners.
7. R6 introduces no independent numerical product limits. Every count bound
   is derived from the current versioned ProjectLimitsPolicy, and every
   implementation-only loop bound is an input-derived termination proof, never
   a user-visible rejection cap.

The policy is intentionally stricter about unprovable transfer: reject or
require a complete explicit record. It never invents an offset, Room value,
surface, resource, policy, identity, or inverse.

### 0.1 Non-adoption rule

Terms labelled "R6 proposed" are draft identifiers, not current stable source
codes. Until §9 is reconciled, a production validator must use no R6-only
reason or state. A rejected detached candidate creates no PendingDurability,
Revision, History entry, autosave, canonical projection publication, writer
takeover, or Project JSON mutation.

### 0.2 Exact values

ExactRationalMm and RationalV2 use positive denominators, gcd reduction, and
one zero form. Q2 is (a + b times sqrt(2)) / d with d positive,
gcd(abs(a), abs(b), d) = 1, and zero exactly (0, 0, 1). All Q2 operations
normalize before a value is placed in a CB3 record. BigInt and Q2 are detached
arithmetic only and never become a Project JSON number.

## 1. Outcome, state, and owner-facing semantics

The first failed phase in this order wins: source lexical and ProjectLimits
validation; detached CB3 decoding; selection; exact contact normalization;
face/ring gate; usable geometry; Room/host/ceiling reconciliation; allocation;
complete transition bundle; durable publication. Within a phase, the exact
order in the corresponding clause wins.

| R6 proposed diagnostic or state | Phase and outcome | Durable / History effect | Import / export effect | Required current owner |
| --- | --- | --- | --- | --- |
| D022_R6_CANONICAL_BYTES_INVALID | CB3 or typed source-ref decode fails | Rejected; no History | Never changes Project import parser or backup result | Geometry Contract §10-11, Project/Backup Contract, UX errors |
| D022_R6_TOPOLOGY_ID_RESERVATION_INVALID | reservation missing, stale, duplicate, used, or inconsistent with effect | Rejected before context | None | Domain Model command/ID model, AD-3/AD-7 |
| D022_R6_SELECTION_SNAPSHOT_INVALID | presentation value, transform, scale, or exact conversion is invalid | Session selection stops; no topology candidate | None | Geometry Contract selection, PRD FR-7/8, UX candidate/error flow |
| D022_R6_ACTIVE_ORIGIN_STALE_OR_MISSING | fenced active origin is absent, stale, or not an allowed safe-mm origin | Session selection stops; no nearest fallback | None | Geometry Contract selection, UX |
| D022_R6_RAY_ROWS_ABOVE_PROJECT_LIMIT | only a corrupt/unvalidated input has more than 8 times current max walls | source-limit reject before R6 selection | Existing source validation owns imported input | ProjectLimitsPolicy, Geometry Contract §4, UX |
| D022_R6_NON_INTEGER_RAY_CONTACT or D022_R6_COLLINEAR_RAY_BLOCKER | C2 winning RayProbe blocker in §4.4 | Session selection stops; C3/C4 suppressed | None | Geometry Contract selection, UX |
| D022_R6_C4_DELTA_BELOW_MINIMUM or D022_R6_C4_OUT_OF_PROJECT_BOUNDS | C4 threshold or sole endpoint fails §4.4 | Session selection stops; no retry/fallback | None | Geometry Contract selection, ProjectLimitsPolicy, UX |
| D022_R6_FACE_ORBIT_INVALID | dart successor, signed orbit, strict witness, or SideTable proof in §§5.1-5.3 is incomplete/non-simple | Rejected before Room mapping | Existing/imported Projects are unaffected by R6 | Geometry Contract planar faces, AD-7, UX topology preview |
| D022_R6_NESTED_RING, D022_R6_HAS_INNER_RING, D022_R6_TOUCHING_RINGS | new candidate fails §5.3 | Rejected; no state transition | Existing/imported Projects are unaffected by R6 | Geometry Contract §§3,7, PRD FR-14, UX topology preview |
| D022_R6_ROOT_ATOM_INVALID | non-integral virtual point, noncontiguous ordinal, or incomplete atom expansion | Rejected before Room mapping | No new import state | Geometry Contract §§6-7, AD-7 |
| D022_R6_Q2_COLLINEAR_THICKNESS_STEP, D022_R6_Q2_BACKTRACK, D022_R6_Q2_MITER_CAP_EXCEEDED, D022_R6_Q2_ZERO_EDGE, D022_R6_Q2_NON_POSITIVE_AREA, D022_R6_Q2_REPEATED_NONADJACENT_VERTEX, D022_R6_Q2_NONADJACENT_EDGE_OVERLAP, D022_R6_Q2_NONADJACENT_EDGE_CROSS, D022_R6_Q2_NONADJACENT_VERTEX_TOUCH, or D022_R6_Q2_ADJACENT_EXTRA_CONTACT | exact ordered usable-polygon failure in §§5.4-5.5 | Rejected; no state transition | No new import state | Geometry Contract §7, PRD, UX diagnostics |
| D022_R6_MEASUREMENT_SELECTION_UNRESOLVED | target bytes are stale, non-admitted, or not resolvable under §5.6 | Session measurement stops; no geometry mutation | None | Geometry Contract metrics, asset admission, UX |
| D022_R6_ROOM_SURVIVOR_MAP_INVALID, D022_R6_ROOM_SEED_REQUIRED, or D022_R6_ROOM_FIELD_RECONCILIATION_INVALID | changed-face map/seed/value/loss route in §5.7 is incomplete or invalid | Rejected before host/allocation | None | Geometry Contract Room identity, Domain Model, PRD FR-15/16, UX confirmation |
| D022_R6_CROSS_ROOT_REHOST_REJECTED | explicit target has a different root wall | Rejected; explicit delete remains possible | None | Geometry Contract §§3,9, PRD FR-19/35, UX confirmation |
| D022_R6_HOST_PROOF_INVALID, D022_R6_HOST_REBASE_UNSUPPORTED, D022_R6_PARTITION_ATTACHMENT_CROSSES_CHILD_BOUNDARY, D022_R6_MERGE_ATTACHMENT_MAP_INVALID, or D022_R6_TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED | host inventory, same-root action, opening, side, or address proof fails | Rejected; no partial asset/opening mutation | None | Geometry Contract §§3,8-9, Domain Model, UX |
| D022_R6_CEILING_TRANSITION_INVALID | no legal matrix row or incomplete forward/inverse record | Rejected; no partial asset mutation | None | Geometry Contract §9, PRD FR-28/29/35, UX |
| D022_R6_RESOURCE_ADMISSION_INVALID | exact pin, grant, notice, parser, or backup feasibility is incomplete | Rejected before PendingDurability | No new import alias | Project/Backup, asset import/grant/security, UX |
| D022_R6_TRANSITION_BUNDLE_INVALID | a root, patch, allocation, state fence, or replay check differs | Rejected before PendingDurability | None | Domain Model ChangeSet/History, AD-3/AD-4 |
| Project ResourceRecoveryRequired | a resource referenced by current durable Project bytes is missing/corrupt | Current Project read-only until exact repair or one atomic RecoveryChangeSet restores backup readiness | Existing Project/Backup recovery behavior | Project/Backup Contract, AD-3/AD-4, UX recovery |
| SessionHistory ResourceRecoveryRequired | retained transition content/policy/resource is missing or corrupt after publication | Existing history-only recovery: exact repair or explicit DiscardSessionHistory; current Project is not rewritten | Healthy current Project may still export; session History never enters backup | Project/Backup Contract §1/§6, PRD FR-38, UX recovery |

The R6 diagnostic names are a complete proposed mapping for this draft. Their
stable-code adoption, localized text, safe suggestions, persistence semantics,
and imported-data behavior are source-owner work in §8; no slash subtype is
left to an implementation.

A §4 selection diagnostic is a proposed session-only
CandidateUndetermined/NoDraftCommand result: no detached topology candidate,
PendingDurability, Revision, or HistoryEntry exists, so it is not a rejected
command. A source Plan-limit error remains its current source-owned
pre-DraftCommand result. Only a failure after a detached candidate has been
built in §§5-7 is an R6 proposed RejectedDetachedCandidate result. The
DraftCommand/preview vocabulary and its user-visible distinction from
rejection are explicit source-owner decisions in §8; this draft does not
replace the current command-state machine.

## 2. Limits derived from current ProjectLimitsPolicy

R6 uses the current hard limits, not R5's independent 64-edge, 4,096-pair,
1,200-record, 600-vertex, or 1,200-dart limits. The table is a calculation
proof, not a new ProductLimitsPolicy.

| Current hard source limit | R6 derived bound and rule |
| --- | --- |
| WallSegment = 300 | at most 600 darts; at most 300 current geometric edges on one bounded face; at most 600 root-side atoms across both physical sides of one state; RayProbe rows = 8 times wall count and therefore at most 2,400 |
| Room = 50 | at most 400 Room field classes when all eight classes are represented |
| Opening = 200 | at most 200 centerline Opening host records |
| AssetInstance = 250 | at most 250 WallPlacement records and at most 250 Ceiling-scope identities after candidate validation |
| Surface/material assignment = 400 | at most 400 WallFinish host records |
| Durable ChangeSet = 2 MiB | the existing source byte policy, checked only after the complete single R6 transition is constructed; R6 adds no record-count limit |
| Canonical Project JSON = 10 MiB | an already source-owned byte ceiling; R6 does not add a smaller Project, field, or footprint byte cap |

Thus the largest source-valid wall-host inventory is 200 + 250 + 400 = 850
rows and the largest Room field inventory is 50 times 8 = 400 rows. R6 never
rejects that inventory because of a count cap. It streams sorted records and
may fail only under the existing 2 MiB Durable ChangeSet policy, whose hard
reason must report actual and allowed bytes under its source owner.

For one complete source-to-target transition, the independently source-derived
preflight ledger is at most 400 Room-field rows, 850 wall-host rows, 600
source SideTable rows plus 600 target rows, and 250 pre plus 250 explicitly
declared post Ceiling-scope identities: 2,950 typed record references before
deduplication. This ledger is a proof that the source-valid inventory is
finite, not a max-transfer-records product limit or a new rejection reason.
Every array is streamed in its stated canonical order and only the source
2 MiB byte policy may reject a complete otherwise-valid transition for size.

For two whole Room boundaries, R6 enumerates at most 300 times 300 = 90,000
metric edge pairs in canonical streaming order; it never materializes a
4,096-pair list. Asset-footprint edges are streamed from the already admitted
AssetDefinition snapshot and receive no D022 edge cap. A missing or invalid
snapshot uses the source asset-admission path, not a new metric-cap path.

### 2.1 RayProbe equality and raw presentation values

Before probe allocation, source Plan validation requires wallCount less than
or equal to 300. R6 then calculates rowCount = 8 times wallCount. Equality
rowCount = 2,400 is valid and fully evaluated; rowCount > 2,400 is reachable
only from an input that already violates the source WallSegment hard limit and
returns D022_R6_RAY_ROWS_ABOVE_PROJECT_LIMIT before a probe row exists.

A finite browser binary64 is decoded exactly from its IEEE-754 fields. This
has a finite representation-derived numerator and denominator, not a R6
product cap. Non-finite or non-invertible presentation input follows the
source-owned invalid-dimension/gesture diagnostic route. No arbitrary 40-bit,
32-bit, or comparison-temporary limit remains in R6.

### 2.2 Finite formatter work without a rejection cap

For RootQ2 formatting, first derive a positive integer upper bracket H such
that H squared is strictly greater than q times the squared decimal scale.
H is the least power of two established by exact Q2 comparison. Binary search
over integer printed cells uses exactly bitLength(H) iterations at most; the
last equality comparison selects the even half-cell. DirectQ2 uses the same
half-cell comparison without square root.

The bound is recomputed from the finite accepted input and is a termination
proof, not a limit outcome: equality at bitLength(H) succeeds and a
bitLength(H)+1 iteration is impossible for the prescribed loop. There is no
GEOMETRY_EXACT_LIMIT/METRIC_FORMATTER result in R6. Formatter fixtures include
bracket-minus-one, bracket-equality, and an assertion that an extra iteration
is unreachable.

### 2.3 Cap ownership and deliberately unreachable private limits

The values 65 and 300 in the fixture corpus are representative and maximum
source-valid geometric boundary sizes, not an R6 minimum/maximum acceptance
policy. R6 owns only deterministic enumeration order and the arithmetic
termination proof. Wall, Room, Opening, AssetInstance, Surface assignment,
Project JSON, and Durable ChangeSet byte validation remain the named current
ProjectLimitsPolicy checks with their current source-owned reasons.

Consequently there is no R6 max candidate contacts, pair-list length, transfer
row count, boundary vertex count, BigInt width, Q2 magnitude, formatter
iteration count, asset-footprint edge count, or RayProbe count below
8 times active maxWallSegments. A current-valid Plan with 300 walls evaluates
all 2,400 RayProbe rows. A Plan with 301 walls must fail the source wall-limit
path before selection; D022_R6_RAY_ROWS_ABOVE_PROJECT_LIMIT is defensive
corrupt-input reporting, not a second cap. Any future lower device-performance
limit would require a source-owner ProductLimits/UX/performance-budget delta,
not a local implementation knob.

## 3. CanonicalBytesV3: closed values, opaque IDs, and digest roots

### 3.1 Wire grammar

Each CB3 root starts with bytes 49 45 43 42 33, the ASCII prefix IECB3, then
one Value. Unsigned lengths and IDs use minimal unsigned LEB128. A decoder
rejects truncated, overflowed, or overlong LEB128 before allocating a length.

| Tag | Value | Canonical rule |
| ---: | --- | --- |
| 00 | Null | Not legal in any R6 field; absence uses a union variant |
| 01 / 02 | false / true | Boolean |
| 03 | UInt | minimal big-endian magnitude; zero has byte length zero |
| 04 | SInt | sign 00 or 01, minimal magnitude; negative zero rejects |
| 05 | Bytes | exact declared length |
| 06 | Text | NFC UTF-8, exact declared byte length |
| 08 | Sha256 | exactly 32 raw bytes |
| 09 | Array | ordered elements; only a schema-declared order is legal |
| 0A | Record | typeId, field count, then strictly ascending fieldId/value pairs |
| 0B | Union | unionId, variantId, then exactly the registered Record type |
| 0C | Enum | enumId and memberId, both registered |
| 0D | Set | strictly increasing complete encoded Value bytes, no duplicate |

Digest(x) is SHA-256 over IECB3 followed by EncodeValue(x). A CB3 decoder
rejects an unknown type, field, union, enum, forbidden tag, duplicate field,
trailing byte, or noncanonical scalar.

Id is not UUID and is not presumed textual. OpaqueIdV1 is a closed record of
an IdPort domain enum and nonempty raw tokenBytes. IdPort validates the token
for that domain; R6 compares and sorts IDs by domain member ID, then unsigned
token bytes, and never parses a UUID, ULID, timestamp, NFC text, or array
index. If the current IdPort has only text transport, its source-owned adapter
must supply its exact raw token bytes. This is an explicit source delta in §9,
not a hidden replacement of the opaque-ID convention.

RationalV2 is one closed record: denominator is greater than zero,
gcd(abs(numerator), denominator) is one, and zero is exactly numerator zero
with denominator one. Any other RationalV2 byte form rejects as
D022_R6_CANONICAL_BYTES_INVALID before comparison, sort, partition, or
division.

### 3.2 Registered roots and acyclic content references

Type 4, TypedContentRefV2, carries role, schemaId, exact payload bytes, and
payloadDigest. Its digest is SHA-256(payload bytes), and schemaId identifies
one registered CB3 type or one named source canonical record grammar. Payload
bytes are decoded and validated before their digest is accepted. Bytes are
never an untyped semantic escape hatch.

The reference graph is a finite DAG. A payload cannot reference its own
TypedContentRefV2, its containing record, or a later root in this order:

1. source canonical records, semantic values, normalized footprints, policy;
2. topology reservation, intent, normalized effect, face/side/exterior roots;
3. host and ceiling inventories, fields, Room maps, and allocation;
4. source/candidate state fences and forward/inverse patches;
5. resource manifest, TransitionBundle, and HistoryEntry.

The validator topologically decodes this graph and rejects a cycle, duplicate
content address with unequal bytes, wrong type role, or unavailable retained
content as D022_R6_TRANSITION_BUNDLE_INVALID.

| Root or live digest field | Exact byte source and equation | Required sort / relation |
| --- | --- | --- |
| TypedContentRefV2.payloadDigest | SHA-256 of its declared payload bytes | payload type and schemaId must agree |
| SourceCanonicalRecordRefV2.sourceDigest | exact bytes accepted by the named versioned source serializer, SHA-256 equal to its typed leaf payload digest | role is ProjectState, EntityRecord, CommandPayload, FieldValue, AssetDefinitionSnapshot, or PolicyPayload |
| StateSnapshotRefV2.stateDigest | SHA-256 of the exact canonical project/project.json bytes for its named immutable Revision; candidate state is base plus PatchSetV4 replay | Revision ID, Project ID, schema version, and digest must agree |
| CommandIntentV3.intentDigest | Digest(CommandIntentV3), including immutable topology reservation | no map, allocation, Room choice, host target, or candidate Revision ID |
| PolicyArtifactV2.policyDigest | Digest(PolicyArtifactV2), including parser identity and typed policy payload | immutable for the whole bundle |
| NormalizedTopologyEffectV4.effectDigest | Digest(effect) over exact contacts, source/output WallSnapshotV3, root intervals, and reserved topology IDs | effect has no Context, map, allocation, or patch reference |
| ContextV4.contextDigest | Digest(context) over intent/effect/pre-state/inventory/policy roots only | no candidate ID, map, seed, host target, allocation, patch, or history |
| FaceKeyV4.faceDigest | Digest(FaceKeyV4) over its least-rotated expanded point/atom arrays | byte-identical faces only may use automatic Room retention |
| RoomFaceInventoryV2.inventoryDigest | Digest(inventory) over its fenced state and sorted Room/Face rows | pre inventory enters ContextV4 before identity resolution |
| FaceLineageRelationV3.relationDigest and RoomSurvivorMapV4.mapDigest | Digest(each separately encoded typed record) | map points to relation/context; neither record has its own digest field |
| NormalizedFootprintV2.footprintDigest | Digest(NormalizedFootprintV2) | CCW vertices, anchor basis, and yaw policy in canonical order |
| ExteriorOrbitV2.orbitDigest | Digest(ExteriorOrbitV2) | ordered darts and root atoms in traversal order |
| SideTableV2.tableDigest | Digest(SideTableV2) | rows sorted by wall opaque ID bytes then Left/Right |
| HostKeyV2.keyDigest | Digest(HostKeyV2), which excludes WallHostRecordV3 and all key digests | keys sort host inventory and all target/inverse arrays |
| HostInventoryV4.inventoryDigest | Digest(HostInventoryV4) | records strictly sorted by HostKeyV2 bytes |
| FieldProjectionV3.projectionDigest | Digest(FieldProjectionV3), which contains values but no disposition/loss back-reference | slots sorted by complete target key |
| FieldDispositionV3.dispositionDigest and RoomLossAcknowledgementV4.lossDigest | Digest(each separately encoded typed record) | forward/inverse projection refs point downward and never back to this digest |
| AllocationPlanV4.allocationDigest | Digest(AllocationPlanV4) | entries sorted by purpose bytes |
| PatchSetV4.patchSetDigest | Digest(PatchSetV4) | patches sorted by entity kind then opaque entity ID bytes |
| CeilingTransitionV3.transitionDigest and WallHostResolutionV3.resolutionDigest | Digest(each separately encoded typed record) | source/target/inverse are complete typed records, not untyped digest labels |
| TransitionResourceManifestV2.manifestDigest | Digest(manifest) | resource refs sorted by content hash then semantic slot |
| BundleMaterialTableV1.tableDigest | Digest(table) over its sorted leaf rows | a row is byte-identical to exactly one TypedContentRefV2 payload; no row may name the table, bundle, or HistoryEntry |
| TransitionBundleV2.bundleDigest | Digest(bundle) over context, allocation, inline material table, both patches, policy, resources, and fences | one closed bundle only |
| HistoryEntryV3.entryDigest | Digest(entry) over label, command, inline bundle bytes/digest, and directional fences | HistoryEntry is not a bundle material row and bundle never points upward |

Pinned resource content hashes retain their existing source rule: SHA-256 of
the exact AssetBlobStore bytes. The resource manifest names those hashes,
grant/notice/backup evidence, and the existing local blob-store availability
requirement; it does not copy a 50 MiB blob into a CB3 patch.

BundleMaterialTableV1 is an inline, bundle-local material table, not an
ambient content-addressed store. Its rows are sorted by (role member ID,
schemaId UTF-8 bytes, payloadDigest) and carry the exact leaf payload bytes.
Every TypedContentRefV2 reachable from ContextV4, allocation, reconciliation,
patch, policy, or manifest must resolve to one and only one byte-equal row.
The table contains neither a TypedContentRef to itself nor a payload encoding
TransitionBundleV2 or HistoryEntryV3. Therefore all content needed to replay
either patch direction is in the single immutable bundle, while the bundle
digest remains a finite acyclic root.

StateSnapshotRefV2 is a typed fence rather than an ambient content lookup. For
a DurableRevision it verifies the named immutable Revision's exact canonical
project/project.json bytes against stateDigest. For a DetachedCandidateDerived
state, the containing TransitionBundleV2 validator verifies its declared base
fence plus the bundle's forward PatchSetV4 replay against the candidate digest;
StateSnapshotRefV2 itself does not point back to that patch. It contains no
reference to a future HistoryEntry, and a candidate Revision ID is already
bound by AllocationPlanV4 before this fence enters TransitionBundleV2.

### 3.3 Compact registry

This table gives every live transition form a closed type. In a record row,
semicolon-separated fields are field IDs 1 through N in the displayed order;
all are required unless a discriminator makes a different variant apply.
Union variants appear in variant-ID order. Braces mean CB3 Set sorted by
complete bytes; brackets mean an Array with the stated order.

| Type or union | Closed purpose and required fields |
| --- | --- |
| 1 RationalV2 | numerator SInt; denominator UInt with the normal form in §3.1 |
| 2 AbsentSlotV1 | no fields |
| 3 PresentSlotV1 | one TypedContentRefV2 entity record |
| union 1 RecordSlotV1 | AbsentSlotV1 or PresentSlotV1 |
| 4 TypedContentRefV2 | role enum; schemaId Text; payloadBytes; payloadDigest |
| 5 WallExteriorAddressV1 | wallSegmentId opaque Id; Exterior marker enum |
| 6 OpaqueIdV1 | IdDomain enum; nonempty tokenBytes |
| 7 Q2V2 | a SInt; b SInt; d UInt in §0.2 normal form |
| 8 NormalizedFootprintV2 | assetDefinitionId; AssetDefinition snapshot ref; CCW Q2 vertices; anchor; yaw policy |
| 9 CommandIntentV3 | commandId; projectId; base Revision state ref; kind; source payload ref; TopologyIdReservationV1 |
| 10 TopologyIdReservationV1 | commandId; sorted TopologyReservationSlotKind to unused opaque ID bindings |
| 11 NormalizedTopologyEffectV4 | intent ref; source/output vertices and walls with reserved IDs; exact contacts; root intervals |
| 12 FaceKeyV4 | canonical CCW expanded BoundaryPointV2 array and FaceAtomOccurrenceV3 array |
| 13 FaceAtomOccurrenceV3 | one-based ordinal; current wall; root wall; root/current intervals; side; parity |
| 14 ExteriorOrbitV2 | exterior class; ordered dart/root-atom sequence; source effect ref |
| 15 SideTableV2 | current effect ref and exactly two SideTableRowV2 rows per wall |
| 16 HostKeyV2 | host kind; host opaque ID; current wall; typed surface/address discriminator |
| 17 OpeningHostV2 | HostKey; OpeningPayloadV2; centerline span; complete source and target OpeningSideProofV2 sets |
| 18 WallPlacementHostV2 | HostKey; AssetInstance source record; WallSurfaceAddressV2; span; source and target SideProofV3 |
| 19 WallFinishHostV2 | HostKey; WallSide surface address; SemanticValueRefV2; source and target SideProofV3 |
| union 2 WallHostRecordV3 | OpeningHostV2, WallPlacementHostV2, or WallFinishHostV2 |
| 20 HostInventoryV4 | phase Pre or Post; sorted WallHostRecordV3 set |
| union 3 SurfaceAddressV3 | Floor(RoomId), Ceiling(RoomId), WallSideRoom(WallId, RoomId), WallSideExterior(WallId, Exterior marker) |
| 21 FloorSurfaceV1 | roomId |
| 22 CeilingSurfaceV1 | roomId |
| 23 WallRoomAddressV1 | wallSegmentId; adjacentRoomId |
| 24 SemanticValueRefV2 | field class; value schema; typed source FieldValue record ref; value digest |
| 25 FieldProjectionV3 | Room ID; field class; face ref; sorted slots with complete SemanticValueRefV2 |
| 26 FieldDispositionV3 | source projection ref; complete post projection ref; action; exact inverse projection ref |
| 27 RoomLossAcknowledgementV4 | source Room/class; forward and inverse FieldProjectionV3 refs; every explicit target value |
| 28 NewRoomSeedV4 | successor FaceKey ref; allocated Room ID; typed values for every field; explicit height; resources |
| 29 AllocationPlanV4 | base Revision; candidate Revision allocation; sorted non-topology allocation entries (including new Opening, Room, and AssetInstance); output identity set |
| 30 AllocationEntryV2 | purpose bytes; kind; allocated opaque ID |
| 31 PlacementSnapshotV2 | AssetInstance; full discriminated Floor/Wall/Ceiling/Absent placement source record ref |
| 32 CeilingTransitionV3 | asset; pre and post PlacementSnapshotV2; matrix action; allocation ref when Create; exact inverse |
| 33 PatchV3 | entity kind/id; before RecordSlotV1; after RecordSlotV1; source record schema |
| 34 PatchSetV4 | from StateSnapshotRefV2; to StateSnapshotRefV2; sorted PatchV3 set |
| 35 ContextV4 | intent/effect/pre-state/pre-host/pre-side/pre-RoomFace inventory roots and immutable policy ref; no allocation/map/target |
| 36 PolicyArtifactV2 | policy ID/version; parser ID; typed policy payload ref; policy digest |
| 37 TransitionResourceManifestV2 | sorted pinned resource/grant/notice/backup references |
| 38 BundleMaterialTableV1 | sorted unique leaf material rows: role; schemaId; payload bytes; payload digest; no bundle/history/self row |
| 39 TransitionBundleV2 | ContextV4; AllocationPlanV4; inline BundleMaterialTableV1; pre/post fences; full forward/inverse PatchSetV4; policy; resources; all reconciliation records |
| 40 HistoryEntryV3 | label; command identity; inline immutable TransitionBundleV2 bytes; bundle digest; directional Revision fences |
| 41 StateSnapshotRefV2 | Project ID; Revision ID or Candidate Revision ID; schema version; StateSourceKind; state digest; DurableRevision canonical-state locator only when the discriminator is DurableRevision |
| 42 RoomFaceInventoryV2 | base or candidate state fence; sorted (Room ID, FaceKey ref) rows; pre-identity SideTableV2 ref |
| 43 FaceLineageRelationV3 | predecessor Room/Face; successor Face; ContextV4 ref; transition; complete sorted atomic correspondences |
| union 4 RootOccurrenceCorrespondenceV3 | RetainedRootAtomV2, RemovedRootAtomV2, or CreatedRootAtomV2 |
| 44 RoomSurvivorMapV4 | predecessor Room/Face; successor Face; FaceLineageRelationV3 ref; ContextV4 ref |
| 45 WallHostResolutionV3 | source HostKey/ref; WallHostAction; complete sorted target WallHostRecordV3 array; complete sorted inverse source array; pre/post inventory refs; explicit acknowledgement when required |
| 46 SideProofV3 | source SideTableV2 ref; target SideTableV2 ref; source parity; target parity; source SideTargetKind/ref; target SideTargetKind/ref; source occurrence-or-exterior root; target occurrence-or-exterior root; source base root ID; target base root ID |
| 47 OpeningSideProofV2 | physical side; SideTableV2 ref; source-or-target discriminator; orientation parity; SideTargetKind/ref; occurrence-or-exterior root; Room ID/FaceKey/height only for Room |
| 48 OpeningPayloadV2 | OpeningKind; offsetMm; widthMm; heightMm; sillMm; derived DoorAdjacencyKind/pair when applicable |
| 49 WallSnapshotV3 | wall opaque ID; canonical endpoints; thickness; base root wall ID; root interval; physical orientation |
| 50 RootIntervalV2 | base root wall ID; exact RationalV2 start/end; physical side; descendant wall ID/parity |
| 51 ResourceAdmissionV3 | semantic slot; pinned content hash; media type; AssetUsageGrant ref; notice ref; BackupFeasibility result |
| union 5 BoundaryPointV2 | VertexBoundaryPointV1 or VirtualBoundaryPointV2 |
| 52 VertexBoundaryPointV1 | xMm; zMm; persisted Vertex opaque ID |
| 53 VirtualBoundaryPointV2 | xMm; zMm; base root wall ID; exact root RationalV2; no persisted Vertex ID |
| 54 SideTableRowV2 | current wall ID; PhysicalSide; FaceKeyV4 ref or ExteriorOrbitV2 ref |
| union 6 WallSurfaceAddressV2 | WallSideRoomV2 or WallSideExteriorV2 only |
| 55 WallSideRoomV2 | wall ID; adjacent Room ID |
| 56 WallSideExteriorV2 | wall ID; Exterior marker |
| 57 RetainedRootAtomV2 | base root wall ID; PhysicalSide; atom start/end; old one-based ordinal; new one-based ordinal |
| 58 RemovedRootAtomV2 | base root wall ID; PhysicalSide; atom start/end; old one-based ordinal |
| 59 CreatedRootAtomV2 | base root wall ID; PhysicalSide; atom start/end; new one-based ordinal |
| 60 MeasurementFormatPolicyV4 | quantity; unit; fraction digits; RootQ2-or-DirectQ2 input discriminator; exact unit scale; half-even algorithm ID |
| 61 SourceCanonicalRecordRefV2 | SourceRecordRole; source serializer ID; source schema ID; TypedContentRefV2 leaf ref; sourceDigest equal to leaf payloadDigest |

Targets and inverseSources are Arrays only because their order is fixed:
sort by WallHostRecordV3 discriminator, then HostKeyV2 full bytes, then complete
record bytes. Every other unordered collection is a Set. Face boundaries rotate
to the least complete expanded atom/point sequence, not to a Room ID or hash.

CameraDeltaV3, FaceRunV2, OverlapWitnessV1, and the metric target/format result
are detached session-calculation values, not CB3 TransitionBundle roots. Their
complete field order and arithmetic are fixed respectively in §§4.3-4.4,
§§5.4-5.6.1; none may be smuggled into a bundle as an untyped Bytes payload.
If a future source wants to persist one, it must allocate a new registered
record/union and source-owner route rather than reuse this local notation.

### 3.3a Closed enum registry

| enum ID | Enum and members in member-ID order |
| ---: | --- |
| 1 | SourceRecordRole: 1 ProjectState, 2 CommandPayload, 3 EntityRecord, 4 FieldValue, 5 AssetDefinitionSnapshot, 6 PolicyPayload |
| 2 | IdDomain: 1 Project, 2 Revision, 3 Command, 4 Vertex, 5 Room, 6 WallSegment, 7 Opening, 8 AssetInstance, 9 SurfaceAssignment, 10 AssetDefinition, 11 Level |
| 3 | TopologyIntentKind: 1 AddWallSegment, 2 MoveVertex, 3 MoveWallSegment, 4 DeleteWallSegment, 5 SplitWallSegment, 6 MergeCollinearSegments, 7 AddOpening, 8 MoveOpening, 9 ResizeOpening, 10 DeleteOpening, 11 SetRoomProperties, 12 ChangeWallThickness |
| 4 | ExteriorMarker: 1 Exterior |
| 5 | PhysicalSide: 1 Left, 2 Right |
| 6 | OrientationParity: 1 SameAsRoot, 2 ReversedFromRoot |
| 7 | HostKind: 1 Opening, 2 WallPlacement, 3 WallFinish |
| 8 | PlacementKind: 1 Absent, 2 Floor, 3 Wall, 4 Ceiling |
| 9 | FieldClass: 1 IdentityAndFace, 2 CoreName, 3 CoreType, 4 CoreMetadata, 5 RoomHeight, 6 FloorAssignment, 7 CeilingAssignment, 8 WallSideAssignmentSet |
| 10 | FieldAction: 1 Retain, 2 SetExplicitTarget, 3 RemoveAcknowledged |
| 11 | EntityKind: 1 Vertex, 2 WallSegment, 3 Room, 4 Opening, 5 AssetInstance, 6 SurfaceAssignment, 7 AssetDefinitionRef, 8 Level |
| 12 | RootKind: 1 Intent, 2 Policy, 3 Footprint, 4 FaceKey, 5 ExteriorOrbit, 6 SideTable, 7 HostKey, 8 HostInventory, 9 FieldProjection, 10 Allocation, 11 PatchSet, 12 ResourceManifest, 13 TransitionBundle |
| 13 | CeilingAction: 1 CreateCeiling, 2 MoveToCeiling, 3 KeepCeiling, 4 MoveCeiling, 5 MoveFromCeilingToFloor, 6 MoveFromCeilingToWall, 7 DeleteCeiling |
| 14 | StateSourceKind: 1 DurableRevision, 2 DetachedCandidateDerived |
| 15 | TopologyReservationSlotKind: 1 Vertex, 2 WallSegment |
| 16 | OpeningKind: 1 Door, 2 Window |
| 17 | DoorAdjacencyKind: 1 RoomPair, 2 NoWalkEdgeWindow, 3 NoWalkEdgeExterior |
| 18 | FaceTransitionKind: 1 AddBoundarySegment, 2 MoveWithinSameBoundary, 3 DeleteBoundarySegment, 4 SplitBoundarySegment, 5 MergeBoundarySegments, 6 ThicknessOnly |
| 19 | OccurrenceRelationKind: 1 Retained, 2 Removed, 3 Created |
| 20 | TargetSlotKind: 1 RemovedNoSuccessor, 2 RoomField, 3 Floor, 4 Ceiling, 5 WallSide, 6 NewSeed |
| 21 | LossDisposition: 1 Removed, 2 Transferred, 3 ClonedExplicitly, 4 ReplacedExplicitly |
| 22 | InventoryPhase: 1 Pre, 2 Post |
| 23 | SideTargetKind: 1 Room, 2 Exterior |
| 24 | WallHostAction: 1 KeepExact, 2 TransferContainedChild, 3 CloneFullSide, 4 CoalesceEqualFullSide, 5 MoveExplicit, 6 DeleteExplicit |

No enum has an implicit other member. A field whose semantic discriminator is
not in this table is CB3-invalid rather than an implementation extension.

### 3.4 Byte conformance vectors

All SHA-256 values below were calculated over every shown byte. Spaces are
presentation only.

| Vector | Full bytes | SHA-256 |
| --- | --- | --- |
| CB3-UINT-2 | 49 45 43 42 33 03 01 02 | a95a724960ee38721d6d51e9d6382cee6d9ba7f18f7eea863ef33b6aa29f9a97 |
| CB3-SINT-N1 | 49 45 43 42 33 04 01 01 01 | 1e1c0675c5ed315718801b9ba65f0b7a6714c2d6dae4ef82fa67f15e013d26ee |
| CB3-EMPTY-SET | 49 45 43 42 33 0D 00 | 43a496faee3f269a099042ebc1226b170cad5d06997dfedd37508761ca22c40a |
| CB3-RATIONAL-ZERO | 49 45 43 42 33 0A 01 02 01 04 00 00 02 03 01 01 | bfd25aaf35436f10c4504432f93834f773bd9a38305a661cca7296a87e89d09c |
| CB3-OPAQUE-ID-R1 | 49 45 43 42 33 0A 06 02 01 0C 02 05 02 05 02 72 31 | 6ef521749d6747549dd5fecc1b1c89b18b16b8722ecbf254312504c7de598db8 |
| CB3-PATCH-ABSENT | 49 45 43 42 33 0B 01 01 0A 02 00 | a4a99870b4fb313b3badc9eaf3defa1af5697ef6a7553e725bc39807310618ee |
| CB3-SURFACE-WALL-EXTERIOR | 49 45 43 42 33 0B 02 04 0A 05 02 01 0A 06 02 01 0C 02 06 02 05 06 77 61 6C 6C 2D 31 02 0C 04 01 | b62dc3612a771174402206996f3e320962fae9537a0c72006531608ea6a207d4 |
| CB3-PATCH-PRESENT | 49 45 43 42 33 0B 01 02 0A 03 01 01 0A 04 04 01 0C 01 03 02 06 06 74 65 73 74 2F 31 03 05 01 AA 04 08 BC EE F6 55 B5 A0 34 91 1F 1C 37 18 CE 05 65 31 B4 5E F0 3B 4C 7B 1F 15 62 9E 86 72 94 01 1A 7D | b41bd43ac21a3c7b9cc75588848f099a37304b4c88dfd3876ad27eb4cb3f870a |

The nested present vector contains a TypedContentRefV2 whose payload is one
byte AA and whose inner SHA-256 is
bceef655b5a034911f1c3718ce056531b45ef03b4c7b1f15629e867294011a7d.
Negative corpus entries must reject RationalV2 1/0, 0/2, and 2/4; a payload
digest mismatch; an out-of-order target array; and a content-reference cycle.

## 4. One identity model and noncircular transition order

### 4.1 Immutable topology reservation

TopologyIdReservationV1 is part of the command before any candidate is built.
It has one binding for every newly created output Vertex and WallSegment that
the normalized command may need. A binding contains command ID, slot kind,
ordinal, opaque reserved ID, and source base Revision ID. Slots are sorted by
kind then ordinal; IDs must be unused in the base state and unique within the
reservation. Existing topology entities retain their base opaque IDs and need
no reservation. Opening is a semantic centerline host, not a planar-topology
identity: a newly created Opening has an explicit non-topology
AllocationEntryV2 only after ContextV4 is complete.

No binding can be added, removed, or replaced after CommandIntentV3 is hashed.
NormalizedTopologyEffectV4 names every new output Vertex and Wall by that
reservation and every retained entity by its base ID. FaceKeyV4, side table,
host records, and patches must name the same IDs. An extra allocation entry
for a topology identity, a new effect ID not in the reservation, a reserved ID
used as a retained base ID, or a reservation ID absent from the effect rejects
D022_R6_TOPOLOGY_ID_RESERVATION_INVALID.

### 4.2 Fixed phase order

~~~text
immutable Command + topology ID reservation + base Revision
  -> exact contact normalization and NormalizedTopologyEffectV4
  -> expanded FaceKeyV4, SideTableV2, pre inventories, ContextV4
  -> explicit Room maps/seeds/values/host/ceiling decisions
  -> one AllocationPlanV4 including candidate Revision ID
  -> full PatchSetV4 forward and inverse plus resource manifest
  -> one TransitionBundleV2 digest
  -> PendingDurability, source staging/checksum/pointer publication
  -> Durable Revision and one HistoryEntryV3
~~~

ContextV4 contains no candidate Revision ID, Room allocation, Asset allocation,
field value chosen after context, target host, ceiling action, patch, or
history object. AllocationPlanV4 contains the candidate Revision purpose
"candidate-revision/<command-id>/<base-revision-id>" and validates it before
TransitionBundleV2 is hashed. This gives preflight a fixed candidate Revision
identity without creating the R5 reservation/allocation cycle.

An AllocationPlanV4 entry names only stable semantic purpose bytes and entity
kind; it never points to the digest of a final seed, host, ceiling, or patch
record. The selected source payload first supplies the user choice and purpose,
then the plan binds its opaque ID, then the final typed record must use that
same ID and explain it in the output identity set. Thus a new Room, Opening,
or Create-to-Ceiling AssetInstance can be fully serializable after allocation
without entering ContextV4 or forming an allocation-to-record digest cycle.

### 4.3 Exact presentation ingress and C1 through C4 selection

R6 carries the full detached selection policy; it does not inherit it from R5.
The selection canvas must have computedCanvasTransform equal to none and the
default transform origin. Raw values are read in this fixed field order:

~~~text
clientX, clientY, canvasRect.left, canvasRect.top,
rawPanXCss, rawPanYCss, rawScaleCssPerMm
~~~

Let U = 1/256 CSS pixel, Z = 2^16, and H_U = 5,632, the closed 22 CSS-pixel
hit half-width in U units. Every finite binary64 input is losslessly decoded
to an exact rational, negative zero becomes positive zero, and all
roundHalfToEven operations are exact rational operations:

~~~text
relativeXU      = roundHalfToEven((clientX - rect.left) / U)
relativeYU      = roundHalfToEven((clientY - rect.top) / U)
panXU           = roundHalfToEven(rawPanXCss / U)
panYU           = roundHalfToEven(rawPanYCss / U)
scaleNumerator  = roundHalfToEven(rawScaleCssPerMm * 256 * Z)

pointerXUZ = (relativeXU - panXU) * Z
pointerYUZ = (relativeYU - panYU) * Z
~~~

scaleNumerator has CSS-U times Z per millimetre units and must be positive.
The only accepted CSS transform is IdentityOnly. An invalid finite conversion,
nonpositive rounded scale, unsupported transform, or source-owned input
dimension failure returns D022_R6_SELECTION_SNAPSHOT_INVALID before candidate
enumeration; it never uses browser hit testing or a renderer transform.

For immutable active origin P = (originXmm, originZmm):

~~~text
CameraDeltaV3 {
  dxNumerator = pointerXUZ - originXmm * scaleNumerator
  dzNumerator = -pointerYUZ - originZmm * scaleNumerator
  denominator = scaleNumerator
}
~~~

An active origin must be an existing Vertex of the fenced base Revision or an
explicit safe-integer numeric origin of the current gesture. A missing/stale
origin returns D022_R6_ACTIVE_ORIGIN_STALE_OR_MISSING and never falls back to a
nearest Vertex. For exact world witness W = (xNum/d, zNum/d), d positive:

~~~text
sx = xNum * scaleNumerator - d * pointerXUZ
sy = -zNum * scaleNumerator - d * pointerYUZ
screenDistanceSquared(W) = (sx^2 + sy^2) / (d * Z)^2
insideHitSquare(W) iff abs(sx) <= d * Z * H_U
                    and abs(sy) <= d * Z * H_U
~~~

At one CSS pixel per millimetre, zero pan and origin (0,0), a pointer 100 CSS
pixels right has relativeXU 25,600 and inverse x delta exactly 100 millimetres.
Device pixel ratio, page zoom, DOM order and renderer state cannot change this.

Candidate class order is C1, C2 RayProbe, C3, C4. A nonempty earlier class
returns before a later one is considered. C3 has an empty generator set in
Alpha. C1 enumerates every canonical Vertex inside the closed hit square and
chooses the unique least complete key:

~~~text
(classOrdinal=1,
 screenDistanceNumerator=sx^2+sy^2,
 worldXmm, worldZmm,
 opaqueVertexIdBytes)
~~~

All C1 denominators are Z squared. C2 rows use the following complete
ascending key; the separate metric key is defined in §5.6:

~~~text
(classOrdinal=2,
 squaredDistanceNumerator, squaredDistanceDenominator,
 blockerKindOrdinal,
 canonicalWitnessPointOrIntervalBytes,
 fixedDirectionOrdinal,
 canonicalWallSourceKeyBytes)
~~~

Fractions compare by exact cross multiplication. No hash-map, insertion,
canvas, DOM, or source collection order is observable.

### 4.4 Bounded exact RayProbe and C4

RayProbe directions are fixed clockwise:

~~~text
D0=(0,1), D1=(1,1), D2=(1,0), D3=(1,-1),
D4=(0,-1), D5=(-1,-1), D6=(-1,0), D7=(-1,1)
~~~

Let S be all WallSegments sorted by canonical endpoint pair and opaque ID
bytes. §2 proves exactly 8 times |S| rows and allows equality at 2,400.
For ray P + lambda d and segment R to T:

~~~text
D       = cross(d, T-R)
Nlambda = cross(R-P, T-R)
Nmu     = cross(R-P, d)
~~~

If D is nonzero, normalize lambda=Nlambda/D and mu=Nmu/D; finite positive
contact requires lambda positive and 0 <= mu <= 1. An integral coordinate is a
candidate; a nonintegral coordinate is D022_R6_NON_INTEGER_RAY_CONTACT. If D is zero, select the
fixed nonzero component of d and derive the exact segment lambda interval. A
parallel noncollinear or disjoint interval is NoProbe; singleton lambda
positive is the same finite contact; lambda zero belongs only to C1; a
positive collinear interval is D022_R6_COLLINEAR_RAY_BLOCKER when its closest
exact point is in the closed hit square:

~~~text
closest = clamp((dxNumerator*d.x + dzNumerator*d.z) /
                (denominator * norm2(d)), interval)
~~~

Group rows by canonical point or interval bytes. Equal-distance blocker order
is encoded as blockerKindOrdinal:
NonIntegerContactBlocker=0, CollinearOverlapBlocker=1, IntegralContact=2.
For a finite contact, canonicalWitnessPointOrIntervalBytes is its normalized
Q2 point; for a collinear blocker it is the ordered closed lambda interval
followed by its exact closest point. Each equal-witness group retains the
least (direction ordinal, canonical wall source key) row as evidence. Its
screen distance is calculated only at the singleton/contact or closest point
with the sole §4.3 screen equation. The least full C2 key wins. A winning
blocker returns the proposed draft diagnostic named above and suppresses
C2/C3/C4. A winning IntegralContact returns that one exact integer-mm C2
selection endpoint and also suppresses C3/C4; C1 still preempts all RayProbe
rows.

For C4 let q=CameraDeltaV3.denominator and:

~~~text
mNumerator = max(abs(dxNumerator), abs(dzNumerator))
~~~

The first C4 operation is mNumerator < 50*q. If true, return the named
below-minimum D022_R6_C4_DELTA_BELOW_MINIMUM result without ranking a
direction. Otherwise rank only
directions with n_d = dxNumerator*d.x + dzNumerator*d.z positive by
n_d squared / norm2(d), cross-multiplying positive denominators and breaking
ties by the fixed direction ordinal.

Let unit=100*q, a=floor(mNumerator/unit), r=mNumerator mod unit,
lower=max(1,a), upper=a+1. Select k=lower when 2*r is less than or equal to
unit and k=upper when 2*r is greater than unit. Thus an exact half chooses the
lower positive integer. The sole C4 endpoint is P + 100*k*chosenDirection.
It either passes ordinary ProjectLimits or returns the source-owned
D022_R6_C4_OUT_OF_PROJECT_BOUNDS result. There is no retry with smaller k,
alternate direction, hysteresis, or approximate screen fallback.

## 5. Planar faces, usable Q2, and metrics

### 5.1 Deterministic dart traversal and side table

Traversal starts only after the source Plan has passed exact contact
normalization: no zero segment, duplicate, positive collinear overlap, or
unsplit contact may enter it. For every WallSegment, choose canonical physical
orientation from the lexicographically least tuple
(xMm, zMm, opaqueVertexIdBytes) to the greater tuple. Make Forward and Reverse
darts, each with tail, head, wall ID, physical direction, and parity.

At every Vertex, sort outgoing darts in the fixed CCW C8 order
E, NE, N, NW, W, SW, S, SE, then by head coordinate and wall opaque ID bytes.
Two non-twin darts with the same direction are an invalid collinear Plan
condition; the final fields only make malformed-input reporting deterministic.
The successor of dart d is the clockwise predecessor of twin(d) in the
outgoing list at head(d); at degree one it is twin(d). This visits the face to
the left of d. Every dart receives exactly one successor before any orbit is
walked; a missing successor or a repeated different dart before return is
D022_R6_FACE_ORBIT_INVALID.

Walk all unvisited darts in ascending canonical dart bytes. Preserve each
physical dart orbit for side evidence. For a bridge-bearing orbit only, remove
the lexicographically least adjacent pair (d,twin(d)) that makes a bridge,
repeat until none remains, and retain the original physical orbit separately.
An empty or fewer-than-three reduced orbit is ExteriorBridgeOrOpenTail, not a
bounded face. For every remaining orbit compute exact integer signed
twice-area. A positive simple orbit is a left-bounded outer-ring candidate; a
negative simple orbit is an opposite-ring candidate. A zero-area orbit rejects
as D022_R6_FACE_ORBIT_INVALID. An orbit is simple exactly when it has at least
three distinct vertices, repeats no vertex except closure, and every
nonadjacent integer edge pair is disjoint. A non-simple positive orbit rejects;
a non-simple negative orbit is Exterior only when its unreduced form still
contains a bridge pair, otherwise it rejects with the same diagnostic.

For each current wall, SideTableV2 has exactly two rows:

~~~text
physical Left  = target left of Forward dart
physical Right = target left of Reverse dart
~~~

Rows are sorted by wall opaque ID bytes then Left/Right. A bounded valid face
initially names a FaceKeyV4 root only after §5.3 accepts its positive ring;
opposite, bridge, hole, and unbounded sides name an ExteriorOrbitV2 root.
Missing, duplicate, or wrong target rows reject
D022_R6_FACE_ORBIT_INVALID. After Room identity, only a proved
FaceKey-to-Room mapping replaces a bounded face target; physical left/right
remains validation evidence and never becomes the persistent semantic surface
address.

### 5.2 Expanded root atoms and one-based occurrence ordinals

Every directed current face edge is expanded before FaceKeyV4 construction.
Take its WallSnapshot current intervals, sort interval endpoints by exact
current local parameter, and split the directed edge at each root interval
endpoint. The result is one ordered FaceAtomOccurrenceV3 per root atom.

If an eliminated collinear join is not a current Vertex, insert its exact
integer-mm source-root endpoint as a VirtualBoundaryPointV2. It is a FaceKey
point only, never a persisted Vertex. A non-integral virtual point, interval
gap/overlap, zero atom, or atom outside the directed edge is
D022_R6_ROOT_ATOM_INVALID.

After CCW normalization and least cyclic atom/point rotation, the expanded
array has N atoms. Its boundaryOrdinal is exactly 1 through N in array order,
and atom i is the oriented edge from boundary point i to boundary point
(i mod N) + 1. Correspondence oldOrdinal/newOrdinal must name those indices;
zero, a gap, duplicate, or arbitrary positive label rejects. A merged current
segment spanning two roots therefore produces two atom occurrences and includes
the virtual join point where necessary.

### 5.3 Complete ring classifier

Every simple orbit retains its signed role from §5.1 and is additionally
normalized to a CCW cyclic coordinate/wall byte sequence for comparison. Two
rings are TwinBoundary only when those complete sequences are byte-equal after
one reversal; twins are two physical sides of one boundary and never form a
hole/contact pair.

For each simple ring, derive a strict interior witness without a geometry
library. Sort its distinct integer z values. For every consecutive pair,
scan at z=(zi+zi+1)/2; intersect nonhorizontal edges under the half-open rule
minZ <= z < maxZ, sort exact rational x intersections, and take the midpoint
of the first nonempty even/odd interior interval in ascending
(z, intervalOrdinal) order. A nonzero simple ring must yield that witness or
is D022_R6_FACE_ORBIT_INVALID.

For non-twin rings A and B, A strictly contains B only if every B vertex and
Witness(B) are strictly inside A under half-open winding and no B edge
contacts an A edge. A boundary contact is exact equal vertex, SinglePoint
touch, proper cross, or PositiveCollinearOverlap. A pair is a
NestedCandidate only when Witness(B) is strictly inside or on A's boundary.
This condition prevents two independently adjacent rooms sharing an ordinary
wall from being falsely labelled a touching/nested ring.

Process candidate pairs in ascending (outer canonical bytes, inner canonical
bytes, witness bytes) order:

1. a non-twin boundary contact in a NestedCandidate pair returns
   D022_R6_TOUCHING_RINGS with the least exact contact witness;
2. a positive outer strictly containing a different positive ring returns
   D022_R6_NESTED_RING with the least outer/inner pair;
3. otherwise, each negative opposite ring chooses its containing positive
   parent with least absolute twice-area, then least canonical bytes. A
   parentless negative belongs to Exterior;
4. a positive parent with any assigned negative child returns
   D022_R6_HAS_INNER_RING with the least parent/child pair. Independent
   depth-zero positive rings with no child become separate bounded faces.

The three-level outer, hole, island case reaches step 2 and deterministically
returns D022_R6_NESTED_RING. An accepted Alpha face is exactly one positive
simple outer without a negative child. R6 has no imported-hole state: this
gate rejects only a newly constructed detached candidate and does not change
open, writer, History, export, backup, recovery, or readability of existing
or imported Projects.

### 5.4 Full miter-only usable-polygon construction

For each accepted single CCW centerline ring, interior is to the left of every
directed edge. Each source occurrence supplies one positive integer
wallThicknessMm from the already validated source WallSegment record. Build a
cyclic FaceRunV2 before deriving any Q2 point:

1. consecutive equal C8 directed vectors with equal thickness collapse into
   one run, retaining their complete ordered source-occurrence array;
2. equal direction with different thickness is the first usable failure,
   D022_R6_Q2_COLLINEAR_THICKNESS_STEP;
3. an opposite C8 direction is the next failure, D022_R6_Q2_BACKTRACK;
4. after those checks, every adjacent pair has nonzero integer
   determinant and has exactly one miter join.

For a run A to B with permitted direction u=(ux,uz) and thickness t, its
inward offset vector is exactly:

~~~text
if ux*uz = 0:        o = t/2 * (-uz, ux)
if abs(ux)=abs(uz)=1:o = t*sqrt(2)/4 * (-uz, ux)
~~~

Both forms are normalized Q2 points. For preceding run A to B and following
run B to C, let p=A+oPrev, q=B+oNext, u=B-A, v=C-B and D=cross(u,v). The one
legal join is:

~~~text
lambda = cross(q-p, v) / D
miter  = p + lambda*u
~~~

D is nonzero by the preceding run checks. Accept that miter exactly when:

~~~text
distanceSquared(miter, B) <= (2 * max(tPrev, tNext))^2
~~~

Equality keeps the miter. Strict excess is
D022_R6_Q2_MITER_CAP_EXCEEDED. This is a geometry validity comparison, not an
additional ProjectLimits count or byte cap. There is no bevel, clipping,
epsilon, renderer approximation, or alternate join. The miter-only decision
is a proposed source delta recorded in §8. The current Geometry Contract's
miter-then-deterministic-bevel behavior remains current until its owner
explicitly reconciles it; this draft reject-only branch does not authorize a
production replacement.

All arithmetic is over normalized Q2. For x=(a+b*sqrt(2))/d, SignQ2(x) uses
sign(a) when b is zero, sign(b) when a is zero, their common sign when both
are nonzero with equal sign, and otherwise compares a squared with 2*b squared
and retains the sign of the larger magnitude term. Thus
orientation(P,Q,R)=cross(Q-P,R-P), dot products, shoelace area, and closed
coordinate comparisons have an exact finite sign without Number, a mesh
predicate, or a generic polygon library.

After the cyclic miter array is built, remove only adjacent byte-equal miter
vertices. The remaining ring must contain at least three edges and have
positive exact Q2 shoelace area. A Q2 point lies on a closed segment precisely
when orientation is zero and both coordinates are in their closed endpoint
ranges. For two segments, exact orientation signs and these closed-range tests
produce one of Disjoint, SinglePoint, or PositiveCollinearOverlap; in the
collinear case, project to the lexicographically first non-equal coordinate
and compare its exact closed intervals. Adjacent segments may share exactly
their designated cyclic join only. Every nonadjacent pair must be Disjoint.
These predicates, including the least ordered pair witness, are the complete
inputs to §5.5; no unlisted Q2 predicate is delegated to an implementation.

### 5.5 Ordered Q2 usable-polygon diagnostics

Q2_INVERSE_ZERO is removed: the only miter division has a nonzero determinant
after the ordered run checks, so no reachable predicate existed for that name.
The following sequence is complete. In each scan, the least cyclic run index
or least ordered pair is the witness.

1. equal direction with different thickness:
   D022_R6_Q2_COLLINEAR_THICKNESS_STEP;
2. opposite direction:
   D022_R6_Q2_BACKTRACK;
3. miter-cap excess:
   D022_R6_Q2_MITER_CAP_EXCEEDED;
4. adjacent duplicate or zero-length output edge:
   D022_R6_Q2_ZERO_EDGE;
5. nonpositive Q2 shoelace area:
   D022_R6_Q2_NON_POSITIVE_AREA;
6. nonadjacent endpoint equality:
   D022_R6_Q2_REPEATED_NONADJACENT_VERTEX;
7. nonadjacent positive collinear overlap:
   D022_R6_Q2_NONADJACENT_EDGE_OVERLAP;
8. nonadjacent proper crossing:
   D022_R6_Q2_NONADJACENT_EDGE_CROSS;
9. nonadjacent single-point contact:
   D022_R6_Q2_NONADJACENT_VERTEX_TOUCH;
10. an adjacent pair sharing anything other than its intended one endpoint:
    D022_R6_Q2_ADJACENT_EXTRA_CONTACT.

Each contact predicate is exact Q2 orientation and closed interval comparison.
The earlier numbered phase wins even if a later predicate is also true.

### 5.6 Metric target language and deterministic witness

Metric selection is session-only and uses this closed target language:

~~~text
PlanPoint =
    ExistingVertex { vertexId }
  | UsableVertex { roomId, faceKeyDigest, vertexOrdinal }
  | AssetFootprintVertex { assetInstanceId, footprintDigest, vertexOrdinal }
  | ExactNumericMm { xMm, zMm }

MetricBoundary =
    MetricEdge {
      source: WallCenterline | UsableBoundary | AssetFootprint,
      sourceId, faceOrFootprintDigest, edgeOrdinal
    }
  | MetricWholeBoundary {
      source: UsableBoundary | AssetFootprint,
      sourceId, faceOrFootprintDigest
    }
~~~

Every tag, source ID, digest, and one-based ordinal is part of the target
bytes. MetricEdge expands to exactly one oriented segment. MetricWholeBoundary
expands every segment of its named current ring in canonical edge-ordinal
order; it cannot name a wall because a wall centerline is already one segment.
A stale digest, missing ordinal, unavailable pinned AssetDefinition snapshot,
or a footprint that fails its source asset-admission rule returns
D022_R6_MEASUREMENT_SELECTION_UNRESOLVED before metric enumeration. There is
intentionally no MEASUREMENT_UNSUPPORTED diagnostic or implicit fallback to a bounding box,
mesh, renderer, or whole boundary.

For Plan and usable boundaries, the metric edge set is geometric: a current
source-valid Room boundary has at most 300 geometric edges. Root atoms are
lineage evidence only and never multiply metric geometry edges. Two whole
boundaries therefore enumerate at most 90,000 ordered candidate pairs under
the current 300-WallSegment source policy (§2). A footprint is read as a
finite source-admitted snapshot in canonical segment order and is streamed;
R6 imposes neither a 64-vertex nor any other private footprint cap.

Canonicalize each segment to its lexicographically least Q2 endpoint and sort
the two target keys before enumeration. For point/point, point/boundary, and
boundary/boundary pairs, enumerate only exact intersection or overlap,
endpoint-on-finite-segment, strict-interior orthogonal projection, and endpoint
pair candidates. All Q2 dot, cross, interval, and projection comparisons use
§5.4. A strict projection is eligible only when its parameter is strictly
between zero and one; endpoint projection is represented only by the endpoint
case.

For positive collinear overlap, choose the lexicographically least endpoint of
the closed common Q2 interval in the first sorted target's canonical
direction. OverlapWitnessV1 stores that single point and its exact parameter
on both segments. Reversing either source cannot change it. The unique least
metric result is selected by this complete ascending key:

~~~text
(squaredDistanceQ2,
 kindOrdinal: Zero=0, EndpointOn=1, InteriorProjection=2, EndpointPair=3,
 orderedFeatureRefs,
 orderedWitnessPoints,
 leftTargetCompleteKey,
 rightTargetCompleteKey)
~~~

Thus an interval never leaks into output bytes and selecting one edge can never
silently become selecting a whole ring.

#### 5.6.1 One exact formatter shared by preview, 2D, 3D, and export

MeasurementFormatPolicyV4 is a typed immutable PolicyArtifactV2 payload. It
accepts either RootQ2 { squaredMm2: q } for a distance sqrt(q), or
DirectQ2 { value, unitScale } for an already Q2 length, perimeter, or area.
The source-proposed display profile is Length/Perimeter in mm with two
fraction digits and Area in square metres with three; the selected profile,
quantity, unit, fraction digit count, and ASCII token are returned together.
Localisation may add labels but may not reformat or recompute this datum.

Let c be the exact decimal unit conversion: 1 for mm length/perimeter and
1/1,000,000 for square metres. At f fraction digits, printed integer n has
half-cell boundaries:

~~~text
L(n) = (2*n - 1) / (2*10^f)
U(n) = (2*n + 1) / (2*10^f)
~~~

For RootQ2, compare sqrt(q)*c to a nonnegative rational h=p/s by the exact
sign of q*c*c*s*s - p*p. For DirectQ2, compare value*c*s directly to p with
the Q2 sign rule in §5.4. A negative lower boundary is automatically below a
nonnegative distance. These direct comparisons decide every below, equality,
and above boundary. The unique printed cell uses the half-open intervals
(L(n), U(n)); at an exact shared half-cell, the even n wins.

The result's exactAtPrintedPrecision flag is true exactly when
q*c*c*(10^f)^2 equals n^2 for RootQ2, or value*c*(10^f) equals n for DirectQ2.
It is never an interval heuristic. A positive upper bracket H is the least
power of two with H squared strictly above the appropriately scaled exact
quantity; binary search uses at most bitLength(H) comparisons, then the direct
half-cell comparison decides the result. This is the finite
input-derived termination proof from §2.2, not a formatter cap: equality at
the bound succeeds, the next iteration is unreachable, and no
GEOMETRY_EXACT_LIMIT/METRIC_FORMATTER outcome exists in R6.

### 5.7 Changed-face lineage, Room identity, seeds, and loss

ContextV4 is built once after exact contact normalization, §5.1 traversal,
the no-holes gate, FaceKeyV4 construction, SideTableV2 construction, and
fenced pre-state inventory extraction, but before a Room map, new Room ID,
seed, field target, host target, resource, or candidate Revision ID exists.
Its RoomFaceInventoryV2 contains every base (Room ID, FaceKeyV4) pair and the
complete pre-identity SideTableV2 root. ContextV4 is the one common typed
context reference for every relation, survivor map, seed, disposition, host,
ceiling, allocation, patch, and bundle record.

For a proposed changed-face retention, FaceLineageRelationV3 is derived from
the old and new expanded FaceKeyV4 arrays; a submitted partial witness is never
authoritative. For each base-relative tuple (baseRootWallId, physicalSide),
collect every old and new root-interval endpoint, sort/deduplicate their exact
RationalV2 bytes, and partition adjacent endpoints into nonzero atomic root
intervals. The root wall ID in every old/new occurrence must resolve to that
same base root through NormalizedTopologyEffectV4; a current descendant is not
a different lineage root.

For each atom, derive its unique old and new owner occurrence. The only three
serializable correspondence variants are:

~~~text
Retained { baseRootWallId, physicalSide, atomStart, atomEnd,
           oldBoundaryOrdinal, newBoundaryOrdinal }
Removed  { baseRootWallId, physicalSide, atomStart, atomEnd,
           oldBoundaryOrdinal }
Created  { baseRootWallId, physicalSide, atomStart, atomEnd,
           newBoundaryOrdinal }
~~~

An atom with more than one old owner, more than one new owner, an uncovered
interval, zero length, mismatched physical side, unresolved base root, or an
occurrence outside its declared root interval invalidates the relation. The
complete supplied array must byte-equal the derived sorted array; it cannot
omit an inconvenient predecessor or successor portion. The union of its
atomic rows covers every old and every new expanded occurrence exactly once,
without a gap or overlap. Ordinals are the one-based values from §5.2:
Retained requires both, Removed only old, Created only new; zero and a
present-but-inapplicable ordinal are invalid.

FaceLineageRelationV3.transition is derived only from the normalized topology
intent:

| Normalized topology intent | Face lineage transition |
| --- | --- |
| AddWallSegment | AddBoundarySegment |
| MoveVertex or MoveWallSegment | MoveWithinSameBoundary |
| DeleteWallSegment | DeleteBoundarySegment |
| SplitWallSegment | SplitBoundarySegment |
| MergeCollinearSegments | MergeBoundarySegments |
| ChangeWallThickness | ThicknessOnly |
| Add/Move/Resize/DeleteOpening or SetRoomProperties | no changed-face relation; FaceKey must be unchanged |

There is no catch-all, score, area maximum, overlay, nearest Room, name match,
or renderer inference. A valid changed-face relation has at least one Retained
atom and proves only eligibility; it does not choose a survivor.

After that derivation, exactly one Room route applies to every successor face:

| Successor-face condition | Required route |
| --- | --- |
| Exactly one predecessor has byte-identical FaceKeyV4 digest | automatic retain of that Room ID; a survivor map is forbidden |
| Different digest and one valid confirmed RoomSurvivorMapV4 | retain the explicitly mapped predecessor Room ID |
| Different digest and no survivor-map entry | one declared complete NewRoomSeedV4 followed by one Room AllocationEntryV2; absence/incompleteness is D022_R6_ROOM_SEED_REQUIRED |
| A supplied map is stale, duplicate, unchanged-face, missing its relation/context, or differs from the complete derived relation | reject D022_R6_ROOM_SURVIVOR_MAP_INVALID |

RoomSurvivorMapV4 is sorted by successor FaceKey bytes then predecessor Room
opaque ID bytes. It is partial-injective in both dimensions: a predecessor
Room may map to at most one changed successor and a changed successor may
receive at most one predecessor. Map absence is intentional only on the
new-seed route; an invalid supplied map never silently becomes a seed. A
changed face can therefore never acquire an automatic Room ID.

NewRoomSeedV4 declares the successor FaceKey, then uses the AllocationPlanV4
Room entry with purpose new-room/<successor-face-key-bytes> to bind its Room
ID. The final seed has exactly one typed value for each of the eight
FieldClass members: IdentityAndFace (derived allocated ID and FaceKey),
CoreName, CoreType, CoreMetadata, RoomHeight, FloorAssignment,
CeilingAssignment, and WallSideAssignmentSet. RoomHeight is a complete
explicit integer-mm source value and remains the sole editable height source.
Every absent semantic value is an explicit typed unset source record; no
Level default, predecessor suggestion, renderer value, or UI placeholder may
fill a slot. Each referenced resource carries its exact pinned content,
grant, notice, and backup evidence.

For every base (Room ID, FieldClass) pair, reconciliation contains exactly one
FieldDispositionV3. Retain has byte-identical pre/post typed values; an
explicit target records every target slot and both forward/inverse values; a
destructive, clone, transfer, or replacement action has exactly one
RoomLossAcknowledgementV4 with a LossDisposition and complete forward/inverse
FieldProjectionV3. The union of target slot keys equals the candidate post
state for that source class. A missing, duplicate, stale, value-equal-but-
unrecorded, resource-incomplete, or inverse-incomplete class is
D022_R6_ROOM_FIELD_RECONCILIATION_INVALID. This field matrix applies before
height-dependent Opening and side-host validation.

## 6. Total topology host transfer

### 6.1 Closed surface and host discriminators

SurfaceAddressV3 is a union, never optional fields:

~~~text
Floor(roomId)
Ceiling(roomId)
WallSideRoom(wallSegmentId, adjacentRoomId)
WallSideExterior(wallSegmentId, Exterior)
~~~

FloorSurface and CeilingSurface contain only Room ID. Wall records contain only
their stated wall and room/exterior branch. Host record, side proof, semantic
value, and patched source entity must agree byte-for-byte on the same branch.

FloorPlacement is Level-hosted:

~~~text
FloorPlacement { levelId, xMm, zMm, elevationMm, yawStep }
~~~

It is explicitly unaffected by a topology-only R6 transition when Level ID is
unchanged. Its bytes are neither rehosted nor silently collision-reclassified;
its existing source placement and collision policy still applies. This is why
R6 has no floor-host inventory or strict-containment assertion.

### 6.2 Opening is a centerline host with both-side proof

OpeningHostV2 is distinct from side hosts:

~~~text
OpeningHostV2 {
  openingId, wallSegmentId,
  payload: { kind Door|Window, offsetMm, widthMm, heightMm, sillMm },
  centerlineSpan: [offset/sqrt(lengthSquared),
                   (offset+width)/sqrt(lengthSquared)],
  sourceSides: complete sorted set of one or two OpeningSideProofV2,
  targetSides: complete sorted set of one or two OpeningSideProofV2,
  inverseSource: complete OpeningHostV2 source record
}
~~~

An OpeningSideProofV2 names physical side, SideTableV2 root, source or target
orientation parity, Room or Exterior target, occurrence/exterior-orbit root,
and, for a Room, that Room ID, face, and height. A shared opening has exactly
two Room-side proofs and validates sillMm plus heightMm less than or equal to
both Room heights. An exterior side has no Room height. A Door carries the
derived adjacency proof: exactly one sorted pair of Room IDs only when both
sides are Rooms and all opening validation passes; otherwise the explicit
NoWalkEdge branch names Window, Exterior, or invalid opening. The adjacency is
derived, not persisted as a second editable state.

WallPlacementHostV2 is side-addressed and includes AssetInstance source
record, WallSurfaceAddressV2, exact Q2 tangent span, elevation, normal offset,
orientation, and separate source/target SideProofV3. WallFinishHostV2 is
side-addressed and contains the complete SemanticValueRefV2. Neither can be
mistaken for an Opening.

### 6.3 Source/target side proof and cross-root rule

SideProofV3 carries distinct source and target fields:

~~~text
sourceSideTableRef, targetSideTableRef,
sourceOrientationParity, targetOrientationParity,
source side target and occurrence-or-exterior root,
target side target and occurrence-or-exterior root,
source root wall ID, target root wall ID
~~~

An interior branch must carry the matching face occurrence root and forbids an
exterior-orbit root. An exterior branch does the reverse. Both table refs must
decode to the current pre/post SideTableV2 and contain exactly the named row.
Root-side equality is tested separately for source and target parity.

For an unchanged root, an explicit same-root move may proceed only with this
complete proof and a complete inverse. A target root different from source root
is D022_R6_CROSS_ROOT_REHOST_REJECTED even if the user selected it. The only
safe alternative in this draft is user-acknowledged DeleteExplicit with exact
inverse restore. This is an explicit source delta, not a silent change to the
current preview vocabulary. In particular, the current atomic
orphan/rehost-plus-preview flow remains current until the Geometry/Domain/PRD/
UX owners choose a reconciled route; R6's reject-only rule is neither a stable
code nor an implementation authorization.

#### 6.3.1 Complete same-root host inventory and actions

Before any host target is accepted, HostInventoryV4 Pre extracts exactly one
typed OpeningHostV2, WallPlacementHostV2, or WallFinishHostV2 record for every
fenced source wall host, sorted by discriminator then HostKeyV2 bytes. There
is exactly one WallHostResolutionV3 for each Pre record and no resolution for
any other key. Its sorted target records must byte-equal the complete
HostInventoryV4 Post set; a missing source record, duplicate resolution,
orphan target, omitted placement, mismatched inventory root, or extra target
is D022_R6_HOST_PROOF_INVALID.

The local basis is derived only from the canonical physical wall endpoints,
physical side, base-root interval, and orientation parity. Its root side is:

~~~text
rootSide = sourceSide when parity = SameAsRoot
         = opposite(sourceSide) when parity = ReversedFromRoot
~~~

The target proof must derive the same rootSide. A Room target carries Room ID,
FaceKeyV4 occurrence root, and physical side; an Exterior target carries only
the distinct ExteriorOrbitV2 root and physical side. A Room proof cannot carry
an exterior root and an Exterior proof cannot carry a Room ID/height. A wall
with both physical sides Exterior may exist, but a WallPlacement or WallFinish
on it is D022_R6_TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED rather than two values
collapsing into one exterior token.

The closed action table is:

| Action | Exact legal condition and replay payload |
| --- | --- |
| KeepExact | The source and target WallSnapshotV3 bytes and complete host bytes are identical except for an equal recomputed proof. It is the only automatic action. |
| MoveExplicit | Full user-chosen target WallHostRecordV3, source record, source/target proof, and inverse are present. It is required for a same-ID wall whose endpoint, canonical orientation, or thickness changed. No offset, elevation, normal offset, span, or orientation is inferred. |
| DeleteExplicit | User acknowledgement, complete source record, and exact inverse restore are present. |
| TransferContainedChild | Opening or WallPlacement only: exactly one same-root descendant interval [a,b] contains source root span [s,e], with a <= s < e <= b. Target local span is the normalized Q2 pair [(s-a)/(b-a), (e-a)/(b-a)]. Any crossing child boundary is D022_R6_PARTITION_ATTACHMENT_CROSSES_CHILD_BOUNDARY; rounding, a reverse/unknown basis, or a noncanonical result is D022_R6_HOST_REBASE_UNSUPPORTED. |
| CloneFullSide | WallFinish only: the target list is the complete proven child-side set covering the same root side, each target has byte-identical value/resource admission, and the inverse is one explicit collapse to the source record. |
| CoalesceEqualFullSide | The only automatic merge action: contiguous same-root, same-thickness, same-parity full sides have byte-identical values and resource admissions, and one inverse expands them. |

Every other Opening, WallPlacement, unequal WallFinish, singleton WallFinish,
or merge case requires MoveExplicit or DeleteExplicit; otherwise it is
D022_R6_HOST_REBASE_UNSUPPORTED or D022_R6_MERGE_ATTACHMENT_MAP_INVALID.
No proximity, current polygon order, Room name, renderer normal, nearest
descendant, or temporary geometry cache may establish a host target. Each
accepted action carries complete source and target lists plus the inverse
source list inside its WallHostResolutionV3 before allocation.

### 6.4 Ceiling transition matrix

Ceiling scope contains every AssetInstance whose pre placement is Ceiling or
whose explicitly declared post placement is Ceiling. Every scope identity has
one CeilingTransitionV3 with full pre/post PlacementSnapshotV2 bytes and an
inverse made by swapping those bytes.

| Pre kind | Post kind | R6 action |
| --- | --- | --- |
| Absent | Ceiling | CreateCeiling; allocate AssetInstance ID in AllocationPlanV4; full inverse Absent |
| Floor | Ceiling | MoveToCeiling; existing AssetInstance ID; full Floor inverse |
| Wall | Ceiling | MoveToCeiling; existing AssetInstance ID; full Wall inverse |
| Ceiling | Ceiling, identical bytes | KeepCeiling |
| Ceiling | Ceiling, changed room/coordinates/drop/yaw | MoveCeiling |
| Ceiling | Floor | MoveFromCeilingToFloor |
| Ceiling | Wall | MoveFromCeilingToWall |
| Ceiling | Absent | DeleteCeiling with user acknowledgement and full inverse |
| Any non-Ceiling to same/different non-Ceiling | no CeilingTransitionV3 row; ordinary source asset command owns it |
| Absent to Floor/Wall or Absent to Absent | no R6 ceiling row; a row is invalid |

The inventory, all rows, allocated Create identity, AssetInstance patches,
resource manifest, and candidate post AssetInstance set must agree exactly.
No placement digest alone is sufficient; PlacementSnapshotV2 has replayable
typed source bytes. Any missing, duplicate, extra, stale, directionally
incomplete, or matrix-incompatible row is D022_R6_CEILING_TRANSITION_INVALID.

## 7. Room values, patches, and one retained transition bundle

### 7.1 Complete values and loss acknowledgements

SemanticValueRefV2 is a typed source FieldValue record, not merely a digest.
Its class is exactly one of IdentityAndFace, CoreName, CoreType, CoreMetadata,
RoomHeight, FloorAssignment, CeilingAssignment, or WallSideAssignmentSet. It
contains full canonical value bytes, schema ID, digest, resources if any, and
the source decoder rule. No default, renderer value, Level value, or UI
placeholder can supply it.

FieldProjectionV3 contains sorted target slots and their complete values but
does not contain FieldDispositionV3 or RoomLossAcknowledgementV4. A
FieldDispositionV3 has complete before, after, and inverse projection refs.
RoomLossAcknowledgementV4 repeats the exact source class and references the
same complete forward/inverse target values. A split, clone, replacement, or
loss is invalid if any class, target slot, value bytes, resource binding, or
inverse value is absent, stale, duplicated, or mismatched.

### 7.2 Replayable PatchV3

PatchV3 uses a closed presence union:

~~~text
Add       = before Absent,  after Present(entity canonical record bytes)
Replace   = before Present, after Present
Remove    = before Present, after Absent
~~~

The Present record is a TypedContentRefV2 with replayable canonical source
entity bytes and type. Forward PatchSetV4 applies to the exact pre-state fence
and must produce the exact candidate-state digest. Inverse PatchSetV4 applies
to that candidate-state fence and must restore the exact pre-state digest.
Patch sorting is entity kind, then opaque entity ID bytes. Candidate discard
cannot lose replay material because every Present record required by either
direction is retained by the one TransitionBundleV2.

### 7.3 Session history storage and recovery boundary

TransitionBundleV2 is the single immutable session-history object:

~~~text
TransitionBundleV2 {
  context,
  allocation including candidate Revision ID,
  inline BundleMaterialTableV1 containing every reachable typed leaf payload,
  pre and candidate state fences,
  every Room/host/ceiling reconciliation record,
  full forward and inverse patch sets,
  immutable policy artifact and parser identity,
  complete resource/grant/notice/backup manifest
}
~~~

Every typed leaf reference in the fields above must resolve by exact
(role, schema, payloadDigest, payloadBytes) equality to its one material-table
row. No global content store, browse cache, new policy lookup, or later
catalog record participates in replay. HistoryEntryV3 retains the exact
immutable TransitionBundleV2 bytes inline with its verified bundleDigest; it
does not recompute a policy, host, allocation, Room identity, or payload on
undo/redo. The bundle has no reference to its containing HistoryEntry, so this
retention graph is finite.

An attempt may discard its detached candidate state after a complete bundle
has been built, but not the bundle material needed to apply its forward or
inverse patch while that attempt is under verification. After successful
publication, the HistoryEntry bundle, every manifest resource reference, and
all material rows are GC roots while reachable from undo or redo and count as
one closed retained unit for SessionRetentionPolicy. A new command may be
rejected by SessionRetentionPolicy; it may never silently trim an existing
undo or redo bundle. These history roots are not Project JSON and are not
Portable Backup members.

After durable publication, missing/corrupt bundle policy/content/resource is a
history-only resource issue under the existing ResourceRecoveryRequired flow.
Exact-byte repair makes the entry usable again. If current Project resources
are healthy, only explicit confirmed DiscardSessionHistory may remove both
branches; cancel leaves them intact. Neither GC nor a failed new command may
silently discard the bundle.

### 7.4 Resource admission, pinning, and backup feasibility

Every resource referenced by a NewRoomSeedV4, SemanticValueRefV2,
WallHostResolutionV3, PlacementSnapshotV2, or TransitionResourceManifestV2 has
exactly one ResourceAdmissionV3 row. Rows are sorted by pinned content hash
then semantic-slot bytes and contain the source canonical resource record,
the exact local AssetBlobStore SHA-256, media type/parser result,
human-approved AssetUsageGrant reference, required notice reference, and the
complete BackupFeasibilityPolicy result.

Admission is true only when the exact blob bytes are locally pinned, the hash
matches the source record, the parser/security policy accepted the resource,
the grant covers every required alpha use, every required notice is bound, and
BackupFeasibilityPolicy accepts the complete resource closure. A browse cache,
catalog lookup, URL, thumbnail, later transcoding result, or digest alone is
not a pin. Any absent, corrupt, ungranted, unnoticed, mismatched, or
backup-infeasible row makes the detached transition invalid before
PendingDurability; it cannot create a partial Project mutation, candidate
Revision, or HistoryEntry: the draft outcome is
D022_R6_RESOURCE_ADMISSION_INVALID.

For an alpha catalog resource, "every required alpha use" means the
human-approved AssetUsageGrant explicitly covers in-app render and thumbnails,
model and subresources, optimisation/transcoding, .interiors inclusion,
private 3D transfer, rendered PNG download/share, and every required notice
placement. A custom static GLB also needs the existing experimental
resource/security admission result. R6 does not infer any grant scope from a
catalog label or from a successful render.

The TransitionResourceManifestV2 set must be byte-equal to the union of every
resource admission required by all forward and inverse records. It retains the
existing blob-store roots and backup evidence but does not embed arbitrary
large blobs in CB3. Once a transition is durable, its bundle and manifest keep
those references reachable under the existing History/GC and exact-repair
rules in §7.3. This is a routing proposal to the current Project/Backup,
asset-import, catalog/grant, and security owners; R6 does not change their
admission policy or Portable Backup format.

### 7.5 ResourceIssue and recovery crosswalk

The following uses the existing ResourceRecoveryRequired/RecoveryChangeSet
grammar; it does not collapse preflight failure, current-Project integrity, and
history-only integrity into one R6 code:

| Condition | Required existing recovery boundary |
| --- | --- |
| A prospective resource fails §7.4 before publication | D022_R6_RESOURCE_ADMISSION_INVALID; no Project resource issue, detached candidate, PendingDurability, or HistoryEntry is created. |
| A resource referenced by the current durable Project is missing/corrupt | existing Project ResourceRecoveryRequired: the Project is read-only until exact repair or one complete atomic RecoveryChangeSet restores backup readiness. DiscardSessionHistory cannot repair it. |
| Only a retained HistoryEntry bundle/material/policy/resource is missing/corrupt while the current Project is healthy | existing session-history ResourceRecoveryRequired: exact-byte repair, or explicit confirmed DiscardSessionHistory; cancel preserves both history branches. |
| Both current Project and HistoryEntry references are unhealthy | current-Project recovery has precedence; history discard remains unavailable until the Project is healthy. |

An R6 transition never turns a current Project ResourceIssue into an imported
hole state, a new writer state, an automatic resource substitution, or a
silent history trim. Exact repair means exact bytes and matching typed digest;
RecoveryChangeSet is the one atomic source-owned route for current-Project
repair. This crosswalk is a source-delta reconciliation requirement in §8.

## 8. Source-delta reconciliation register

All rows below are explicit proposals. They do not claim adoption.

| R6 proposal | Source owners and required decision |
| --- | --- |
| CB3 grammar, opaque-ID text bytes, typed source record refs, state digest binding | Architecture ID/AD-3, Domain Model IDs/Command/ChangeSet, Geometry Contract §10, Project/Backup schema and backup owner |
| command-supplied topology ID reservation and one later non-topology allocation | Domain Model Command/ChangeSet, Architecture AD-3/AD-7, PRD topology flows |
| full CSS-U C1/C2/C3/C4 selection, exact camera ingress, RayProbe blockers, and CandidateUndetermined/NoDraftCommand versus RejectedDetachedCandidate mapping | Geometry Contract selection clauses, Domain Model command states, PRD FR-7/8/13, UX candidate/error flow, performance budgets |
| no independent D022 caps; derived stream bounds and source 2 MiB behavior | Project/Backup ProjectLimitsPolicy §1, PRD NFR-1 through NFR-4 and NFR-24, performance-budgets, Geometry Contract, UX error flow |
| candidate-only no-holes gate; no imported-hole read-only state | Geometry Contract §§3/7/10, PRD FR-14 and FR-45, NFR-1 through NFR-4/NFR-13, AD-4/AD-7, UX preview/import/export |
| miter-only Q2 order/reject and removal of Q2_INVERSE_ZERO, versus current miter-then-deterministic-bevel behavior | Geometry Contract §7, PRD geometry corpus, UX diagnostics; explicit owner choice required before canonical behavior changes |
| closed metric Edge/WholeBoundary target language, exact witness, and shared half-even formatter | Geometry Contract metric clauses, PRD FR-13, UX Preview/2D/3D/export, performance budgets, asset admission |
| explicit changed-face map/seed/value/loss and no automatic changed-face Room ID | Geometry Contract §7, Domain Model Room/ChangeSet, PRD FR-15/16, UX confirmation |
| Opening centerline two-side proof, split/merge atom expansion, same-root-only host transfer, and R6 cross-root reject versus current atomic orphan/rehost preview | Geometry Contract §§3/8/9, Domain Model Opening/placement, PRD FR-19/35-38, UX rehost/delete preview; explicit owner choice required |
| FloorPlacement Level-hosted invariant and removal of strict-containment claim | Geometry Contract §9, Domain Model placement, PRD FR-28/29/31, AD-8, UX collision policy |
| complete ceiling matrix and replayable placement data | Geometry Contract §9, Domain Model AssetInstance/ChangeSet, PRD FR-28/29/35, UX confirmation |
| exact local resource pin/grant/notice/backup admission rows and the preflight/current-Project/history-only ResourceRecoveryRequired crosswalk | Project/Backup resource/backup/recovery policy, asset-import and security policy, catalog AssetUsageGrant, PRD FR-28/38, UX recovery |
| one retained local TransitionBundle and history-only repair/discard mapping | Domain Model History, AD-3/AD-4, Project/Backup History/GC/recovery, PRD FR-38/NFR-13, UX recovery |
| every R6 diagnostic/state in §1 | Geometry Contract §11, Project/Backup stable errors, PRD NFR-24, UX localized error/recovery semantics |

## 9. Frozen R5 finding disposition matrix

SRC-R5 numbering follows the twelve numbered findings in the frozen
current-source report. TOPO-R5 numbering follows the twelve numbered findings
in the frozen topology/data-integrity report. Every row names a concrete R6
clause and required evidence; none changes the frozen R5 REJECT verdict.

| Frozen finding | R6 closure | Required byte or fixture evidence |
| --- | --- | --- |
| CB2-RAT-001 | §§3.1, 3.4 | CB3-RATIONAL-NORMAL-FORMS |
| CB2-ROOT-002 | §§3.2-3.3 | CB3-DIGEST-ROOT-CLOSURE |
| CB2-PROJECTION-003 | §§3.2, 5.7, 7.1 | FIELD-PROJECTION-DAG-AND-LOSS |
| SEL-RAY-004 | §§4.3-4.4 | SEL-CSSU-C1-C4-AND-RAY-KEYS |
| FACE-RING-005 | §§5.1, 5.3 | RING-THREE-LEVEL-NESTING |
| Q2-OUTCOME-006 | §§5.4-5.5 | Q2-COMBINED-PRECEDENCE |
| LIN-ORD-007 | §§5.2, 5.7 | LINEAGE-ORDINAL-RENAMED-REJECT |
| MET-WITNESS-008 | §5.6 | METRIC-OVERLAP-REVERSED |
| MET-FORMAT-009 | §§2.2, 5.6.1 | FORMAT-BRACKET-BOUNDARIES |
| FIX-EXACT-010 | §§3.4, 10-11 | R6-FROZEN-FINDING-MATRIX |
| SRC-R5-01 metric 64/4096 cap | §§2, 5.6 | LIMITS-METRIC-300-EDGE-STREAM |
| SRC-R5-02 1200 transfer cap | §2 | LIMITS-MAX-HOST-ROOM-INVENTORY |
| SRC-R5-03 hole compatibility route | §§0, 5.3, 8 | HOLE-CANDIDATE-ONLY-NO-IMPORT-STATE |
| SRC-R5-04 strict containment unowned | §§0, 6.1, 8 | FLOOR-PLACEMENT-INVARIANT |
| SRC-R5-05 FloorPlacement omitted | §6.1 | FLOOR-PLACEMENT-INVARIANT |
| SRC-R5-06 UUID ID narrowing | §§3.1, 8 | OPAQUE-ID-BYTE-ROUNDTRIP |
| SRC-R5-07 open semantic bytes | §§3.2-3.3, 7.1, 7.4 | TYPED-VALUE-AND-POLICY-REFS |
| SRC-R5-08 Patch add/remove absence | §7.2 | PATCH-ADD-REMOVE-ROUNDTRIP |
| SRC-R5-09 candidate Revision ID | §§4.1-4.2, 5.7 | CTX-ALLOC-X-WITH-ROOM-SEED |
| SRC-R5-10 history boundary | §§7.3-7.5 | HISTORY-POLICY-BINDING-AND-LOSS |
| SRC-R5-11 stable reason ownership | §§1, 8 | REASON-STATE-OWNER-MAP |
| SRC-R5-12 product limits ownership | §§2, 8 | LIMITS-SOURCE-POLICY-ONLY |
| TOPO-R5-01 Patch absence | §7.2 | PATCH-ADD-REMOVE-ROUNDTRIP |
| TOPO-R5-02 patch replay after discard | §7.2 | PATCH-REPLAY-AFTER-CANDIDATE-DISCARD |
| TOPO-R5-03 live digest roots | §§3.2-3.3 | CB3-DIGEST-ROOT-CLOSURE |
| TOPO-R5-04 merged root atom expansion | §§5.2, 5.7 | LINEAGE-MERGE-TWO-ROOTS-ONE-EDGE |
| TOPO-R5-05 context/allocation cycle | §§4.1-4.2, 5.7 | CTX-ALLOC-X-WITH-ROOM-SEED |
| TOPO-R5-06 values/loss lack payloads | §§5.7, 7.1 | ROOM-FIELD-REPLACE-AND-LOSS-ROUNDTRIP |
| TOPO-R5-07 Opening side model | §6.2 | OPENING-SHARED-WALL-TWO-SIDE-HEIGHT |
| TOPO-R5-08 side proof roots/parity | §6.3 | WALL-SIDE-REVERSE-SOURCE-TARGET-PROOF |
| TOPO-R5-09 SurfaceAddress optionals | §6.1 | SURFACE-ADDRESS-EXTERIOR-TAGGED |
| TOPO-R5-10 cross-root rehost dead route | §6.3 | HOST-EXPLICIT-CROSS-ROOT-REJECT |
| TOPO-R5-11 ceiling directional gap | §6.4 | CEILING-POST-TARGET-DIRECTION-MATRIX |
| TOPO-R5-12 unbound history commitment | §§7.3-7.5 | HISTORY-POLICY-BINDING-AND-LOSS |

## 10. Required executable byte and fixture matrix

This is required future evidence, not a claim that tests already exist. Every
fixture pins complete input bytes, output/reason, all relevant root digests,
forward/inverse result, and the unchanged preceding Durable Revision on reject.

| Fixture | Mandatory cases and proof |
| --- | --- |
| CB3-RATIONAL-NORMAL-FORMS | valid 0/1 and 1/2; reject 1/0, 0/2, 2/4 before sort/lineage/host arithmetic |
| CB3-DIGEST-ROOT-CLOSURE | intent, policy, footprint, exterior orbit for bridge/open tail, host key, pre/post inventory, side table, values, resources, bundle; recompute every digest from typed bytes |
| R6-FROZEN-FINDING-MATRIX | every frozen exact-review finding maps to a named clause, byte vector, and fixture; a removed/misnumbered row fails | 10 exact + 12 current-source + 12 topology rows, no orphaned review finding |
| FIELD-PROJECTION-DAG-AND-LOSS | seed, target values, projection, disposition, loss acknowledgement; reject a cycle/wrong type/wrong post projection |
| TYPED-VALUE-AND-POLICY-REFS | every semantic field, source canonical record, policy parser/payload, resource admission, and material table ref has type/schema/digest/bytes | reject wrong role/schema, stale digest, hidden Bytes, upward/cyclic ref, and unpinned resource |
| SEL-CSSU-C1-C4-AND-RAY-KEYS | 100 CSS px at 1 px/mm; C1 equal-distance complete tie; stale origin; every C2 blocker/tie; C4 zero, 49, 50, and exact half multiplier | exact input rationals, class precedence, no DOM/DPR fallback, and each named §1 outcome |
| RAY-2399-2400-2401 | derived row equality is accepted at 2,400; 2,401 is source-limit invalid before selection |
| DART-SUCCESSOR-EXTERIOR-AND-TWIN | degree one tail, bridge reduction, two adjacent rooms sharing a twin wall, open tail, and negative exterior orbit | every successor, signed role, SideTable rows, and no false TouchingRings outcome |
| RING-THREE-LEVEL-NESTING | outer, hole, island deterministically reports NestedRing; contact precedence and separate outers included |
| HOLE-CANDIDATE-ONLY-NO-IMPORT-STATE | newly formed hole/nested/contact candidate rejects; readable existing/imported Project is opened/exported without R6 state change | no import read-only flag, migration, deletion, autosave replacement, or History mutation is introduced by R6 |
| Q2-MITER-CARDINAL-DIAGONAL-EXACT | odd cardinal and diagonal thickness, run collapse, exact miter intersection, cap equality and strict excess | normalized Q2 bytes, no bevel, and exact least run witness |
| Q2-COMBINED-PRECEDENCE | every named subtype plus simultaneous repeated-vertex/contact and cap/contact cases prove numbered precedence; no Q2_INVERSE_ZERO branch |
| LINEAGE-ORDINAL-RENAMED-REJECT | one-based contiguous ordinals positive; same geometry with arbitrary labels rejects |
| LINEAGE-MERGE-TWO-ROOTS-ONE-EDGE | two roots merged into one current edge, virtual join point, atom sequence, side rows, Room decision, inverse |
| LINEAGE-COMPLETE-PARTITION-AND-MAP | split, merge, moved, created, and removed root atoms; stale/duplicate map; changed face without map; unchanged face with map | complete base-relative atom partition, partial injectivity, automatic-unchanged-only rule, seed and loss bytes |
| METRIC-OVERLAP-REVERSED | collinear overlap, reversed source order, edge versus whole boundary, one exact singleton witness |
| METRIC-TARGET-EDGE-WHOLE-AND-FORMAT | PlanPoint and all MetricBoundary tags, endpoint/projection/overlap candidate key, RootQ2 and DirectQ2 half-even outputs | no whole-boundary widening, one Preview/2D/3D/export ASCII token, no MEASUREMENT_UNSUPPORTED |
| FORMAT-BRACKET-BOUNDARIES | below/equal-even/equal-odd/above decimal half; bracket minus one and equality complete; extra iteration unreachable |
| LIMITS-METRIC-300-EDGE-STREAM | 65 and 300 edge source-valid Room boundaries; 90,000 pair streaming order; no R6 metric cap |
| LIMITS-MAX-HOST-ROOM-INVENTORY | 400 Room fields, 850 hosts, 1,200 source/target side rows, 500 ceiling-scope identities, and 2,950 ledger references construct without a count reject; source 2 MiB byte policy checked only at end |
| LIMITS-SOURCE-POLICY-ONLY | source Wall/Room/Opening/Asset/Surface/Project/ChangeSet limit errors occur before/after their owned phase; a source-valid candidate never sees a private R6 cap | equality at every source-derived bound, 301-wall source rejection, and no product-specific cap diagnostic |
| OPAQUE-ID-BYTE-ROUNDTRIP | non-UUID opaque IDs survive command, reservation, map, patch, history, and source-ref decoding |
| PATCH-ADD-REMOVE-ROUNDTRIP | exact X adds one Vertex/removes two Walls/adds four; DeleteWall; forward/inverse byte-identical state restoration |
| PATCH-REPLAY-AFTER-CANDIDATE-DISCARD | retain only bundle content, discard detached candidate, replay both directions and verify state JSON bytes |
| CTX-ALLOC-X-WITH-ROOM-SEED | reserved topology IDs plus one new Room and candidate Revision allocation; reject a substituted ID at every phase boundary |
| ROOM-FIELD-REPLACE-AND-LOSS-ROUNDTRIP | split finished Room, replace name, clone a wall finish, all eight classes, resource values, inverse undo |
| OPENING-SHARED-WALL-TWO-SIDE-HEIGHT | same-ID Door retain, one adjacent Room height change, min-height reject, exterior conversion, inverse adjacency |
| WALL-SIDE-REVERSE-SOURCE-TARGET-PROOF | descendant reverse parity, interior and exterior variants, exact source/target table roots and inverse |
| HOST-SAME-ROOT-ACTION-MATRIX | KeepExact, explicit same-ID move/delete, contained child conversion, crossing reject, CloneFullSide, coalesce merge, and two-exterior reject | complete Pre/Post inventories, root-side parity, source/target/inverse host bytes, no inferred rebase |
| SURFACE-ADDRESS-EXTERIOR-TAGGED | round-trip Floor, Ceiling, interior WallSide, exterior WallSide; reject every illegal discriminator combination |
| HOST-EXPLICIT-CROSS-ROOT-REJECT | source wall delete plus target on another root gives named reject; user-acknowledged delete has replayable inverse |
| FLOOR-PLACEMENT-INVARIANT | topology change leaves Level-hosted FloorPlacement bytes untouched and does not add containment validation |
| CEILING-POST-TARGET-DIRECTION-MATRIX | every §6.4 matrix row, including Floor and Wall to Ceiling and Create to Ceiling, allocation and inverse |
| HISTORY-POLICY-BINDING-AND-LOSS | policy upgrade, exact bundle replay, missing/corrupt retained policy, GC root, exact repair, confirmed/cancelled discard |
| RESOURCE-ADMISSION-PIN-GRANT-BACKUP | locally pinned and browse-only bytes, hash/parser mismatch, missing grant/notice, backup infeasibility, current-Project resource issue, history-only repair, and both-unhealthy precedence | one sorted admission/manifest closure; no PendingDurability/History on failed admission; exact repair/RecoveryChangeSet/DiscardSessionHistory crosswalk |
| REASON-STATE-OWNER-MAP | each §1 row has one localized UX surface and correct no-mutation/history/import/export behavior |

### 10.1 Standalone inherited-scope inventory

R6 does not rely on a rejected R5 rule by implication. The following inventory
is the complete policy surface retained or deliberately narrowed in this
standalone draft:

| Policy surface | Standalone R6 clauses | Required fixture family |
| --- | --- | --- |
| status, source ownership, durable/no-mutation effects, and non-adoption | §§0-2, 8-9 | REASON-STATE-OWNER-MAP |
| typed bytes, normal forms, opaque IDs, all digest roots, and DAG direction | §§3.1-3.4 | CB3-RATIONAL-NORMAL-FORMS; CB3-DIGEST-ROOT-CLOSURE |
| C1 complete selection, C2 RayProbe, C3 empty Alpha set, and C4 | §§4.3-4.4 | SEL-CSSU-C1-C4-AND-RAY-KEYS; RAY-2399-2400-2401 |
| dart successor, signed/exterior orbit, twin boundary, ring containment, and no-holes candidate gate | §§5.1-5.3 | DART-SUCCESSOR-EXTERIOR-AND-TWIN; RING-THREE-LEVEL-NESTING |
| expanded root atoms, virtual points, one-based ordinals, complete lineage, survivor map, seed, and loss matrix | §§5.2, 5.7, 7.1 | LINEAGE-ORDINAL-RENAMED-REJECT; LINEAGE-COMPLETE-PARTITION-AND-MAP |
| cyclic run normalization, cardinal/diagonal offsets, miter/cap, and exact Q2 contacts | §§5.4-5.5 | Q2-MITER-CARDINAL-DIAGONAL-EXACT; Q2-COMBINED-PRECEDENCE |
| MetricEdge/MetricWholeBoundary, exact candidates/witness, and half-even formatter | §§5.6-5.6.1 | METRIC-TARGET-EDGE-WHOLE-AND-FORMAT; FORMAT-BRACKET-BOUNDARIES |
| discriminated surfaces, Opening centerline proof, same-root host actions, cross-root reject, and Level Floor invariant | §§6.1-6.3.1 | OPENING-SHARED-WALL-TWO-SIDE-HEIGHT; HOST-SAME-ROOT-ACTION-MATRIX; SURFACE-ADDRESS-EXTERIOR-TAGGED |
| full directional ceiling placement matrix | §6.4 | CEILING-POST-TARGET-DIRECTION-MATRIX |
| replayable absent/present patches, candidate allocation, resource pinning, one retained bundle, GC, repair, and discard | §§7.2-7.5 | PATCH-ADD-REMOVE-ROUNDTRIP; CTX-ALLOC-X-WITH-ROOM-SEED; RESOURCE-ADMISSION-PIN-GRANT-BACKUP; HISTORY-POLICY-BINDING-AND-LOSS |
| source-derived non-narrowing limits and all cap ownership | §§2.1-2.3 | LIMITS-METRIC-300-EDGE-STREAM; LIMITS-MAX-HOST-ROOM-INVENTORY |

## 11. Mechanical self-check and non-adoption

Before a fresh review, the R6 author must mechanically verify:

1. every §3.4 vector SHA-256 against its shown bytes, including the nested
   payload SHA in CB3-PATCH-PRESENT;
2. every Digest/content-hash field, CB3 record/union/enum, sort order, and
   reference direction against §§3.1-3.3a, with no unregistered or cyclic root;
3. every §1 D022 diagnostic against one emitted clause and no emitted
   diagnostic absent from §1;
4. every 34 frozen R5 findings against one §9 row and one §10 fixture,
   including R6-FROZEN-FINDING-MATRIX;
5. equality acceptance at RayProbe 2,400, 300-edge/90,000-pair streaming,
   2,950 ledger non-cap behavior, and formatter bitLength bound;
6. dart/twin/exterior and same-root host/ResourceAdmission/recovery closure
   against §§5.1-5.3 and §§6.3-7.5;
7. markdown whitespace with git diff --check.

R6 is not source-owner reconciliation, executable evidence, a waiver,
canonical adoption, or implementation authorization. A new independent review
of this exact R6 SHA remains mandatory.

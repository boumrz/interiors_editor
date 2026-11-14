---
title: "D-022 R6 — advisory targets for an acyclic retained transition bundle"
date: 2026-08-05
status: advisory-noncanonical
canonical: false
implementation_ready: false
readiness: NOT_READY
purpose: "Concrete corrective target for the R6 author: a minimal total wire/storage model for R5 CB2, digest-root, patch, host and history findings."
reviewed_r5:
  artifact: ../d-022-geometry-policy-decision-draft-r5-2026-08-05.md
  sha256: c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c
review_inputs:
  - review-d022-r5-exact-geometry-external-2026-08-05.md
  - review-d022-r5-topology-data-integrity-external-2026-08-05.md
  - review-current-source-d022-r5-external-2026-08-05.md
architecture_spine_changed: false
memlog_changed: false
---

# D-022 R6 — target model for one retained transition

## Status and boundary

This is an **advisory, noncanonical** design target for the author of a new
frozen D-022 successor. It does not modify an `AD-*`, `CAP-*`, `FR-*`,
`NFR-*`, the canonical `project/project.json` member, a Portable Backup, the
reason-code registry, or implementation readiness. It creates no code, test,
storage adapter, migration, or persistence authorization.

The target deliberately resolves only the R5 closure gaps around CB2 values,
digest roots, replayable patches, allocation, host inventories and retained
history. Its use would require explicit source-owner reconciliation, in
particular for AD-3/AD-4, the Project/Backup Contract, Geometry Contract,
Domain Model, CAP-8 and FR-38. The proposed retained bytes are session-history
material, not an alternate canonical Project representation or a Portable
Backup member.

The recommended minimum decision is:

> One successful topology mutation retains exactly one self-contained,
> bundle-local `TransitionBundleV1`. It contains every typed immutable record
> needed to apply its forward or reverse patches after the detached candidate
> has been discarded. There is no global content-addressed record store and
> no hash-only patch placeholder.

This is smaller in authority surface than introducing a second repository
encoding: the current Durable Revision remains source-owned canonical Project
JSON, while the bundle is a finite, nonportable history adjunct. It does make
history bytes durable for the active session, which is an explicit owner delta
rather than an implication of the R5 word "resource".

## 1. Decisions that R6 must make consistently

| R5 blocker | Target decision |
| --- | --- |
| `CB2-RAT-001` | A closed `RationalV2` normal form is mandatory everywhere an exact interval or root atom occurs. |
| `CB2-ROOT-002`, topology finding 3 | Every semantic digest is a typed registered root reference, including host key, exterior orbit, side table, post-host inventory and retained bundle. |
| `CB2-PROJECTION-003`, topology finding 6 | Room values and projections refer to typed payload records, never to a naked value digest or arbitrary `Bytes`. |
| topology findings 1–2 | A patch uses `Absent | Present(CanonicalEntityRecordRef)` and each present ref resolves inside its own retained bundle. |
| topology finding 5 and current-source finding 9 | Topology IDs are pre-reserved by `IdPort`; one later allocation plan owns all semantic IDs, including exactly one candidate Revision ID. |
| topology findings 3, 7–9 | Host records are discriminated; their key projection, exterior orbit, source/target side tables and post inventory are independently digestible roots. |
| topology finding 12 and current-source finding 10 | A `HistoryEntry` roots exactly one typed bundle containing context, allocation, both directions, policy material and all replay records. |

No recommendation below licenses a new UUID requirement, an untyped hash, a
silent default, a default parser, or a garbage collector to repair history by
removing it.

## 2. Closed scalar and reference vocabulary

The sketches below assume the existing IECB2 primitive framing, but R6 must
allocate actual type/field/union/enum IDs in its one closed registry and pin
their vectors. A sketch is not permission to leave a field as an opaque
`Bytes` value.

### 2.1 Source-compatible opaque IDs

R5's `Uuid` scalar must not be carried forward. The current source boundary is
an opaque branded ID produced and checked through `IdPort`; its transport
encoding must preserve that fact instead of guessing a UUID or a UTF-8 string.

```text
OpaqueIdV1 {
  1: domain      Enum(IdDomain),
  2: tokenBytes  Bytes
}
```

Rules:

1. `tokenBytes` is non-empty and is compared as unsigned raw bytes. It has no
   UUID, textual, sortable-ULID, NFC, timestamp, or semantic interpretation.
2. `domain` is the existing branded domain (`Project`, `Revision`, `Vertex`,
   `WallSegment`, `Room`, `Opening`, `AssetInstance`, `SurfaceAssignment`,
   etc.). It is not a new user-visible identifier namespace.
3. Encoding/decoding calls the source-owned `IdPort` validity predicate for
   the stated domain. Allocation is also through `IdPort`; neither a hash nor
   an array index allocates an ID.
4. Equality and collection ordering are `(domain memberId, tokenBytes)`.
   An accepted `OpaqueIdV1` round-trips byte-for-byte through every record
   that names it.

If the actual `IdPort` accepts a textual token only, its own canonical byte
adapter defines `tokenBytes`; this proposal still must not state that it is a
UUID. If no stable byte adapter exists, R6 must stop at an explicit
source-owner blocker rather than introduce one by implementation default.

### 2.2 Rational normal form

```text
RationalV2 {
  1: numerator    SInt,
  2: denominator  UInt
}
```

It is valid iff:

```text
denominator > 0
gcd(abs(numerator), denominator) = 1
numerator = 0  iff  (numerator, denominator) = (0, 1)
```

`1/0`, `0/2`, `2/4`, `-0/1`, and an overlong integer encoding are rejected
as canonical-byte invalid before sorting, comparison or interval arithmetic.
Comparison uses exact cross multiplication only in transient arithmetic under
the already owner-routed magnitude caps. `ParameterQ2`, root spans, contact
parameters, host spans and every endpoint of a face atom use this same form;
there is no second rational spelling hidden in a host or lineage record.

### 2.3 Typed digest references; no arbitrary 32-byte semantic hash

Every R6 semantic hash field is one of the two structures below. A bare
`Sha256` is legal only inside such a structure, never as an untyped
"digest" field.

```text
CanonicalRootRefV1 {
  1: rootKind       Enum(CanonicalRootKind),
  2: schemaVersion  UInt,
  3: sha256         Sha256
}

CanonicalProjectJsonDigestV1 {
  1: projectSchemaVersion  UInt,
  2: byteLength            UInt,
  3: sha256                Sha256
}
```

For `CanonicalRootRefV1`, the equality is exact:

```text
sha256 = SHA-256(IECB2 || Encode(one registered root of rootKind/schemaVersion))
```

`CanonicalProjectJsonDigestV1` is the separately named current-source hash of
the exact canonical `project/project.json` byte member. It is not silently
treated as an IECB2 root. A resource byte hash similarly uses a distinct
source-owned `ExactContentHash` record with content kind, length, algorithm and
hash; it is not usable as an entity/policy/context digest.

The minimum closed `CanonicalRootKind` table for this target is:

| Root kind | Registered root whose bytes are hashed | May be referenced by |
| --- | --- | --- |
| `TopologyIntent` | `NormalizedTopologyIntentV2` including the fixed topology-ID reservation | context only |
| `FaceKey` / `Lineage` / `RoomProjection` / `SingletonContext` | their complete registered records | map, field/loss and host validation |
| `TypedValuePayload` | one branch of `TypedValuePayloadV1` | seed, field disposition, loss acknowledgement, entity record |
| `HistoricPolicyArtifact` | `HistoricPolicyArtifactV1` | context and transition bundle |
| `CanonicalEntityRecord` | `CanonicalEntityRecordV1` | `Present` patch value and inventories |
| `HostRecordKey` | `HostRecordKeyV1`, excluding any key digest | host record and resolution row |
| `HostRecord` | one discriminated `HostRecordV3` branch | host inventory and resolution row |
| `ExteriorOrbit` | `ExteriorOrbitV1` | exterior target/proof only |
| `WallSideTable` | `WallSideTableV2` | source and target side proofs |
| `HostInventory` | `HostInventoryV3` | host resolution set |
| `ResourceCommitmentManifest` | complete pins/grants/notices/backup result record | bundle and patch direction |
| `AllocationPlan` | `AllocationPlanV4` | bundle only |
| `DirectionalPatchSet` | `DirectionalPatchSetV4` | transition bundle only |
| `TransitionBundle` | `TransitionBundleV1`, excluding its own ref | `HistoryEntry` only |

The registry must reject a root kind/schema mismatch, a hash with no matching
encoded root, an extra root not reachable from the bundle, and a root whose
decoded type does not equal the typed field that refers to it. In particular,
neither an exterior orbit, host-record key, post inventory, footprint, policy,
or intent may be supplied as an arbitrary 32-byte value.

## 3. Typed values and historic policy material

### 3.1 Values are records, not `valueBytes + valueDigest`

Every non-base Room value must be one typed canonical root:

```text
TypedValuePayloadV1 =
  | RoomNameValueV1          { nfcText }
  | RoomTypeValueV1          { registeredRoomType }
  | RoomMetadataValueV1      { byte-sorted registered metadata entries }
  | SurfaceAssignmentValueV1 { closed SurfaceAddressV3, material/resource refs }
  | ExplicitUnsetValueV1     { only the registered unset marker }
```

Each branch has a closed schema and own fixed type ID. A field disposition,
loss acknowledgement, target slot and entity record that designate the same
semantic value use the *same* `CanonicalRootRefV1(TypedValuePayload, …)`.
They never repeat a prose promise to retain/clone/replace a value with only its
digest. `RoomProjection` contains refs to values and target slots, but is not
an input to itself or to a target slot that points back to it.

This makes the necessary acyclic construction explicit:

```text
typed value roots
  -> target-slot / room projection roots
  -> field disposition or loss acknowledgement
  -> entity records and patches
```

No arrow points backward. A projection digest cannot include a record that
contains that projection digest.

### 3.2 Historic policy is a typed retained artifact

```text
HistoricPolicyArtifactV1 {
  1: policyFamily      Enum(PolicyFamily),
  2: policyVersion     UInt,
  3: codecVersion      UInt,
  4: policyPayload     PolicyPayloadV1,
  5: compatibility     Enum(PolicyCompatibility)
}
```

`PolicyPayloadV1` is itself a closed union of registered policy records. It is
not an arbitrary `immutablePolicyBytes` field and no current/default policy is
permitted as a fallback. `codecVersion` selects a registered parser/validator;
an unavailable or digest-mismatched codec/payload is the history-only failure
route, not a reinterpretation under a newer policy.

Both the preflight context and both directional transitions reference the same
`HistoricPolicyArtifact` root. The entire encoded artifact appears in the
bundle-local material table described next, so undo/redo does not need the
discarded candidate or a network/catalog service.

## 4. Chosen retention model: bundle-local material, not a global store

### 4.1 Exact storage decision

Choose a **self-contained, bundle-local, deduplicated material table**. Do
not choose a global content-addressed record store for R6.

```text
BundleMaterialEntryV1 {
  1: ref                 CanonicalRootRefV1,
  2: encodedRootDocument Bytes
}

BundleMaterialTableV1 {
  1: entries  { BundleMaterialEntryV1 }  // sorted (rootKind, schemaVersion, sha256)
}
```

For every entry, the decoder must consume `encodedRootDocument` completely,
prove that it is the registered root named by `ref`, and recompute the stated
SHA-256. Entries are unique by the complete ref. An entry may refer to lower
rank material only through a typed `CanonicalRootRefV1`; `TransitionBundle`
itself is forbidden as an entry, so a bundle can never contain itself.

This is content-addressed *inside one bundle*, but the bytes are retained
inline with that bundle. It intentionally avoids:

- a cross-history dangling reference;
- an unfenced global-record GC policy;
- an external record availability condition not named by `HistoryEntry`;
- treating a temporary candidate cache as durable replay evidence.

The trade-off is measurable duplication between history entries. Before
publication, `SessionRetentionPolicy` must account for the exact encoded bundle
bytes together with existing resource roots. It may reject the new command;
it must not publish it and later remove bytes needed by an older entry.

### 4.2 Entity records and `Present | Absent` patches

```text
CanonicalEntityRecordV1 {
  1: entityKind     Enum(EntityKind),
  2: entityId       OpaqueIdV1,
  3: entitySchema   UInt,
  4: entityPayload  EntityPayloadV1
}

CanonicalEntityRecordRefV1 {
  1: entityKind  Enum(EntityKind),
  2: entityId    OpaqueIdV1,
  3: record      CanonicalRootRefV1(CanonicalEntityRecord)
}

PatchValueV3 =
  | AbsentV1  { onlyAbsentMarker }
  | PresentV1 { record CanonicalEntityRecordRefV1 }

PatchV3 {
  1: entityKind  Enum(EntityKind),
  2: entityId    OpaqueIdV1,
  3: before      PatchValueV3,
  4: after       PatchValueV3
}
```

`CanonicalEntityRecordV1` never contains its ref/digest. A `PresentV1` ref
must resolve to one and only one matching material entry whose decoded record
has the same `(entityKind, entityId)`. `EntityPayloadV1` is a registered
discriminated payload, not raw JSON or untyped bytes.

The operation is derived, so a contradictory `operation` field is not stored:

| before | after | sole legal result |
| --- | --- | --- |
| `Absent` | `Present` | `Add` |
| `Present` | `Absent` | `Remove` |
| `Present(old)` | `Present(new)` where refs differ | `Replace` |
| same variant/ref | reject as a no-op/inconsistent patch |

Each patch set is strictly sorted and unique by `(entityKind, entityId)`. A
patch set contains complete typed `fromFence` and `toFence`, where each fence
names `projectId`, `revisionId` and `CanonicalProjectJsonDigestV1`. The source
owner must define the one lossless mapping between an entity record and the
current Project JSON entity semantics. Applying a patch materializes Project
values through that mapping, serializes through the source-owned canonical
Project JSON serializer, and proves the resulting `toFence` digest. The
bundle never replaces the canonical JSON as persistence source of truth.

### 4.3 Replay after candidate discard

For a base Project containing old record `A` and not record `B`, the retained
bundle contains both full entity records in its table:

```text
forward patches:
  A: Present(ref(A-old)) -> Absent
  B: Absent              -> Present(ref(B-new))

reverse patches:
  B: Present(ref(B-new)) -> Absent
  A: Absent              -> Present(ref(A-old))
```

After successful atomic publication, the detached candidate may be discarded.
Forward replay first proves the current state equals the forward `fromFence`,
loads `B-new` from the retained table, applies all sorted rows, and proves the
forward `toFence`. Reverse does the symmetric operation from the retained
`A-old` bytes. Neither direction reads a renderer object, a current policy, an
unretained candidate cache, or a bare digest.

If publication itself fails, no `HistoryEntry` or retained bundle becomes
Durable; the existing pending/retry boundary remains intact. If a published
bundle later fails its hash/parse/material check, current Project bytes are
not changed, the entry remains visible/rooted, and only exact-byte repair or
the existing explicitly confirmed `DiscardSessionHistory` route may resolve a
healthy-current history-only issue.

## 5. One allocation discipline without a context cycle

R6 should choose the following explicit two-origin model and not mix it with a
late allocation of the same topology IDs.

### 5.1 Pre-context topology identity reservation

`IdPort` creates a finite `TopologyIdentityReservationV1` before context
creation. It contains only command-determined output `Vertex` and
`WallSegment` identities:

```text
TopologyIdentityReservationV1 {
  1: items { TopologyIdReservationItemV1 }
}

TopologyIdReservationItemV1 {
  1: outputSlot  TopologyOutputSlotV1,
  2: entityKind  Enum(Vertex | WallSegment),
  3: entityId    OpaqueIdV1
}
```

`TopologyOutputSlotV1` is a closed normalized-command position, not a user
ID and not an array-order accident. The reservation is included in the
`TopologyIntent` root, which is referenced by the singleton context. It has
no Room, Asset, policy-result, bundle, candidate-Revision, patch or history
field. A rejected candidate may burn a local `IdPort` token, but cannot make a
Durable object or reuse an ID for another output.

This chooses the reviewers' "command-supplied immutable topology IDs outside
allocation" alternative. If source owners instead choose symbolic slots, they
must redesign *all* affected `FaceKey`/lineage rules in one successor; R6 must
not use some pre-reserved IDs and later allocate others for the same output.

### 5.2 One late semantic allocation plan

After context, map/seed/loss/host/ceiling choices are complete, exactly one
`AllocationPlanV4` resolves the remaining semantic IDs:

```text
AllocationPlanV4 {
  1: contextRef  CanonicalRootRefV1(SingletonContext),
  2: entries     { AllocationEntryV2 }
}

AllocationEntryV2 =
  | CandidateRevisionAllocationV1 { projectId, baseRevisionId, allocatedRevisionId }
  | NewRoomAllocationV1           { successorFaceRef, allocatedRoomId }
  | NewAssetAllocationV1          { declaredPostSlot, allocatedAssetInstanceId }
  | NewAssignmentAllocationV1     { declaredTargetSlot, allocatedAssignmentId }
```

All entries are byte-sorted by their closed purpose union, IDs are unique and
noncolliding with base state and the topology reservation, and the allocation
root contains no bundle digest. There is exactly one
`CandidateRevisionAllocationV1`; its ID equals the candidate `toFence`
Revision ID and the bundle's forward destination. It appears only after the
context and semantic choices exist, then before entity records, fences, patches
and bundle assembly. Thus it is deterministically bound in preflight without
being a field of the singleton context.

## 6. Host roots: keys, exterior proof, tables and post inventory

### 6.1 Discriminated host records and nonrecursive keys

The R5 uniform `HostRecord` must be replaced by a union. A key is the digest
of a *key projection* that never contains that digest or mutable payload:

```text
HostRecordKeyV1 =
  | OpeningHostKeyV1          { openingId }
  | WallPlacementHostKeyV1    { assetInstanceId }
  | WallSideAssignmentKeyV1   { owningRoomId, sourceSurface, materialSlotId }
```

`materialSlotId` above must be an existing source-owned stable slot identity.
If the domain does not own one, R6 must ask its owner to define it or model the
assignment as a separately identified entity; it must not invent a hash of a
mutable value as identity. The digest of this union is the one
`CanonicalRootRefV1(HostRecordKey, …)` used by the host record.

```text
HostRecordV3 =
  | OpeningHostRecordV1 {
      key, openingId, wallSegmentId, localSpan,
      openingPayloadRef, sideAndHeightProofs { OpeningSideAndHeightProofV1 }
    }
  | WallPlacementHostRecordV1 {
      key, assetInstanceId, wallSurface, localSpan,
      elevationMm, normalOffsetMm, orientation, placementPayloadRef,
      sideProof
    }
  | WallSideAssignmentHostRecordV1 {
      key, owningRoomId, wallSurface, assignmentValueRef, sideProof
    }
```

An `Opening` is a centerline attachment, not a one-side wall host. Its complete
record includes the canonical `kind`, `offsetMm`, `widthMm`, `heightMm`,
`sillMm`, nonzero span and a complete set of applicable side/height proofs.
For each adjacent Room side, the proof binds available Room height; a valid
Door additionally derives its exactly-two-Room adjacency from these same
targets. Exterior/invalid Door behavior is explicit. A wall placement and a
wall-side assignment retain one semantic side address, as current sources
require.

`SurfaceAddressV3` is a closed union, never optional fields:

```text
SurfaceAddressV3 =
  | FloorAddressV1        { roomId }
  | CeilingAddressV1      { roomId }
  | WallRoomAddressV1     { wallSegmentId, adjacentRoomId }
  | WallExteriorAddressV1 { wallSegmentId }
```

Floor placement receives an explicit no-topology-transfer rule (or an
owner-routed containment policy); it may not disappear from the transition
simply because the wall-host inventory is scoped to wall-attached records.

### 6.2 Registered exterior and side-table roots

```text
ExteriorOrbitV1 {
  1: phase          Enum(Base | Candidate),
  2: orbitKind      Enum(BoundedExterior | Bridge | OpenTail),
  3: directedAtoms  [ExteriorBoundaryAtomV1]
}

WallSideTableV2 {
  1: phase  Enum(Base | Candidate),
  2: rows   { WallSideRowV2 }
}

WallSideRowV2 {
  1: wallSegmentId,
  2: physicalSide,
  3: target  FaceTargetV2 | ExteriorTargetV2
}

ExteriorTargetV2 { physicalSide, exteriorOrbitRef }
FaceTargetV2     { faceKeyRef, boundaryOccurrenceRef }
```

`ExteriorOrbitV1` is a real registered root and is listed in the material
table. It does not reference the table, its own digest, a host record or a
bundle. `WallSideProofV3` carries **separate** source and target side-table
refs, source and target target-unions, occurrence/exterior refs, and source
and target orientation parities. It therefore proves a reverse/split/exterior
transition without an unstated lookup or a single ambiguous table digest.

### 6.3 Source and post host inventories

```text
HostInventoryV3 {
  1: phase    Enum(Base | Candidate),
  2: records  { CanonicalRootRefV1(HostRecord) }
}

HostResolutionSetV3 {
  1: contextRef,
  2: sourceInventoryRef  CanonicalRootRefV1(HostInventory),
  3: targetInventoryRef  CanonicalRootRefV1(HostInventory),
  4: rows { HostResolutionRowV3 }
}
```

The base inventory has exactly one record for each applicable base Opening,
WallPlacement and wall-side assignment. The candidate inventory has exactly
one record for every applicable post state host. Both inventories sort by the
full encoded `HostRecordKey` ref and reject duplicate keys. Every base key has
exactly one resolution row; the union of all row target records equals the
candidate inventory byte-for-byte. The target inventory is thus a named,
recomputable root rather than an unexplained `targetInventoryDigest`.

An explicit cross-root rehost, if retained by R6, must use a distinct,
user-confirmed branch with a full target host record, source/target proofs,
resource/notice preflight and inverse. It must not claim same-root lineage.

## 7. The retained transition bundle and its acyclic assembly order

### 7.1 Bundle and history entry sketches

```text
DirectionalPatchSetV4 {
  1: fromFence,
  2: toFence,
  3: patches { PatchV3 },
  4: resourceCommitmentManifestRef
}

TransitionBundleV1 {
  1: schemaVersion,
  2: contextRef,
  3: topologyIntentRef,
  4: allocationPlanRef,
  5: historicPolicyRef,
  6: sourceHostInventoryRef,
  7: targetHostInventoryRef,
  8: forwardPatchSetRef,
  9: reversePatchSetRef,
  10: bundleMaterialTable,
  11: resourceCommitmentManifestRef
}

HistoryEntryV3 {
  1: historyEntryId OpaqueIdV1,
  2: transitionBundleRef CanonicalRootRefV1(TransitionBundle),
  3: forwardFromFence,
  4: forwardToFence
}
```

The bundle has no `bundleDigest` field. Its digest is calculated only after all
other fields and material entries validate, then `HistoryEntryV3` stores the
typed ref outside it. A bundle material entry cannot contain a bundle root;
a context/allocation/patch/policy record cannot refer to the enclosing bundle.
This makes the dependency graph acyclic by construction.

The two directional patch-set refs must be exact inverses in both fences and
every `PatchV3` value. A history entry cannot bind a separate loose policy
digest, loose allocation ID or loose patch hash: replay reads only this one
bundle.

### 7.2 Mandatory calculation order

```text
1. fenced base Project JSON + writer lease + source policy are checked
2. IdPort creates TopologyIdentityReservationV1 for only new Vertex/Wall IDs
3. normalized topology intent, faces, pre inventories, exterior orbits and
   base side table are derived without semantic transfer choices
4. typed policy/value roots and singleton context are encoded and digested
5. confirmed map/seed/loss/host/ceiling decisions are selected
6. AllocationPlanV4 allocates semantic IDs, including exactly one Revision ID
7. candidate entity records, target side table/inventory and all material roots
   are encoded; each reference is resolved and type-checked
8. source-owned canonical Project JSON bytes and both Revision fences are made
9. forward/reverse PatchV3 sets are built and simulated against those fences
10. one TransitionBundleV1 is encoded and digested; HistoryEntryV3 points to it
11. staging writes the candidate Revision, bundle and history entry; checksum
    plus atomic pointer swap publishes all three or none
```

The rank rule is strict: a root may refer only to material already constructed
at a lower rank, except `TransitionBundleV1`, which collects completed roots
but is not referenced by them. A validator rejects a duplicate, missing,
unreachable, wrong-kind, wrong-schema, self-referential or higher-rank material
ref before `PendingDurability`.

### 7.3 Retention, GC and exact repair

After durable publication, each active undo/redo `HistoryEntryV3` is a GC root
for its one bundle, its inline material table, its policy artifact and its
resource commitment roots. A redo branch becomes releasable only together with
the atomic Durable publication that replaces it; rejected, canceled and
persistence-failed candidates release nothing from an existing branch.

Missing/corrupt bundle material or historic policy is a history-only fault when
the current Project is healthy: undo/redo returns the named history outcome,
does not mutate current Project or silently hide the entry, and preserves the
bundle as a root. Exact repair restores one byte-identical bundle whose
`TransitionBundle` ref verifies. If exact repair is unavailable, only the
source-owned explicit `DiscardSessionHistory` action may discard the healthy
session history; it does not create a Project Revision. Session history stays
out of Portable Backup unless a future owner explicitly changes that boundary.

## 8. Mandatory future fixtures

These are proposed golden requirements, not existing automated tests. Each
accepted case must pin exact input bytes, the complete material-table bytes,
every typed root ref/digest, both canonical Project JSON fences, forward and
reverse output, and source/candidate IDs. Each rejection must prove byte- and
semantic identity of the preceding Durable Revision and existing history.

| Fixture | Required proof |
| --- | --- |
| `CB2-OPAQUE-ID-PORT-ROUNDTRIP` | Two distinct source-valid opaque tokens round-trip by domain without UUID/text coercion; wrong domain and invalid `IdPort` token reject. |
| `CB2-RATIONAL-NORMAL-FORMS` | `0/1`, signed nonzero reduced fractions accept; `0/2`, `2/4`, `1/0`, negative zero and malformed integer encodings reject before any interval sort. |
| `CB2-DIGEST-ROOT-CLOSURE` | Independently recomputes every live ref for an exterior wall side, bridge/open-tail exterior, host key, source/post inventory, typed policy, patch set and retained bundle; an arbitrary 32-byte substitution rejects. |
| `CB2-DIGEST-DAG-REJECT` | A projection back-reference, a bundle-in-material entry, or a self/hash cycle rejects with no candidate. |
| `PATCH-ADD-REMOVE-ROUNDTRIP` | Exact X adds a Vertex/replacement walls and removes old segments; inverse restores byte-identical base. A DeleteWallSegment add/remove pair is also covered. |
| `PATCH-PRESENT-ABSENT-INVALID` | Missing material, wrong entity type/key, duplicate patch key, Present→same Present, and impossible absent/present relation reject deterministically. |
| `PATCH-REPLAY-AFTER-CANDIDATE-DISCARD` | Persist only Revision plus one bundle/history entry, dispose the in-memory candidate, then prove forward and reverse replay from retained bytes alone. |
| `CTX-ALLOC-X-WITH-ROOM-SEED` | Topology IDs come only from the pre-context reservation; new Room and exactly one candidate Revision come only from late allocation. Changed/reused/colliding IDs at every phase reject. |
| `ROOM-FIELD-REPLACE-AND-LOSS-ROUNDTRIP` | A split with explicit name replacement and wall-finish clone proves all eight field classes, exact typed values, loss rows and full inverse restoration. |
| `HOST-KEY-EXTERIOR-POST-INVENTORY` | Recomputes key projections, base/candidate inventories, source/target tables and exterior orbit refs; missing/extra/duplicate target host row rejects. |
| `OPENING-SHARED-WALL-TWO-SIDE-HEIGHT` | A Door on a shared wall covers valid retention, adjacent-height failure, exterior conversion and byte-identical inverse adjacency without treating Opening as a one-side host. |
| `WALL-SIDE-REVERSE-SOURCE-TARGET-PROOF` | A reversed descendant preserves semantic side with separate source/target table/parity proofs and covers both interior and exterior target variants. |
| `HISTORY-POLICY-BINDING-AND-LOSS` | Undo/redo after policy upgrade uses retained typed policy; corrupt/missing policy leaves Project/history unchanged; exact repair restores it; explicit history discard remains separately confirmed. |
| `BUNDLE-GC-BRANCH-BOUNDARY` | A rejected or persist-failed replacement does not free redo bundle bytes; only a successfully published replacement releases the old branch roots. |

## 9. Handoff to the R6 author

R6 should either adopt this model coherently into a new frozen draft or record
an explicit, equally total alternative. It must not mix the rejected R5
hash-only-patch approach with only some inline bytes, reserve a candidate
Revision twice, use UUID as a convenience encoding, or put a bare `Digest` back
into a host/history record.

Before another independent review, the successor needs a single closed registry
with actual IDs/conditional field rules, full byte vectors for the fixtures
above, a source-delta table for the session-history material boundary and all
caps, and the required owner routing. This advisory itself changes none of
those sources and makes no readiness or implementation claim.

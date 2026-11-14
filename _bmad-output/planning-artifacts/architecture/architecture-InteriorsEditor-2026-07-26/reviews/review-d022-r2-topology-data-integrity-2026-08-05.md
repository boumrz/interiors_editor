---
title: "InteriorsEditor — independent topology/data-integrity review of D-022 revision 2"
review_type: topology-data-integrity-precanonical-r2
reviewed: 2026-08-05
reviewer: "Codex /root/d022_changeset_policy_research"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 0bbab7d0771a3a1a78b50ef3a58e3f723d828322cb36ff249c90f9d1f70cd167
  architecture_spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  domain_model_sha256: 80eed557aeafaaf97dfef974e3f639efb887b1d28fe50b878722e813913e5395
  geometry_contract_sha256: ca0efcc9126ac8ff92fa76eeafa32ac8dd3d13311d8d66758a68219b52cefbb0
  project_backup_contract_sha256: 91ecfb9ac4cb7bc21e2e0205442b960713e70a2aaf3384a40645db2fff8d7157
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../domain-model.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../project-context.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Independent read-only review of R2 planar topology, host transfers, Room reconciliation, ChangeSet/replay and atomic durability; no draft, canonical, memlog, code, test, configuration or evidence mutation"
source_mutations: "Created only this versioned review artifact."
---

# D-022 revision 2 — topology/data-integrity review

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT` for the reviewed R2 snapshot.** `NOT_READY`
does not change.

R2 correctly narrows several previously ambiguous paths: it keeps canonical
geometry integer-mm, groups exact contacts before topology partition, makes an
axis merge require a map, and keeps rejected/persist-failed candidates outside
Durable state. Those directions are compatible with the current invariants.

It is nevertheless not a complete pre-canonical contract. The remaining gaps
leave at least one of these outcomes to implementation choice: which contact
becomes a partition point, which exact host record survives/duplicates, which
Room owns a property, and whether undo/redo reproduces the published result.
That conflicts with AD-1/AD-3/AD-6/AD-7 and the domain model requirement that a
complete ChangeSet carry affected IDs, reconciliation, assets and an inverse.

This is a review of a noncanonical decision input only. It neither changes an
`AD-*`, source owner, reason-code registry, S-2 status, implementation scope,
nor any readiness or product claim.

## What passes this review

| Boundary | Assessment |
| --- | --- |
| Canonical/exact boundary | **Pass as working policy.** R2 keeps `BigInt`/rational and Q2 work ephemeral and admits only `SafeIntegerMm` topology. |
| Atomic T/X direction | **Pass in intent.** §4 requires grouping before all affected segments are partitioned, one shared X vertex, non-zero pieces and whole-candidate rejection. |
| Axis-merge direction | **Pass in intent.** §5 rejects implicit/visual equality and requires explicit source/target discriminants, interval coverage and same-orientation translation. |
| Conservative host behavior | **Pass in intent.** R2 rejects reverse/diagonal automatic rebase, hidden nearest-host repair and delete-with-hosted-records. |
| Durable lifecycle | **Pass in intent.** §9 retains detached preflight, `baseRevisionId`, complete validation before `PendingDurability`, and a distinct persistence-failure path. |

The findings below concern the missing executable details needed to turn those
directions into one deterministic, reversible result.

## Blocking findings and required corrections

### D022-R2-TDI-01 — Collinear finite-segment contact is classified by examples, not by a total exact predicate

**Evidence.** R2 §1.2 says that `D = 0` non-collinear lines have no contact,
positive open-interval overlap rejects, and a single shared endpoint reuses an
existing Vertex. It does not define how two finite collinear canonical segments
are projected and compared, nor precedence between an orientation-independent
duplicate and overlap.

**Consequence.** A reversed duplicate, endpoint touch, disjoint collinear pair
and positive overlap can receive different outcomes in two implementations even
though AD-7 and Geometry Contract §3 require orientation-independent duplicate
detection and whole-candidate topology normalization.

**Required correction.** Before canonical adoption, define a no-zero-length,
exact collinear classifier: choose a specified non-zero component or a
coordinate-free parameter; normalise both closed intervals; detect duplicate
before overlap; then distinguish disjoint, exactly one already-existing shared
endpoint, and positive open overlap. Bind each case to one stable outcome and
add reversed/equal, endpoint, gap and partial-overlap corpus rows.

### D022-R2-TDI-02 — `Nt/D` is not an order for every segment that must be partitioned

**Evidence.** R2 §1.2 sorts multiple contacts by `Nt/D`, which is the parameter
of the first `P→Q` segment in one pairwise intersection formula. §4 then
requires every affected proposed and existing segment to be partitioned at all
ordered contacts.

**Consequence.** Pair enumeration order or argument order can choose different
piece boundaries/IDs when an existing segment has several contacts. That breaks
the planar-graph result before Room and host reconciliation begin.

**Required correction.** Introduce an exact
`segmentParameter(segment, contact)` for **each** affected segment, normalised
to its stored `start→end` orientation. Group coordinates first, sort each
segment's distinct interior contacts by that parameter and a fully specified
coordinate tie key, then create all non-zero pieces in one detached candidate.
The corpus must include multi-contact proposed and existing segments, reversed
stored direction, T at an existing junction, and an X plus another contact on
the same segment.

### D022-R2-TDI-03 — Automatic T/X partition has no complete serializable attachment transfer contract

**Evidence.** §4 can split existing walls as a consequence of total T/X
normalization. §7 supplies an interval formula for an axis split, but the only
versioned, serializable attachment map is `MergeAttachmentMapV1` in §5.
There is no result that enumerates every source Opening, WallPlacement and
WallSide assignment together with its exact child host/address after an
automatic partition.

**Consequence.** The same valid T/X can retain an Opening on different child
IDs, duplicate a side assignment differently, or be unreplayable after an
otherwise identical contact normalization. A generic "same host safety" rule
does not identify the child records needed by ChangeSet/inverse semantics.

**Required correction.** Add a versioned `PartitionAttachmentMapV1` (or an
equivalent explicitly named field of the command/result) for every explicit or
automatic split. It must enumerate source record identity/kind, source
interval/side, each target child wall/interval/side, orientation/local-basis
transform and the preservation/clone rule. The domain must recompute and
compare it before validation; absent, extra or ambiguous entries reject the
whole candidate. Its exact output must enter `ChangeSet`, inverse and replay
fixtures.

### D022-R2-TDI-04 — Merge-map coverage is not closed over record kinds or coalesced output identity

**Evidence.** `MergeAttachmentMapV1` contains a free `recordKind` plus three
host discriminants. §5.2 says all source hosted records occur once and permits
two full-side assignments to coalesce, but does not define a closed
`recordKind → canonical collection/payload/output-record` mapping. In the
coalescing case two source entries name one target side key without stating the
identity and inverse of the single resulting assignment.

**Consequence.** An implementation can omit a future or differently stored
wall-hosted record from coverage, or choose which equal source record survives
as the output. Both violate the current domain model's unique entity IDs,
affected-surface/asset ChangeSet requirement and exact history restoration.

**Required correction.** Define a closed V1 enum and extractor for every
wall-hosted canonical record in Alpha, including its canonical payload and
whether it is an entity or address-keyed value. Each map entry must contain a
source key and an output key/ID. For coalescing, define one newly produced or
deterministically retained output identity, both removed source identities, and
the exact inverse expansion. A record outside the closed enum must make merge
reject until this contract is versioned again.

### D022-R2-TDI-05 — Treating a WallPlacement as a point can silently split its physical host span

**Evidence.** R2 §5.2 permits `[offset, offset]` if a canonical schema does not
define a non-zero exact host span. The current AssetDefinition contract already
has physical dimensions, footprint and anchor; `WallPlacement` is a hosted
physical object, not merely an offset token.

**Consequence.** A wide wall object whose anchor lies before a split can be
assigned to that child even when its body crosses the new child boundary. Its
wall host then no longer represents a valid physical placement, despite a
superficially complete map.

**Required correction.** Define the exact wall-local occupied interval from the
AssetDefinition footprint/dimensions, anchor and orientation before a split or
merge. If V1 cannot derive a finite interval for an asset, automatic transfer
must reject and require an explicit `MoveAsset`/remove outcome; it must never
fall back to a point. Add boundary-crossing, child-boundary-touching and
orientation/anchor corpus cases.

### D022-R2-TDI-06 — `remaining tied eligible pair` does not define a total Room-survivor relation

**Evidence.** R2 §6.1 defines eligibility and a mutual-unique-max automatic
rule, then lets `RoomSurvivorMapV1` choose a “remaining tied eligible pair.” It
does not define the tie graph, the score equality relation for both endpoints,
or whether a pair is selectable after another candidate has been consumed by
an automatic or explicit mapping.

**Consequence.** In a split/merge component with equal maxima on one side and
a stronger candidate on the other, one implementation can accept a supplied
map while another rejects it as competing. Room IDs, height, side addresses and
Door adjacency then diverge from the same command.

**Required correction.** Define the complete bipartite eligibility/score graph
and a deterministic reduction sequence. An explicit pair must be an unresolved
equal maximum under a stated relation, may not displace an auto pair, and must
be maximum for every endpoint it claims. Serialize the successor face key and
the exact score/lineage digest that was confirmed. Add asymmetric/equal split,
asymmetric/equal merge, competing predecessor/successor, invalid lower-score
pair and replay cases.

### D022-R2-TDI-07 — Loss acknowledgement is not bound to a particular lost record and final outcome

**Evidence.** §6.2 requires a serializable acknowledgement when a losing
record differs from “the final successor record or Level-default record,
against which it is lost.” §9 only carries a generic data-loss acknowledgement.
Neither section defines its schema, a unique target successor/default outcome,
the before/after values, or the handling of several possible successor faces.

**Consequence.** A confirmation for one preview can be replayed against a
different loss in the same topology command, including after an explicit Room
property mutation. The user-approved loss and the Durable loss need not be the
same.

**Required correction.** Introduce sorted `RoomLossAcknowledgementV1[]`, each
binding `{ losingRoomId, carryClass/fieldSet, normalizedBeforeDigest,
resolvedOutcome: successorFaceKey | levelDefault, normalizedAfterDigest }`.
Recompute all fields atomically and require exact equality before accepting the
command. A missing, duplicate, stale or mismatched acknowledgement must reject
without a ChangeSet.

### D022-R2-TDI-08 — CeilingPlacement reconciliation checks only Room identity, not the resulting host surface

**Evidence.** R2 §6.2 says a `CeilingPlacement` remains only if its `roomId`
survives. The current domain model separately requires every Wall/Ceiling
AssetInstance to have a valid host surface. A surviving Room ID can nevertheless
have a changed usable polygon that no longer contains the placement's local
point or physical footprint.

**Consequence.** A topology edit can publish an asset over a cut-away/not-usable
part of a Room while satisfying the stated ID condition. Relying on an unnamed
generic later host check is not enough to make the reconciliation outcome
repeatable.

**Required correction.** After the Room matrix and usable polygon are derived,
require an exact `CeilingPlacement` host predicate for `xMm`, `zMm`, `dropMm`
and the defined footprint. It must state containment/boundary semantics and
the no-nearest-room outcome. The ChangeSet must report retention/rejection for
the affected asset; add a same-ID-but-outside-usable-polygon test.

### D022-R2-TDI-09 — Full-side split duplication has no output cardinality or inverse semantics

**Evidence.** R2 §7 allows one full-side `WallSideHost` assignment to transfer
as an identical full-side assignment on each lineage child. It does not state
whether this creates new records or address-keyed values, how many outputs a
multi-contact partition creates, or how undo collapses those outputs back into
the source assignment.

**Consequence.** A one-to-many host transformation can leak or lose a material
assignment in undo/redo, and different ChangeSets can represent the same
visible result. It is especially material because §5 permits two-to-one
coalescing on merge, creating the inverse transformation in the other
direction.

**Required correction.** Put every child output in
`PartitionAttachmentMapV1`/ChangeSet with its exact host address and declared
identity rule. Define the inverse for `1→n`, `n→1` and no-op cases before
publication; validate referenced-resource/backup and session-retention impacts
for every output. If the source owner cannot define this in V1, reject any
split with a full-side assignment rather than silently duplicating it.

### D022-R2-TDI-10 — WallPlacement lacks a physical-side and local-basis preservation rule

**Evidence.** §7 gives detailed post-change physical-side proof only for
`WallSideHost`. It says the same safety rules apply to `WallPlacement`, but a
placement additionally carries `adjacentRoomId | exteriorSide`, local offset,
normal offset and orientation. Neither the split rule nor the merge map binds
the tangent/normal/orientation transform to the resolved physical side.

**Consequence.** A placement can retain a formally valid wall ID and interval
while moving to the opposite physical side, or use a different orientation
after a Room identity change. That violates the stable wall-side address in the
Geometry Contract and turns a topology operation into an unacknowledged asset
move.

**Required correction.** Make `WallPlacementHost` carry a canonical local-basis
mapping: same stored tangent direction, same resolved physical side after the
Room map, same normal-sign and an explicitly defined orientation transform.
Reject a basis/side change as `ANCHOR_REHOST_AMBIGUOUS` or the adopted
unsupported-rebase outcome; do not infer it from a renderer transform. Cover
adjacent-Room survivor, exterior, split, merge and reversal cases.

### D022-R2-TDI-11 — New vertex/wall/Room/output identities are not frozen as part of the command result

**Evidence.** R2 requires shared vertex reuse/creation, canonical non-zero
pieces, `mergedWallId`, new Room IDs and (in §7) potentially many child-side
outputs. It never states how new opaque IDs are allocated, serialised or
reused on redo. The current domain model makes IDs stable, ChangeSet-visible
and part of `HistoryEntry`/inverse semantics.

**Consequence.** Two replays of the same topology intent can produce different
host addresses even when geometry is identical. A random allocator hidden in a
kernel cannot prove byte-equivalent candidate/ChangeSet replay or correctly
resolve maps that reference newly created outputs.

**Required correction.** Require a deterministic allocation plan in the
validated result/immutable history payload (or caller-supplied opaque IDs
validated for uniqueness) for every new vertex, wall piece, merged wall, Room
and cloned output. Maps must reference those frozen IDs. Add serialize → replay
→ undo → redo assertions for exact Project IDs, host addresses and ChangeSet
IDs, not geometry alone.

### D022-R2-TDI-12 — Preflight confirmation has no immutable consequence binding, and the corpus omits the required replay boundary

**Evidence.** §9 distinguishes ephemeral preflight from the actual command,
but the command carries no canonical impact/preflight digest. §10 requests
some cancellation/replay coverage, while the current domain-model test rule
requires **every** command to have inverse/undo, serialization round-trip and
a property-based chain. No R2 corpus row requires exact restoration of the new
maps, Room-loss acknowledgements, output IDs and one-to-many host effects.

**Consequence.** A map/acknowledgement confirmed for one candidate can be
reused with a changed payload whose recomputed geometry is similar enough to
pass individual checks, while history cannot prove that undo/redo restores the
same durable state. This weakens the AD-3 rule that only a complete, atomic
ChangeSet becomes Durable.

**Required correction.** Give the confirmed command a canonical
`impactDigest` over the topology payload, frozen allocations, Room/attachment
maps, loss acknowledgements and resolved record commitment. Recompute it after
the `baseRevisionId` fence and reject mismatch before `PendingDurability`.
Expand §10 with command serialization/replay, inverse/undo/redo, stale base,
digest mismatch, persistence failure and hard ChangeSet-size/retention cases;
assert byte-identical current Durable Revision on every rejected path.

## Minimum re-review evidence

Before this input may enter a source-owner architecture update, its corpus must
show, for the revised contracts above:

- deterministic T/X/contact grouping and per-segment piece construction;
- total split/merge coverage for every Alpha wall-hosted record, including
  point-vs-span, one-to-many duplication and inverse coalescing;
- Room tie/ack outcomes that produce one explicit resolved record before
  Opening, Door adjacency and ceiling-host validation;
- exact host-address, asset-resource and ChangeSet/inverse assertions across
  serialize, replay, undo and redo; and
- no `PendingDurability`, History, autosave or canonical projection mutation
  on a stale base, map/ack/digest mismatch, limit failure or persistence
  failure.

Only a corrected draft, source-owner reconciliation and fresh independent
review may alter this `REJECT_FOR_PRECANONICAL_INPUT` verdict. The broader
implementation-readiness gate remains `NOT_READY` regardless.

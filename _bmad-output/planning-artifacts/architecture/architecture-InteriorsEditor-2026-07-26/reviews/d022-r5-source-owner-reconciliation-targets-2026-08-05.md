---
title: "InteriorsEditor — D-022 R5 source-owner reconciliation targets"
date: 2026-08-05
status: advisory-precanonical
review_type: source-owner-reconciliation-targets
reviewed_r4:
  artifact: ../d-022-geometry-policy-decision-draft-r4-2026-08-05.md
  sha256: 2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b
frozen_current_source_review:
  artifact: review-current-source-d022-r4-2026-08-05.md
  sha256: 57aedd56df40da2698e0d27a4c4b2d469bae2a00c664abbac1f9f261e9781bb2
scope: "Read-only reconciliation targets for a possible D-022 R5 successor; no source-owner decision is made here."
source_mutations: none
canonical_adoption: blocked
implementation_ready: false
readiness: NOT_READY
---

# D-022 R5 — targets for source-owner reconciliation

## Boundary and owner rule

This is an advisory input for a successor working policy, not an amendment to
R4 or an alternate source of truth. It was prepared by reading the frozen R4
snapshot and current-source review, the complete SPEC package, PRD, Architecture
Spine and Domain Model, UX pair, and `project-context.md`.

The ownership rule is deliberately strict:

- PRD owns `FR-*` and `NFR-*`; SPEC owns `CAP-*` and its companion contracts;
- Architecture Spine owns `AD-*`; UX owns observable selection, preview,
  confirmation and recovery behaviour;
- a D-022 working paper can make a **proposed** total rule, but cannot silently
  narrow a capability, replace a portable Project format, change a stable reason
  code, or migrate/drop user data.

`Compatible` below means that R5 can state a total proposed implementation of
the existing requirement. It does **not** mean adoption. `Explicit source
delta` means that an owner must amend/reconcile the named source before the
rule can become canonical. In every uncertain case the safe autonomous choice
is reject/preserve/ask, never nearest/default/implicit conversion.

## A. Frozen R4 current-source findings that R5 must close

| Frozen finding | Exact current owner clauses | R5 reconciliation target | Relation and irreversible-risk fence |
| --- | --- | --- | --- |
| `D022-R4-CSR-01` — CSS-U / scale equation differs by 256 | Geometry Contract §4 defines the origin-relative `100 × k` gesture and leaves screen-space tolerance/ties/`k` to D-022; Architecture Spine `AD-7` binds active-origin construction; PRD `FR-7`, `FR-8`, `FR-13`, `NFR-4`; UX Experience §5.1.1 requires an observable exact candidate rather than a library default. | R5 must choose one dimensional system and use it in raw ingress, camera delta, C1/C2 hit test, RayProbe and C4. A safe form is to encode scale in `CSS-U × Z / mm`, or to divide every CSS-U delta by 256 before mixing it with CSS-pixel scale. It must pin the `1 CSS px/mm`, 100-mm witness in corpus. | **Compatible proposed completion of open D-022 policy.** A wrong conversion changes the promised active-origin candidate and can silently choose a 25,600-mm rather than 100-mm point. No renderer/browser convention may supply the missing factor. |
| `D022-R4-CSR-02` — wire primitives exist but no closed schema registry | Architecture Spine `AD-3`, `AD-4`, `AD-7` own atomic command/durability and the portable canonical-JSON boundary; Geometry Contract §10 fixes `project/project.json` as the only portable Project JSON; Project/Backup Contract §§2–2.1 fixes the bundle/path and lossless ingress; PRD `NFR-1`, `NFR-3`, `NFR-4`, `NFR-24` require deterministic versioned contracts. | R5 must publish a closed, versioned registry for every digestable root/nested record, record field, union/enum variant, optional form and unordered-set ordering in its proposed impact envelope, with fixture bytes/digests for each variant class. It must state that this encoding is **not** a second portable Project format and cannot persist `BigInt`, `Q2`, mesh or other derived state. | **Explicit source delta for the internal ChangeSet/digest schema; compatible only if it remains subordinate to canonical `project/project.json`.** Without it identical confirmed effects can produce different hashes/replay outcomes. Unknown/duplicate/non-minimal representations reject; they never receive a locally invented number. |
| `D022-R4-CSR-03` — declared paths have no named reason | Geometry Contract §11 owns the current stable reason-code minimum; PRD `FR-12`, `FR-40`, `NFR-4`, `NFR-25`; UX Experience §§5.1.1, 5.1.2 and §9 require a truthful undetermined/rejected state; Project Context “Naming and operational rules” requires stable discriminated errors. | Add proposed, serializable entries for stale/missing active origin, C4 delta below 50 mm, and a non-simple centerline ring, including phase precedence and corpus/UI wording. A safe naming direction is draft-only `CANDIDATE_UNDETERMINED/ACTIVE_ORIGIN_STALE_OR_MISSING` and `CANDIDATE_UNDETERMINED/C4_DELTA_BELOW_MINIMUM`, plus a stable proposed `USABLE_POLYGON_COLLAPSED/CENTERLINE_RING_NON_SIMPLE` (or an owner-approved Plan-validation equivalent). | **Explicit source delta for new codes/subtypes.** A stale input must not turn into nearest-origin selection; a short vector must not fall through to another `k`; a non-simple face must not be diagnosed differently by different implementations. |

## B. Material R5 decisions and their source-owner targets

| R5 decision / ambiguity | Exact current owner clauses | Compatible or explicit delta | Safe autonomous disposition before adoption |
| --- | --- | --- | --- |
| **Plan face traversal and exact face keys** | SPEC `CAP-2`/`CAP-3`; Geometry Contract §§2, 3, 6, 7; Architecture Spine `AD-1`, `AD-7`; PRD `FR-9`, `FR-14`, `NFR-1`–`NFR-4`; Domain Model §§2, 9. | **Compatible completion** of the still-open D-022 traversal/kernel policy, provided canonical state remains the integer-mm planar graph and Face/usable polygon remain derived. | Define a bounded, ordered integer half-edge/cycle traversal, unique exterior exclusion, orientation/rotation normalisation and deterministic ownership before any Room reconciliation. Reject any topology that cannot produce that one result; do not let library cycle order or a renderer choose it. |
| **No-holes Alpha and imported-hole compatibility** | Geometry Contract §12 explicitly includes hole goldens; §§3 and 7 define derived faces/usable polygons but do not adopt a no-hole scope. SPEC `CAP-3`, Constraints 2/9 and Open Question 2; PRD `FR-14`, `FR-15`, `NFR-1`–`NFR-3`; Domain Model §12 golden plans include holes; Project/Backup Contract §§2.1, 4 preserves validated raw Project bytes. | **Explicit material source delta.** A blanket no-holes validator conflicts with current hole fixtures unless their owner changes them or supplies a total multi-ring model. | For a *new candidate*, reject before Room/host/allocation work with a named proposed reason. For an already persisted/imported readable Project, preserve bytes and expose only a named read-only/export compatibility state: no automatic migration, simplification, autosave replacement, deletion or new Durable Revision. A later owner decision must choose multi-ring support or a deliberate migration path. |
| **Usable join policy: miter-only versus source miter-then-bevel** | Geometry Contract §7.1 requires a capped miter followed by deterministic bevel and expressly leaves rounding/join policy to D-022; SPEC Open Question 4; PRD Phase blocker 1; Architecture Spine Deferred D-022. | **Explicit material source delta** if R5 retains miter-only rejection. | R5 may specify full exact miter construction/caps as a proposal, but must reject an over-cap join rather than silently bevel or approximate. It cannot claim this replaces the current bevel rule until the Geometry Contract owner reconciles it and adds corpus. |
| **Changed-face `RoomId`, name, height and finish preservation** | SPEC `CAP-3`; PRD `FR-15` and `FR-16`; Geometry Contract §7.1 reconciliation bullets; Domain Model §§2 (`Room`), 9 and 10 (`RoomReconciliationPolicy`); UX Experience §14; Architecture Spine `AD-1`, `AD-6`, `AD-7`. | Automatic preservation only for a byte-identical derived Face is a **material proposed reconciliation** of the currently open “same semantic Room where possible” rule. It is compatible with the no-silent-distribution requirement only when the user sees the changed-face choice. | Preserve exact fields automatically only for an unchanged fingerprint. For every changed Face, require a confirmed injective survivor relation or allocate a new Room with a complete explicit seed. Any predecessor field not retained by an explicit disposition receives a complete loss acknowledgement. Never seed `Room.heightMm`, name/type/metadata, floor/ceiling or wall-side assignment from a Level/default/nearest Room; `Room.heightMm` remains the sole editable height source. |
| **Opening and wall-host transfer through split/merge** | Geometry Contract §8 leaves post-wall-edit Opening policy unresolved and forbids silent offset/host moves; §9 requires lineage/offset and conflict preview; PRD `FR-19`; Domain Model `WallPlacement` and §10 `AnchorRehostPolicy`; UX Experience §§5.1.1, 7, 9, 14. | **Compatible proposed completion** of an explicit open policy, but any persisted map/schema is a source-owned contract extension. | Use one fenced context and exact local spans/bases. Preserve one-to-one only when entirely contained with identical side/orientation; reject a crossing Opening/WallPlacement until a total split rule (forward and inverse) is owner-approved. No reverse/diagonal/nearest automatic rebase; no hidden world-space orphan. |
| **Wall-side identity, exterior and bridge walls** | Geometry Contract §9 and Domain Model §3 define `SurfaceAddress = WallSide(WallSegmentId, AdjacentRoomId|ExteriorSide)` and say side is not unstable left/right; PRD `FR-35`; SPEC `CAP-7`; Architecture Spine `AD-8`. | A physical `Left|Right` proof and two-exterior rule are **explicit proposed policy/schema detail** because current persistent address has one `ExteriorSide` token. | Keep the current semantic address; derive physical side only as validation evidence. A wall resolving exterior on both physical sides may exist with no hosted side value, but must reject a `WallSideAssignment`/`WallPlacement` rather than collapse two sides into one `ExteriorSide`. Do not silently version or reinterpret existing addresses. |
| **Ceiling/floor assignments and affected ceiling placements** | Domain Model `Room.surfaceAssignments`, `CeilingPlacement`, `SurfaceAddress`; Geometry Contract §§3 and 9; PRD `FR-34`–`FR-37`; SPEC `CAP-6`/`CAP-7`; Architecture Spine `AD-8`, `AD-14`. | Complete affected-set enumeration and explicit Keep/Move/Delete are **compatible safety detail**, while any durable ChangeSet schema is an explicit source extension. | Compute the full bounded base∪candidate ceiling-placement set after Room identity is resolved. Each member has exactly one explicit keep, fully specified move or confirmed delete with inverse; never nearest-room rehost. Floor/ceiling assignments participate in the same complete Room field disposition/loss acknowledgement. |
| **Resource pin, backup feasibility, grant and notice in topology impact** | SPEC `CAP-6`, `CAP-7`, `CAP-8`, `CAP-10`; Project/Backup Contract §1, §2 and §6; PRD `FR-28`, `FR-37`, `FR-38`, `FR-44`, `FR-46`, `NFR-10`, `NFR-13`; Architecture Spine `AD-4`, `AD-14`, `AD-17`; Catalog Control Plane contract Boundary/Availability. | **Compatible and mandatory**: R5 may not weaken this boundary. A digest envelope carrying resource proof is an explicit schema extension, not a bypass. | Every newly referenced asset/finish must carry exact pinned hash, backup-feasibility result, grant identity/scope and required notice placement before Durable publication. Missing/corrupt or unavailable unpinned bytes remain preview/recovery/catalog outcomes; no map/seed/host transfer can make them a Durable Project mutation. Control-plane availability never substitutes for local bytes or turns a healthy Project read-only. |
| **Project-scoped writer fence, policy identity, replay and session history** | Architecture Spine `AD-3`, `AD-4`, `AD-12`; Project/Backup Contract §1 and §6; Domain Model §§5–7; PRD `FR-5`, `FR-38`, `NFR-3`, `NFR-10`–`NFR-13`; Project Context “Domain and state” / “Local data”. | Base-revision/context fencing is **compatible**; recording an exact policy-bundle identity/bytes for history replay is a **proposed source extension** that needs owner adoption. | Every preflight/confirmation/replay is fenced to one Project, writer lease/fencing token, base Revision and policy-bundle identity. Reject stale base/no auto-rebase. Retain an existing undo/redo entry if its recorded policy is unavailable or cannot validate; surface a named integrity/recovery path rather than applying current policy, rewriting it or silently dropping history. `SessionRetentionPolicy` may reject a *new* command only. |
| **Exact FR-13 target language, metric witness and formatter** | PRD `FR-13`, `NFR-1`, `NFR-4`; SPEC `CAP-2`, Geometry Contract §§1, 4, 7, 11–12; Architecture Spine `AD-7`; UX Experience §5.1.1 and §14. | Closed target/witness/formatter rules are **compatible proposed completion** of open D-022 precision/locale policy. New reason codes and the exact format schema require reconciliation. | Accept only a closed exact source (canonical vertex, current usable boundary/vertex, metric-ready footprint boundary/vertex, or lossless numeric integer point). No renderer mesh point, sampled float or arbitrary touch enters metrics. For a healthy supported source use exact arithmetic and one product formatter across Preview/2D/3D/export; a cap or unresolvable source yields a named outcome, never approximate output or `MEASUREMENT_UNSUPPORTED`. |
| **C8 yaw for metric-ready asset footprints** | Domain Model leaves `RotationStep` unconstrained; Geometry Contract §9 uses `yawStep`; PRD `FR-29` permits rotate; SPEC `CAP-6`/`CAP-7`; Asset Import Contract §5; Project/Backup Contract §2 resource/metadata preservation. | Restricting new metric-ready Alpha catalog placements to rotation-only C8 is an **explicit material source delta**. | Do not round, reflect or silently migrate an existing arbitrary rotation. A future owner may admit only C8 at catalog/placement admission; legacy/non-C8 data remains intact/exportable but cannot pretend to be metric-ready until an explicit compatibility/migration policy and named outcome are adopted. |

## C. Non-negotiable cross-cutting safeguards for the R5 proposal

1. **No second source of truth.** `ExactRationalMm`, `Q2`, screen snapshots,
   face keys, metric witnesses, lineage proof and renderer objects remain
   detached/derived. They do not enter canonical Project JSON, Portable Backup
   or an unfenced history payload (SPEC Constraints 2–3; Geometry Contract §10;
   Architecture Spine `AD-1`, `AD-7`).
2. **No partial durability.** Every proposed map, seed, field disposition,
   host resolution, allocation and resource commitment must validate before one
   complete ChangeSet may enter `PendingDurability`; a reject/persistence
   failure leaves the preceding Durable Revision unchanged (PRD `FR-5`,
   `FR-12`, `NFR-3`; Geometry Contract §5; Spine `AD-3`).
3. **No invisible loss.** Absence is never “keep the default”: changed Room
   fields, side/ceiling transfers, dropped assets and discarded History require
   either exact retention, explicit target data, or an explicit acknowledged
   removal. This is the only safe reading of PRD `FR-15`, `FR-19`, `FR-38` and
   Project/Backup Contract §6.
4. **No library/renderer policy default.** Face ordering, C1–C4, miter,
   formatter, metric tie, rehost and Room reconciliation must be determinable
   from the proposed policy/corpus; external library ordering, float epsilon,
   viewport convention or nearest object cannot decide them (Geometry Contract
   §§4, 6–7, 12; Spine `AD-7`; UX Experience §14).
5. **No code/readiness inference.** The R5 corpus plan must include both
   forward and inverse bytes, stable outcomes, rejected-prior-Durable checks
   and source-owner reconciliation examples. It is planning evidence only;
   the official readiness report remains `NOT READY` and `AGENTS.md` still
   prohibits production implementation until a future gate/waiver permits it.

## Required owner hand-off after an independently accepted R5 policy

1. **Geometry Contract owner:** selection units/corpus, face traversal,
   hole/multi-ring choice, join rule, Room correspondence, host transfer,
   metric/yaw/reason-code rules and complete byte grammar boundary.
2. **PRD owner:** reconcile the explicit deltas with `FR-13`, `FR-15`,
   `FR-19`, `FR-28`, `FR-35`–`FR-38`, `FR-44`/`FR-46` and `NFR-1`–`NFR-4`,
   `NFR-10`–`NFR-13`, without reducing their user-visible guarantees.
3. **SPEC/backup/catalog owners:** adopt only those companion changes that
   preserve canonical JSON, self-contained backup, exact resource pinning,
   human AssetUsageGrant and notice obligations.
4. **Architecture/Domain owner:** version any accepted command/history/schema
   changes, retain `AD-1`–`AD-4` and `AD-7` boundaries, and do not turn a
   D-022 paper into an `AD-*` without the normal memlog/spine workflow.
5. **UX owner:** make changed Room/host/loss choices and each named
   undetermined/rejected state visible, correctable and accessible; UX must
   not decide a hidden tie, migration or fallback on its own.

## Non-disposition

This matrix does not accept R4, does not accept a future R5, does not amend
SPEC/PRD/UX/Architecture/Domain Model/project context, does not modify the
Architecture memlog, and does not create corpus, code, tests or configuration.
It grants no implementation authorization and does not change the official
`NOT READY` readiness verdict.

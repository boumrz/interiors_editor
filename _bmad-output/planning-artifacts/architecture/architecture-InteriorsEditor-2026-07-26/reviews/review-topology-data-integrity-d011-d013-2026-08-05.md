---
title: "Independent topology/data-integrity review — D-011…D-013 draft"
review_type: topology-data-integrity
reviewed: 2026-08-05
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
reviewer: "Codex /root/architecture_topology_review"
status: complete
verdict: NOT_READY
independence: "Lens 3; no source, test, spine, or memlog was modified."
---

# Verdict

**NOT_READY for a canonical Architecture Spine update.** The draft correctly
preserves the non-canonical boundary and the positive-integer `BigInt`
inequality is mathematically sound.  It nevertheless leaves four
implementation-level divergence points unspecified, and it conflicts with the
current FR-9 / delegated-X direction by treating X and T defaults as open.
Those gaps can produce different accepted Plans, command payloads, migrations,
and history behaviour in independently built units.

This is a review of a noncanonical input. It does not change `AD-7`, the
Geometry Contract, the PRD, `G-READY`, S-2's terminal status, or any readiness
gate.

## Reviewed authority

- `SPEC.md` and every declared companion, especially the glossary and Geometry
  Contract;
- PRD `FR-7`–`FR-13`, `NFR-1`–`NFR-4`, and the PRD Addendum;
- Architecture Spine `AD-1`, `AD-3`, `AD-4`, `AD-7`, `AD-11`, and `AD-12`,
  plus its domain-model companion and decision memlog;
- delegated change proposal, including §§4.2, 4.3 and 4.3.1;
- S-2 work package, policy-boundaries, and executable evidence report;
- UX Design and Experience contracts for preview, numeric alternatives, draft
  state, and rejected geometry.

The review also followed the BMad Architecture reviewer-gate guidance: the
parent spine is binding, a source conflict is surfaced rather than locally
overridden, and a data-integrity lens must name lower-level divergence before a
spine can be redistilled.

## What is sound in the draft

For a **positive integer** length `L`, the proposed condition

```text
(2n − 1)² < 2L² < (2n + 1)²
```

is the exact nearest-integer characterization of `n = round(L / √2)`. Equality
cannot occur: the boundary squares are odd while `2L²` is even. Therefore a
pure unbounded-integer helper can choose one unique `n` without `Math.sqrt` or
`Math.round`. The draft also correctly keeps zoom/display rounding out of a
Revision and requires full Plan validation after candidate construction.

Those properties hold only after the input has been reduced to a valid positive
integer magnitude and an unambiguous direction. The draft does not yet bind
that reduction.

## Critical finding

### TDI-01 — X/T cannot remain an open default in this reconciliation

The proposed AD-7 text says “X/T default behavior” remains open, and the
outside-the-delta list repeats an X choice between reject and automatic split.
That no longer matches the authority chain:

- PRD `FR-9` requires a geometric intersection to create the shared Vertex and
  required WallSegments atomically.
- Geometry Contract §6 already requires a T intersection to create a shared
  Vertex and split the affected wall.
- Delegated change proposal §4.3.1 selects the Alpha **working default** for a
  valid exact X: one shared Vertex and four canonical WallSegments, atomically;
  invalid/non-integer/out-of-limit/full-invariant failures reject before a
  Command or Revision mutation.

The working default is not yet a canonical ADR, but it is not safe to describe
as an unconstrained alternative. A future AD-7 amendment that leaves an
implementation free to reject an otherwise valid exact X would weaken FR-9 and
lose a delegated source input. Likewise, only **T selection/continuity and
merge details** remain open; basic T splitting does not.

**Required remediation before a canonical update:** reconcile one explicit
source-owned rule through `bmad-prd` + `bmad-spec` + `bmad-architecture`:
valid exact X and T intersections atomically materialise all necessary split
segments; non-integral, out-of-range, collinear-overlap, self-intersecting, or
otherwise invalid candidates reject intact. If a rejection default is desired,
the Product owner must first change FR-9; AD-7 cannot silently create that
exception. Preserve the unresolved kernel/tolerance question separately.

## High findings

### TDI-02 — `L` does not yet have a total numeric boundary

“Any signed integer millimetre” is broader than the Geometry Contract's
`signed safe integer` domain. `BigInt` removes intermediate arithmetic
overflow, but it does not repair a value already rounded by a JavaScript
`Number`, nor does it define what happens to a negative, fractional, nonfinite,
lexically malformed, or project-bound-exceeding requested length. The text only
gives a reason for `L = 0`.

This matters at two boundaries:

1. a UI/parser must not convert an imprecise number to `BigInt` and then claim
   canonical exactness;
2. `origin ± n` can exceed the safe-integer or Project coordinate bounds even
   when `L` itself parses successfully.

**Required remediation:** define a total `LengthMm` / input-parser contract
before normalization. It must distinguish at least:

- `L < 0`, fraction, `NaN`, infinity, invalid lexical form, and unsafe integer
  input → stable `INVALID_DIMENSION` (or a deliberately named replacement);
- `L = 0` → `ZERO_LENGTH` before constructing `n`;
- coordinates or resulting endpoints outside the documented safe/project range
  → `PROJECT_BOUNDS_EXCEEDED` before candidate publication;
- corrupt persisted numeric primitives → `SERIALIZATION_INVALID`, never a raw
  conversion exception.

Parse exact user text to an integer representation before any `Number`
conversion, use `BigInt` only for comparison/intermediate arithmetic, and
admit a result to the canonical JSON domain only after safe-integer and Project
limit checks. The canonical serialization remains integer-mm data; it must not
serialize an arbitrary unbounded `BigInt` merely because the helper can compute
one.

Required corpus rows include negative/negative-zero, zero, fractional,
nonfinite/malformed, `Number.MAX_SAFE_INTEGER` boundaries, project-bound
boundaries, and an origin-plus-normalized-delta overflow. Each rejected row
must prove an unchanged serialized Revision and no thrown exception.

### TDI-03 — the sign/direction contract is ambiguous

`±n × ±n` describes four possible endpoints, not one normalized candidate.
The draft never binds whether the signs come from a selected diagonal direction,
a raw endpoint, a raw delta, or a previous gesture. “Same
origin/quadrant/`L`” in the verification list is not a serializable command
contract. Different implementations can therefore flip a diagonal, infer a
direction after rounding, or treat a signed `L` as direction.

**Required remediation:** add an explicit, mutually exclusive normalized
request shape, for example:

```text
DiagonalLengthRequest {
  origin: PlanPoint,
  direction: NE | NW | SE | SW,
  lengthMm: PositiveLengthMm
}
```

The normalizer must construct exactly
`origin + signs(direction) × n`, then validate the final endpoints and full
Plan. Exact endpoint/delta input must instead preserve its supplied signs and
infer one allowed discrete direction; it must not be reinterpreted as a length
request. Persisted Revisions store only validated integer endpoints, never an
unresolved `±` choice. Add all four quadrants, reversed walls, negative-origin,
and out-of-bounds endpoint vectors to the golden corpus.

### TDI-04 — `SnapPolicy` has no lifecycle, migration, or serialized-form rule

Calling `SnapPolicy` “versioned pure” is insufficient. The domain model has
`Project.schemaVersion`, immutable Revision snapshots, `CommandEnvelope`, and
session History, but no policy ID/version or rule saying whether one is
persisted. Consequently two legitimate implementations can make different
choices about whether a policy change replays old gestures, changes newly opened
Projects, invalidates drafts, or affects backup/import.

The desired omission of visual-grid step from Plan state is correct, but it
does not decide the lifecycle of the semantic 100-mm/direction/normalization
policy.

**Required remediation:** the canonical update must choose and document one
compatible policy lifecycle. At minimum it must state all of the following:

1. `UiState` owns zoom and visible grid step; neither belongs in a Revision,
   Project backup, nor a History entry.
2. A durable Revision stores normalized endpoints only and is never
   re-normalized when a later `SnapPolicy` changes.
3. A `CommandEnvelope`/History record either carries an immutable
   normalization-policy version, or commands are explicitly non-replayable
   snapshots and the version is deliberately not persisted. The choice must be
   one, not an implementation preference.
4. The owner/location of the policy version, unknown-version behaviour,
   copy-on-write migration rule, ReleaseManifest compatibility check, and
   fixture matrix for old Project/imported Backup are defined.
5. An active DraftCommand's policy/version transition is explicit (retain the
   already selected candidate, rebuild only by an explicit action, or cancel
   with a stable reason); it is never silently rounded or mutated by zoom or an
   app update.

This is a new open policy that the current draft must expose; it cannot be
hidden in “separately versioned policies.”

### TDI-05 — candidate construction needs an explicit no-partial-mutation seam

AD-3 and Geometry Contract §5 already require an atomic full ChangeSet, but the
new numeric normalizer is a new entry path and the proposed replacement does
not make its failure boundary explicit. In particular, an invalid `L`, a
post-normalization crossing, Room reconciliation conflict, Opening conflict,
or host reconciliation failure must not leak a vertex/split/Room mapping into
current state, history, autosave, projections, or `PendingDurability`.

**Required remediation:** bind the sequence for both gesture and numeric input
as:

```text
total parse → detached normalize → detached candidate/complete ChangeSet
→ full topology/Room/Opening/host validation → Validated | Rejected
→ only Validated may enter PendingDurability
```

`Rejected` must retain the current Durable Revision byte-for-byte, create no
HistoryEntry/autosave/projection publication, and return a stable reason plus
safe field context. A draft may show a rejected preview, but it remains UI-only
and cannot become the base for the next mutating Command. Include stale
`baseRevisionId` and persistence-failure assertions so the new policy does not
weaken the existing command fence.

## Medium findings

### TDI-06 — the “still open” list is partly too broad and partly incomplete

The following distinction is needed before redistillation:

| Topic | Accurate state after the reviewed sources |
| --- | --- |
| D-011–D-013 | Delegated working policy, awaiting owner-workflow canonicalization; not reopened as arbitrary implementation choice. |
| Exact T split | Already required by Geometry Contract §6; only selection/continuity details remain open. |
| Exact valid X split | Delegated working default and aligned with FR-9; exact canonical wording/corpus/kernel+tolerance remain open. |
| Merge, room identity, opening relocation | Candidate directions exist in the change proposal, but their canonical rule, fixtures, preview, and owner reconciliation remain open. |
| Usable polygon | The companion already specifies a provisional inward offset, miter cap, and deterministic bevel. Its rounding/corpus and any change to that rule remain open; it is inaccurate to describe the entire join behaviour as unconstrained. |
| Snap priority/tolerance, measurement display rounding, kernel | Still genuinely open and must remain an explicit Deferred/open question. |
| SnapPolicy version/migration | Newly surfaced and genuinely open; must be added to the explicit list. |

This correction prevents a future implementation from treating a currently
bound source rule as optional, or treating a genuinely unresolved lifecycle
choice as already decided.

### TDI-07 — verification must prove the exact comparison and durable boundary together

The existing five verification bullets are a useful start, but they do not
cover the parser/range/direction/migration cases above. The canonical gate needs
property and golden tests which prove, without authoritative float arithmetic:

- for every accepted bounded positive `L`, the returned `n` satisfies the two
  strict `BigInt` inequalities and is unique;
- the selected `ConstrainedDirection` produces exactly one endpoint pair in
  each quadrant;
- gesture and numeric routes reach the same complete validator after their
  intentionally different selection policies;
- a rejected numeric candidate leaves Revision bytes, history, writer state,
  autosave signal, and derived projection publication unchanged;
- schema/policy migration and Portable Backup import never renormalize old
  endpoints, and safely handle a recognized versus unknown policy version.

The S-2 prototype's fractional/corrupt-revision negative evidence is valuable,
but it is not a substitute for this production-independent corpus or the
required source-owner reconciliation.

## Required disposition before any canonical update

1. Mark this draft **blocked for canonicalization** until TDI-01 through
   TDI-05 are remediated in the draft/input package.
2. Route the FR-9/X wording through `bmad-prd`, then use `bmad-spec` to
   re-derive the Geometry Contract companion; do not make AD-7 override a PRD
   consequence.
3. Add the total numeric, direction, policy-lifecycle, atomicity, and X/T
   golden/property/migration cases as evidence requirements. They must be
   independent of disposable S-2 source.
4. Only after that reconciliation, append the decision/migration/open-question
   entries through `memlog.py`, redistill AD-7 with its stable ID, and run the
   full BMad Architecture reviewer gate (lint, rubric, configured lenses, and
   this data-integrity lens).
5. Keep `S-2`, `G-READY`, production bootstrap, and physical NFR-15 gates
   unchanged. This review is not a terminal spike verdict or authorization for
   product code.


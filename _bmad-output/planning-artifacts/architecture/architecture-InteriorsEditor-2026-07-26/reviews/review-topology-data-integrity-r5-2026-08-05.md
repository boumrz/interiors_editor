---
title: "Independent topology/data-integrity re-review — D-011…D-013, revision 5"
review_type: topology-data-integrity-rereview
reviewed: 2026-08-05
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
reviewed_revision: 5
reviewer: "Codex /root/architecture_topology_review"
status: complete
verdict: ACCEPTABLE_AS_PRECANONICAL_INPUT
readiness: NOT_READY
independence: "Fresh lens-3 re-review. No Spine, memlog, source contract, test, or application artifact was modified."
---

# Verdict

**`ACCEPTABLE_AS_PRECANONICAL_INPUT`; implementation readiness remains
`NOT_READY`.** Revision 5 closes the data-integrity blockers from the prior
lens-3 review and the R4 current-source/adversarial re-reviews. It is suitable
as an input to the next, source-owning `bmad-architecture` update; it is not an
adopted amendment to `AD-7`, a geometry/SPEC/PRD/UX update, a terminal S-2
verdict, or authorization for implementation.

The acceptance is deliberately narrow. The next workflow must still reconcile
FR-9 and the Geometry Contract through their owners, choose the canonical
serialization/import reason, redistill the Spine from its memlog, and repeat
the full reviewer gate against that distilled Spine. `G-READY` remains
`NOT_READY`.

## Review basis and link integrity

Read-only review covered revision 5, every `sources` and `review_inputs` path
named in its frontmatter, and all prior topology-policy outputs:

- initial current-source, adversarial, and topology/data-integrity reviews;
- revision-4 current-source and adversarial re-reviews; and
- the available revision-5 adversarial re-review.

All eleven declared source paths and all five declared prior-review paths
resolve locally. The binding sources compared include `AD-3`, `AD-7`, `AD-11`,
and `AD-12`; Geometry Contract §§1, 3–6 and 10–12; PRD `FR-7`–`FR-13`,
especially `FR-9`; the glossary/Portable Backup contract; UX numeric/draft and
persistence states; delegated clarifications §§4.2.1 and 4.3.1; and S-2's
nonterminal evidence boundary.

Read-only mechanical checks:

- the current Spine lint passes with zero findings;
- the declared integer-token grammar accepts canonical signed integers
  (including raw `-0`) and rejects decimal, exponent, unsafe-looking, `+`,
  whitespace, and nonfinite forms before number materialization;
- an independent `BigInt` probe verified the strict normalization predicate
  for every `L = 1…100000`, `Number.MAX_SAFE_INTEGER`, and an arbitrary
  much-larger integer; it found no normalization for `L = 0`;
- an off-grid origin exercised all eight `100 × direction` relative-step
  candidates without losing the exact cardinal/45-degree delta relation.

## Focused data-integrity assessment

### 1. Lossless persistence/import ingress — accepted

Revision 5 no longer treats `Number.isSafeInteger` after ordinary `JSON.parse`
as evidence that a wire value was an integer. Its proposed rule requires a
schema-aware decoder to retain and validate the raw numeric lexeme before host
IEEE-number materialization, and allows a typed runtime number only through the
validated `SafeIntegerMm` boundary. This closes the prior counterexample where
`99999.000000000000001` could become the valid integer `99999` before a
validator saw it.

The rule correctly keeps `BigInt` ephemeral and excludes it from Project,
Revision, History, Command payloads, and Portable Backup. It also checks both
input and normalized endpoint against `ProjectLimitsPolicy`. The eventual
stable serialization/import reason remains explicitly owned by `bmad-spec` and
the Project/Backup contract; that is appropriate for a pre-canonical
architecture input and does not copy S-2's experimental reason code.

### 2. Total numeric and exact-diagonal boundary — accepted

The new order is complete for the relevant geometry values:

```text
lossless token → SafeIntegerMm + ProjectLimitsPolicy → ephemeral BigInt
→ endpoint limit check → detached candidate/full validation
```

It distinguishes negative `L` (`INVALID_DIMENSION`), zero including normalized
`-0` (`ZERO_LENGTH` before direction logic), malformed/fractional/nonfinite or
unsafe interactive values (`INVALID_DIMENSION`), and limit failures
(`PROJECT_BOUNDS_EXCEEDED`). No rejected path may reach raw conversion
exceptions or a canonical candidate.

For positive integer `L`, the stated inequality

```text
(2n − 1)² < 2L² < (2n + 1)²
```

is correct and unique: boundary squares are odd whereas `2L²` is even, so no
half-way tie exists. The explicit `DiagonalLengthRequest` direction makes the
sign unambiguous; normalization changes magnitude only, never quadrant.

### 3. Origin-relative 100-mm candidate and off-grid input — accepted

The revision adopts the delegated clarification rather than inventing a global
lattice. A gesture candidate is `origin + (100 × k) × d`, with `k > 0` and a
selected permitted unit direction. Thus an off-grid start retains an exact
45-degree result. Exact numeric endpoint/delta input preserves its own signs,
bypasses gesture selection, and is not forced onto the 100-mm increment.

The remaining tolerance/tie/hysteresis and `k`-selection questions are visibly
deferred. They cannot silently become geometry-library defaults, which keeps
the remaining `D-022` scope honest.

### 4. Accepted contact partitioning and no partial topology — accepted

Revision 5 now defines all required exact contact cases before full validation:

- equality with an endpoint reuses that Vertex;
- endpoint/interior contact follows the already-required T split;
- an accepted segment with multiple exact interior contacts creates/reuses one
  common Vertex per distinct coordinate and partitions the proposed and every
  affected segment at all ordered contacts;
- resulting pieces must be distinct and non-zero; duplicate, too-short,
  non-integral, out-of-limit, overlapping, self-intersecting, or otherwise
  invalid candidates reject as one whole candidate.

This rules out competing first-intersection-only, coincident-Vertex, and
partially split outcomes. A valid single X remains the one-Vertex/four-piece
case from the delegated working default. The rule does not force acceptance of
an otherwise invalid multi-contact candidate or select a geometry library.

### 5. Shared validator and AD-3 outcomes — accepted

Gesture and numeric selection may differ, but both now pass the same detached
parse/normalize/candidate/complete-ChangeSet/full-validation sequence. A
pre-validation rejection preserves the current Durable Revision byte-for-byte,
creates no `PendingDurability`, HistoryEntry, autosave, or canonical projection
publication, and exposes only preview/reason context.

The revision correctly distinguishes a later persistence failure: the current
Durable Revision and History remain current, no false saved/Durable projection
is published, but the pending candidate/journal remains only for retry or
recovery export and fences the next mutating commit. A stale worker result is
discarded under AD-12, not mislabeled as persistence failure. This conforms to
AD-3 rather than weakening it.

### 6. Remaining `D-022` scope — accepted as explicit Deferred work

The draft does not falsely close the topology/kernel decision. It keeps open:

- concrete tolerance/tie/hysteresis and the gesture selection of `k`;
- geometry-kernel/library choice and cross-environment corpus;
- T/X selection continuity, merge UI consequences, Room reconciliation, and
  opening relocation;
- measurement precision/locale; and
- usable-polygon rounding/corpus and any change to its existing provisional
  offset/miter/bevel behaviour.

The delegated valid-X working default is correctly treated as a source-routing
input aligned with FR-9, not as proof that the current PRD/SPEC/Architecture
wording has already been reconciled. This preserves the distinction between
product semantics required for a valid accepted candidate and the remaining
`D-022` implementation/kernel evidence.

## Non-blocking carry-forward detail

When source owners distill the candidate wording, the diagonal preview should
present the actual **selected signed** delta rather than a generic `±n × ±n`
placeholder. Revision 5 already binds direction and resolved endpoints, so
this is an editorial/UX precision point, not a remaining state or persistence
divergence.

## Required next gate

1. Run the fresh `bmad-architecture` update only from this accepted input:
   use `memlog.py`, retain `AD-7`'s ID, and distill rather than copy the long
   candidate text verbatim into the Spine.
2. Reconcile FR-9 and the Geometry Contract via `bmad-prd` and `bmad-spec`,
   including the stable serialization/import reason mapping and raw-decoder
   fixture ownership.
3. Add the listed independent corpus/migration cases; S-2 remains evidence
   input only and its source must not be promoted.
4. Run lint, rubric, current-source/reality, adversarial, and
   topology/data-integrity lenses against the resulting canonical Spine.
5. Keep all unrelated blockers unchanged: `S-2` nonterminal evidence, `G-1`,
   control-plane ADR, AssetUsageGrants, physical NFR-15 traces, and final
   implementation-readiness review.


---
title: "InteriorsEditor — current-source/reality re-review: D-011…D-013, revision 4"
review_type: current-source-reality
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
artifact_revision: 4
previous_review: review-current-source-topology-policy-2026-08-05.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
readiness: NOT_READY
scope: "read-only re-review of revision 4; no canonical source, Spine, memlog, prototype, or implementation mutation"
source_mutations: none
---

# Current-source/reality re-review — revision 4

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`; `NOT_READY` remains unchanged.**

Revision 4 resolves the previous draft's direction/scalar ambiguity, global
lattice ambiguity, X/T routing, detached atomic validation sequence, and
cross-surface measurement seam. It also correctly retains the non-canonical
boundary, does not promote S-2, and does not claim any device or production
evidence.

It is nevertheless not yet an acceptable input for redistilling AD-7. Its
claimed safe JSON boundary is not lossless after ordinary JSON parsing: a raw
fractional JSON literal can be rounded to an in-range safe JavaScript integer
before `Number.isSafeInteger` sees it. The policy lifecycle also splits the
existing `SnapPolicy` into unbound new terms, so the version carried with an
intent need not identify every rule that formed its endpoint. Both gaps permit
two compliant lower-level units to accept different canonical Plans.

This is a documentation-only review. It neither changes an authority source nor
advances `G-READY`, S-2, the waiver boundary, physical `NFR-15`, or production
authorization.

## Method and current sources

Read-only comparison covered revision 4, the previous current-source review,
the adversarial and topology/data-integrity reports, current SPEC and all
relevant companions, PRD, UX Experience/Design, Architecture Spine,
domain-model/solution-design companions, project context, delegated change
proposal, and S-2 work-package/policy-boundary/test evidence.

Mechanical checks were intentionally read-only:

- The exact-integer predicate was checked for every `L = 1…100000` and
  `Number.MAX_SAFE_INTEGER`: `formula_check=PASS`.
- `uv run .agents/skills/bmad-architecture/scripts/lint_spine.py --workspace
  _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26`
  returned `ok: true`, `0` findings.
- A raw JSON counterexample was parsed by Node before the numeric validator:

  ```text
  JSON.parse('{"value":99999.000000000000001}').value === 99999
  Number.isSafeInteger(99999) === true
  JSON.parse('{"value":1.00000000000000001}').value === 1
  Number.isSafeInteger(1) === true
  ```

  The input literals are fractional, but each becomes an in-range integer
  before the proposed `Number.isSafeInteger` check.

## Closure of the previous findings

| Previous finding | Revision-4 result | Current-source assessment |
| --- | --- | --- |
| `CS-TP-01` — total length boundary | Negative, zero/lexical `-0`, malformed, non-finite, unsafe, ProjectLimits and post-normalization endpoint cases are named; `BigInt` is ephemeral. | **Partly closed.** The UI/programmatic-value boundary is strong, but raw persisted JSON still loses fractional lexemes before it reaches that boundary; see R4-CS-01. |
| `CS-TP-02` — scalar and signs | The rule now gives `delta = k × d`, `k > 0`, the complete eight-direction set, explicit quadrant for a length request, and preservation of endpoint/delta signs. | **Closed.** It matches Geometry Contract §§1/4 and removes pointer-history inference. |
| `CS-TP-03` — X conflict | Exact T splitting remains mandatory; the delegated valid exact-X split is explicit, while PRD/SPEC/Architecture owner reconciliation remains a stated gate. | **Closed as a pre-canonical routing decision.** It does not falsely claim that the current PRD/geometry contradiction is already canonical. |
| `CS-TP-04` — policy lifecycle | Resolved endpoints are not re-normalized; intent/history, unknown-version, migration, ReleaseManifest and active-draft behavior are all addressed. | **Partly closed.** The lifecycle is materially improved, but `SnapPolicySpec`, `SnapPriorityPolicy` and `normalizationPolicyVersion` are not bound to the one existing `SnapPolicy` contract or to one complete version scope; see R4-CS-02. |

## Confirmed revision-4 improvements

- The total detached sequence at draft lines 101–108 preserves AD-3 and
  Geometry Contract §5: rejected work has no Revision, history, autosave,
  projection publication, or pending candidate.
- `ProjectLimitsPolicy` is grounded by the Project-and-Backup Contract §1;
  checking both source inputs and the normalized endpoint correctly prevents
  the `origin + n × direction` overflow class.
- The global 100-mm lattice anchored at Plan `(0,0)`, its stated precedence,
  and the numeric off-grid bypass resolve the earlier local-vs-relative grid
  divergence without making zoom canonical.
- Exact T splitting and the delegated valid exact-X four-piece split now match
  the change proposal §4.3.1 and the product direction in PRD FR-9. Invalid
  intersections remain rejected atomically. Kernel, tolerance and UI
  continuity are honestly left open.
- The exact diagonal predicate is mathematically sound for a positive integer
  `L`; odd boundary squares cannot equal `2L²`. The explicit quadrant binds the
  selected sign, while full Plan validation still rejects a too-short or
  out-of-limit normalized result.
- One `MeasurementFormatPolicy` consuming exact squared length is a valid
  pre-canonical seam for PRD FR-13: no 2D, 3D, preview, or export adapter may
  independently round and formatted text never becomes command input.

## Blocking findings

### R4-CS-01 — High: `Number.isSafeInteger` after JSON parsing is not a lossless persisted-data boundary

**Evidence.** Draft lines 83–96 and 210–218 allow a programmatic JSON number
when `Number.isSafeInteger(...)` succeeds, and promise that a malformed
persisted primitive rejects as `SERIALIZATION_INVALID`. JavaScript's ordinary
`JSON.parse` materializes a Number before that validation. The mechanical
counterexample above turns a fractional literal into a safe, in-project-range
integer, so an implementation following the wording can accept a value that
the rule says must reject as fractional.

This is not fixed by a JSON reviver: it also receives the already-rounded
Number. It affects `project.json`, imported Portable Backup data, and any
serialized command/revision envelope, not only an interactive `L` field.
Geometry Contract §1 requires integer-mm canonical data, §10 requires safe
serialization/migration, and AD-2 requires plain serializable values; none
permit a raw parser to silently rewrite a fractional literal into geometry.

**Required closure.** Add one explicit persisted/import numeric boundary:

1. Retain each raw JSON numeric lexeme (or use an equivalently lossless,
   schema-aware decoder) before JavaScript Number materialization.
2. Accept only the selected canonical integer grammar and range at that
   boundary; reject decimal/exponent/unsafe lexemes before arithmetic, then
   map the rejection to the approved stable serialization reason.
3. Apply it to every persisted coordinate, dimension, offset, delta and
   command payload, and add raw-byte backup/Project fixtures for both examples
   above plus unsafe values and lexical `-0`.

The existing UI token parser is not a substitute for this storage/import path.

### R4-CS-02 — High: policy-version scope is ambiguous and introduces unbound policy names

**Evidence.** The architecture domain model already owns one pure
`SnapPolicy`. Revision 4 first puts precedence/tolerance/tie/hysteresis in
`SnapPriorityPolicy` (draft lines 133–136), then defines an
application-owned `SnapPolicySpec` with a `normalizationPolicyVersion`
(lines 138–154). It never states that these are parts of one immutable policy,
nor that the carried version identifies the global lattice origin, precedence,
tolerance, tie handling, hysteresis, direction set and diagonal
normalization together.

Consequently one implementation can version only the diagonal formula while
another versions its `SnapPriorityPolicy`; both can claim to retain the same
`normalizationPolicyVersion` but form different endpoints for the same intent.
The current AD-11 `ReleaseManifest` lists build/protocol/schema/catalog and
capabilities, not a policy-version range, so invoking it alone does not define
that compatibility contract.

**Required closure.** Reuse or explicitly extend the canonical `SnapPolicy`
term rather than introduce parallel synonyms. Define one immutable policy
identity whose version covers every endpoint-forming rule; define the registry
and ReleaseManifest compatibility mapping for that identity; and say exactly
which `CommandEnvelope`/History/Draft fields record it. Retain the important
rule that Durable Revisions store resolved endpoints only and never
re-normalize.

### R4-CS-03 — Medium: `SERIALIZATION_INVALID` is proposed as stable but has no canonical reason-code owner yet

The draft uses `SERIALIZATION_INVALID` as a stable reason in both proposed
texts. Current Geometry Contract §11 does not include it in the minimal stable
reason-code union; it appears only in non-promotable S-2 evidence. The proposed
companion change is scoped to §§4 and 6, so a literal owner workflow could
leave the error contract incomplete.

**Required closure.** `bmad-spec` must either add the code and its safe-context
semantics to the canonical error contract (including serialization/import
fixtures), or choose and document an existing stable mapping. This is not an
authorization to copy an S-2 reason code into production without owner review.

## Required owner workflow and gates

1. Produce a revised non-canonical reconciliation input that closes
   R4-CS-01…03, then obtain fresh current-source, adversarial lower-level, and
   topology/data-integrity re-reviews. Earlier rejection reports do not review
   the corrected text.
2. Only after those inputs are accepted, run a fresh `bmad-architecture`
   **update**: append decisions/assumptions through `_bmad/scripts/memlog.py`,
   preserve `AD-7`, re-distill the Spine, run the spine lint and the rubric
   walker, then re-run all three reviewer lenses against the distilled result.
3. Route the owned source changes through `bmad-prd` (FR-9 intersection
   wording), `bmad-spec` (geometry §§4/6/10/11 and any companion re-derivation)
   and `bmad-ux` (gesture/numeric feedback, measurement and acceptance paths).
   Update `project-context.md` only after adoption.
4. Build independent, non-S-2 production corpus evidence for raw
   serialization, limits, all direction/quadrant cases, global-lattice
   precedence, X/T atomicity, policy-version migration, measurement formatting
   and unchanged durable-state failures. S-2 remains
   `needs-further-evidence`; no prototype source is promoted.
5. The broader readiness gates remain: evidence-backed terminal spikes,
   `G-1` research, the bounded `G-CP-ADR`, human AssetUsageGrants, all eight
   physical `NFR-15` traces, and a final official `READY`. None is relaxed by
   this review.

Until these steps are complete, no root scaffold, production code, production
test/configuration, release claim, or commit is authorized by this document.

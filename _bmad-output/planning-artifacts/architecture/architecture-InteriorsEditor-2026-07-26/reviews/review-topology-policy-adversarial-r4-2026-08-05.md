---
title: "Adversarial re-review — topology-policy reconciliation draft revision 4"
date: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewer_lens: "adversarial lower-level divergence re-review"
reviewed_artifact: "../topology-policy-reconciliation-draft-2026-08-05.md"
reviewed_revision: 4
scope: "D-011, D-012, D-013 and delegated valid-X source routing"
verdict: "REJECT_FOR_PRECANONICAL_INPUT"
implementation_ready: false
spine_changed: false
memlog_changed: false
---

# Независимый adversarial re-review: revision 4

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`.** Revision 4 correctly fixes several
earlier issues, but it still contains five P1 lower-level divergence or source
scope failures. It must not yet be used as the clean input for a
`bmad-architecture` update.

This is deliberately narrower than an implementation-readiness verdict:
`G-READY` remains `NOT_READY`, but the decision here is only that the current
draft needs another documentation correction before canonicalization workflow
starts. No Spine, `.memlog.md`, source contract, production code, test,
configuration or evidence status was changed by this review.

## What revision 4 did fix

| Earlier concern | Re-review result |
| --- | --- |
| Positive-integer diagonal predicate | Accepted. The strict odd-square / even-value argument is correct after a valid bounded integer input exists. |
| T split and valid-X source routing | Accepted in principle. Revision 4 now preserves mandatory T split and follows the newly recorded delegated valid-X working default rather than treating either as an arbitrary library choice. |
| Explicit direction scalar and quadrant | Accepted in principle: the `k × d` rule and `DiagonalLengthRequest` remove the prior sign ambiguity. |
| Shared detached validation path | Materially improved, but its persistence-failure assertion now contradicts AD-3 (P1-R4-4). |
| One measurement-format seam | Accepted as a good pre-canonical seam; concrete locale/precision may remain deferred. |

## P1 findings — correct before this becomes a pre-canonical input

### P1-R4-1 — `Number.isSafeInteger` after JSON parsing does not reject every fractional input

Revision 4 requires raw UI text to match an integer token, but separately says
that a programmatic JSON number is accepted when `Number.isSafeInteger(...)`
is true ([draft lines 81–96](../topology-policy-reconciliation-draft-2026-08-05.md#L81-L96)). That check occurs after a standard JSON/JavaScript parser may
already have rounded the lexical value.

Read-only probe in the planned runtime demonstrates the counterexample:

```text
JSON.parse("9007199254740991.1") → 9007199254740991
Number.isSafeInteger(...)          → true
JSON.parse("9007199254740990.9") → 9007199254740991
Number.isSafeInteger(...)          → true
```

Thus one unit that receives a raw JSON number can silently admit a fractional
token as a different safe integer, while a UI unit correctly rejects that same
lexical value. It defeats the draft's stated `INVALID_DIMENSION` boundary and
the canonical signed-safe-integer requirement
([geometry contract lines 11–15](../../../specs/spec-interiors-editor-alpha/geometry-contract.md#L11-L15)). A programmatic `-0` also passes the safe-integer check and needs the same
normalization as lexical `-0`.

**Required correction.** Do not treat a parsed JavaScript `number` as proof of
an integral wire value. Choose one exact ingress rule and use it for UI,
programmatic and import data:

> Untrusted numeric input is either an integer-string token validated before
> conversion, or a raw JSON number token validated by the import/parser before
> JavaScript numeric parsing. A typed runtime `number` is accepted only when it
> originated from that validated `SafeIntegerMm` constructor. `-0` is normalized
> before length/delta classification. `Number.isSafeInteger` is a final runtime
> guard, never the sole lexical validator.

The corpus must add the two fractional-to-safe examples above, an exponent
token if the wire grammar excludes it, and programmatic negative zero.

### P1-R4-2 — global lattice plus off-grid start leaves 45° gesture construction undefined

The draft now fixes a global lattice and candidate precedence
([draft lines 122–136](../topology-policy-reconciliation-draft-2026-08-05.md#L122-L136)), while D-013 continues to allow off-grid exact numeric vertices
([change proposal lines 98–100](../../sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md#L98-L100)). It never defines how the 100-mm lattice composes with a
constrained-direction candidate from such a Vertex.

For an allowed start `(125, 0)` and an NE diagonal, every global-lattice end is
`(100a, 100b)`. The required diagonal equation is
`100a − 125 = 100b`, or `100(a − b) = 125`, which has no integer solution.
The same issue occurs in the other diagonal quadrants. Consequently one lower
level may use an off-grid directional projection, another may use a start-local
100-mm increment, and a third may reject the gesture. The existing wording
allows all three: it ranks a “constrained-direction candidate” before the
lattice but gives neither its quantization frame nor its no-solution outcome.

The draft also labels the global anchor and full precedence as “delegated
working” even though the recorded D-011…D-013 packet chooses a 100-mm base
step but does not record the global-origin/relative-start decision. The
geometry companion's priority is only provisional.

**Required correction.** Make this an explicit source-owned policy decision,
not an implied consequence of D-011. The policy must choose one total rule for
an off-grid start, for example a documented origin-relative constrained step,
a documented global-lattice fallback plus a numeric alternative, or a stable
rejection. It must state the selected candidate frame, no-solution behavior and
the precedence after that choice. Until then mark the global-lattice claim as a
candidate/assumption and keep it out of the proposed AD-7 replacement.

Required golden cases include off-grid start × each cardinal/diagonal direction,
attachment to an off-grid vertex, and a pointer position for which global grid
and constrained projection disagree.

### P1-R4-3 — the new policy-version lifecycle leaks into AD-3/AD-4/AD-11 and contradicts backup/history boundaries

The draft proposes `SnapPolicySpec`, `normalizationPolicyVersion`,
`CommandEnvelope`, compatibility registry, copy-on-write migration and
`ReleaseManifest` behavior ([draft lines 138–154 and 227–243](../topology-policy-reconciliation-draft-2026-08-05.md#L138-L154)). This is no longer “amend AD-7 only”: it changes the
semantic form and migration of Commands/History and the PWA release handshake.

More importantly, its own rules cannot all be true together:

- a durable Revision stores only resolved endpoints;
- policy version is carried only by an intent-bearing CommandEnvelope/History;
- session History is not included in Portable Backup
  ([glossary lines 32–35](../../../specs/spec-interiors-editor-alpha/glossary.md#L32-L35), [backup contract lines 104–108](../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md#L104-L108)); yet
- verification requires recognized/unknown `normalizationPolicyVersion` cases
  for Portable Backup import ([draft lines 275–278](../topology-policy-reconciliation-draft-2026-08-05.md#L275-L278)).

There is no policy version in that stated backup payload for import to inspect.
Conversely, persisting it in Project/backup just to exercise the test creates a
new schema and migration field the draft says it avoids. `DraftCommand` is also
a non-Revision preview, while AD-11 only promises a user-mediated reload after
a Durable Revision; it does not promise a draft can survive a code/policy
upgrade ([AD-11 lines 221–234](../ARCHITECTURE-SPINE.md#L221-L234)).

**Required correction.** Choose one bounded lifecycle before redistillation:

1. **Recommended minimal route:** resolved endpoint ChangeSets are the only
   durable/history semantics; input intents and policy versions are
   session-local construction metadata. A release never re-normalizes a
   Revision. An active DraftCommand is retained only while the same app session
   remains alive; update/reload is deferred until explicit cancel/confirm, and
   a reload restores the last Durable Revision. Remove policy-version/unknown
   policy cases from Portable Backup.
2. **If intent replay must be durable:** widen the architecture change beyond
   AD-7, define the new vocabulary and serialized envelope/schema, update the
   Project/backup contract and AD-3/AD-4/AD-11 together, and prove
   copy-on-write import/migration semantics. It cannot be silently introduced
   by this geometry delta.

In either route, use one policy name and version scope. The current draft has
both `SnapPriorityPolicy` and `SnapPolicySpec`, but only the latter receives a
version; an intent replay could still change its candidate when priority,
tolerance or tie handling changes.

### P1-R4-4 — persistence failure is incorrectly grouped with rejection in the required proof

The exact AD-7 candidate text correctly says a *Rejected* candidate has no
pending state ([draft lines 101–108](../topology-policy-reconciliation-draft-2026-08-05.md#L101-L108)). But verification item 4 says the same no-pending/no-publication
result also holds for a persistence failure ([draft lines 266–270](../topology-policy-reconciliation-draft-2026-08-05.md#L266-L270)). That conflicts with adopted AD-3: after validation, a failed
persistence operation leaves the last Durable Revision current **and keeps the
candidate available for retry/recovery export**
([AD-3 lines 103–110](../ARCHITECTURE-SPINE.md#L103-L110)). UX likewise requires a distinct
`PendingDurability` candidate/journal and retry/recovery path
([UX lines 389–392](../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md#L389-L392)).

**Required correction.** Split the verification and state transitions:

- parse/normalization/topology/validation/stale-base rejection: no
  `PendingDurability`, HistoryEntry, autosave, canonical projection publication
  or Command mutation;
- persistence failure after a Validated ChangeSet: current Durable Revision and
  History remain unchanged, no false `saved` claim or Durable projection is
  published, **but** the pending candidate/journal remains available only for
  retry or recovery export and fences the next mutating commit as AD-3 requires.

`baseRevisionId` is a worker-job fence under AD-12, so only stale worker output
should be tested as a rejection; it should not be conflated with a failed
repository publication.

### P1-R4-5 — exact numeric contacts and multi-X candidates have no total topology canonicalization rule

“Exact numeric input bypasses gesture selection” is correct, but the draft
does not state what happens when its endpoint equals an existing Vertex, lies
on an existing Wall interior, or when one proposed segment crosses more than
one existing Wall. The new X wording says “one shared Vertex and four pieces”
([draft lines 170–178](../topology-policy-reconciliation-draft-2026-08-05.md#L170-L178)); that describes one interior/interior X, not a candidate with several
exact crossings.

Independent units can therefore reuse an exact matching Vertex, reject it, or
create a second coincident Vertex; split every crossing, split only the first,
or reject multi-crossing input. The first/last outcomes can violate the planar
graph requirement that an intersection be represented by shared split topology
([geometry contract lines 61–74 and 149–159](../../../specs/spec-interiors-editor-alpha/geometry-contract.md#L61-L74)). They also make the numerical route behave differently from
the stated `FR-9` add-to-existing-Vertex path.

**Required correction.** Add a topology-normalization sentence that applies
before full validation:

> Numeric input bypasses only visual/gesture snap selection. Exact coordinate
> equality reuses the existing Vertex; exact endpoint/interior contact follows
> the required T rule. For a proposed segment with multiple exact interior
> crossings, the accepted candidate atomically partitions every affected
> segment at every accepted intersection, or the whole candidate is rejected by
> an explicitly named policy. It never creates a coincident Vertex, leaves an
> unsplit crossing or commits a first-intersection-only result.

The implementation may still keep selection continuity, Room reconciliation,
merge and kernel choice deferred. This rule only makes the accepted Plan
topologically total.

## P2 observations

1. Write the direction predicate in zero-safe form rather than relying on the
   prose precondition: `ZERO_LENGTH` must be selected before the
   `abs(dx) = abs(dz)` branch, including programmatic `-0`.
2. Replace “`BigInt` only as normalization arithmetic” with “ephemeral exact
   geometry arithmetic” if a later selected kernel needs it for intersection
   predicates. The important constraint is non-persistence, not needlessly
   forbidding exact transient arithmetic outside the diagonal helper.
3. Define the set meant by “every supported runtime” for the predicate corpus;
   it must not imply unverified Kotlin/control-plane ownership of local Project
   geometry or substitute browser emulation for NFR-15.

## Gate disposition

- Revision 4 is not yet an acceptable clean input for the canonical
  architecture update. Correct P1-R4-1…P1-R4-5, then obtain fresh independent
  re-reviews rather than carrying this verdict into the Spine gate.
- The earlier T/X and measurement remediations may be retained; no source
  change in this review reopens the delegated valid-X working default.
- Keep `S-2` `needs-further-evidence`, keep all source-owner routing
  (`bmad-prd`, `bmad-spec`, `bmad-architecture`) explicit, and do not append to
  `.memlog.md` until a correctly scoped canonical update begins.
- `G-READY` remains `NOT_READY`; no product scaffold, code/test/configuration
  change, release claim or commit is authorised by this re-review.


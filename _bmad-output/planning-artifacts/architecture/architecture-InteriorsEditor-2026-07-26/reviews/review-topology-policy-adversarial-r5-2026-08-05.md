---
title: "Adversarial re-review — topology-policy reconciliation draft revision 5"
date: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewer_lens: "adversarial lower-level divergence re-review"
reviewed_artifact: "../topology-policy-reconciliation-draft-2026-08-05.md"
reviewed_revision: 5
scope: "D-011, D-012, D-013 and delegated valid-X source routing"
verdict: "ACCEPTABLE_AS_PRECANONICAL_INPUT"
implementation_ready: false
readiness: NOT_READY
spine_changed: false
memlog_changed: false
source_mutations: none
---

# Независимый adversarial re-review: revision 5

## Verdict

**`ACCEPTABLE_AS_PRECANONICAL_INPUT`.** Revision 5 closes the five P1
lower-level divergences recorded in the adversarial R4 review without claiming
that its candidate wording is already canonical. It is a clean input to the
next owner workflow; it is not an adopted amendment to AD-7, PRD, SPEC,
geometry companion or UX contract.

This verdict is deliberately narrower than implementation readiness. `G-READY`
remains **`NOT_READY`**. `S-2` remains `needs-further-evidence`; no product
code, test/configuration, source-of-truth, Spine or `.memlog.md` change is
authorised by this review.

## Independent basis

The re-review compared revision 5 with the R4 findings and the current
authority sources: Architecture Spine AD-3, AD-7, AD-11 and AD-12; Geometry
Contract §§1, 3–6 and 10–12; PRD FR-7…FR-13 (especially FR-9); glossary and
Project/Portable Backup boundaries; the UX durable/persist-failed and PWA
flows; and delegated proposal §§4.2.1 and 4.3.1. The latter is working-policy
authority only: it does not supersede the source-owning workflows.

## Closure of R4 P1 findings

| R4 finding | Revision-5 evidence | Adversarial assessment |
| --- | --- | --- |
| P1-R4-1 — a parsed JavaScript number can hide a fractional JSON literal | Proposed AD-7 wording requires a schema-aware decoder to retain and validate every raw persisted numeric lexeme before host IEEE-number materialization; typed numbers require provenance through `SafeIntegerMm`, and `Number.isSafeInteger` is only a final guard. It normalizes raw `-0` and requires raw-byte decimal/exponent/unsafe fixtures. | **Closed.** `9007199254740991.1` can no longer become an admissible safe integer merely because ordinary `JSON.parse` rounded it first. The eventual `bmad-spec` reason-code selection is correctly left to its owner. |
| P1-R4-2 — an off-grid origin has no total 45° result on a global 100-mm lattice | The working policy now explicitly constructs the gesture candidate as `origin + (100 × k) × d`, keeps visual-grid step presentation-only, and requires off-grid cases in every allowed direction. | **Closed.** It implements the delegated clarification rather than inventing a global lattice, so `(125, 0)` can form an exact diagonal candidate. Tolerance, ties and `k` selection remain honestly deferred rather than silently delegated to a library. |
| P1-R4-3 — policy versioning conflicted with Revision/History/Backup and AD-11 | `SnapPolicy` is now expressly construction-only: configuration, identity and snapshots enter neither Project, Revision, History, persisted Command nor Portable Backup. Resolved endpoints are never re-normalized, and a `DraftCommand` is session-only/non-replayable. The draft introduces neither policy registry nor ReleaseManifest/policy migration contract. | **Closed.** This is the bounded non-replayable-snapshot route compatible with the glossary's session-only History, Portable Backup exclusion, and AD-11's existing reload handshake. |
| P1-R4-4 — persistence failure was conflated with rejection | Rejection before validation has no `PendingDurability`; a persistence failure after `Validated` retains the pending candidate/journal for retry or recovery export, keeps Durable Revision/History current, and fences the next mutation. Stale worker output is separately discarded under AD-12. | **Closed.** The state machine now matches AD-3 and the existing UX persist-failed flow. |
| P1-R4-5 — numeric contacts and multi-X could leave partial/unsplit topology | Exact endpoint reuse, endpoint/interior T treatment, one shared Vertex per distinct contact, and complete ordered partitioning of the proposed plus all affected segments are explicit. Non-integral/out-of-limit/overlap/self-intersection/duplicate/too-short/full-invariant failures reject the whole detached candidate. | **Closed.** The statement rules out coincident vertices, an unsplit accepted contact, and a first-crossing-only result. Its phrase “all distinct contacts” must retain both endpoint/interior orientations when the source owners re-distil the canonical wording. |

## Focused adversarial checks

- **Lossless ingress and limits:** the draft now makes lexical validation precede
  number materialization and uses transient `BigInt` only after safe,
  project-bounded values are admitted. It separately rechecks the resulting
  endpoint, so `origin ± n` cannot escape through an otherwise valid `L`.
- **Exact 45-degree math:** zero is selected before direction classification;
  signs come from an explicit `DiagonalLengthRequest`, while exact endpoint
  input preserves its supplied signs. The strict integer comparison for `n`
  avoids an authoritative binary-float rounding result.
- **Topology:** a single X is the expected shared-Vertex/four-piece special
  case; the more general complete-partition formulation prevents accidental
  first-hit behavior. It does not pretend that near-contact tolerance, merge,
  Room reconciliation, opening relocation or kernel choice is settled.
- **Authority:** every new rule is marked candidate/proposed, with PRD,
  `bmad-spec`, `bmad-architecture` and `bmad-ux` routing specified. The draft
  neither turns S-2 executable evidence into a production kernel nor selects a
  new stable serialization reason.

## Required next gate, unchanged

The acceptance permits only the documented next step: a fresh
`bmad-architecture` update must route and record approved decisions through
`memlog.py`, re-distil the Spine, reconcile FR-9/geometry/UX ownership, run
the mechanical lint and all three independent reviewer lenses against the
distilled canonical result. The remaining S-2 evidence, product/UX decisions,
human/legal and physical-device evidence, control-plane ADR, and final
implementation-readiness gate remain outstanding.

---
title: "Adversarial re-review — topology-policy reconciliation draft revision 7"
date: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewer_lens: "adversarial lower-level divergence re-review"
reviewed_artifact: "../topology-policy-reconciliation-draft-2026-08-05.md"
reviewed_revision: 7
scope: "D-011, D-012, D-013 and delegated valid-X source routing"
verdict: "ACCEPTABLE_AS_PRECANONICAL_INPUT"
implementation_ready: false
readiness: NOT_READY
spine_changed: false
memlog_changed: false
source_mutations: none
---

# Независимый adversarial re-review: revision 7

## Verdict

**`ACCEPTABLE_AS_PRECANONICAL_INPUT`.** Revision 7 correctly repairs the R6
wire-format contradiction and does not turn its negative fixture into a new
canonical serialization policy. No new lower-level geometry, state, limits or
source-ownership divergence was found.

This accepts only a non-canonical input for the next owner workflow.
`G-READY` remains **`NOT_READY`**. No Spine, `.memlog.md`, PRD, SPEC,
companion, implementation artifact, test/configuration, evidence status or
production authorization changes through this review.

## Exact backup path and negative-fixture check

The binding Project and Portable Backup Contract specifies `project/project.json`
as a mandatory logical entry **inside** the `.interiors` container and requires
a manifest/path allowlist before Project deserialization. Revision 7 now uses
that exact representation consistently in the proposed AD-7 text, candidate
companion wording, verification matrix and owner-workflow handoff.

The negative fixture for `.interiors/project/project.json` is valid and
non-expansive:

- it tests an unlisted nested entry against the pre-existing path allowlist;
- it neither permits an alternate encoding nor changes the canonical member;
- it does not choose a new stable error code, since the draft retains that
  mapping for `bmad-spec` and the Project/Backup contract; and
- its raw-lexeme assertions still run only over the valid canonical
  `project/project.json` JSON boundary.

Thus the fixture prevents the former ambiguity without redefining the bundle
format in an AD-7 geometry delta.

## Re-check of R6 boundaries

| Stress area | Revision-7 assessment |
| --- | --- |
| JSON numeric ingress | **Pass.** Raw JSON numeric tokens are validated before host-number coercion; `SafeIntegerMm` provenance, safe/project limits, canonical `-0 → 0`, ephemeral `BigInt`, and no non-JSON canonical alternative remain explicit. |
| Exact contacts and partitions | **Pass.** The total coordinate-group rule covers endpoint/Vertex, endpoint/interior, candidate-interior/Vertex including a junction, and interior/interior. Every affected segment containing a grouped coordinate in its interior is atomically partitioned in order, with zero, duplicate, coincident, too-short or invariant-breaking outcomes rejected as a whole. |
| Direction and signed preview | **Pass.** The selected direction determines the signed diagonal delta; exact squared length feeds the one measurement-format seam, so the new preview detail does not create an independent rounding policy. |
| Durability and limits | **Pass.** Pre-validation rejection, stale-worker discard and post-`Validated` persistence failure remain distinct. Inputs and resulting endpoints are bounded before publication; only Validated reaches `PendingDurability`. |
| Scope / source ownership | **Pass.** The draft still keeps valid-X reconciliation, tolerance/kernel, merge/Room/Opening consequences and measurement precision with their owner workflows. It neither promotes S-2 nor claims canonical adoption, device evidence or implementation readiness. |

## Required next gate, unchanged

This acceptance does not replace the required fresh `bmad-architecture` update:
record approved decisions via `memlog.py`, re-distil AD-7, reconcile PRD/SPEC/UX
owners, then run lint, rubric and all independent reviewer lenses against the
distilled Spine. S-2, legal/asset, physical-device, control-plane and final
readiness gates remain outstanding.

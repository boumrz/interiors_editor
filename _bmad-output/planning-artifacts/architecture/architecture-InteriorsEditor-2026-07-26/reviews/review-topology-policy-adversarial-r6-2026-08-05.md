---
title: "Adversarial re-review — topology-policy reconciliation draft revision 6"
date: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewer_lens: "adversarial lower-level divergence re-review"
reviewed_artifact: "../topology-policy-reconciliation-draft-2026-08-05.md"
reviewed_revision: 6
scope: "D-011, D-012, D-013 and delegated valid-X source routing"
verdict: "REJECT_FOR_PRECANONICAL_INPUT"
implementation_ready: false
readiness: NOT_READY
spine_changed: false
memlog_changed: false
source_mutations: none
---

# Независимый adversarial re-review: revision 6

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT`.** Revision 6 correctly closes the two
revision-5 gaps in exact contact normalization and removes the unapproved
non-JSON canonical-format alternative. It nevertheless introduces one direct
canonical-wire-format contradiction in every newly added JSON/Backup assertion.
That P1 makes the draft unsuitable for redistilling AD-7 until corrected.

This is not an implementation-readiness verdict: `G-READY` remains
**`NOT_READY`**. This review changes no Spine, `.memlog.md`, PRD, SPEC,
companion, source, test, configuration or application artifact.

## Read-only comparison

The review compared revision 6 with the R5 adversarial review and the
current-source R5 rejection, then checked the binding sources: Spine AD-3,
AD-4, AD-7, AD-11 and AD-12; Geometry Contract §§1, 3–6 and 10–12; Project
and Portable Backup Contract §§1, 2, 4, 5 and 7; PRD FR-7…FR-13 and FR-45;
glossary, domain/solution companions, UX durability flow, and delegated
clarifications §§4.2.1 and 4.3.1.

## What revision 6 closes

| R5 concern / requested stress case | Revision-6 result | Assessment |
| --- | --- | --- |
| Lossless raw JSON number boundary and no alternate canonical encoding | Raw lexemes are validated before IEEE-number materialization; `SafeIntegerMm` provenance, `-0` normalization, safe/Project-limit checks and ephemeral-only `BigInt` remain explicit. The draft now says an internal non-JSON repository encoding cannot become an alternate canonical format through AD-7. | **Substantively closed**, subject to the path contradiction below. |
| Candidate interior passing through an existing Vertex or multi-Wall junction | The exact-contact set now explicitly includes candidate-interior/existing-Vertex, groups contacts by coordinate, reuses the vertex and splits every segment whose interior contains that coordinate. | **Closed.** A singular pass-through can no longer be accidentally retained as an unsplit WallSegment. |
| Complete atomic partitioning | All distinct grouped coordinates are ordered on every affected segment; zero, duplicate/coincident and too-short pieces reject the complete detached candidate. | **Closed.** This covers endpoint/interior T, one-X, multi-X and junction contacts without a first-hit path. |
| Selected diagonal signs in preview | The normalized preview now exposes the selected signed delta and exact squared length; the existing common `MeasurementFormatPolicy` still owns approximate formatted text. | **Closed.** It supplements rather than weakens the Geometry Contract's actual-length preview requirement. |
| AD-3, stale-worker and bounds branches | Reject, stale discard and post-validation persistence failure remain distinct; endpoints are checked after exact arithmetic and only Validated reaches `PendingDurability`. | **Closed.** No new state/limit divergence was found. |

## P1-R6-1 — the draft changes the mandatory Portable Backup entry path

The current Project and Portable Backup Contract defines the mandatory logical
entries of a `.interiors` container as:

```text
manifest.json
project/project.json
catalog/<hash>.asset
...
```

Revision 6 instead repeatedly calls the required JSON entry
`.interiors/project/project.json` (draft lines 103–106, 267–269, 320–325
and 398–402). `.interiors` is the **container extension**, not a mandatory
top-level directory in its logical structure. The current import pipeline also
validates an allowlisted path layout before Project deserialization.

This is an enforceable wire-format contradiction, not merely a prose style
choice. A source-compliant exporter/importer uses `project/project.json`; a
draft-compliant fixture or decoder can instead seek/create a distinct nested
`.interiors/project/project.json` entry. The latter can fail the canonical path
allowlist before raw-token validation, or establish a competing format that the
draft explicitly says it is preventing.

**Required correction.** Replace every occurrence with exactly
`project/project.json` **inside the `.interiors` bundle**. Keep the rule that
the schema-aware raw-token decoder validates that entry before JavaScript-number
coercion. The verification matrix must prove both that the canonical entry is
accepted and that the nested `.interiors/project/project.json` path is rejected
by the backup path/schema boundary. This is owned by the existing
Project/Backup and `bmad-spec` route, not a new AD-7 wire-format decision.

## Retained gate boundary

After correcting P1-R6-1, obtain fresh current-source, adversarial and
topology/data-integrity re-reviews of the new revision. Only then may a fresh
`bmad-architecture` update append decisions through `memlog.py`, re-distil
AD-7, reconcile PRD/SPEC/UX owners and run the full gate against the distilled
Spine. S-2 remains `needs-further-evidence`; all human/legal, physical-device,
control-plane ADR and final readiness gates remain unchanged.

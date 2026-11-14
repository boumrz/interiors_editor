---
title: "InteriorsEditor — adversarial canonical Architecture gate: distilled AD-7"
review_type: adversarial-canonical-architecture-gate
reviewed: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewed_memlog: ../.memlog.md
review_basis:
  - ../topology-policy-reconciliation-draft-2026-08-05.md
  - review-topology-policy-adversarial-r7-2026-08-05.md
  - review-topology-data-integrity-r7-2026-08-05.md
  - review-current-source-topology-policy-revision-7-2026-08-05.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../../project-context.md
status: complete
verdict: REJECT_FOR_CANONICAL_ARCHITECTURE_GATE
readiness: NOT_READY
scope: "Independent read-only adversarial review of the actual distilled AD-7 and its memlog provenance; no source, Spine, memlog, application, test, configuration, or evidence mutation"
source_mutations: none
---

# Adversarial canonical gate — distilled AD-7

## Verdict

**`REJECT_FOR_CANONICAL_ARCHITECTURE_GATE`; `G-READY` remains `NOT_READY`.**

The Product Owner delegated policy and revision-7 draft are not rejected.  The
distilled AD-7 does retain the important atomicity, construction-only policy,
exact-contact and open-D-022 boundaries.  It nevertheless loses three
load-bearing *enforceable* seams from the accepted R7 input, and its two
post-distillation additions are recorded only as an `event`, not a decision or
constraint.  Two compliant lower-level units can therefore accept different
backups, generate different gesture endpoints, or format the same diagonal
differently.

This is a planning/reviewer-gate result only.  It authorises no source edit,
implementation, kernel selection, S-2 promotion, device claim, or change to
the retained readiness status.

## Review method and controls

- Compared actual `AD-7` and `Deferred` with the accepted R7 draft and all
  three R7 reviews, the delegated decision packet, the full architecture
  memlog, the PRD, the SPEC and its geometry/backup companions, and
  `project-context.md`.
- Ran the required read-only mechanical check:

  ```text
  uv run .agents/skills/bmad-architecture/scripts/lint_spine.py \
    --workspace _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26

  { "ok": true, "total_findings": 0, "by_severity": {} }
  ```

  This establishes structural validity only; it cannot prove that the Rule is
  sufficiently precise to prevent lower-level divergence.
- Independently checked the coercion counterexample.  In the current Node
  runtime, raw JSON `9007199254740991.1` becomes the safe integer
  `9007199254740991`; converting the already coerced value back to text yields
  the apparently valid lexical string `"9007199254740991"`.

## P1 blockers

### CAN-ADV-01 — Lossless JSON ingress is weakened below an enforceable boundary

**Evidence.** R7 states that a schema-aware decoder retains each *raw JSON
numeric lexeme* and validates it **before** host IEEE-number materialisation
(draft lines 97–116).  Actual AD-7 lines 181–188 instead say only “exact
lexical validation of persisted/imported values” and defer details to future
SPEC/Project-Backup work.  That wording neither requires raw-token retention
nor fixes the ordering relative to coercion.  The present Geometry Contract
only requires safe integer millimetres/no float source of truth
(§1, lines 11–15), while the Backup Contract establishes path/staging order
(§2 and §4, lines 80–90 and 159–171), not this raw-numeric acceptance boundary.

Consequently an importer can `JSON.parse`, stringify the rounded `Number`, run
an “exact lexical” check, and incorrectly admit the raw decimal.  This has no
visible conflict with the short AD-7 phrase, but loses the R7 safety property.
`Deferred` correctly names `project/project.json` inside `.interiors`
(lines 633–639), so no alternate path is presently claimed; the defect is that
the actual parser boundary is not enforceable in the adopted Rule.

**Required correction.** Add a compact architectural seam to AD-7, without
stealing grammar/reason ownership from `bmad-spec`: persisted/imported geometry
must be decoded from retained raw JSON numeric tokens and validated before any
host-number coercion; the canonical bundle member is
`project/project.json` inside `.interiors`; grammar and stable reason mapping
remain SPEC/Project-Backup owned.  Then make the required owner reconciliation
and raw-byte fixture/corpus gate explicit before implementation.

### CAN-ADV-02 — Gesture scalar `k` lost its integer domain

**Evidence.** AD-7 lines 208–210 says the candidate is
`origin + (100 × k) × direction`, “where `k` is positive.”  The delegated
clarification requires an **integer** `k × direction` delta
(change proposal §4.2.1, lines 114–121), and R7 makes `k` a positive integer
both for permitted deltas and the 100-mm gesture candidate (draft lines
154–180).

The omission is observable, not editorial: from `(125, 0)` in NE direction,
`k = 1/2` yields `(175, 50)`.  It is still integer-mm, 45°, safe, off-grid and
passes the rest of the rendered AD-7 predicates, yet it is not a 100-mm
increment.  One implementation can reject it and another accept it while both
claim to follow the present Rule.

**Required correction.** Replace the untyped `k` with “positive integer `k`”
and name `direction` as one of the eight unit vectors.  Preserve the existing
exception for exact numeric input: it may be off-grid and need not be a
multiple of 100 mm.

### CAN-ADV-03 — AD-7 drops the shared diagonal measurement-format seam bound by FR-13

**Evidence.** R7 requires preview, 2D, 3D and export to request text from one
product-owned `MeasurementFormatPolicy` supplied with the same exact squared
length (draft lines 232–236).  Actual AD-7 only asks the length-entry preview
to show a quantised actual length (lines 201–206).  PRD FR-13 explicitly
requires diagonal length to be uniform in every representation and export
(lines 278–288).  The current `Deferred` item leaves precision/locale open
(lines 627–632), but does not declare a common policy or prohibit independent
rounding.

For the same exact `2 × 707²` length, a preview can show `≈999.85 mm`, the 2D
surface `1,000 mm`, 3D `999.8 mm`, and export another locale/precision.  All
four comply with the current AD-7 wording, but violate FR-13.

**Required correction.** Restore the seam: preview, 2D, 3D and export obtain
diagonal display text from one product-owned formatting policy over the same
exact squared length; precision and locale remain deferred to the named
PRD/SPEC/UX owners, and formatted text never re-enters a Command or Revision.

### CAN-ADV-04 — The clean re-distillation cannot reproduce two load-bearing rules

**Evidence.** Memlog lines 52–55 record delegated relative snapping,
valid-exact-X, the constrained S-2 status and D-022 deferral.  The lexical
ingress/ephemeral-wide-arithmetic rule and the complete four-class/all-contact
partition rule appear only in the post-distillation **`event`** at line 57.
They are substantive product decisions, not a mechanical observation.  A
fresh re-distillation from durable decision/constraint records can therefore
restore the narrower X decision but omit raw-value safety, proposed-interior
pass-through of an existing junction, or ordered all-contact partitioning.

**Required correction.** Append, through `_bmad/scripts/memlog.py`, separate
`decision` or `constraint` records for (1) lossless persisted numeric ingress
plus ephemeral-only wider arithmetic and (2) all exact contact classes,
one-Vertex-per-coordinate grouping, ordered partition of every affected
interior and whole-candidate rejection.  Re-distil AD-7, rerun lint, and rerun
all three independent canonical lenses.  The historical `event` may remain,
but cannot be the sole provenance.

## Boundaries that survived this adversarial pass

- **AD-3 remains intact.** Geometry rejection has no `PendingDurability`,
  history, autosave or canonical-projection publication; a post-validation
  persistence failure remains a distinct AD-3 outcome.
- **`SnapPolicy` lifecycle remains compatible with AD-3/AD-11.** It is
  construction-only, does not enter Project/Revision/History/Backup, and a
  later policy cannot reinterpret a Durable Revision.
- **Exact topology is materially stronger than the old draft.** AD-7 now
  enumerates all four contact classes and requires grouped, ordered atomic
  partitioning, including candidate-interior through an existing junction and
  exact X.
- **D-022 is not accidentally closed.** Kernel, tolerance, tie/hysteresis,
  continuity, merge, Room/Opening, usable-polygon rounding and
  precision/locale are visibly still open.  The existing Geometry Contract
  §6 X split/reject wording remains an explicitly routed source-owner
  reconciliation gate, not a claim that reconciliation is complete.
- **No unsupported readiness claim was found.** The Spine and memlog retain
  S-2, physical NFR-15, legal, G-1, G-CP-ADR and the official readiness gate as
  open; `G-READY` stays `NOT_READY`.

No canonical artifact or implementation artifact was changed by this review.

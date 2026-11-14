---
title: "Planning-drift reconciliation targets — 2026-08-05"
date: "2026-08-05"
status: "advisory-precanonical"
scope: "P1 planning drift from the official implementation-readiness report"
authority: "Documentation/decision-register owner with PM; canonical source owners retain their normal ownership"
source_mutations: "none"
implementation_authorization: false
readiness_verdict: "NOT READY"
review_basis:
  - "../implementation-readiness-report-2026-08-05.md"
  - "../decision-register.md"
  - "../roadmap-to-alpha.md"
  - "../traceability-matrix.md"
  - "../epics.md"
  - "../architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md"
---

<!-- markdownlint-disable MD013 -->

# Targets for safe planning-drift reconciliation

This is an advisory handoff for the P1 condition in the official
[implementation-readiness report](../implementation-readiness-report-2026-08-05.md):
the current primary packages have reconciled the *semantics* of `D-011`–`D-013`,
while the decision register, roadmap and traceability surface still expose a
stale or incomplete planning status. It does **not** alter a canonical source,
evidence, gate, waiver, implementation artifact or readiness verdict.

The reconciliation owner must use the current canonical sources rather than
this document as truth. In particular, it must leave `G-READY = NOT READY`,
`D-022` open, and every production `EV-*` item planned until its own required
evidence exists.

## Boundaries and terminology that must not drift

- `D-011`, `D-012` and `D-013` are historical product-decision IDs in the
  [decision register](../decision-register.md). Their currently binding
  geometry outcome is the adopted `AD-7` seam plus its source-owned PRD, SPEC
  and UX wording; it is **not** permission to fill in `D-022`.
- `D-022` remains the P0 topology-policy completion: kernel/library,
  tolerance, candidate eligibility/ties, origin-relative `k`, hysteresis,
  Room reconciliation, Opening policy and measurement precision/locale are
  still open. No reconciliation may describe them as selected.
- `D-018` in the decision register is the *Walk mode* product-decision key
  (with a `D-052` clarification of its Door/Walk-edge scope). `AD-18` in the
  Architecture Spine is the separate adopted root phone POC exception. The
  readiness report spells the latter `AD-018`; the canonical Architecture ID
  is **`AD-18`**. Do not make them aliases.
- `AD-18` maps a bounded `W-POC-2026-08-04` browser demonstration only. It
  neither passes a production `EV-*`, nor opens `G-READY`, any `V-*` entry,
  physical `NFR-15` certification, or release.

## Reconciliation matrix

| Stale status / planning drift | Exact authority as of 2026-08-05 | Required safe correction to the canonical planning surface | Preserve history and evidence | Exact proof after the owner change |
| --- | --- | --- | --- | --- |
| `D-011`, `D-012`, `D-013` are still listed as `Proposed` in the decision register, and the "Ближайший пакет" still asks to confirm all `D-011`–`D-020`. | [AD-7](../architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md) is `ADOPTED`. Its rule fixes infinite *presentation* grid, origin-relative 100-mm gesture construction, valid off-grid integer-mm numeric input, explicit-quadrant quantized 45° length input, and atomic valid exact T/X. [PRD FR-7–FR-9](../prds/prd-InteriorsEditor-2026-07-26/prd.md) and its 2026-08-05 resolved-update record, [SPEC CAP-2 / geometry contract](../../specs/spec-interiors-editor-alpha/SPEC.md), and [UX §5.1.1 / §14](../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md) carry that result. | Add a dated **current reconciliation** block to the register, keyed to the existing three IDs. State that their resolved scope is adopted through `AD-7` and list the precise primary-source links. Amend the forward-looking confirmation package so it does not present those three as still awaiting a new decision; keep `D-014`–`D-020` and every genuinely open decision explicit. The block must say `D-022 remains open`. Do not mint a second geometry rule or choose a hidden policy. | Keep the original `Proposed` table and its original dates as a labelled historical proposal snapshot, or retain it verbatim and append a dated supersession/reconciliation note. Do not erase the original wording, relabel a past gate result as `PASS`, or turn AD-7 source reconciliation into spike evidence. | Check 2 must show both the historical proposal and the dated current-status pointer. Manual review must confirm that `D-022` is still open and neither S-2 nor `G-READY` is called passed. |
| Roadmap `G-0` still says to determine the meaning of Gridfinity, and §8 still treats grid/snap/off-grid/n=`round(L/√2)` as one unresolved dependency for `G-3 / S-2`. | The adopted scope is the same `AD-7`/PRD/SPEC/UX package above. `AD-7` expressly distinguishes visual grid presentation from origin-relative construction; it leaves the D-022 candidate/tolerance/hysteresis policy open. | In [roadmap](../roadmap-to-alpha.md), preserve the original `G-0` research path as history but add a dated current-status note. Split §8 into: (1) resolved D-011–D-013 construction semantics, with canonical links; and (2) the still-open D-022 policy/corpus dependency for `S-2`. Keep `S-2` evidence and the `G-3` PASS exit criteria unchanged. | Do not rewrite `G-0`/`G-3` as if their historical work or exit criteria had already happened. Do not remove the `S-2` dependency, convert the waiver to a production path, or mark a future stage `PASS`. | Check 2 must show a resolved-versus-open split. Manual review of `### G-3` must still find its PASS and `readiness = READY` production exit, not a current claim. |
| Roadmap has no compact current-status disposition for the final readiness/gate reality and therefore can be read as a linear plan already advancing through its named stages. | The dated [official report](../implementation-readiness-report-2026-08-05.md) is evidence inventory, not a canonical source owner, and records: `G-READY = NOT READY`; S-1 terminal `PAUSED`; S-2 closed/not PASS; S-3 `PAUSED`; S-4 `PAUSED`; S-6 terminal `PAUSED`; and `G-CP-ADR` inputs pending/not PASS. `AD-18` independently says its POC cannot open production gates. | Add one explicitly **informative current disposition** row or note to the roadmap, sourced to the dated report. It may report the above states and link the needed next ownership work; it must remain separate from the normative stage/gate tables. Include `AD-18 / W-POC-2026-08-04: bounded POC evidence only` if the POC is mentioned. | Preserve all planned gate definitions and all original spike history. A status note must not manufacture an `EV-*`, change a terminal package to `PASS`, or imply POC browser screenshots satisfy physical-device evidence. | Check 5 must find the status note alongside unchanged normative gates. Compare each state word-for-word with the official-report scorecard before publishing. |
| [Traceability](../traceability-matrix.md) reports `17/17` architecture decisions and has neither `AD-18` nor a current gate/exception disposition. Its `EV-*` entries correctly say planned, but the document does not explain the POC boundary. | The Architecture Spine contains 18 current `AD-*` entries; `AD-18` binds `CAP-5`, `CAP-9`, `CAP-11` but is a bounded POC delivery exception. The report identifies traceability as incomplete; its assessment does not turn any planned evidence into actual evidence. | Add `AD-18` to the architecture references for `CAP-5`, `CAP-9` and `CAP-11`, marked **POC exception only — no production evidence closure**. Change the audit count to `18/18 referenced`. Add a dated, non-`EV` current-gate/exception disposition table that links the official report and names `G-READY` and the closed/not-PASS packages. Keep the existing planned-evidence catalogue intact. | Do not add an `EV-PASS`, delete an EV row, mark NFR-15 complete, or treat the root POC as a release artifact. Preserve the current `EV-*` table as planned production evidence and record the status snapshot separately. | Check 3 must find all three CAP mappings, the corrected count, and explicit no-closure wording. It must still find the same 20 planned EV IDs and no `PASS` claim. |
| Identifier collision can make the traceability/roadmap reconciliation accidentally attach the POC exception to the Walk-mode decision, or create a fictitious `AD-018` decision. | The decision register's `D-018` is a Walk-mode key with a `D-052` clarification; the Spine's `AD-18` is adopted POC delivery scope. The report's `AD-018` spelling is a reference-format inconsistency only. | Use fully qualified ID families (`D-018` versus `AD-18`) in every new table/note. Normalise only the *reference spelling* to canonical `AD-18`; do not change the semantic content of either source decision. Add a one-sentence disambiguation footnote where `AD-18` first enters traceability or roadmap status. | Preserve both existing IDs and their separate history. Never move or reclassify `D-018` merely because `AD-18` is adopted. | Check 4 must show no new canonical use of `AD-018` and make the two ID families visually distinct. |
| The Epics surface has a related P0 execution drift: `FR-7` still allows “snap-ится либо отклоняется”, Story 2.2 does not explicitly require valid off-grid numeric input, and Story 2.4 can reject a valid exact X through an unresolved S-2 policy. The official report also calls out FR-13 formatter ownership. | [Current PRD FR-7–FR-9](../prds/prd-InteriorsEditor-2026-07-26/prd.md), `AD-7`, and [UX §5.1.1](../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md) forbid silent rounding and require valid exact T/X semantics. [Epics Story 2.2/2.4](../epics.md) remain dependent on unresolved `D-022`; the official report classifies this as P0. | **Do not repair the acceptance criteria in this P1 documentation pass.** Put an explicit handoff in the reconciliation note: after a source owner adopts `D-022`, a backlog owner must reconcile only the affected FR inventory and Stories 2.2/2.4 (including `FR-13` formatting ownership) into executable, testable cases. Keep the P0 blocker visible. | Preserve the present Story wording and all trace links until the D-022 source-owner package is complete; do not silently choose a library default, mark the stories implementation-ready, or use a documentation fix to close a geometry gate. | A future post-D-022 review must use Check 1 plus the named Epic terms and show an explicit decision/corpus contract before any production-story authorization. |

## Recommended safe order for the canonical owner

1. Freeze a small source snapshot and record the review date; do not use a
   POC, waiver, or an older readiness report as an alternative source of
   truth.
2. Reconcile the decision register first, retaining the historical `Proposed`
   material and adding the current source pointer for `D-011`–`D-013`.
3. Split the roadmap's resolved D-011–D-013 wording from open `D-022`, then
   add its clearly non-normative current disposition note.
4. Update traceability to `18/18`, map `AD-18` only as a bounded exception,
   and add a separate planned-evidence/gate-status explanation.
5. Run the checks below and obtain a documentation/PM review. Treat the Epic
   acceptance work as a separately owned P0 follow-up after `D-022`, not as a
   by-product of this reconciliation.

## Exact reconciliation checks

Run these after the canonical owner has made the source changes. They are
checks for coherence and evidence honesty, not a substitute for a later fresh
readiness assessment.

```sh
# 1. The primary geometry package still says what the reconciliation points to.
rg -n 'origin \+ \(100 × k\)|off-grid|exact X|D-022|MeasurementFormatPolicy' \
  _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md \
  _bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md \
  _bmad-output/specs/spec-interiors-editor-alpha/SPEC.md \
  _bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md

# 2. Register and roadmap retain historic context while publishing a dated
#    current pointer. The owner should review every hit, not merely count them.
rg -n 'D-011|D-012|D-013|D-022|AD-7|Gridfinity|round\(L/√2\)' \
  _bmad-output/planning-artifacts/decision-register.md \
  _bmad-output/planning-artifacts/roadmap-to-alpha.md

# 3. AD-18 is complete as a coverage reference, but does not close evidence.
rg -n 'AD-18|18/18|POC exception|no production evidence closure|NOT READY' \
  _bmad-output/planning-artifacts/traceability-matrix.md
rg -n '^\| `EV-' _bmad-output/planning-artifacts/traceability-matrix.md

# 4. No accidental D-018 / AD-18 conflation or fictional canonical AD-018.
rg -n '\bD-018\b|\bAD-018\b|\bAD-18\b' \
  _bmad-output/planning-artifacts/decision-register.md \
  _bmad-output/planning-artifacts/roadmap-to-alpha.md \
  _bmad-output/planning-artifacts/traceability-matrix.md

# 5. The new status language does not downgrade production gates. Compare these
#    hits to the official scorecard rather than treating any one document as
#    a new evidence source.
rg -n 'G-READY|NOT READY|S-1|S-2|S-3|S-4|S-6|G-CP-ADR|PASS|W-POC-2026-08-04' \
  _bmad-output/planning-artifacts/roadmap-to-alpha.md \
  _bmad-output/planning-artifacts/traceability-matrix.md \
  _bmad-output/planning-artifacts/implementation-readiness-report-2026-08-05.md
```

The reviewer should reject the reconciliation if any of the following appears:

- `D-022` becomes implicitly selected or its corpus is called complete;
- a historical/waiver/POC result is renamed `PASS` or a production `EV-*`;
- `AD-18` is treated as a release, native-fullscreen, service-worker, or
  physical-device certification result;
- the `17/17` audit is changed to `18/18` without all three `CAP-5`, `CAP-9`,
  `CAP-11` exception references and their no-closure qualifier; or
- the P1 status cleanup claims that the P0 Epic acceptance conflicts are fixed.

## Out of scope

This advisory plan deliberately does not adopt `D-022`, select a renderer or
Control Plane ADR, split Epics, edit production/source/test artifacts, execute
evidence, change a waiver, or request a new readiness verdict. The result of a
correct reconciliation remains **NOT READY** until all independent blockers in
the official report are actually resolved and that report is re-run.

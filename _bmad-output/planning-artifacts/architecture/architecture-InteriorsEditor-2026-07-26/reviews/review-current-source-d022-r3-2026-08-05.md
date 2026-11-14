---
title: "InteriorsEditor — independent current-source review of D-022 revision 3"
review_type: current-source-reality-precanonical-policy-r3
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r3-2026-08-05.md
reviewed_snapshot:
  draft_sha256: ef16eb1a15b0face1e92077dff9ca904fa094378a64c10b8752fa48960151773
  spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  architecture_memlog_sha256: 55a83cf0d999797f5e4c6d0802655c6f4e6483db4c7c3a581b3098fdb929622d
  domain_model_sha256: 80eed557aeafaaf97dfef974e3f639efb887b1d28fe50b878722e813913e5395
  spec_sha256: ce903b5aa4bf3f59efbd08d030dc7c292491315a1280cf1203f3114e517169ed
  glossary_sha256: 3762338e349293863176f802d7ee1a783b62ef28d081b96155a11598da894156
  geometry_contract_sha256: ca0efcc9126ac8ff92fa76eeafa32ac8dd3d13311d8d66758a68219b52cefbb0
  asset_import_contract_sha256: a2515ee47c029516643e33a6c90453a6ebafcbbd1110048ec1dbbd8e1ad99c56
  performance_budgets_sha256: 4063badb4ac950fb1811297d2d87cbfcdc21ffa54754201a3ceb190bbecc3547
  project_backup_contract_sha256: 91ecfb9ac4cb7bc21e2e0205442b960713e70a2aaf3384a40645db2fff8d7157
  catalog_control_plane_contract_sha256: c3b06f9967630fb1e66754463acb97d5dda9a3209ac1cade418f33e770b8a48c
  prd_sha256: 48bd0a416dad0e78ac65d3f616da7ded36500726ff2e0026650d7f93814d47eb
  ux_design_sha256: 02c18269245a71ea6a7058daead2268e56e81ef11c5bb459a40b294f09b02289
  ux_experience_sha256: ac20ff129bee180509fe3d83f2537f35672904c17a3fd5ae34eb9a407310cb29
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
  readiness_report_sha256: dd8d32fa23d4a135494157cc3a649c163da2ab8a57ec1e44b47b327adb8a9a3c
  prior_current_source_r2_sha256: 311561650838b4db8ed26f2609b9a00386fc8185455f9bfaa3f926c9e0a52a27
  prior_exact_geometry_r2_sha256: fa70b9987476ae93fefeb2bfef7d285926fa5e55ff40267594a62379ce917c15
  prior_topology_data_integrity_r2_sha256: a57f461237402750185ab60c3f6315b7bcf4fe834fd458d849fd3dc432da8768
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../.memlog.md
  - ../domain-model.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/performance-budgets.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/catalog-control-plane-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../../../project-context.md
  - ../../../implementation-readiness-report-2026-08-05.md
  - review-current-source-d022-r2-2026-08-05.md
  - review-d022-exact-geometry-adversarial-r2-2026-08-05.md
  - review-d022-r2-topology-data-integrity-2026-08-05.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Independent read-only review of the exact R3 D-022 working-policy snapshot. It creates only this review artifact; it changes no draft, canonical source, memlog, code, test, configuration, evidence, gate, or readiness state."
source_mutations: none
---

# D-022 revision 3 — current-source/reality review

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT` for this exact R3 snapshot only.**
`G-READY` remains **`NOT_READY`**.

R3 is a material improvement over R2.  It correctly retains the canonical
integer-mm / ephemeral-exact boundary, replaces R2's unsupported-measurement
branch with an exact bounded metric, requires explicit `NewRoomSeedV1`, gives
C4 the missing rational-denominator comparison, and makes the intended source
deltas explicit rather than silently rewriting the current contract.

It is nevertheless not yet a complete decision input.  One Alpha FR-13 target
is declared but not resolved into an exact selectable input, and the promised
single reason-status table leaves declared rejection branches without one
diagnostic outcome.  Those are deterministic behavior, UX, and test-surface
gaps, rather than evidence that a source owner has already adopted R3.  Two
conforming implementations could therefore offer different measurements or
return different stable reasons for the same detached candidate.

This disposition neither rejects the Product Owner direction nor authorizes a
scope reduction.  It rejects only the reviewed noncanonical policy as a
precanonical hand-off until the two corrections below receive a fresh review.

## Checks that pass

- The reviewed file hashes exactly to
  `ef16eb1a15b0face1e92077dff9ca904fa094378a64c10b8752fa48960151773`.
- `lint_spine.py` over the unchanged architecture workspace returned
  `ok: true`, `total_findings: 0`.  This mechanical result does not adopt R3.
- R3 accurately remains noncanonical, keeps `NOT_READY`, and routes its miter,
  C3/RayProbe, catalog-footprint/formatting, Room, reason, limit and map
  proposals to their source owners (§§0 and 12).  It makes no false claim that
  an R3 policy, browser result, corpus plan, or device screenshot establishes
  readiness.
- The R2 current-source blockers are substantively addressed in the working
  policy: no `MEASUREMENT_UNSUPPORTED` product narrowing (§6); new/mixed Room
  successors require an explicit height seed (§7); new names are mostly
  classified by status (§2); and the C4 score preserves the common inverse
  denominator (§4.5).
- The R2 exact-geometry and topology directions are also materially
  remediated in policy: finite collinear classification and per-segment
  partition ordering (§4), Q2 simple-polygon validation (§5), bounded
  centerline Room reconciliation (§7), closed transfer maps (§8), and frozen
  ChangeSet allocation/impact replay (§9).  These remain proposals requiring
  the declared corpus and owner reconciliation.

## Blocking findings

### D022-R3-CSR-01 — `PlanPoint` is not a total exact measurement-selection contract

**Evidence.** R3 §6.1 says that *every* Alpha FR-13 target resolves to an
ephemeral extractor, but defines `PlanPoint` only as one bare member of
`MeasurementTargetV1` (lines 530–541).  `MetricPointQ2V1` has an untyped
`sourceKey` and coordinates, but the draft does not specify what is a valid
PlanPoint, how either selected point is extracted from a canonical vertex,
numeric input, or selected Q2 boundary feature, or how a normal phone gesture
reaches such a value without reintroducing a screen-coordinate approximation.

PRD FR-13 requires the exact distance between **two selected points/item
boundaries**, and UXF-1 explicitly requires bed-to-wall clearance.  The
Wall/usable-boundary/metric-ready-bed path is a strong proposal, but it does
not define the separate selected-point branch.  The current UX contract also
does not fill in that selection policy; it explicitly leaves D-022-owned
selection behavior open.

**Consequence.** One implementation can expose only existing integer vertices;
another can create arbitrary Q2 points from a touch; a third can reject the
same action.  The result is a different FR-13 affordance and potentially a
different exact value, even though all three appear to use `ExactMetricV1`.

**Required correction.** In R4, add a closed, ephemeral
`PlanPointSelectionV1` / target-discriminant contract.  It must name every
permitted exact source, its `sourceKey` type and Q2 extraction rule, the
pairing/selection ingress and no-result behavior.  Route its visible mobile
selection and numeric alternative through the UX/PRD owner when canonical
reconciliation begins.  Add corpus cases for two selected points, point-to-bed
boundary, point-to-wall/usable boundary, an unresolvable touch, and exact
formatting parity.  This does not require persisting a measurement or adding a
new canonical geometry representation.

### D022-R3-CSR-02 — the claimed unified reason-status contract is still incomplete

**Evidence.** Section 2 promises one table that keeps renderer/UI/test
diagnostics from becoming implicit canonical reason codes (lines 132–163).
However, §5.3 lists several distinct usable-polygon rejection branches
(too-few/non-positive ring, adjacent extra contact, non-adjacent touch/cross/
overlap, repeated non-adjacent vertex) and concludes only that each has a
“stable draft subtype”; it supplies neither the subtype names nor their status
in the table.  Separately, §8.1 says an out-of-enum wall-hosted record makes a
split/merge reject (lines 856–860), but assigns it no outcome.  It could be
reported as a partition-map failure, merge-map failure, host-rebase failure or
some new code depending on the implementation.

The current Geometry Contract makes reason codes stable test/diagnostic
semantics, while project context requires stable reason-code discriminated
unions.  A generic "reject" is therefore insufficient at these declared
branches.

**Consequence.** Corpus, UX copy, automated diagnostics and implementations
can diverge despite the document's stated aim of a single status table.  This
is especially material for the `WallHostedRecordKindV1` closed-world rule:
its safe rejection is correct, but the user-visible/testable outcome is still
chosen by an implementer.

**Required correction.** Give every §5.3 usable-polygon branch a named
draft subtype with the exact existing/proposed/draft-only status, and add a
table row that maps an unknown wall-host record unambiguously to the appropriate
split and merge outcome (or to explicitly named new proposed reasons).  Bind
those branches to the R3 corpus rows.  Source owners may later adopt, rename,
or replace the proposed names; R4 must simply remove implementation discretion.

## Ownership and readiness boundary

R3 correctly identifies several **proposed** material deltas from the current
sources: miter-only rather than the current miter-then-bevel rule; C3-empty and
RayProbe presentation behavior; metric-ready D8 catalog footprints and fixed
formatter policy; Room reconciliation/seeds/loss maps; and new reasons/limits/
maps.  Those differences are not a reason to reject a noncanonical working
input by themselves.  They may be considered only after this policy is made
deterministic, its source-owned corpus and mobile evidence are completed, and
the Architecture, SPEC, PRD and UX owner workflows reconcile the affected
sources.

The official readiness report still records D-022, FR-13 acceptance, S-2,
renderer/control-plane/legal decisions, participant evidence and the physical
NFR-15 matrix as blocked or missing.  This review changes none of those facts.
No root application implementation, test/CI bootstrap, commit, or `READY`
claim is authorized by this artifact.

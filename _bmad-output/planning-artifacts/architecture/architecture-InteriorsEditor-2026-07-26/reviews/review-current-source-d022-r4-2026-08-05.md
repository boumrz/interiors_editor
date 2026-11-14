---
title: "InteriorsEditor — independent current-source review of D-022 revision 4"
review_type: current-source-reality-precanonical-policy-r4
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-r4-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b
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
  frozen_r3_current_source_review_sha256: 2ab774dd26ca37abef1e7429a0afd99a117ed0158e428bac04bd825bf2ac2abc
  frozen_r3_exact_geometry_review_sha256: 9771832facf06fbec0e238168be89d363d6aae2017021d7fc1c015df79057918
  frozen_r3_topology_review_sha256: 890360d022828368412613a2311dd56dc8ef85024034de6f43a582179621712d
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
  - review-current-source-d022-r3-2026-08-05.md
  - review-d022-exact-geometry-adversarial-r3-external-2026-08-05.md
  - review-d022-r3-topology-data-integrity-2026-08-05.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Independent read-only review of the exact R4 working-policy snapshot. It creates only this review artifact and changes no R4/canonical source/memlog/code/test/configuration/evidence/gate/readiness state."
source_mutations: none
---

# D-022 revision 4 — current-source/reality review

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT` for this exact R4 snapshot only.**
`G-READY` remains **`NOT_READY`**.

R4 is a meaningful successor to the three frozen R3 rejections.  It closes the
previous bare `PlanPoint` with a typed, exact selection union; makes most
reason outcomes explicit; replaces the overlay/DCEL route with a transparent
changed-face mapping route; defines the requested field/ceiling/side lifecycle;
and correctly labels no-holes, miter-only, C8, formatter, Room and byte-format
rules as proposed source deltas.  It does not pretend that any of those changes
are canonical or that the required corpus/physical evidence exists.

Three remaining defects still prevent this document from becoming an
architecture-input hand-off.  Its CSS-U camera equations have incompatible
units, its digest grammar refers to an absent schema registry, and its own
single reason registry omits declared outcomes.  These are policy-totality
defects, not requests to silently amend PRD/SPEC/UX.  They can produce a wrong
mobile candidate, non-reproducible impact digest, or different diagnostic for
the same input.

## Checks that pass

- The reviewed file hashes exactly to
  `2711b00ee98e1bbf7649cae7ef4d51974c9a1615f9e712cebbcd9d9ab86b321b`.
- The three frozen R3 review hashes match the values declared by R4.
- `lint_spine.py` over the unchanged architecture workspace returned
  `ok: true`, `total_findings: 0`.  That mechanical result does not adopt R4.
- R4 preserves the canonical integer-mm / derived-or-session-only boundary,
  the sole `Room.heightMm` authority, atomic durability boundary and
  `NOT_READY` status.  It makes no implementation, test/CI, commit or release
  claim.
- The previous current-source R3 findings are substantively remediated in
  direction: §2.4 closes exact measurement targets and ingress; §§1.2/3.2
  supply named usable and unknown-host outcomes; and §4 retains bed-to-wall
  and other FR-13 paths without `MEASUREMENT_UNSUPPORTED`.
- The previous R3 external findings are materially addressed as proposals:
  separate camera-delta representation, raw finite ingress, bounded arithmetic,
  no overlay/DCEL matching, Q2 winding, complete metric witness/formatter
  direction, C8 rotation intent, canonical-byte framing, hole lifecycle,
  field/loss/ceiling coverage, side proof and non-recursive impact envelope.
- The working draft accurately marks source deltas rather than contradicting
  the current sources by assertion.  In particular, no-holes, changed-face
  preservation, miter-only, C8 catalog admission, the formatter, new reasons
  and canonical bytes still require the named owner reconciliations.

## Blocking findings

### D022-R4-CSR-01 — CSS-U, scale and world equations disagree by a factor of 256

**Evidence.** R4 defines `U=1/256 CSS px`, stores `relativeXU` and `panXU` as
CSS values divided by `U` (§2.1, lines 268–276), but stores
`scaleNumerator` as `rawScaleCssPerMm × Z`, with `Z=2^16`.  Its
`CameraDeltaV1` and `ScreenDistanceSqV1` then multiply the CSS-U integers by
`Z` without converting the U unit (§2.2, lines 320–340).

For a concrete valid input—scale `1 CSS px/mm`, zero pan, origin `(0,0)`, and
a pointer `100 CSS px` right of the canvas—the stated values are
`relativeXU=25,600`, `scaleNumerator=65,536`, and the draft computes
`dxNumerator/q = 25,600 mm`, not `100 mm`.  Consequently C4 chooses `k=256`
instead of `k=1`, and the exact witness at `(100 mm, 0)` is not a C1 hit under
the stated screen-distance formula.

**Consequence.** This breaks the source-owned origin-relative 100-mm gesture
policy, the UX candidate preview and the FR-13 touch-selection seam.  It is
also a different behavior from the equally plausible interpretation that the
scale is expressed in CSS-U per millimetre; two implementations cannot both
conform.

**Required correction.** Choose one unit system and carry it through every
camera, hit-square, RayProbe and C4 equation.  For example, a CSS-U expression
can quantize scale in `CSS-U × Z / mm`; alternatively every CSS-U delta must
be divided by 256 before it is combined with a CSS-pixel scale.  Update the
cap units and the named raw/C1/C2/C4 corpus goldens, including the simple
`1 CSS px/mm` counterexample above.  Do not leave the conversion to renderer
or browser convention.

### D022-R4-CSR-02 — `CanonicalBytesV1` defines primitives, not the schema needed to reproduce a digest

**Evidence.** Section 1.4 requires a registered `typeId`, numeric record
`fieldId`s and union/variant IDs (lines 206–224), but neither R4 nor any
referenced current source defines that registry for
`PreflightImpactContentV1`, `RoomSurvivorMapV2`, maps, field dispositions,
`SurfaceAddress`, policy bundles or their nested unions.  A single fixture for
one map/context/content (lines 226–232) cannot define encodings for the
remaining valid field/variant combinations.  Repository search finds no other
`CanonicalBytesV1`/`IECB1` registry.

**Consequence.** Two implementations can legitimately choose different type,
field or variant numbers and obtain different context/impact SHA-256 values
for the same valid candidate.  That violates NFR-4 determinism and makes
`IMPACT_DIGEST_MISMATCH`, replay and inverse validation implementation-owned
despite R4's intended fence.

**Required correction.** Add a closed, versioned R4 schema registry (or an
exactly pinned referenced artifact) that assigns every root/nested record,
field, union variant, enum, optional/empty form and sorting rule used by the
impact envelope.  Include `SafeIntegerMm`, `SurfaceAddress`, policy-bundle and
all map/acknowledgement variants, then provide fixture bytes for every variant
class.  The future source owner may decide where this proposal lives; the R4
input must make the proposed digest computable before that workflow begins.

### D022-R4-CSR-03 — the purported single reason registry still leaves declared paths unnamed

**Evidence.** R4 calls §1.2 the *only* reason/status registry and requires a
serializable subtype (lines 137–141).  Yet §2.2 says a stale/missing active
origin “yields no Draft” without an outcome (lines 311–313), and §2.3 says
`m<50 mm` is merely “Draft” (lines 410–415); neither is present in the table.
Also §3.1 says a non-simple centerline cycle fails before Room assignment,
whereas the allegedly exhaustive §3.2 usable-subtype list includes
`CENTERLINE_RING_ZERO_AREA` but no non-simple-centerline subtype (lines
450–516).  The table's hole rows do not cover that separate non-simple branch.

**Consequence.** The UI can choose between a disabled/no-result/unspecified
Draft for a stale gesture or too-short C4 vector, while Plan validation can
assign different codes to the same non-simple cycle.  This conflicts with the
current requirement for stable reason-code discriminated unions and with the
UX requirement to state that a candidate is not determined rather than choose
a library default.

**Required correction.** Add explicit draft-only outcomes for an invalid
active origin and sub-50 C4 delta, plus a named subtype and base-code mapping
for non-simple centerline rings.  Put each in §1.2, define validation
precedence where relevant, and add the corresponding corpus/UX cases.  The
names remain proposed until the Geometry Contract owner adopts them; R4 only
needs to eliminate implementation discretion.

## Ownership and readiness boundary

The current Geometry Contract still owns the miter-then-bevel rule and the
open Room matching direction; PRD owns FR-13/FR-15 and NFR-1–NFR-5; SPEC owns
capability scope; UX owns visible selection/confirmation; and the companion
contracts own import, backup and catalog implications.  R4 appropriately does
not claim to have changed any of them.  Once the three defects are corrected,
the proposed no-holes import state, C8 catalog compatibility and
`CanonicalBytesV1` must be reconciled with their relevant companion owners as
well as Architecture/PRD/UX.

The official readiness report continues to list D-022/FR-13, S-2, renderer,
control-plane, legal/catalog, participant and physical NFR-15 gates as open.
This review changes none of those facts and authorizes no root implementation,
test bootstrap, CI, commit or `READY` claim.

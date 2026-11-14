---
title: "InteriorsEditor — independent current-source review of D-022 revision 2"
review_type: current-source-reality-precanonical-policy-r2
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 0bbab7d0771a3a1a78b50ef3a58e3f723d828322cb36ff249c90f9d1f70cd167
  spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  architecture_memlog_sha256: 55a83cf0d999797f5e4c6d0802655c6f4e6483db4c7c3a581b3098fdb929622d
  spec_sha256: ce903b5aa4bf3f59efbd08d030dc7c292491315a1280cf1203f3114e517169ed
  geometry_contract_sha256: ca0efcc9126ac8ff92fa76eeafa32ac8dd3d13311d8d66758a68219b52cefbb0
  prd_sha256: 48bd0a416dad0e78ac65d3f616da7ded36500726ff2e0026650d7f93814d47eb
  ux_experience_sha256: ac20ff129bee180509fe3d83f2537f35672904c17a3fd5ae34eb9a407310cb29
  project_context_sha256: f1621cd2d6f00b5d53d76739cfb66d9daab5f8a68a49071b4ac2025edcdca2d4
  readiness_report_sha256: dd8d32fa23d4a135494157cc3a649c163da2ab8a57ec1e44b47b327adb8a9a3c
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../.memlog.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../../../project-context.md
  - ../../../implementation-readiness-report-2026-08-05.md
  - ../../../sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md
  - ../../../evidence/spikes/S-2/work-package.md
  - ../../../evidence/spikes/S-2/policy-boundaries.md
  - review-current-source-d-022-geometry-policy-2026-08-05.md
  - review-d022-adversarial-geometry-policy-2026-08-05.md
  - review-d022-topology-data-integrity-2026-08-05.md
status: complete
verdict: REJECT_FOR_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Independent read-only R2 review of the noncanonical D-022 working-policy input; no draft, canonical source, memlog, code, test, configuration, or evidence mutation"
source_mutations: none
---

# D-022 revision 2 — current-source/reality review

## Verdict

**`REJECT_FOR_PRECANONICAL_INPUT` for the reviewed R2 snapshot only.**
`NOT_READY` remains unchanged.

R2 resolves most of the prior draft's structural defects, but it still has
four load-bearing gaps: a required FR-13 measurement is declared unsupported,
one Room-height branch has no owned value, the reason taxonomy is both
internally inconsistent and partly unowned, and direction-score comparison does
not bind the rational denominator path. Until these are corrected, two
independent implementations can reject different valid user actions or create
different canonical endpoints/Room records.

This verdict rejects neither the delegated Product Owner direction nor the
need for a D-022 decision. It creates no source, architecture, implementation,
device or readiness authority.

## Independent checks

- All sixteen source and review paths declared by the R2 draft resolve.
- `lint_spine.py` over the unchanged architecture workspace returned `ok: true`
  and `total_findings: 0`. This mechanical result does not adopt the draft.
- Existing current Geometry Contract reason codes used by the draft were found:
  `AMBIGUOUS_INTERSECTION`, `PROJECT_BOUNDS_EXCEEDED`,
  `USABLE_POLYGON_COLLAPSED` and `ANCHOR_REHOST_AMBIGUOUS`.
- The current canonical reason list contains none of
  `GEOMETRY_EXACT_LIMIT`, `CANDIDATE_UNDETERMINED`,
  `NON_INTEGER_RAY_CONTACT`, `HOST_REBASE_UNSUPPORTED`,
  `MERGE_ATTACHMENT_MAP_INVALID`, `MERGE_PRECONDITION_FAILED` or
  `MEASUREMENT_UNSUPPORTED`.

## What R2 correctly remediates

| Earlier risk | R2 evidence | Result |
| --- | --- | --- |
| Truncating `BigInt` intersection | §§1.1–1.2 define `ExactRationalMm`, normalisation, exact cross multiplication and an integer-only admission gate; the 999-mm diagonal-X counterexample now rejects without rounding. | **Pass.** |
| Float/camera-selected canonical endpoint | §2 fixes a session-only `1/256 CSS px` snapshot, a quantised axis-aligned camera, rational ingress and zero domain tolerance; C1/C2 ties have a total source tuple. | **Substantially remediated; see score-comparator blocker below.** |
| Undefined C3/C4 handoff | §3 makes C3 explicitly empty in Alpha, defines exact C2 ray contact and C4's 100-mm `k` threshold/tie/failure behavior. | **Pass.** |
| Partial usable geometry | §8 defines Q2 normal form/sign/order, zero-determinant boundary normalisation, miter squared-distance tests and intentionally excludes bevel rather than using a float fallback. | **Pass as a proposed source delta.** It must still reconcile current Geometry Contract's bevel rule. |
| Informal merge/Room/Opening rules | §§5–7 introduce an exact axis-only attachment map, a bounded survivor map/property matrix, and distinguish host-wall edits from `MoveOpening`/`ResizeOpening`; diagonal automatic rebase is conservatively rejected. | **Pass as a detailed working proposal.** |
| S-2/readiness overclaim | The front matter, §§1/11 and corpus route keep `canonical: false`, S-2 `needs-further-evidence`, independent evidence and final `READY` prerequisites. | **Pass.** |

The R2 miter-only rule differs from the current Geometry Contract's
miter-then-bevel rule. That is a material proposed policy delta, but not an
unauthorised claim: the draft identifies itself as noncanonical and routes
source reconciliation through the owner workflows. It cannot be implemented
until that reconciliation accepts, replaces or rejects the delta.

## Blocking findings

### D022-R2-01 — R2 removes an Alpha FR-13 measurement instead of supplying its exact input model

**Evidence.** Draft lines 576–586 define a Q2 perimeter model, then declare
“generic arbitrary boundary distance” `MEASUREMENT_UNSUPPORTED` until a later
algebraic-metric policy. PRD FR-13 requires the user to see the **exact distance
between two selected points/item boundaries**, alongside wall/Room measurements;
UXF-1 uses a bed-to-wall clearance measurement. The current sources leave
rounding/locale open, not the measurement capability itself.

The R2 behavior therefore narrows a binding Alpha requirement without a PRD or
SPEC owner decision. It also introduces an unregistered reason name as if the
feature's unsupported outcome were an Alpha semantic.

**Required correction.** Either define a total ephemeral exact-distance input
type and rounding-bound procedure for every FR-13 supported selection, or
explicitly route a documented scope change to the PRD/SPEC owners. The working
input may not make the required distance action unavailable merely because its
value is outside Q2. Add exact-distance fixtures for object/Room boundaries and
confirm that all resulting text still uses the single product formatting seam.

### D022-R2-02 — The claimed total Room matrix depends on an undefined `Level default heightMm`

**Evidence.** R2 §6.2 resolves survivors and pure split children, but its
“Unmapped/mixed successor” row assigns `Level default heightMm`. Current
canonical sources define `Room.heightMm` as the sole editable height source and
refer only to an unspecified default Room height for an exterior wall; neither
SPEC, PRD, Geometry Contract nor the S-2 boundary defines a Level-owned default
height field, value, versioning rule or owner.

This is not harmless presentation state: the chosen height controls derived
wall height, Opening fit and ceiling hosts before the complete ChangeSet can be
validated. Different hidden defaults yield different accepted topology.

**Required correction.** Name a source-owned, versioned default-height policy
and its canonical location/range, or make zero/mixed-predecessor face creation
require an explicit `heightMm` in the same pre-validation command (or reject as
ambiguous). Do not call the Room matrix total until this branch is deterministic
and covered by corpus/UX confirmation cases.

### D022-R2-03 — Reason status is incomplete and `ExactGeometryLimitsV1` has conflicting outcomes

**Evidence.** §1.3 says any arithmetic budget overflow returns proposed
`GEOMETRY_EXACT_LIMIT`, while §8.3 says an
`ExactGeometryLimitsV1` failure returns existing
`USABLE_POLYGON_COLLAPSED`. The same versioned limit therefore has two outcome
codes without a phase boundary. In addition, `HOST_REBASE_UNSUPPORTED`,
`NON_INTEGER_RAY_CONTACT` and `MEASUREMENT_UNSUPPORTED` are absent from the
current reason registry and lack the explicit proposed/source-owned status that
R2 correctly gives some other new names.

Stable reason codes are part of the Geometry Contract's test/diagnostic
surface. A source owner cannot later tell whether a test should assert an
existing code, a draft-only diagnostic subtype or a new stable code.

**Required correction.** Add a draft-local reason-status table covering every
new identifier: existing stable reason plus permitted subtype, proposed stable
reason and named owner, or draft-only presentation diagnostic. Specify a single
outcome for each `ExactGeometryLimitsV1` phase (or distinguish its limits by
name). Do not promote any new name in canonical source or code before the
source-owner workflow adopts it.

### D022-R2-04 — Direction scoring does not explicitly retain inverse-camera rational denominators

**Evidence.** §2 makes the world pointer delta an inverse rational transform;
§3.3 then compares `dot(v,d)^2 / norm2(d)` and notes only that `norm2(d)` is 1
or 2. `v.x` and `v.z` still have the camera-scale denominator after inversion.
The prose does not require either a common unnormalised denominator for both
components or the complete rational score denominator in the cross product.

An implementation that compares only the squared dot numerators and the 1/2
direction norm is not bound to the same result as one that normalises each
component/ray score. This matters because that presentation winner becomes the
integer C4 endpoint entering the candidate path.

**Required correction.** Bind the comparator mechanically: if
`dot(v,d) = p_d / q_d`, compare positive scores as
`p_a² × q_b² × norm2(b)` versus
`p_b² × q_a² × norm2(a)`, or first require an explicitly preserved common
denominator and give the equivalent integer formula. Retain the fixed clockwise
order only after this equality comparison. Add non-unit camera-scale and
normalised-component fixtures at each direction tie.

## Ownership and readiness boundary retained

R2 correctly treats its new kernel/types/maps/limits as draft policy, not as a
replacement for the Architecture memlog, SPEC grammar, PRD capability or UX
copy. S-2 remains a disposable, non-terminal evidence experiment; its stated
scope excludes the new usable-polygon, Room, Opening and touch policy. The
official readiness report still lists D-022, S-2, G-1, physical NFR-15,
renderer, control-plane and legal gates as blocked.

The next revision should fix the four findings in this input, preserve the
noncanonical labels, complete the source-owned corpus and obtain fresh
independent reviews. Only then may the named Architecture/SPEC/PRD/UX owners
consider source reconciliation; `G-READY` remains `NOT_READY` throughout.

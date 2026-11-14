---
title: "InteriorsEditor — current-source review of D-022 working geometry-policy input"
review_type: current-source-reality-precanonical-policy
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../d-022-geometry-policy-decision-draft-2026-08-05.md
reviewed_snapshot:
  draft_sha256: 659c8f359df0bd0358a34d118550817f4e812ee5418a32b01208d7b325683f49
  spine_sha256: a648f0da31ce7bd66c161bbb98c0468ec0a4b84129c2219592767c8289a2b7b7
  architecture_memlog_sha256: 55a83cf0d999797f5e4c6d0802655c6f4e6483db4c7c3a581b3098fdb929622d
  spec_sha256: ce903b5aa4bf3f59efbd08d030dc7c292491315a1280cf1203f3114e517169ed
  geometry_contract_sha256: ca0efcc9126ac8ff92fa76eeafa32ac8dd3d13311d8d66758a68219b52cefbb0
  prd_sha256: 48bd0a416dad0e78ac65d3f616da7ded36500726ff2e0026650d7f93814d47eb
  ux_design_sha256: 02c18269245a71ea6a7058daead2268e56e81ef11c5bb459a40b294f09b02289
  ux_experience_sha256: ac20ff129bee180509fe3d83f2537f35672904c17a3fd5ae34eb9a407310cb29
  readiness_report_sha256: dd8d32fa23d4a135494157cc3a649c163da2ab8a57ec1e44b47b327adb8a9a3c
  change_proposal_sha256: 78ddbb5797b448e17c926c79abaf7fef36e8c9a4d1965194348d5921f70e6d92
  s2_policy_boundaries_sha256: 3e277ab7b66d0916fb4a2293e2b042580f4d25787dcd83976f5f416b3c39c18d
review_basis:
  - ../ARCHITECTURE-SPINE.md
  - ../.memlog.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../../decision-register.md
  - ../../../sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md
  - ../../../implementation-readiness-report-2026-08-05.md
  - ../../../evidence/spikes/S-2/work-package.md
  - ../../../evidence/spikes/S-2/policy-boundaries.md
status: complete
verdict: ACCEPT_AS_PRECANONICAL_INPUT
canonical_adoption: BLOCKED
readiness: NOT_READY
scope: "Independent read-only current-source review of the noncanonical D-022 draft; no draft, canonical source, memlog, code, test, configuration, or evidence mutation"
source_mutations: none
---

# D-022 working-policy input — current-source review

## Gate verdict

**`ACCEPT_AS_PRECANONICAL_INPUT`; `BLOCKED_FOR_CANONICAL_ADOPTION`; project
`NOT_READY`.**

The document is a useful, reviewable working packet. It clearly distinguishes
the Product Owner's delegated choice of a policy *input* from evidence and
from canonical adoption; it does not change a stable `AD-*`, `D-*`, source of
truth, `.memlog.md`, or readiness gate. It is therefore suitable for the next
owner workflow, not for implementation or an Architecture Spine update yet.

Two unresolved semantics below prevent an independent builder from producing
the same gesture or Room mutation. They are blockers to **canonical adoption**
of this packet, not a rejection of its noncanonical working status.

## Read-only checks

- `lint_spine.py` against the current architecture workspace returned
  `ok: true` with `total_findings: 0`.
- The hashes in the front matter identify the exact draft and primary source
  snapshot reviewed.
- `D-022` is an existing stable decision-register ID for topology/kernel
  policy. The draft neither renumbers it nor creates a competing `AD-*`.
  The reason codes it names (`ROOM_IDENTITY_AMBIGUOUS` and
  `USABLE_POLYGON_COLLAPSED`) already belong to Geometry Contract §11.

## Source-reality reconciliation

| Boundary | Evidence in the reviewed snapshot | Review result |
| --- | --- | --- |
| Delegation versus evidence | The draft front matter and lines 35–56 call it a noncanonical, delegated working input and preserve `NOT_READY`. The change proposal §4.3 calls D-022 candidates S-2-only until corpus evidence plus a fresh architecture workflow. S-2's own policy boundary says it is not an ADR and cannot choose tolerance, Room, Opening or usable-polygon policy. | **Pass.** Delegation selects a policy direction; it is not misrepresented as experimental, user, device or production proof. |
| Stable ownership | The draft leaves `canonical: false`, `architecture_spine_changed: false` and `memlog_changed: false`, then routes adoption through a fresh `bmad-architecture` update, followed by `bmad-spec`, `bmad-prd` and `bmad-ux` (§10). The Architecture memlog has no D-022 adoption record. | **Pass.** No draft is being smuggled into an authority surface. |
| AD-7 invariants | The draft preserves integer-mm canonical topology, ephemeral wider arithmetic, raw-value boundary, the active-origin positive-integer `k`, off-grid numeric path, total exact-contact partitioning and the shared `MeasurementFormatPolicy`. It does not broaden directions beyond cardinal/45°. | **Pass.** It supplements the current AD-7 Deferred list rather than overwriting its adopted seams. |
| Exact kernel and usable geometry | A domain-owned exact-kernel and ephemeral `BigInt`/`Q(√2)` proposal is compatible with AD-7's ban on library-owned semantics and with Geometry Contract §§1 and 7.1. Its corpus table correctly says this needs hand-reviewed golden results and an independent oracle may not become semantic authority. | **Acceptable only as a proposal.** S-2 does not evidence mixed-thickness/diagonal usable polygons, so this is not an adopted kernel selection. |
| Diagonal hosts and Openings | Geometry Contract §8 keeps the canonical segment orientation, requires deterministic reverse handling, lineage-based wall placement transfer and no hidden world-space orphan. The draft preserves the stored start, forbids a normalizer flip merely for sorting, requires explicit lineage and rejects a diagonal rebase when integer `offsetMm` cannot be preserved. Its corpus explicitly includes direction-reversal and diagonal hosted-opening cases. | **No direct contradiction.** Conservative reject is compatible with host safety. Canonical text must still make the explicit reverse-orientation mapping formula unambiguous. |
| Measurement formatting | Draft §8 deliberately leaves public locale and precision to PRD/SPEC/UX, while requiring every surface to receive one identical exact input through `MeasurementFormatPolicy`. That is exactly the AD-7, Geometry Contract §1 and UX §5.1.1 seam. | **Pass.** It does not choose a renderer-local precision or locale. |
| Readiness | The official 2026-08-05 assessment remains `NOT READY`: D-022, terminal spike evidence, G-1, physical NFR-15, renderer/control-plane/legal gates are all open. The draft repeats those boundaries and its §10 denies implementation authority. | **Pass.** This review changes none of those gates. |

## Canonical-adoption blockers

### D022-CR-01 — Candidate class 3 has no separate, exact construction rule

**Evidence.** The draft repeats AD-7's four classes at lines 138–143:
existing Vertex, intersection/end, constrained-direction candidate, then the
origin-relative 100-mm candidate. Its zero-tolerance boundary at lines 107–128
correctly prohibits converting a free pointer into a rounded point. But its
only construction formula after the first two classes is lines 158–172:
choose a ray from pointer angle, calculate nearest positive integer `k`, and
produce `origin + (100 × k) × d`.

That formula can be read as the third class, leaving class 4 undefined, or as
the fourth class, leaving class 3 undefined. It does not state what makes the
third class eligible, how its exact endpoint is constructed without prohibited
pointer rounding, or when a near non-zero movement is `Undetermined` rather
than a 100-mm `k = 1` candidate. Two conforming implementations can therefore
show different candidate classes/endpoints, contrary to UX §5.1.1's promise to
show the actual winning class and to keep an unresolved candidate as a
`DraftCommand`.

**Required before canonical adoption.** Define the constructor, eligibility
predicate and failure/`Undetermined` rule for **each** class separately, plus
the exact handoff from class 3 to the origin-relative 100-mm class. Include the
minimum movement/confirmation implication for `0 < |pointer-origin| < 50 mm`
or explicitly state that it intentionally yields `k = 1`. Add those cases to
the required presentation/domain corpus and UX-visible copy. No geometry
library or UI default may fill this gap.

### D022-CR-02 — Room properties have a nondeterministic carry/confirmation boundary

**Evidence.** Lines 238–247 define a deterministic mutual-unique-maximum rule
for `Room.id`. Immediately afterwards, line 249 says the unique child **may**
keep the predecessor's ID **and properties**, while the remaining child gets a
new ID and only `heightMm`; the summary at lines 65–69 instead says automatic
metadata copying is forbidden. Geometry Contract's `Room` includes name,
`heightMm` and surface assignments, and PRD FR-15 forbids silent name/finish
distribution pending a documented matching policy.

It is plausible that retaining values for the one same logical Room is
intended as identity preservation rather than a copy, but the current words do
not make that mandatory or enumerate the fields. One builder can preserve the
winner's name/finish without confirmation; another can reset them; a third can
ask for confirmation. All three fit “may”, yet produce different durable
ChangeSets and previews.

**Required before canonical adoption.** State one deterministic matrix for
unchanged, unique split, unique merge and explicit equal/ambiguous mapping:
which fields remain because the Room identity is retained; which new Room fields
default; which loss/conflict requires an explicit confirmation; and how the
selected mapping plus consequences enters the complete ChangeSet. Keep
`Room.heightMm` as the sole editable height source and include the matrix in
the Room corpus/UX preview fixtures.

## Non-blocking clarification retained for the owner workflow

The diagonal attachment proposal is safe as a conservative working policy, but
“does not require implicit reverse orientation” needs one source-owned meaning
before adoption. Define whether a lineage mapping may explicitly reverse a
derived segment and, if so, the exact `offsetMm` transformation for an Opening
and `WallPlacement`; preserve the current rule that a diagonal rebase which
cannot remain an integer is rejected. This is a precision clarification, not a
finding that the present draft conflicts with Geometry Contract §8.

The 44×44 CSS-px hit region is also correctly marked as a working UI hit policy
and not a domain epsilon or physical-device claim. The UX Design system applies
44×44 to the general interactive area, while NFR-17 names DOM targets; neither
one fixes an exact canvas-projection tolerance. The draft therefore still needs
its promised multi-DPR/zoom corpus plus G-1/physical-phone usability evidence
before this hit region can be called an accepted product tolerance.

## Required route and retained status

1. Resolve `D022-CR-01` and `D022-CR-02` in the working packet; do not alter
   an AD or canonical companion as a shortcut.
2. Produce the source-owned, versioned corpus named in draft §9, including the
   explicit diagonal-host/reversal and measurement-input cases.
3. Run the fresh architecture owner workflow: append accepted constraints and
   decisions to the memlog, re-distil only affected stable ADs, lint and run
   independent reviewer lenses.
4. Let SPEC, PRD and UX owners reconcile their respective contracts and
   acceptance surfaces; then update epics/traceability and reassess the bounded
   topology gate.
5. Re-run official readiness only after those steps and the remaining evidence
   gates. `G-READY` stays closed and no production code, root configuration,
   test suite, deployment or device claim is authorized by this review.

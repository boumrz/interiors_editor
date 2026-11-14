---
title: "InteriorsEditor — draft reconciliation for D-011…D-013 and valid X routing"
status: draft-remediated-awaiting-independent-rereview
canonical: false
implementation_ready: false
readiness: NOT_READY
date: 2026-08-05
revision: 7
scope: "D-011 origin-relative gesture construction, D-012 constrained diagonal normalization, D-013 off-grid numeric input; source routing for delegated valid-X default"
proposed_architecture_delta: "amend AD-7 only; do not allocate a new AD"
review_inputs:
  - reviews/review-current-source-topology-policy-2026-08-05.md
  - reviews/review-topology-policy-adversarial-2026-08-05.md
  - reviews/review-topology-data-integrity-d011-d013-2026-08-05.md
  - reviews/review-current-source-topology-policy-revision-4-2026-08-05.md
  - reviews/review-topology-policy-adversarial-r4-2026-08-05.md
  - reviews/review-current-source-topology-policy-revision-5-2026-08-05.md
  - reviews/review-topology-policy-adversarial-r5-2026-08-05.md
  - reviews/review-topology-data-integrity-r5-2026-08-05.md
  - reviews/review-topology-policy-adversarial-r6-2026-08-05.md
  - reviews/review-current-source-topology-policy-revision-6-2026-08-05.md
review_pending:
  - current-source/reality re-review of revision 7
  - adversarial lower-level divergence re-review of revision 7
  - topology/data-integrity re-review of revision 7
sources:
  - ARCHITECTURE-SPINE.md
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md
  - ../../evidence/spikes/S-2/work-package.md
  - ../../evidence/spikes/S-2/policy-boundaries.md
  - ../../evidence/spikes/S-2/test-report.md
---

# Draft reconciliation: D-011…D-013

## Status and authority boundary

Product Owner delegated the working-policy choices in the sprint change
proposal. This document turns `D-011`, `D-012`, and `D-013` into one
reviewable architecture delta. It also records the narrowly delegated valid-X
working default from proposal §4.3.1 solely to reconcile the otherwise hidden
`FR-9` source conflict. That routing does **not** select a geometry kernel or
close `D-022`.

It is **not** an Architecture Spine update, ADR, change to the decision
register, PRD, UX contract, SPEC, or geometry companion. In particular it
does not make `S-2` terminal, select a geometry kernel, authorize product
code, or change `G-READY` from `NOT_READY`.

No `.memlog.md` was changed for this draft. Appending the canonical
architecture decision log before the required re-distill and independent
reviewer gate would incorrectly make a pre-gate proposal look adopted.

## Evidence that can and cannot support this draft

| Evidence | Supports | Does not support |
| --- | --- | --- |
| Delegated change proposal §§4.2, 4.2.1 and 4.3.1 | The working-policy intent: 100 mm candidate construction relative to the active gesture origin, adaptive visual grid, eight directions, quantised integer diagonal endpoints, valid integer off-grid numeric input, and an otherwise valid exact X split. | Canonical adoption by a source-owning workflow or closure of `D-022`. |
| `geometry-contract.md` §§1, 4 and 6 | Integer-mm canonical coordinates, eight 45° directions, `n = round(L / √2)` preview semantics, visual-grid/snap separation, and mandatory T split. | Concrete screen-space tolerance, display-rounding thresholds, canonical valid-X text, or a library choice. |
| S-2 43/43 test corpus and independent review | A disposable kernel can reject malformed/fractional state, preserve exact integer candidates, and make T/X behavior explicit rather than inherit an accidental library default. | User-facing grid/touch behavior, tolerance, diagonal normalization of near input, or production portability. |
| S-2 policy boundaries | The unresolved kernel, tolerance, merge, Room, opening and usable-polygon boundaries that must remain explicit. | A library selection, a replacement for production corpus, or a physical/mobile claim. |

`S-2` remains `needs-further-evidence`; its own work package says that an
authorized Architecture update follows independent evidence, not that the
prototype itself is the product specification.

## Review-remediation status

Revision 7 incorporates the two current-source revision-5 corrections:
mandatory JSON metadata/Portable Backup representation and total exact-contact
normalization for a pre-existing Vertex in a proposed segment interior. It also
folds the accepted topology/data-integrity revision-5 carry-forward: the
diagonal preview names its selected signed delta. It retains the revision-5
construction-only `SnapPolicy`, durability and origin-relative-snap boundaries.
It corrects adversarial revision-6's container-path finding: the canonical
entry is `project/project.json` **inside** the `.interiors` bundle. It is
**not** reviewer-gate passed: every completed review applies to an earlier
revision, so fresh current-source, adversarial and topology/data-integrity
re-reviews of revision 7 remain required before any canonical update.

## Proposed architecture delta — amend AD-7, do not add an AD

`AD-7` is already the single invariant that prevents touch, numeric input and
a geometry library from assigning different semantics to constrained geometry.
The delegated decisions tighten that existing rule. A new `AD` or an `ADR-G1`
would wrongly imply that `D-022` (kernel and remaining tolerance evidence) is
also closed.

### Exact proposed replacement for the AD-7 Rule

> **Rule:** The canonical Plan stores no grid coordinate, visual-grid step,
> floating-point endpoint, `BigInt`, or mutable snap/measurement policy. Every
> untrusted geometry number crosses one lossless `SafeIntegerMm` boundary. UI
> text is validated before conversion against the signed integer grammar
> `^-?(?:0|[1-9][0-9]*)$` (no whitespace, `+`, decimal or exponent form). A
> persistence/import decoder retains each raw JSON numeric lexeme for a
> persisted coordinate, dimension, offset, delta or serialized Command field
> and validates that same grammar before any host IEEE-number materialization;
> an ordinary `JSON.parse`/reviver after coercion is never an acceptance
> boundary. Canonical Project metadata remains JSON, and every Portable Backup
> contains that canonical Project JSON at mandatory `project/project.json`
> **inside the `.interiors` bundle**; the schema-aware raw-token decoder runs
> inside that JSON boundary. A non-JSON internal
> repository encoding cannot become an alternate canonical format through this
> AD-7 delta and would require a separate AD-4/Project-and-Backup owner
> decision. A typed runtime number is admitted only through that validated
> `SafeIntegerMm` constructor, with
> `Number.isSafeInteger(...)` as a final runtime guard rather than lexical
> proof. Raw `-0` normalizes to canonical `0` before length/delta classification
> and canonical serialization emits `0`.
>
> Before ephemeral exact-geometry `BigInt` arithmetic, every coordinate, delta
> and requested length is admitted to the canonical signed-safe-integer domain
> and checked against applicable `ProjectLimitsPolicy` limits; the resulting
> endpoint is checked again before publication. Interactive fractional, `NaN`,
> infinite, malformed or unsafe input rejects with `INVALID_DIMENSION`; an
> out-of-limit coordinate or endpoint rejects with
> `PROJECT_BOUNDS_EXCEEDED`. A persisted/imported numeric token that fails the
> lossless schema boundary rejects with the stable serialization/import reason
> selected by `bmad-spec` when it owns `geometry-contract.md` §11 and the
> Project/Backup import contract; this draft deliberately does not introduce
> a serialization reason code. `BigInt` may be used only as ephemeral exact
> geometry arithmetic and never appears in Project, Revision, History, Command
> payload or Portable Backup. Signed coordinates/deltas remain plain
> JSON-serializable integer-mm values, and a raw conversion exception is never
> the user-visible outcome.
>
> A requested length has the additional total boundary: `L < 0` rejects with
> `INVALID_DIMENSION`; zero (including normalized lexical or programmatic
> `-0`) selects `ZERO_LENGTH` before any direction predicate; and only a
> positive signed-safe integer within the applicable limit reaches diagonal
> normalization. Gesture and numeric paths may select a candidate differently,
> but both then use the same detached sequence: `total parse → detached
> normalize → detached candidate/complete ChangeSet → full
> topology/Room/Opening/host validation → Validated | Rejected`. A
> parse/normalization/topology/validation rejection retains the current Durable
> Revision byte-for-byte, creates no HistoryEntry, autosave, canonical
> projection publication or `PendingDurability` candidate, and may expose only
> a UI preview plus stable reason/safe field context. Only `Validated` may
> enter `PendingDurability` and the AD-3 atomic-durability path. A persistence
> failure after `Validated` is not a rejection: the current Durable Revision
> and History remain unchanged, no false saved claim or Durable projection is
> published, and the pending candidate/journal remains available only for
> retry or recovery export while the next mutating commit is fenced. A stale
> worker result is discarded under AD-12 rather than being reclassified as a
> persistence failure.
>
> For every non-zero integer delta `(dxMm, dzMm)`, a direction is permitted
> exactly when one component is zero and the other is non-zero, or when
> `abs(dxMm) = abs(dzMm)`. Equivalently, the delta is `k × d`, where `k` is a
> positive integer and `d` is one of `(±1,0)`, `(0,±1)`, `(±1,±1)`.
> Every other delta rejects with `UNSUPPORTED_DIRECTION`; no path rounds it to a
> nearest angle. A length-only diagonal request has the mutually exclusive
> normalized form `DiagonalLengthRequest { origin, direction: NE|NW|SE|SW,
> lengthMm }`; missing quadrant/direction is rejected rather than inferred from
> pointer history. Exact endpoint/delta input instead preserves its supplied
> signs and derives one permitted discrete direction; it is never reinterpreted
> as a length request.
>
> The 100 mm gesture base candidate is relative to the active gesture origin,
> never a global-coordinate lattice. Given the selected permitted unit direction
> `d`, its quantised candidate is `origin + (100 × k) × d`, where `k` is a
> positive integer; an off-grid origin therefore still constructs an exact 45°
> endpoint. The visual grid may display only 100, 500, or 1,000 mm cells
> according to zoom; changing that display step neither changes an already
> selected candidate nor validates, rounds, persists, or rewrites a coordinate.
> The delegated working candidate-class order remains: eligible exact existing
> Vertex, eligible exact intersection/end, constrained-direction candidate,
> then the origin-relative 100 mm candidate. Exact numeric input bypasses this
> gesture selection and its valid off-grid `k × d` delta is not required to be a
> multiple of 100 mm. A free gesture never silently changes a supplied numeric
> endpoint. The meanings of “eligible”, screen-space tolerance, equal-candidate
> ties, selection of `k`, and visual-grid hysteresis remain open
> architecture/UX policy; no geometry library may supply an implicit alternative.
>
> `UiState` alone owns zoom and visible grid step. The canonical `SnapPolicy`
> term names construction-only candidate selection: its configuration, identity
> and any in-memory snapshot enter neither Project, Revision, History, a
> persisted Command nor Portable Backup. Only resolved integer endpoints and a
> validated complete ChangeSet progress to the AD-3 path; a Durable Revision is
> never re-normalized by a later `SnapPolicy`. A live `DraftCommand` may retain
> its selected candidate only in the current app session; it is neither
> portable nor replayable, and a new app session cannot reconstruct or
> reinterpret it under a changed policy. PWA reload/update timing, prompts and
> recovery remain governed by AD-11. This delta introduces no policy registry,
> version payload, ReleaseManifest mapping or policy-migration scope.
>
> Exact numeric input bypasses only visual/gesture selection, not topology
> normalization. Before full validation, the detached candidate groups **every
> exact candidate/Plan contact** by coordinate: candidate endpoint/existing
> Vertex, candidate endpoint/existing WallSegment interior, candidate
> interior/existing Vertex (including an existing multi-Wall junction), and
> candidate interior/existing WallSegment interior. Each group reuses its one
> existing Vertex when present, otherwise creates exactly one common Vertex.
> Every proposed or existing WallSegment whose interior contains a grouped
> contact is atomically partitioned at all of its distinct grouped coordinates,
> ordered along that segment, into only distinct consecutive endpoint pairs.
> Thus even a single proposed-segment interior pass-through of an existing
> Vertex partitions the proposed segment; endpoint/interior is the required T
> case; and a single valid exact X is the corresponding one-Vertex/four-piece
> case. The detached complete ChangeSet contains no zero segment, duplicate or
> coincident Vertex, unsplit accepted contact or first-crossing-only result. A
> non-integer crossing, out-of-limit coordinate, collinear overlap,
> self-intersection, duplicate/too-short partition result or any failed full
> Plan invariant rejects the whole candidate before Command or Revision
> mutation. Near-contact tolerance and the geometry-kernel choice remain open
> under `D-022`; they cannot be inferred from a library default.
>
> A requested positive integer diagonal length `L` uses integer endpoints
> with `abs(deltaXmm) = abs(deltaZmm) = n`, where `n` is the nearest integer to
> `L / √2`. Given explicit selected `d`, the candidate endpoint is
> `start + n × d`; normalization chooses magnitude only. It uses exact
> integer/`BigInt` comparison, not a persisted or authoritative binary float:
> choose the unique `n` satisfying `(2n − 1)² < 2L² < (2n + 1)²`. The preview
> shows the selected signed `deltaXmm × deltaZmm` (for example,
> `+707 × -707 mm`) and exact squared length `2n²` before confirmation. Only
> resolved integer endpoints enter a Command.
>
> The delegated valid-X working default therefore remains explicit: an
> otherwise valid exact X creates one shared Vertex and four canonical
> WallSegment pieces atomically. T selection continuity, merge consequences
> and other UI consequences remain deferred. This is a policy input that
> aligns the working rule with current PRD FR-9; it neither selects a geometry
> kernel nor closes `D-022`.
>
> Preview, 2D/3D measurement surfaces and export request approximate diagonal
> text from one product-owned `MeasurementFormatPolicy`, supplied the same
> exact squared length. Its precision and locale remain a PRD/SPEC/UX decision,
> but no renderer, export adapter or UI component chooses independent rounding,
> and formatted text is never parsed back into a Command or Revision. Merge,
> Room reconciliation, opening relocation, usable-polygon joins, the concrete
> screen-space tolerance values, and the geometry-kernel choice remain open;
> they cannot be inferred from a library default.

The strict inequalities are deterministic for every positive integer `L`:
equality would compare an odd square with the even value `2L²`, so there is no
unrecorded half-way tie. Minimum-wall validation remains a later full-invariant
check; normalization itself does not convert a short candidate into a Command.

### Exact proposed companion wording for `geometry-contract.md` §§4 and 6

Only `bmad-spec` may re-derive this companion. The following is candidate text
for that workflow, not a manual edit:

> **Grid, snap and numeric input.** The visual editor grid is infinite and is
> not Gridfinity storage. Its visible cell is 100, 500, or 1,000 mm according
> to zoom; `UiState` owns that presentation and it never changes canonical
> coordinates. The 100-mm gesture base candidate is relative to the active
> gesture origin, not a global-coordinate lattice: after a permitted unit
> direction `d` is selected, it is `origin + (100 × k) × d`, `k > 0`. Thus an
> off-grid origin still produces an exact 45° candidate. The delegated working
> candidate-class order is eligible existing Vertex, eligible exact
> intersection/end, constrained direction, then this origin-relative 100-mm
> candidate. Exact numeric input bypasses that visual selection and may use any
> valid integer `k × d` delta. Eligibility, screen-space tolerance, ties,
> selection of `k` and hysteresis remain source-owned policy; a library cannot
> silently define them.
>
> Every untrusted geometry number reaches canonical state only through a
> lossless `SafeIntegerMm` boundary. UI text and raw persistence/import numeric
> lexemes use `^-?(?:0|[1-9][0-9]*)$`; the schema-aware decoder validates each
> persisted coordinate, dimension, offset, delta and serialized Command field
> before host-number coercion. Ordinary `JSON.parse` or a reviver after
> coercion is not validation. Canonical Project metadata remains JSON, and every
> Portable Backup contains it at mandatory `project/project.json` inside the
> `.interiors` bundle; this decoder runs inside that format. A typed runtime number must originate at this
> boundary, with `Number.isSafeInteger(...)` only as a final guard. Raw `-0`
> becomes canonical `0` before length/delta classification. Interactive
> malformed/fractional/nonfinite/unsafe input rejects with `INVALID_DIMENSION`;
> bounds reject with `PROJECT_BOUNDS_EXCEEDED`; negative length rejects with
> `INVALID_DIMENSION`; zero length rejects with `ZERO_LENGTH`. A persisted
> schema violation uses the serialization/import reason chosen by `bmad-spec`
> in geometry-contract §11 and the Project/Backup import contract; this
> candidate text creates no new reason code. `BigInt` is ephemeral exact
> geometry arithmetic only and never serializes.
>
> Every non-zero endpoint delta is allowed only when exactly one component is
> zero or their absolute values are equal; zero selects `ZERO_LENGTH` first and
> no nearest-angle correction exists. A length-only request has
> `DiagonalLengthRequest { origin, direction: NE|NW|SE|SW, lengthMm }`. For
> positive integer `L`, choose `n` by `(2n − 1)² < 2L² < (2n + 1)²`, then
> construct `start + n × selectedDirection` and preview the selected signed
> delta/exact squared length. Gesture and numeric candidates share one detached full
> invariant/atomicity path.
>
> **Construction state, intersections and measurement.** `SnapPolicy` is
> construction-only and does not enter Project, Revision, History, persisted
> Command or Portable Backup. Durable Revisions retain resolved endpoints only
> and are never re-normalized. A live `DraftCommand` is current-session-only,
> never portable/replayable; PWA reload/update lifecycle remains AD-11. A
> rejected candidate creates no `PendingDurability`; a post-validation
> persistence failure retains the pending candidate/journal only for
> retry/recovery export and fences the next mutating commit per AD-3. Group
> every exact candidate/Plan contact by coordinate—endpoint/Vertex,
> endpoint/interior, candidate-interior/Vertex (including a junction), and
> interior/interior—then reuse one existing Vertex or create one shared Vertex.
> Partition every proposed or existing segment whose interior contains a group
> coordinate at every distinct ordered contact into non-zero pieces. Thus a
> singular candidate-interior pass-through of an existing Vertex, T and every
> X crossing are all atomic complete ChangeSets; invalid/non-integral,
> overlapping, self-intersecting or otherwise invalid candidates reject whole,
> without a partial Command. Preview, 2D, 3D and export use one
> `MeasurementFormatPolicy` from the same exact squared length; its formatted
> output is never command input. The owner workflows must reconcile this X
> wording with FR-9 before canonical adoption; tolerance and the geometry
> kernel stay open.

## Required verification before canonical adoption

The S-2 evidence does not exercise this complete delta. The gate must require
new or reconciled corpus cases, without reusing S-2 implementation code as a
production module:

1. Lossless ingress cases cover malformed, decimal, exponent, nonfinite,
   unsafe, negative and raw-negative-zero values; `Number.MAX_SAFE_INTEGER`
   boundaries; ProjectLimits boundaries; origin-plus-normalized-delta overflow;
   and corrupt persisted primitives. Raw-byte Project/Backup fixtures include
   values such as `99999.000000000000001`, `9007199254740991.1` and an excluded
   exponent form, proving validation occurs before host `JSON.parse` coercion.
   They use mandatory JSON metadata at `project/project.json` inside the
   `.interiors` bundle and prove the nested
   `.interiors/project/project.json` path is rejected by the Backup
   path/schema boundary. They also prove the `bmad-spec`-owned
   serialization/import reason mapping, no raw conversion exception, and that
   no `BigInt` enters JSON, backup, Command payload or Revision.
2. Given the same positive origin/explicit quadrant/`L`, normalization yields
   identical integer endpoints and `2n²` in every implementation that claims
   local-Project geometry. The corpus proves the integer predicate rather than
   relying on `Math.round`, covers every diagonal sign, reversed Walls and
   negative origin, proves that a missing quadrant is rejected, and exposes
   the selected signed delta rather than a generic `±` placeholder.
3. Off-grid active-origin cases cover every cardinal/diagonal direction and
   prove `origin + (100 × k) × direction`; existing off-grid Vertex and exact
   intersection/end candidates retain their working class order without a
   global lattice. Zoom changes leave accepted Plan and a rejected candidate
   semantically unchanged. The eventual source-owned tolerance, equal-tie,
   `k`-selection and hysteresis corpus must make those still-open rules
   explicit rather than inherit a library default.
4. Valid off-grid numeric scalars and invalid non-45° deltas prove the total
   direction predicate. Parse/normalization/topology/validation rejection and
   stale `baseRevisionId` discard leave the prior Durable Revision, History,
   writer state, durable autosave signal and canonical projection publication
   unchanged, with no `PendingDurability`. A persistence failure after
   `Validated` instead preserves its pending candidate/journal for only retry
   or recovery export, keeps Durable Revision/History current and fences the
   next mutating commit.
5. Exact endpoint reuse, endpoint/interior T contacts, a singular and multiple
   candidate-interior pass-through of an existing Vertex (including a
   multi-Wall junction), one-X and multi-X candidates prove one common Vertex
   per distinct exact coordinate and a complete detached partition of every
   affected segment. Duplicate contact, zero/too-short segment,
   fractional/out-of-limit/self-intersecting/overlap cases prove
   whole-candidate rejection before partial mutation. These cases remain
   evidence inputs, not a promotion of S-2 source.
6. Construction-only `SnapPolicy` cases prove that no policy configuration,
   identity or input intent appears in Project, Revision, History or Portable
   Backup; later policy changes never re-normalize resolved endpoints. A live
   `DraftCommand` is current-session-only. PWA update/reload compatibility is
   tested under AD-11, not as a new policy-migration or backup contract here.
7. One golden diagonal is formatted through preview, 2D, 3D and export via the
   same `MeasurementFormatPolicy`; formatted text cannot be parsed back into
   a command. Browser/mobile tests cover the visible preview and numeric
   alternative but remain separate from physical `NFR-15` evidence.

## Deliberately outside this delta

The following rows stay open even though S-2 contains executable candidates:

- geometry-kernel/library choice, concrete tolerance values and corresponding
  corpus across required environments (`D-022` remains open);
- T/X selection continuity, merge policy and associated UI consequences;
- Room identity overlap/lineage rule and metadata preview;
- Opening behavior when a Wall is resized/deleted;
- concrete screen-space tolerance, equal-candidate tie and visual-grid
  hysteresis values, including the gesture selection of relative-step `k`;
- measurement precision/locale, while the common formatting seam is fixed;
- usable-polygon rounding/corpus and any change to its existing provisional
  inward-offset/miter-cap/deterministic-bevel rule.
- PWA update/reload timing and Project-schema migration, which remain governed
  by existing AD-11 rather than a `SnapPolicy` compatibility contract.

Those boundaries prevent a plausible but false conclusion that `D-011…D-013`
plus the valid-X working input turn the current S-2 prototype into `ADR-G1` or
a reusable product kernel.

## Exact gate required next

After the revision-7 independent re-reviews are complete, a fresh
`bmad-architecture` **update** must perform this sequence against the existing
architecture workspace:

1. Append the approved decision and any remaining assumptions/questions using
   `_bmad/scripts/memlog.py` only; keep `AD-7`'s ID stable and re-distill the
   Spine from that log.
2. Reconcile the resulting AD-7 text independently against the PRD (including
   FR-9), SPEC geometry companion, UX interaction contract, delegated change
   proposal and S-2 policy boundaries. `bmad-spec` owns the lossless
   JSON grammar, raw-token decoder and serialization/import reason mapping
   through `geometry-contract.md` §11 and the Project/Backup contract; it must
   preserve mandatory `project/project.json` inside the `.interiors` bundle,
   reject the nested `.interiors/project/project.json` path, and not copy an
   S-2 reason code without that owner decision. Resolve the X wording in all
   three source owners rather than leaving a PRD/geometry contradiction.
3. Run the deterministic mechanical gate:

   ```sh
   uv run .agents/skills/bmad-architecture/scripts/lint_spine.py \
     --workspace _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26
   ```

4. Run the rubric walker and all three configured reviewer lenses in parallel:
   current-source/reality checking, adversarial lower-level divergence, and
   topology/data-integrity. Each reviewer writes its own review under
   `reviews/`; earlier-revision rejection reports do not substitute for
   re-review of the distilled Spine.
5. Apply only clear reviewer fixes, retain unresolved S-2 policies as
   `Deferred`/open questions, then route companion/PRD/UX changes to their
   owner workflows (`bmad-spec`, `bmad-prd`, `bmad-ux`). Update
   `project-context.md` only after canonical adoption.

Until all five steps complete, this file remains a review input. It authorizes
neither a root scaffold nor a production test/configuration change, and it
does not advance implementation readiness.

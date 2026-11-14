---
title: "Adversarial architecture review — topology-policy reconciliation draft"
date: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewer_lens: "adversarial lower-level divergence"
reviewed_artifact: "../topology-policy-reconciliation-draft-2026-08-05.md"
scope: "D-011 grid, D-012 diagonal normalization, D-013 off-grid numeric input"
verdict: "BLOCKED_FOR_CANONICAL_ADOPTION"
implementation_ready: false
spine_changed: false
memlog_changed: false
---

# Независимый adversarial review: D-011…D-013

## Verdict

**`BLOCKED_FOR_CANONICAL_ADOPTION` — P1 findings below must be corrected and
re-reviewed before the draft can be distilled into `AD-7`.** The draft is a
useful non-canonical input and correctly does not itself change `G-READY` from
`NOT_READY`; this review does not change that status, `S-2`, the Architecture
Spine, a companion, the decision register, or any implementation artifact.

The nearest-integer inequality itself is sound for a bounded positive integer
`L`: the midpoint equality is impossible because it would equate an odd square
with `2L²`. The blockers are the missing input/serialization boundary and the
places where two compliant lower-level units could still construct different
plans or user-visible measurements.

## Sources and method

Read-only comparison of the exact proposed replacement and companion candidate
against:

- `SPEC.md`, its companions (especially `geometry-contract.md`) and the
  canonical glossary;
- PRD `FR-7`–`FR-13`, `FR-15` and `NFR-1`–`NFR-4`;
- UX `EXPERIENCE.md` gesture flows and numeric alternative;
- `project-context.md` domain/serialization boundary;
- delegated change proposal §4.2–4.3; and
- S-2 work package, policy boundaries, test report and independent review.

This is the configured second reviewer lens, not an Architecture update. No
technology version was introduced or changed, so there was no version claim to
web-verify. No code, test, configuration, Spine or `.memlog.md` was edited.

## P1 findings — correct before canonical adoption

### P1-1 — `any signed integer` plus `BigInt` leaves an unsafe and non-serializable boundary

The proposed rule says an endpoint/delta may be “any signed integer” and then
requires `BigInt` arithmetic ([draft lines 69–83](../topology-policy-reconciliation-draft-2026-08-05.md#L69-L83)). That is wider than the existing domain contract: coordinates are **signed safe integers** and must stay in Project bounds ([geometry contract lines 11–15 and 61–64](../../../specs/spec-interiors-editor-alpha/geometry-contract.md#L11-L15)), while domain/application values must be plain serializable values
([project context lines 68–71](../../../../project-context.md#L68-L71)).

Two lower-level units could therefore both claim compliance but diverge:

1. a UI parses decimal `9007199254740993` through JavaScript `Number`, silently
   changes it to `9007199254740992`, then normalizes it; and
2. another parses it losslessly as `BigInt`, or stores a `BigInt` directly in a
   Command/Revision and subsequently cannot JSON-serialize the portable data.

S-2 only proves a disposable runtime rejects malformed/fractional data before
its own `BigInt` calculations; it explicitly does not establish persistence,
backup or a production numeric policy ([S-2 policy boundaries lines 23 and
56–58](../../evidence/spikes/S-2/policy-boundaries.md#L23)).

**Required wording correction.** Before the formula, make the boundary total:

> Coordinate, delta and requested length input is parsed losslessly as a
> signed base-10 integer token. Before candidate construction it must be in the
> canonical signed-safe-integer domain and the resulting endpoints must satisfy
> `ProjectLimitsPolicy`; otherwise the candidate is rejected with the existing
> stable dimension/bounds reason and no normalization or coercion occurs.
> `BigInt` may be used only as ephemeral arithmetic for a predicate. It never
> appears in `Project`, `Revision`, `History`, Command payloads or Portable
> Backup; validated endpoints remain plain serializable integer-mm values.

The exact stable reason-code mapping and input lexical grammar need the
geometry/SPEC owner, but they cannot be left to each UI/parser.

### P1-2 — a 100-mm base snap has no lattice origin or precedence, so gesture units can build incompatible walls

`Gesture construction uses a 100 mm base snap` ([draft line 64](../topology-policy-reconciliation-draft-2026-08-05.md#L64)) does not say whether that lattice is global, relative to the active Vertex, or how it competes with an existing off-grid Vertex or valid intersection. This is material because D-013 permits an exact off-grid Vertex ([change proposal lines 98–100](../../sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md#L98-L100)).

For a start Vertex `(125, 0)`, one implementation can snap a horizontal
gesture to a global `(100 × 100)` lattice and produce `(200, 0)`; another can
apply the same 100-mm step relative to the start and produce `(225, 0)`. A
third can attach to an existing off-grid Vertex before considering the grid.
All preserve integer-mm coordinates and the direction constraint, but they
produce different Plans.

The current geometry companion already distinguishes candidate types and has a
provisional priority where existing Vertex/intersection precede grid snap
([geometry contract lines 84–102](../../../specs/spec-interiors-editor-alpha/geometry-contract.md#L84-L102)). The draft moves priority outside its scope, which is valid only if it does not pretend the base snap alone is an implementable deterministic rule.

**Required wording correction.** Retain the deliberate deferral, but bind the
seam explicitly:

> The 100-mm base step applies only to the linear-grid candidate of the
> product-owned `SnapPriorityPolicy`. That policy must name the lattice origin
> and the precedence of existing Vertex, valid intersection/end, constrained
> direction and grid candidates before gesture implementation. It must never
> rewrite an exact numeric candidate or an already selected candidate.

Until that policy is adopted, a canonical AD-7 update may record the 100-mm
working baseline but cannot authorize a gesture implementation to choose a
local/default precedence or lattice origin.

### P1-3 — the replacement weakens the existing T invariant and leaves a current PRD/X conflict unowned

The proposed replacement calls **“X/T default behavior”** separately versioned
([draft lines 85–88](../topology-policy-reconciliation-draft-2026-08-05.md#L85-L88)). That weakens the current geometry companion, which already requires an
exact T intersection to create a common Vertex and split the affected Wall;
only X has a declared open split-versus-reject decision
([geometry contract lines 149–159](../../../specs/spec-interiors-editor-alpha/geometry-contract.md#L149-L159)). A lower-level implementation could now reject an exact T as its
“T policy” while another splits it, even though both read the replacement
literally.

There is also a source conflict that this delta cannot silently hide: PRD
`FR-9` says a geometric intersection creates the common Vertex and necessary
segments atomically ([PRD lines 239–246](../../prds/prd-InteriorsEditor-2026-07-26/prd.md#L239-L246)), while the current geometry companion permits X rejection. The
S-2 candidate deliberately exercised both X choices and records neither as
adopted ([S-2 policy boundaries lines 25–26 and 36–39](../../evidence/spikes/S-2/policy-boundaries.md#L25-L39)).

**Required wording correction.** Keep structural T behavior in the amended
rule, and make the X source conflict an explicit gate:

> An exact T endpoint/interior intersection creates a common Vertex and splits
> every intersected WallSegment atomically; selection continuity and UI
> consequences remain deferred. X behavior remains deferred, but no X policy
> is adopted or implemented until the PRD owner and geometry/SPEC owner
> reconcile whether a valid X must split or may be rejected.

This is not a request to choose X in this review. It is a requirement not to
reclassify a current T invariant as an optional adapter policy or treat the
PRD/companion contradiction as resolved.

### P1-4 — the replacement no longer fully binds one validation path and uses ambiguous direction shorthand

The current AD-7 says constrained geometry is checked alike for touch and
numeric input. The replacement explicitly makes numeric input pass all Plan
invariants ([draft lines 69–73](../topology-policy-reconciliation-draft-2026-08-05.md#L69-L73)) but only implies that gesture candidates do so; the verification item
also allows different selection policies ([draft lines 129–134](../topology-policy-reconciliation-draft-2026-08-05.md#L129-L134)). Different selection is correct under D-013, but different *post-selection
validation* is not.

The vector notation `(±1,0)`, `(0,±1)`, `(±1,±1)` is additionally shorthand,
not a total predicate for an integer delta. One unit can correctly reject
`(200,100)` while another rounds its angle to 45°; one can infer a diagonal
quadrant from pointer history when numeric `L` provides none, while another
rejects it. This violates the PRD requirement that an exact numeric value either
forms a valid constrained segment or explains the conflict
([PRD lines 227–237](../../prds/prd-InteriorsEditor-2026-07-26/prd.md#L227-L237)) and UX's visible preview/precise alternative
([UX lines 176–189 and 218–223](../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md#L176-L189)).

**Required wording correction.** Add a shared, zero-safe rule without making
the selection tolerance the same:

> Gesture and numeric paths may select a candidate differently, but both pass
> the same domain validation after candidate construction. For a non-zero
> integer delta, a permitted direction is exactly `dx = 0 xor dz = 0`, or
> `abs(dx) = abs(dz)`; every other numeric delta is rejected and never rounded
> to a nearest angle. A requested diagonal length also carries an explicit
> selected diagonal quadrant; absence of that direction is a rejected input,
> not a pointer-history default.

The future owner may choose different notation, but the total predicate and the
single validation seam are architecture-level divergence points.

### P1-5 — an approximate preview with deferred display rounding cannot meet the uniform-measurement requirement

The draft requires an approximate Euclidean display ([draft lines 80–83](../topology-policy-reconciliation-draft-2026-08-05.md#L80-L83)) but puts measurement display rounding outside the delta
([draft lines 140–147](../topology-policy-reconciliation-draft-2026-08-05.md#L140-L147)). That permits a preview to show `≈999.85 mm`, a 2D dimension
label to show `1,000 mm`, and export to choose another precision. PRD `FR-13`
requires the diagonal length to be displayed uniformly in every representation
and export ([PRD lines 278–289](../../prds/prd-InteriorsEditor-2026-07-26/prd.md#L278-L289)).

**Required wording correction.** Either defer decimal Euclidean display
entirely and show only the exact `n × n` / `2n²` values until the product owner
chooses it, or add this non-numeric seam now:

> Preview, 2D/3D measurement surfaces and export obtain approximate diagonal
> text from one product-owned `MeasurementDisplayPolicy`; it consumes the same
> exact squared-length value and is never parsed back into a Command. Its
> precision/locale threshold remains an explicit owner decision, but no
> renderer, export adapter or UI component may choose its own rounding.

The policy's concrete precision still needs the appropriate PRD/SPEC/UX owner;
the architecture rule merely prevents three independent rounding paths.

## P2 findings — add to the next evidence gate

1. The draft's proposed test set needs lossless-input and range cases: negative
   `L`, `L = 0`, values beyond signed-safe-integer/project bounds, values near
   a bound, and proof that no `BigInt` reaches JSON/backup serialization.
2. It needs global-versus-relative lattice, off-grid-existing-Vertex,
   intersection-versus-grid and zoom-hysteresis cases. These should establish
   the selected policy before a touch/UI claim, not merely show the visual grid
   does not mutate a Revision.
3. It needs direction-predicate and quadrant cases for endpoint, delta and
   length inputs, plus a shared validation test showing a rejected gesture and
   equivalent rejected numeric candidate leave the same Revision unchanged.
4. It needs one golden measurement rendered through preview, 2D, 3D and export
   to demonstrate the common display policy. Browser emulation can test that
   interaction seam but cannot replace the physical-device/NFR-15 gate.

These additions do not expand S-2's authorized prototype: its work package
explicitly keeps grid/tolerance/rounding, UI and platform evidence out of scope
([S-2 work package lines 102–105](../../evidence/spikes/S-2/work-package.md#L102-L105)). They are required inputs for a later approved corpus and owner workflows.

## Gate disposition

- Keep this reconciliation draft non-canonical and do **not** append its rule
  to the architecture `.memlog.md` yet.
- Do not update `ARCHITECTURE-SPINE.md`, `geometry-contract.md`, PRD, UX,
  project context or the decision register from this review.
- Resolve P1-1…P1-5 in the draft/source-owner reconciliation, then run the
  stated fresh `bmad-architecture` update, deterministic lint and all reviewer
  lenses against the *resulting Spine*.
- `S-2` remains `needs-further-evidence`; its own acceptance boundary requires
  explicit T/X, tolerance/rounding, split/merge identity and opening-relocation
  policies before promotion ([S-2 work package lines 57–73](../../evidence/spikes/S-2/work-package.md#L57-L73)).
- `G-READY` remains `NOT_READY`; no root scaffold, production code, test/config
  change, release claim or commit is authorized by this review.


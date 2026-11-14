# PRD Quality Review — Catalog/Provenance Control Plane Update (2026-08-04)

**Scope:** independent reviewer-gate delta pass for the approved
Kotlin/PostgreSQL catalog/provenance control-plane boundary in `prd.md` and
`addendum.md`. It was run sequentially because no independent agent slot was
available in the headless workflow; the review used the full PRD quality rubric
rather than only checking the changed lines.

## Overall verdict

The update is product-decision-ready: it separates catalog delivery from user
Project ownership, makes the pin/offline boundary testable and explicitly
rejects accounts, sync, collaboration and remote personal-Project persistence.
It is not a downstream-complete package: the current SPEC and Architecture
still state that no backend exists in Alpha runtime, so their owning workflows
must reconcile that contradiction before any readiness assessment.

## Decision-readiness — strong

`FR-54` states the selected server role, the local durability boundary and the
explicitly excluded cloud behaviors. Section 10 records the owner-approved
choice instead of presenting it as an implementation inference, while the
addendum makes the intentionally undecided operational details visible.

## Substance over theater — strong

The control plane is not a generic “backend” feature. It is anchored to the
existing curated catalog, provenance, AssetUsageGrant and exact-byte pin rules
in `FR-26`–`FR-28`, `FR-37` and `FR-44`; no new personas, metrics or cloud
roadmap items were added merely to justify Kotlin/PostgreSQL.

## Strategic coherence — strong

The update retains the PRD thesis that a phone-first user owns a local Project
and can work without an account or reliable network. `FR-42`, `FR-54` and
`NFR-10` narrow network dependency to catalog resources not yet pinned, which
is coherent with the existing Portable Backup promise.

## Done-ness clarity — adequate

`FR-42` and `FR-54` give positive and negative conditions for service
unavailability: pinned existing Projects keep working; only unpinned catalog
discovery/delivery can fail. Two wording changes would make the boundary more
precise without changing its meaning.

### Findings

- **medium** Keep the stack realization in the addendum (§5.11, `FR-54`) — the
  Kotlin/PostgreSQL choice is a technical realization, while the functional
  requirement should own the product boundary. *Fix:* point from `FR-54` to
  the approved addendum decision instead of describing the implementation
  there.
- **low** Name the exact recovery state (§5.11, `FR-54`) — “remote/recovery
  error state” is less precise than the established
  `ResourceRecoveryRequired` term. *Fix:* use the canonical state name and
  make clear that service unavailability alone cannot enter it.

## Scope honesty — strong

The update explicitly leaves API, transport, physical resource distribution,
hosting, SLA, telemetry and retention undefined, and puts remote sharing behind
a separate future decision. The non-goals list closes the likely accidental
expansion into account, sync, collaboration or server-side user-data storage.

## Downstream usability — adequate

The new glossary entry, `FR-54`, `NFR-10` and `NFR-21` give SPEC, Architecture
and Epics a clean extraction target. The current downstream source remains
contradictory: SPEC Constraint 6 says basic scenarios require no backend, and
Architecture says “Backend отсутствует в alpha runtime.”

### Findings

- **high** Reconcile the approved boundary in the owning downstream artifacts
  (SPEC Constraint 6; Architecture Spine runtime/structural-seed wording) —
  their literal “no backend” statements would make a future implementation
  either violate the PRD or hide the Kotlin/PostgreSQL control plane. *Fix:*
  run `bmad-spec`, then `bmad-architecture`, then downstream epics
  reconciliation; do not hand-edit those owned artifacts from this PRD run.

## Shape fit — strong

For this chain-top consumer PRD, one additional stable FR and concise changes
to existing offline/privacy requirements are preferable to a technical API
specification. The detailed stack boundary belongs in the addendum, preserving
the PRD’s role as the behavioral source for UX, Architecture and stories.

## Mechanical notes

- `FR-54` is the next free functional-requirement identifier; existing IDs are
  not renumbered or reused.
- `NFR-10` and `NFR-21` are clarified in place; no new NFR identifier is
  necessary because the existing offline/privacy quality attributes own the
  behavior.
- No new assumption was inferred: the owner explicitly approved the decision.
- The separate reconciliation artifact records the required source-derived
  downstream handoff and makes no readiness or device-evidence claim.

## Resolution in this update

- The medium finding was applied: `FR-54` now owns only the behavioral
  boundary and points to the addendum for the approved Kotlin/PostgreSQL
  realization.
- The low finding was applied: `FR-54` uses the canonical
  `ResourceRecoveryRequired` state and distinguishes it from mere service
  unavailability; `NFR-10` now names remote Project saving precisely.
- The high downstream-reconciliation finding remains intentionally open. It
  cannot be fixed by a PRD writer without violating ownership of SPEC and
  Architecture.

## Editorial checks

- **Structural pass:** preserve §5.11 after the existing `FR-53` section so
  the next stable ID stays in ascending order; the addendum, rather than a new
  PRD implementation section, holds the Kotlin/PostgreSQL detail.
- **Prose pass:** terminology is now consistent with the glossary and
  `ResourceRecoveryRequired`; no further communication issue in the changed
  passages impedes comprehension.

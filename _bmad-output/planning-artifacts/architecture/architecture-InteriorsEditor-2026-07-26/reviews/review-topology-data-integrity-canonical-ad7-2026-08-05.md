---
title: "InteriorsEditor — canonical AD-7 topology/data-integrity gate review"
review_type: topology-data-integrity-canonical-gate
reviewed: 2026-08-05
reviewer: "Codex /root/architecture_topology_review"
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewed_decision: AD-7
reviewed_memlog: ../.memlog.md
review_basis:
  - ../topology-policy-reconciliation-draft-2026-08-05.md
  - review-topology-data-integrity-r7-2026-08-05.md
  - review-current-source-topology-policy-revision-7-2026-08-05.md
  - review-topology-policy-adversarial-r7-2026-08-05.md
status: complete
verdict: REJECT_FOR_CANONICAL_ARCHITECTURE_GATE
readiness: NOT_READY
scope: "Independent read-only reviewer-gate lens for the actual distilled AD-7 and its memlog derivation; no source, Spine, memlog, code, test, configuration, or evidence mutation"
source_mutations: none
---

# Canonical AD-7 topology/data-integrity gate review

## Gate verdict

**`REJECT_FOR_CANONICAL_ARCHITECTURE_GATE`; `NOT_READY` remains unchanged.**

The current AD-7 text is semantically aligned with the accepted revision-7
input: it preserves integer-mm geometry, total exact-contact normalisation,
atomicity, origin-relative gesture construction and the D-022 boundary. The
canonical update nevertheless fails the Architecture reviewer gate because
two load-bearing additions in the distilled Spine are not traceably derived
from `decision` or `constraint` memlog entries. An `event` records the
post-distillation clarification, but it is not an adequate substitute for the
required durable decision/constraint record.

This is a rejection of the **canonical architecture update gate only**. It
does not reject the Product Owner's delegated policy, the accepted R7 draft,
or any existing source. It creates no implementation authority and does not
change the already-blocked readiness status.

## Review method and checks

Read-only comparison covered the actual `ARCHITECTURE-SPINE.md` AD-1, AD-3,
AD-4, AD-7 and AD-12; the complete architecture `.memlog.md`; accepted R7
draft and all three R7 draft reviews; Geometry Contract §§1, 3, 4, 6 and
10–12; Project-and-Backup Contract §§2 and 4; PRD FR-7–FR-13/FR-19; and the
delegated D-011…D-013 / valid-X decision packet.

- The `bmad-architecture` reviewer-gate instructions require every decision,
  constraint, assumption and open question to be appended to memlog, with the
  Spine distilled from that log. The review therefore checks provenance as
  well as rendered AD text.
- `lint_spine.py` returned `ok: true` with `0` findings, and all twelve
  declared Spine source/companion paths resolve. These mechanical checks do
  not establish derivation completeness.
- A read-only semantic needle check confirmed the actual Spine includes the
  integer-mm boundary, one detached mutation path, origin-relative
  `100 × k × direction`, candidate-interior/existing-junction handling,
  ordered all-contact partitioning and explicit D-022 deferral.

## Semantic assessment of the actual AD-7

| Boundary | Actual distilled rule | Assessment |
| --- | --- | --- |
| Integer-mm and serialization | AD-7 requires safe integer millimetres before topology arithmetic, excludes floating endpoints/mutable construction policy from canonical values, and keeps wider exact arithmetic ephemeral. Its Deferred handoff names lexical ingress, reason mapping and canonical `project/project.json` to the SPEC/Project-Backup owners. | **Semantically pass.** The exact bundle path matches Project-and-Backup Contract §2; no `.interiors/` directory is introduced as an alternate entry. |
| Atomic mutation | AD-7 requires a detached complete ChangeSet plus Plan/Room/Opening/host validation; reject creates no `PendingDurability`, History, autosave or canonical projection. AD-3 retains the distinct `PendingDurability` and post-validation persistence-failure path; AD-12 owns stale-worker discard. | **Pass.** No partial Plan or false durable publication is admitted. |
| Relative construction | The 100-mm base candidate is `origin + (100 × k) × direction`, `k > 0`; the grid is UiState presentation only; valid off-grid numeric input bypasses selection but not topology validation. | **Pass.** This preserves delegated D-011 §4.2.1 rather than creating a global lattice. |
| Exact topology | AD-7 names all four exact contact classes, reuses/creates one Vertex per coordinate group and partitions every affected candidate/existing segment at all distinct ordered interior contacts. It covers T, proposed-interior pass-through of a junction, one-X/multi-X and rejects non-integral/overlap/self-intersection/invalid partitions as one candidate. | **Pass in rendered semantics.** It preserves the R7 all-contact rule and Geometry Contract §3 planar-graph invariant. |
| D-022 and source ownership | Deferred retains kernel/tolerance/ties/hysteresis, T/X continuity, merge, Room/Opening, usable-polygon and measurement decisions. It explicitly routes PRD/SPEC/UX reconciliation, including the still-open Geometry Contract X wording. | **Pass.** The update does not silently close policy or claim source reconciliation. |

## Blocking finding

### CAN-TOPO-01 — High: AD-7 contains unlogged load-bearing rules, so a clean re-distill is not deterministic

**Evidence.** The current Spine AD-7 adds the following rules:

1. lossless lexical validation of persisted/imported geometry and the rule that
   wider exact arithmetic cannot become canonical serialized state (lines
   181–188); and
2. total contact grouping for endpoint/Vertex, endpoint/interior,
   candidate-interior/Vertex including a junction, and interior/interior,
   followed by all-contact ordered atomic partitioning (lines 221–233).

The relevant final memlog entries have different coverage:

- the `decision` at `.memlog.md:52` records relative 100-mm construction and
  eight directions;
- the `decision` at `.memlog.md:53` records only narrow valid-X routing;
- `.memlog.md:54–55` retain the S-2 and D-022 constraints; and
- `.memlog.md:57` is an **`event`** saying that a post-distillation
  clarification enumerated contacts and made wider arithmetic ephemeral.

There is no `decision` or `constraint` entry that records the all-contact
classes/partition invariant or the lossless lexical-ingress/ephemeral-
representation invariant. Thus an independent builder re-distilling only from
the authoritative decision/constraint log can retain relative snapping and
valid-X, but omit the previously rejected proposed-interior/junction case,
the total partition requirement, or the raw lexical boundary. Those are
precisely the divergences AD-7 must prevent.

**Required correction.** Before accepting this canonical update:

1. append, through `_bmad/scripts/memlog.py`, a `decision` or `constraint`
   recording the total exact candidate/Plan contact rule, all four classes,
   one-Vertex-per-coordinate grouping, ordered all-affected-segment partition
   and whole-candidate reject boundary;
2. append a separate `decision` or `constraint` recording the safe/lossless
   persisted numeric ingress boundary and the non-canonical status of wider
   exact arithmetic, while retaining `bmad-spec` and Project/Backup ownership
   of grammar, path and stable reason details;
3. re-distill AD-7 from those entries, rerun lint and all three canonical
   reviewer lenses against the newly distilled Spine.

The existing `event` may remain as historical context, but it cannot be the
only provenance for a rule that decides downstream topology and serialization
behavior.

## Retained external gates

After this architecture-gate correction, source owners still must reconcile
the AD-7 choice with PRD, SPEC geometry/backup and UX contracts. In particular,
Geometry Contract §6 still presents X split/reject as open, whereas PRD FR-9
requires the atomic shared-Vertex consequence; the Spine correctly exposes
this route in Deferred but cannot complete it alone.

No production readiness changes here: D-022 evidence, S-2 terminal status,
physical NFR-15 traces, AssetUsageGrants, `G-1`, `G-CP-ADR` and the final
independent `READY` gate remain outstanding.

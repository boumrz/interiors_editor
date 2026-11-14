---
title: "S-2 topology candidate — executable evidence report"
spike_id: S-2
waiver_id: W-SPK-2026-08-04
status: needs-further-evidence
implementation_evidence_owner: "Codex /root/spike_s2_topology"
independent_reviewer: "Codex /root"
evidence_timestamp: "2026-08-04T21:57:33+03:00"
---

# S-2 topology candidate — executable evidence report

## Decision summary

The isolated S-2 prototype now has resumed, reproducible automated evidence
for two bounded integrity defects found during the prior independent review:
unsplit exact T/X topology with a stray Vertex, and malformed/fractional
in-memory Revisions at the public command boundary. It proves only the listed
*candidate* rules in this disposable TypeScript runtime. It does not adopt
unresolved policy, satisfy `G-1`, create ADR-002, prove cross-engine/device
behavior, or authorize product work.

The prototype remains intact for `Codex /root`'s independent review. This
handoff makes no terminal status or cleanup claim.

> **Review addendum — 2026-08-04.** The independent review is complete:
> no P0/P1 was found, while the spike remains `needs-further-evidence`.
> Its three retained limits are recorded in
> [independent-review-integrity-2026-08-04.md](independent-review-integrity-2026-08-04.md).

## Scope and provenance

- Authority: active `W-SPK-2026-08-04`.
- Prototype root: `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/`.
- Inputs: synthetic integer-mm coordinates and synthetic command fixtures only.
- No browser store, real Project, asset, network call, production source, root
  package/configuration, commit, or application UI was used or changed.
- `G-1` is still **PENDING / parallel**. It was neither executed nor inferred
  from these tests.

## Replay commands and observed result

Run from the prototype root (all commands are intentionally local to that
disposable root):

```sh
cd /Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-2
npm test
npm run typecheck
npm run test:coverage
npm run mutation
```

The final verification run used Node `v22.8.0` and npm `10.8.2`. A replay must
record its own runtime rather than assuming this version is an NFR target.

| Check | Result | Evidence |
| --- | --- | --- |
| Vitest unit/property corpus | 4 files, 43/43 tests passed | 14 scenario tests, 13 boundary tests, 9 adversarial tests, 7 integrity regressions |
| Property coverage | 500 generated cases | two `fast-check` properties, 250 runs each |
| TypeScript | passed | `tsc --noEmit` exited successfully |
| V8 coverage | 97.54% statements/lines; 95.53% branches; 100.00% functions | [raw coverage JSON](raw/coverage-final-2026-08-04-215650.json) |
| Mutation testing | 925 killed, 212 survived, 16 no-coverage, 0 timeout/errors; score 80.23% | [raw Stryker JSON](raw/mutation-report-2026-08-04-215733.json) |

The Stryker configuration explicitly requires `break: 80`; the final run
reported “80.23 is greater than or equal to break threshold 80” and exited 0.
This threshold is a quality floor for this experiment, not acceptance of any
product-policy choice.

## Executable behavior covered

The corpus at [corpus/v1.json](corpus/v1.json) maps synthetic cases to tests.
It covers:

- canonical 4,000 × 3,000 mm rectangle and one derived usable face;
- only 0°/45°/90° segment directions, integer-mm coordinates, bounds and
  thickness checks;
- zero-length, duplicate, overlap, malformed-command and malformed-serialization
  rejection, with serialized state unchanged for rejected command cases;
- atomic T splitting; explicit X `reject` versus `split` candidate behavior;
- rejection of a non-lattice X that would need a half-millimetre vertex;
- no automatic collinear merge and an explicit `manual-only` merge candidate;
- rejection of persisted exact T/X crossings whose apparent junction is only an
  unrelated Vertex, including a manual merge that would reintroduce such an
  unsplit junction;
- stable `SERIALIZATION_INVALID` rejection for fractional or malformed
  in-memory Revision envelopes before the command implementation can reach
  integer-only intersection arithmetic;
- bounded face derivation, exact-fingerprint Room identity matching, and an
  explicit ambiguity result after a divider;
- shared-wall max height / opening min-height candidate and interval bounds;
- immutable inverse restoration and canonical serialization round trips.

## Raw and derived artifacts

- [Current raw mutation report](raw/mutation-report-2026-08-04-215733.json)
  is copied byte-for-byte from the isolated Stryker JSON reporter.
- [Current raw coverage report](raw/coverage-final-2026-08-04-215650.json)
  is copied byte-for-byte from the isolated V8 coverage reporter.
- Earlier same-day snapshots are retained under `raw/` for traceability and are
  not substituted for the current replay result.
- [Trace manifest](trace-manifest.md) gives exact paths, commands and SHA-256
  digests. [Policy boundaries](policy-boundaries.md) records the negative and
  unresolved results.

## Mutation residuals and their meaning

The 212 surviving mutants and 16 no-coverage mutants are intentionally retained
as evidence, not hidden by exclusions. The raw report is authoritative. The
largest surviving categories remain conditional expressions, logical operators,
equality operators, block statements, string literals, and arithmetic
operators. The resumed tests deliberately strengthened only the two bounded
integrity defects rather than inflating this disposable experiment's score with
unrelated behavior.

The 16 no-coverage entries are defensive impossible-state branches in the
prototype, including missing wall endpoints during split/merge (lines 360–375
and 491–492), malformed revision/face-walk guards (723–724, 863, 869, 875,
879, 925, 945). They are not reachable through the public validated-command
surface exercised by the synthetic corpus. Their presence is a limitation, not
a claim that production code could omit such defenses.

The resumed mutation inspection found the new interior-Vertex planar check
fully killed by the exact T/X regressions. Remaining survivors in or near the
new Revision guard are either empty-collection/equivalent-path mutations or
would require scope-expanding fixtures; malformed envelope, non-array
collection, fractional coordinate, and fractional thickness behavior now have
separate public-command checks. The surviving broader gaps remain
permutation-sensitive serialization ordering, exact Room-reconciliation
predicates, boundary zero comparisons, degenerate usable-area branches, and
deep face-walk invariants. The result therefore does **not** claim proof of a
complete geometry kernel.

## Resumed integrity evidence — 2026-08-04

The resumed work is limited to the two findings recorded by `Codex /root` in
the prior review. The work package records the implementation owner, reviewer,
scope, and nonterminal status at [work-package.md](work-package.md).

### RED before source change

At `21:50:07 +03:00`, the new public-API-only test file was run before changing
`src/topology-kernel.ts`:

```text
$ npm test -- test/topology-integrity-regressions.spec.ts
Test Files  1 failed (1)
Tests       2 failed (2)

1. expected deserializeRevision(unsplit exact T/X with a stray Vertex) to be
   { ok: false, reason: "SERIALIZATION_INVALID" }, but received { ok: true,
   revision: ... }.
2. RangeError: The number 999.5 cannot be converted to a BigInt because it is
   not an integer, from crossBigInt → intersectSegments → applyAddWallSegment
   → applyCommand.
[exit 1]
```

### Minimal GREEN change and final verification

- `isRevisionLike` now verifies the Revision envelope, every Vertex and Wall
  primitive, and the candidate's topology before command dispatch. A malformed
  Revision returns the documented empty-revision `SERIALIZATION_INVALID`
  rejection rather than entering `BigInt` arithmetic.
- `validateRevision` now rejects any Vertex strictly inside a WallSegment. This
  requires a junction to split every crossed wall; merely adding an unrelated
  Vertex at an exact T/X coordinate cannot make an unsplit graph valid.
- The previously accepted manual merge that would leave a branch on a newly
  unsplit long wall now explicitly rejects with `AMBIGUOUS_INTERSECTION`; this
  is a direct consequence of the same planar-graph rule, not a new merge
  policy.
- The two initial regressions were GREEN (2/2) at `21:51:04 +03:00`. Mutation
  inspection then justified five separate public malformed-envelope cases;
  the final targeted file passed 7/7 at `21:56:43 +03:00` and the final corpus
  passed 43/43 at `21:56:50 +03:00`.

The compact ANSI-stripped RED/GREEN and final command record is retained in
[resumed-integrity-transcript-2026-08-04.md](resumed-integrity-transcript-2026-08-04.md).

## Explicit non-coverage

There is no Playwright/browser test in S-2 because the authorized prototype has
no UI, browser flow, PWA, renderer, or production application surface. This
does not discharge the requested application Playwright coverage, nor the
physical mobile/device requirements. Such coverage belongs to future approved
vertical slices after the implementation-readiness gate, and the waiver makes
clear that spike Playwright flows would still be experimental only.

There is also no cross-JavaScript-engine, iOS Safari, Android Chrome, touch,
performance, WebGL, persistence, recovery, or real-device evidence here.

## Required review outcome

The independent reviewer must assess the resumed integrity evidence and record
its conclusion independently. Before any terminal conclusion can be proposed,
Product/UX/Architecture must resolve the open geometry decisions, a fresh
`bmad-architecture` workflow must create only an evidence-backed ADR-002, and
the approved corpus must be rerun in the required target environments. Do not
promote this prototype source to product code.

## Initial independent reviewer result — 2026-08-04 (historical)

Reviewer: `Codex /root`, independent of the implementation owner.

### Reproduced and verified

- `npm test` reproduced **36/36 Vitest** tests; `npm run typecheck` and
  `npm run test:coverage` exited `0` with **97.45% statements/lines, 95.00%
  branches, 100.00% functions**.
- `npm run mutation` reproduced **903 killed / 206 survived / 16 no coverage**
  of 1,125 mutants, **80.27%** total mutation score and the configured
  `break: 80` exit condition.
- SHA-256 of all five named prototype inputs and both raw evidence JSON files
  matches `trace-manifest.md`. A root-surface inspection found no root
  `src`, `tests`, package manifest or Playwright/Vite configuration.
- `fallow health --format json --quiet --explain --root .` found a critical
  complexity finding in `applyAddWallSegment` (cyclomatic 38, cognitive 45,
  123 lines) and a high finding in `validateRevision` (cyclomatic 21,
  cognitive 32, 63 lines). These are non-promotable maintainability risks even
  though this isolated evidence kernel is disposable.

### Material topology findings

1. **High — deserialization accepts a non-planar graph with an unsplit T
   junction.** `validateRevision` accepts an intersection whenever a Vertex
   merely exists at that coordinate
   (`src/topology-kernel.ts:769-780`); it does not require that the crossed
   wall be split and reference that Vertex. The reviewer deserialized a
   horizontal wall `(0,0)→(1000,0)` plus a vertical wall
   `(500,0)→(500,500)` with a standalone Vertex at `(500,0)` and received
   `{ ok: true }`, although the horizontal WallSegment still bypassed the
   junction. This violates Geometry Contract §3.6 and can produce a broken
   planar graph/face/adjacency basis. The current invalid-serialization corpus
   covers non-integer X crossings but not this exact integer T corruption.

2. **Medium — `applyCommand` is not total for a malformed in-memory
   Revision.** Its shallow `isRevisionLike` guard accepts a fractional vertex,
   after which `intersectSegments` reaches `BigInt(0.5)` and throws a
   `RangeError` (`src/topology-kernel.ts:169-183, 667-694`) rather than
   returning a stable rejection. `deserializeRevision` rejects fractional
   primitives, so this is not a normal happy-path import, but a corrupted
   revision must never crash an editing boundary. The current malformed
   revision tests do not exercise this public-call boundary.

### Decision

**`needs further S-2 evidence`; terminal approval was not granted and prototype
cleanup was not approved.** No terminal classification is justified until the
following bounded evidence exists:

- reject an unsplit T/X topology even when an unrelated Vertex shares the
  intersection coordinate; prove the command path still creates all required
  split edges atomically;
- make the command boundary reject malformed/fractional in-memory revisions
  without throwing, then cover it with a regression test;
- resolve and evidence the already-recorded tolerance, X/T, merge, Room
  reconciliation, opening-relocation and usable-polygon policies through the
  owning Product/UX/Architecture flows before any architecture adoption.

No prototype source, manifest, dependency, report output or corpus was deleted
or promoted by this review.

### Resumed response to the two integrity findings

Implementation owner `Codex /root/spike_s2_topology` subsequently reproduced
both findings as RED, made the bounded repair, and recorded final GREEN evidence
in [resumed-integrity-transcript-2026-08-04.md](resumed-integrity-transcript-2026-08-04.md):

- persisted unsplit exact T and X records with an unrelated crossing Vertex now
  deserialize only as `SERIALIZATION_INVALID`; command-created intersections
  remain covered by the existing atomic split corpus;
- a fractional in-memory Revision and five independently malformed Revision
  envelope/entity cases now return a stable `SERIALIZATION_INVALID` result
  without a raw `RangeError`.

This is an implementation-owner response, not a replacement for an independent
review. The remaining open-policy and non-UI/device limits still apply.

---
spike_id: S-2
title: "Topology evidence work package"
waiver_id: W-SPK-2026-08-04
status: needs-further-evidence
resumed_at: "2026-08-04"
implementation_evidence_owner: "Codex /root/spike_s2_topology"
independent_reviewer: "Codex /root"
created: 2026-08-04
---

# S-2 — work package

## Authority and assignment

This package operates only under active waiver `W-SPK-2026-08-04`, whose scope
is the isolated S-2 topology experiment. The accountable evidence owner is
`Codex /root/spike_s2_topology`; the independent reviewer is `Codex /root`.
The waiver expires and cleanup obligations apply exactly as stated in
[`spike-only-waiver-2026-08-04.md`](../../../spike-only-waiver-2026-08-04.md).

`G-1` (problem and interaction evidence) is explicitly **PENDING / parallel**.
This work package neither claims nor substitutes for a `G-1` pass, physical
device evidence, a human approval, a final BMAD `READY` verdict, or any `V-*`
slice entry.

## Original evidence boundary

The experiment asks whether a small, deterministic, integer-mm planar graph
kernel can produce reproducible evidence for canonical rectangles,
0°/45°/90° directions, duplicate/zero-length rejection, T/X intersections,
split/merge policy boundaries, derived face/Room identity candidates, opening
fit, inverse/undo, and serialization round trips.

Permitted implementation is limited to:

- `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/`
- synthetic fixtures and reports under this evidence root.

It is a disposable experiment, not a production domain module, shared test
harness, product bootstrap, PWA, UI, release, or implementation of a `V-*`
story. No root `src/`, package manifest, tests, build/test configuration, CI,
deployment, catalog or user data may be changed. No commit, publish, or
promotion into product code is authorized.

## Evidence protocol

The prototype must be built test-first and keep raw command output. It must
exercise public command behavior with unit and property tests, including
negative paths and unchanged-state assertions after rejected commands.
Results are retained as evidence only; successful execution does not make a
policy adopted. Any required product choice remains marked as pending for the
proper Product/UX/Architecture decision path.

## Evidence acceptance boundary (non-terminal)

Any future status review needs all of the following to be evidence-backed:

1. A versioned synthetic golden corpus deterministically covers rectangle,
   orthogonal/45° segments, T and X behavior, split/merge, openings, face/Room
   candidates, undo/inverse, and serialization across repeat runs.
2. Every rejected command leaves the serialized Revision exactly unchanged.
3. Integer-mm inputs and persisted coordinates show no semantic drift through
   the tested round trips.
4. T/X, tolerance/rounding, split/merge identity, and opening relocation
   policies are all explicitly resolved by an authorized decision; no library
   default is silently treated as product policy.
5. The independent reviewer verifies the evidence and the required follow-up
   `bmad-architecture` workflow can create an evidence-backed ADR-002.

An open policy, engine/platform variance, a nondeterministic corpus case, a
rejected command that mutates state, or incomplete review remains evidence
against promotion. This work package makes no terminal status claim.

## Planned evidence outputs

- `test-report.md` — replay commands, raw output, result summary and coverage.
- `policy-boundaries.md` — supported candidate behavior, rejected alternatives
  and unresolved product-policy decisions.
- `corpus/` — synthetic, versioned golden fixtures only.

## Resumed bounded integrity evidence — 2026-08-04

**Current status:** `needs-further-evidence`.

The accountable implementation/evidence owner remains
`Codex /root/spike_s2_topology`; the independent reviewer remains
`Codex /root`. This resumed pass is limited exactly to the following two
prototype integrity defects found by independent review:

1. reject a persisted/in-memory graph with an unsplit exact T or X crossing
   even when an unrelated Vertex happens to exist at the crossing coordinate;
2. make the public `applyCommand` boundary total for malformed/fractional
   in-memory Revisions: it must return a stable rejection, never a raw
   `RangeError` from BigInt geometry.

Required method: behavior tests must first demonstrate both defects as `RED`;
the minimum isolated TypeScript repair then makes them `GREEN`. The follow-up
must run relevant/full tests, typecheck, coverage and the configured full
mutation run, record important residuals and update the evidence trace.

Out of scope: topology policy adoption; tolerance/grid/rounding decisions;
Room identity, opening relocation or usable-polygon semantics; product/UI/PWA,
browser/device/Playwright claims; dependencies; root/project code; commits; and
all cleanup or promotion. This amendment makes **no terminal status or cleanup
claim**. It ends by requesting another independent review.

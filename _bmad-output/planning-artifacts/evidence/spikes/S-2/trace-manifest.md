---
title: "S-2 topology candidate — trace manifest"
spike_id: S-2
waiver_id: W-SPK-2026-08-04
status: needs-further-evidence
implementation_evidence_owner: "Codex /root/spike_s2_topology"
independent_reviewer: "Codex /root"
recorded_at: "2026-08-04T21:57:33+03:00"
---

# S-2 topology candidate — trace manifest

## Authority, people, and current state

| Field | Value |
| --- | --- |
| Authority | `W-SPK-2026-08-04` (`active-experimental-only`) |
| Evidence owner | `Codex /root/spike_s2_topology` |
| Independent reviewer | `Codex /root` |
| `G-1` | `PENDING / parallel`; not claimed passed |
| Current evidence state | `needs-further-evidence` |
| Terminal status / cleanup | not asserted; no cleanup performed |
| Prototype root | `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/` |

The resumed work package is limited to two prior review findings: reject an
unsplit exact T/X even if an unrelated Vertex shares the coordinate, and reject
malformed/fractional in-memory Revisions at the public command boundary without
throwing. No policy, production, browser, or device claim is made.

## Inputs and provenance

| Input | Provenance | Use |
| --- | --- | --- |
| Geometry Contract | `_bmad-output/specs/spec-interiors-editor-alpha/geometry-contract.md` | planar-graph constraint only; unresolved policy remains unresolved |
| SPEC / PRD / Architecture / project context | repository sources of truth required by `AGENTS.md` | constraints only; no source-of-truth artifact modified |
| Waiver | `_bmad-output/planning-artifacts/spike-only-waiver-2026-08-04.md` | permission and scope boundary |
| Corpus fixtures | [corpus/v1.json](corpus/v1.json) | synthetic only; no personal Project content or asset |
| Runtime | Node `v22.8.0`, npm `10.8.2` | reproducibility context only, not device evidence |

## Strict TDD replay

Run from the isolated prototype root:

```sh
cd /Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-2
npm test -- test/topology-integrity-regressions.spec.ts
npm test
npm run typecheck
npm run test:coverage
npm run mutation
```

The first command was intentionally run before source changes at `21:50:07
+03:00`; it exited `1` with both required RED results: unsplit exact T/X
deserialized as `{ ok: true }`, and a fractional in-memory coordinate raised
`RangeError: The number 999.5 cannot be converted to a BigInt because it is not
an integer`. The full compact record is in
[resumed-integrity-transcript-2026-08-04.md](resumed-integrity-transcript-2026-08-04.md).

Observed final outcomes:

- `npm test`: exit `0`; 4 files, **43/43** tests passed at `21:56:50 +03:00`.
- `npm run typecheck`: exit `0` after the final regression structure change.
- `npm run test:coverage`: exit `0`; **97.54% statements/lines, 95.53%
  branches, 100.00% functions** at `21:56:50 +03:00`.
- `npm run mutation`: exit `0`; **1,153 mutants, 925 killed, 212 survived,
  16 no coverage, 0 timeout/errors; score 80.23%** at `21:57:33 +03:00`.
  The configured Stryker `break: 80` condition was satisfied.

## Artifact inventory and integrity

| Artifact | SHA-256 | Role |
| --- | --- | --- |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/package.json` | `09ef4b7f05bd170ba2f1577a4ea0ace98dca9d69648163cb7a4ac11265c4c087` | isolated scripts/dependency declaration |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/package-lock.json` | `7c8bf41e5c4364729c9e45433fcefdb2704eb7038537984218bdba5bb71510f9` | isolated dependency graph |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/tsconfig.json` | `b81773bdeb5cda5933474725d620ad1bb69cbb20d9f733fb8216c55c2842a168` | isolated type-check configuration |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/stryker.config.mjs` | `784b1b36cff7bc84f3a675c44b09012aa3af4279bc64bfbdd73870a8a8d5669c` | isolated mutation configuration |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/src/topology-kernel.ts` | `875998ebe6ae7af3cacf74d0e1e9d4aeaf65b4a41a14b0833349eab57881114b` | disposable candidate source |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/test/topology-scenarios.spec.ts` | `37c9802363c41a1a6da854d8bf4cd047f3795cd75c3fc165188ea27d6202b03d` | scenario/property corpus |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/test/topology-boundary-scenarios.spec.ts` | `8392dc8410fd3d9b8cc612b73e76cb936c44239f85537db59f319222d9683067` | boundary corpus including merge regression |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/test/topology-adversarial-scenarios.spec.ts` | `aa7f1b840950c58602ec672ac379e4beba762929f6fc776355a4b6217f5413f7` | adversarial corpus |
| `implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/test/topology-integrity-regressions.spec.ts` | `09b7dca2c85dcf6ff21aa320e7e360b258301736aa1cccbe0c6efda17a307e1b` | resumed public integrity regressions |
| [raw/mutation-report-2026-08-04-215733.json](raw/mutation-report-2026-08-04-215733.json) | `aad6d089f4702f52e93a1e6ece8724a34c4256a357564b2d5634a2b5e33620ab` | raw Stryker machine-readable result |
| [raw/coverage-final-2026-08-04-215650.json](raw/coverage-final-2026-08-04-215650.json) | `5a4e422ea52b6b85f674de7f2180af05a7d52b06419fbb0a17232f9c89580989` | raw V8 machine-readable result |

The two raw files are byte-for-byte copies of their reporters' files under the
isolated prototype root at the time of final verification. Earlier snapshots
are retained under `raw/` and are not substituted for this final replay.

## Mutation inspection and retained limits

| Status | Count | Interpretation |
| --- | ---: | --- |
| Killed | 925 | corpus detects these injected changes |
| Survived | 212 | residual behavioral gaps remain; raw report is authoritative |
| No coverage | 16 | defensive impossible-state branches remain unexecuted |
| Timeout / error | 0 / 0 | no mutation infrastructure failure in this run |

The exact T/X regression kills mutations in the new strict interior-Vertex
check. Separate public cases cover null, schema, non-array collection,
fractional coordinate, and fractional thickness input at the command boundary.
Residual survivors/no-coverage branches outside this two-defect scope include
serialization ordering, Room reconciliation, face-walk internals, opening
boundaries, and usable-area edge cases. They were inspected but not pursued to
avoid silently broadening the disposable spike.

## Scope ledger and handoff

| Check | Result |
| --- | --- |
| Production source/package/tests/configuration/CI touched | No |
| Files outside authorized prototype/evidence roots created by S-2 | No |
| User Project data, asset, network publication, browser store used | No |
| Commit/tag/push/release | No |
| Product/UX/Architecture policy silently adopted | No |
| Playwright application coverage / physical device run | No — non-UI isolated prototype only |
| Mobile screenshot | not applicable — no app UI changed |

The review handoff did not authorize promotion, terminal status, cleanup, or
further product implementation; the completed outcome follows.

## Independent review outcome

[Independent review — 2026-08-04](independent-review-integrity-2026-08-04.md)
found no P0/P1 in the two-defect correction and independently replayed the
full and targeted tests plus typecheck. Its bounded conclusion is evidence
acceptance with retained P2 limits, not a terminal spike `PASS` or `PAUSED`.
The current status remains `needs-further-evidence`.

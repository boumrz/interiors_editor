---
title: G-S2 current-product TCC-A1 execution audit
date: 2026-08-30
status: final
gate: G-S2-topology
verdict: NOT_PASS
authority: bounded readiness evidence spike waiver W-READY-2026-08-30
reviewer: Roman Zheltov (appointed; outcome not yet recorded)
---

# G-S2 — current-product TCC-A1 execution audit

## Verdict

`G-S2-topology` is **NOT PASS**. This is a bounded, reproducible evidence
result, not a product-code finding and not a change to `apps/**`.

The current kernel has substantial green regression coverage, but TCC-A1
requires each family to execute through an immutable manifest with raw-byte
SHA-256, semantic intent, expected outcome, canonical digest and (where
accepted) inverse/allocation proof. The existing runner can execute only two
narrow seed manifests, comprising ten fixtures. Neither constitutes the
minimum complete family matrix in the source-owned contract.

## RED → audit evidence

The initial completeness assertion deliberately failed:

```text
required families: 7
existing executable TCC-A1 routes: raw-ingress-and-directions, commands-and-lifecycle
missing executable routes: contacts-and-plan-invariants,
  faces-and-usable-geometry, lineage-and-hosts,
  measurement-and-projections, legacy-and-ingress-boundary
exit: 1 (expected RED)
```

That assertion did **not** assert a product defect. It establishes the exact
reason that the subsequent 67 passing runner tests cannot be promoted to a
full-corpus PASS.

Then the existing, adopted runner was executed read-only:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/domain/tcc-a1-corpus-runner.test.ts
```

Result: **67/67 passed**, Node `v24.19.0`, `@rstest/core 0.11.5`, duration
110 ms. It executed and SHA-256-validated these exact fixtures:

| Manifest | Fixture IDs | Result |
| --- | --- | --- |
| `interiors.tcc-a1.empty-plan-wall` rev. 1 | `TCC-A1-EMPTY-WALL-001..002` | PASS |
| `interiors.tcc-a1.initial-wall-materialization` rev. 1 | `TCC-A1-INITIAL-WALL-001..008` | PASS |

The broader supporting-kernel command (seven existing test files) passed
**287/287** with no snapshot change. It validates current direct behavior for
contacts, faces, hosts, measurements and a historical V1→V2 code path, but it
does not supply TCC-A1's missing immutable fixture/outcome contracts and is
therefore supporting evidence only.

## Immutable manifest and source hashes

The complete immutable source list, executor constraints, fixture IDs and
family-by-family missing evidence is in
[tcc-a1-current-product-manifest-2026-08-30.json](tcc-a1-current-product-manifest-2026-08-30.json).
It binds this report to:

- TCC-A1 contract SHA-256 `d054335c196827aaf9524fd344937bb18f6f9ac244b0b652b51301b035a0a32f`;
- executor SHA-256 `85bd616a1dece7b528fd7f731709cc58e38fd9eab9e3d5567dc8f525e37a5424`;
- only the `domain-kernel` executor role and four declared stable geometry
  reasons (`INVALID_DIMENSION`, `PROJECT_BOUNDS_EXCEEDED`,
  `UNSUPPORTED_DIRECTION`, `ZERO_LENGTH`).

## Required completion, unchanged by device confirmation

To become `PASS`, a future revision needs all seven source-owned TCC-A1
families in the contract, including the declared legacy classifier and exact
raw grammar/classification matrix. For every case it must record immutable
bytes/hash, expected result and actual executor result; accepted cases need
canonical post/inverse digests and allocation labels. It then needs Roman
Zheltov's recorded review outcome after inspecting that immutable corpus and
results.

Physical/mobile acceptance and catalogue-rights confirmations cannot supply
those topology semantics, so they do not change this verdict.

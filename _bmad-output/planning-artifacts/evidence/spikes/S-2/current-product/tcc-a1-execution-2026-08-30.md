---
title: "G-S2: current-product TCC-A1 execution"
date: 2026-08-30
status: PASS
gate: G-S2-topology
scope: "W-READY-2026-08-30 / S-2; authorized production corpus-runner and adapters"
reviewer: "Roman Zheltov"
reviewStatus: assigned
---

# TCC-A1 current-product execution

This record supersedes only the former **runner-capability** and §4 classifier
blockers in the earlier S-2 dispositions. Functional and narrow mutation
verification are green; the assigned human review is an independent approval
step.

## Implemented execution boundary

`apps/web/src/domain/tcc-a1-corpus-runner.ts` validates and executes the
TCC-A1 outcome vocabulary used by the active current-domain boundary:

- `domain-kernel` manifests may report accepted, stable rejected, and named
  no-effect transient outcomes;
- `legacy-classifier` manifests may report only a byte-preserving
  `legacy-classification` outcome;
- a manifest cannot mix those authorities; its raw SHA-256 declarations are
  checked before any executor is called;
- rejects, transients and legacy classification verify unchanged base digest
  and empty allocation intent; accepted outcomes verify post digest, ordered
  allocation labels/opaque refs and inverse-to-base digest.

The active executable corpus contains two authority-scoped manifests:

| Manifest | Role | Executed families | Fixture IDs |
| --- | --- | --- | --- |
| `interiors.tcc-a1.current-product-boundaries@1` | `domain-kernel` | directions; contacts; faces; lineage and hosts; measurement and projections; commands and lifecycle | 43 immutable SHA-bound rows |
| `interiors.tcc-a1.current-product-legacy-boundary@1` | `legacy-classifier` | registered PPJ-A1 selector; V1-like; V2-like; unregistered future | `TCC-A1-LEGACY-CURRENT-PPJ-A1`; `TCC-A1-LEGACY-V1-LIKE`; `TCC-A1-LEGACY-V2-LIKE`; `TCC-A1-LEGACY-UNREGISTERED-FUTURE` |

Every fixture has immutable ASCII bytes and a lower-case SHA-256 declaration.
Neither executor receives an expected outcome, Project repository, Revision,
writer fence, history or durable allocation-store port.

## Actual product boundaries exercised

| Family | Active boundary | Observable assertion |
| --- | --- | --- |
| Directions | `deriveEmptyPlanGraphWallCandidate` → raw ingress resolver | `-0`, bounds, zero, cardinal, all signed 45° quadrants, length-only and unsupported input |
| Contacts | `addWallSegment`; valid diagonal `addGeneralWallToProject` | endpoint, T, junction, X/multi-X, half-mm rejection, duplicate, overlap, zero/short partition and no-allocation rejects |
| Faces | `deriveBoundedOrthogonalFaces`; `resolveOrthogonalPlanFaces` | exterior/multi-room, void/repeated/touching/nested rings, odd half-mm miter/exterior bevel and usable collapse |
| Lineage and hosts | current general-wall, Door and parametric wall-item commands | one-to-one, split height inheritance, explicit merge choice/re-entry, Door rehome/delete preview, wall-surface rehome and host conflict preview |
| Measurement and projections | `measureDistance`; `formatLengthMm` | exact 3–4–5, stale/unavailable and shared formatted text |
| Commands and lifecycle | `materializeInitialWallSegment` via its adapter | cancelled, stale-base and lost-fence reservation outcomes |
| Legacy and ingress | `parsePpjA1JsonBytes` → `classifyActiveAlphaProjectBytes` | closed current selector only; original-byte-preserving, no-effect `legacy-unreadable` for V1-like/V2-like/unregistered-future input |

## §4 Active Alpha closure and Portable Backup precedence

The classifier is a real production domain adapter, not a fixture branch and
not a historical codec. It parses source bytes with `parsePpjA1JsonBytes` and
recognizes only an accepted root object with the exact closed selector
`projectSchemaId: "interiors.project/alpha-1"` and number lexeme
`schemaVersion: 1`. The selector result is only `current-ppj-a1` with
`current-ingress`; no import success is claimed at this detached boundary.

Every other parse/selector result is `legacy-unreadable` with
`ordinary-ingress-precedence`. The adapter copies and freezes original source
bytes, and its corpus result proves unchanged base digest and empty allocation
intent. It has no migration, pin, ID-allocation, Project publication, Revision
or RecoveryChangeSet port. No V1/V2 raw grammar, decoder, readable/unmappable
classification or future-selector row is invented.

Portable Backup reason precedence remains in the existing adapter, rather than
being reimplemented in this S-2 domain adapter. Its 60-test production suite
proves path/manifest/size/checksum failures before raw JSON classification,
including factual-size-before-AST and checksum-before-malformed-JSON vectors;
only a valid staged member reaches `BACKUP_SCHEMA_UNREADABLE`. The legacy
classifier cannot replace an earlier `BACKUP_*` reason.

## TDD and verification transcript

### RED

1. The active-Alpha corpus test first failed because the legacy executor and
   manifest exports did not exist.
2. `current-ppj-a1-legacy-classifier.test.ts` then failed with
   `Cannot find module './current-ppj-a1-legacy-classifier'`.
3. The production implementation was added only after those failures. A
   follow-up type check caught the test's unavailable `TextEncoder` reference;
   it was replaced with explicit ASCII fixture encoding before GREEN.

### GREEN

Focused domain command, Node `24.19.0` and pnpm `11.20.0`:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/domain/current-ppj-a1-legacy-classifier.test.ts \
  src/domain/current-product-tcc-a1-corpus.test.ts \
  src/domain/tcc-a1-corpus-runner.test.ts
```

Result: **88/88 passed**.

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/adapters/portable-backup/ppj-a1-canonical-project-member-ingress.test.ts
```

Result: **60/60 passed**.

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web test
```

Result: **1,700/1,700 passed** across **125** test files.

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web typecheck
```

Result: **passed** for runtime verification, `tsconfig.json` and
`tsconfig.domain.json`.

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web lint
```

Result: **277 files checked; no fixes applied**.

## Mutation and review handoff

Stryker ran strictly sequentially (`concurrency: 1`, in-place, automatic
backup/restore) with
`stryker.tcc-a1-active-alpha.config.mjs`. The final scope mutates the closed
selector, legacy corpus/executor and TCC authority/legacy outcome guards while
running the three focused domain test files.

| Result | Count |
| --- | ---: |
| Killed | 286 |
| Survived | 20 |
| No coverage / timeout / runtime / compile error | 0 / 0 / 0 / 0 |
| Mutation score | **93.46%** (high threshold: 90%) |

The first 84.97% run exposed meaningful gaps: malformed/non-object/missing
selector parser inputs and active legacy no-effect/authority declaration
guards. Those tests were added and the final run killed every classifier
mutant. The 20 remaining survivors are outside the active Alpha behavior:
four corpus vector-label metadata mutations, plus pre-existing generic runner
validators for rejected/transient and future unreadable/assessment categories
that the current closure deliberately does not register. They do not alter the
four current/V1-like/V2-like/future byte classifications, SHA verification,
base-digest/no-allocation rule or current-ingress handoff.

**Assigned human reviewer: Roman Zheltov.** The reviewer packet is
`tcc-a1-review-packet-2026-08-30.md` beside this record. The executable
current-kernel and Alpha §4 corpus evidence is **PASS**; the reviewer records
the independent human disposition without changing demonstrated results.

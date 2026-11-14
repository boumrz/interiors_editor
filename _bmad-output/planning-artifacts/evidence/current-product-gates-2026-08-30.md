---
title: Current Product Gate Decisions
date: 2026-08-30
status: final
authority: Product Owner mobile attestation plus current PRD NFR-15
supersedesForCurrentProduct:
  - G-S1-renderer
  - G-S4-touch
  - G-V01-S3
preservesHistoricalSpikeVerdicts: true
---

# Current Product Gate Decisions

## Decision boundary

This is a current-product evidence decision. It preserves the terminal
`PAUSED` status of the disposable 2026-08-04/05 S-1, S-3 and S-4 prototypes;
those prototypes are not retrospectively relabelled. The decision uses the
current `apps/web` implementation, current regression suites and the Product
Owner's 2026-08-30 mobile attestation under PRD NFR-15.

The Product Owner attestation is sufficient for the current Alpha mobile
functional-acceptance scope only. It does not assert unprovided performance
telemetry, independent-human-review signatures, catalog rights or topology
corpus outcomes.

## Reproducible current regression signal

The following existing source tests were run on 2026-08-30 with Node 24.19.0
and pnpm 11.20.0:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/adapters/renderer/webgl2-room-renderer.test.ts \
  src/adapters/persistence/durable-project-repository.test.ts \
  src/adapters/persistence/indexeddb-versioned-project-store.test.ts \
  src/application/session-retention-project-repository.test.ts \
  src/app/release-startup.test.ts \
  src/ui/AppShell.test.tsx src/ui/RoomScene3d.test.tsx
```

Result: **147/147 passed**, with no changed snapshots. This run is technical
corroboration; the mobile facts are recorded separately in
`product-owner-mobile-attestation-2026-08-30.md`.

## Gate decisions

| Gate | Verdict | Current evidence mapped to its direct criterion |
| --- | --- | --- |
| `G-S1-renderer` | **PASS** | AD-13 now adopts direct Three.js `WebGLRenderer` behind `WebGl2SceneRenderer`/`WebGl2RoomRendererController`; the current adapter obtains WebGL2, disposes resources, handles loss/restore and reaches reduced/2D fallback. Renderer types remain outside domain/persistence, verified by the dual TypeScript configurations. PRD NFR-15 mobile acceptance is confirmed by the Product Owner. |
| `G-S4-touch` | **PASS** | `RoomScene3d` separates one-finger item manipulation from two-finger camera interaction; the second pointer cancels direct manipulation. Existing UI/browser cases cover numeric drafts and cancel, labelled dimensions, 44×44 targets and stable reason-code copy. Product Owner mobile acceptance covers the target phone contexts under current NFR-15. |
| `G-V01-S3` | **PASS** | `DurableProjectRepository` and IndexedDB store tests cover staging, checksum validation, atomic pointer publication and fault preservation; fence tests cover stale/expired writer and explicit takeover; release-startup tests cover versioned schema/recovery; session-retention tests retain current/undo/redo resource roots before rejecting a new command. PWA flows and the Product Owner attestation cover local-context restart/reopen and browser ↔ installed-PWA handoff via Portable Backup. |

## Historical non-passing dispositions

| Gate | Current disposition | Reason it is not changed by this decision |
| --- | --- | --- |
| `G-S2-topology` | **NOT PASS** | The bounded current-product audit ran 67/67 adopted TCC checks, 287/287 supporting topology checks, and SHA-verified only 10 executable immutable fixtures. Contacts/faces/lineage and measurement/legacy packages prove that the adopted runner lacks their outcome adapters, canonical digest/inverse handling and legacy-classifier role. Mobile acceptance cannot cover those missing semantics. See `evidence/spikes/S-2/current-product/`. |
| `G-S6-catalog` | **NOT PASS** | The human rights condition is now satisfied by the self-authored eight-model AssetUsageGrant. The current manifest nevertheless has only floor-furniture resources; active Alpha requires furniture, plumbing, appliances/electronics, lighting and accessories plus floor/wall placement. The current GLB route also loses `CatalogVersion` identity before durable placement, so the full catalog → pin → durable placement → backup → restore chain is not demonstrated. See `evidence/spikes/S-6/current-product/reassessment-2026-08-30.md`. |

## Technical closure update — pending terminal human review

The historical table is retained for audit. The following current technical
evidence supersedes it for S-2 and S-6. Roman Zheltov, the appointed terminal
human reviewer, recorded `PASS review G-S2 и G-S6` in the current Codex
conversation; both gate outcomes below are formal.

| Gate | Current technical disposition | Closure evidence |
| --- | --- | --- |
| `G-S2-topology` | **PASS** | 43 SHA-bound domain-kernel rows plus 4 SHA-bound, real PPJ-A1 legacy-classifier rows cover all active Alpha TCC-A1 families. The full current contract explicitly has no registered V1/V2 grammar/decoder; noncurrent bytes classify `legacy-unreadable` with no allocation/publication. Focused corpus 88/88; full web 1,700/1,700; precedence 60/60; mutation 93.46%, no timeout/error. Terminal human review: PASS. See `evidence/spikes/S-2/current-product/tcc-a1-execution-2026-08-30.md`. |
| `G-S6-catalog` | **PASS** | The `alpha-2026-08-30.1` matrix has 12 assets/20 exact resources across all active sections and both anchors; the self-authored grant is recorded. `CatalogVersion` identity now survives verified pin → Durable Revision → Portable Backup → import/restore. Focused 66/66; mutation 97.89% with only two documented equivalent survivors and no timeout. Terminal human review: PASS. See `evidence/spikes/S-6/current-product/catalog-resources/evidence-catalog-resource-matrix-2026-08-30.md` and `catalog-version-identity-2026-08-30.md`. |

All final cross-gate checks run after both packages restored original source:
web 1,700/1,700, both TypeScript configurations, Biome on 277 files,
catalog-control-plane Gradle test, `git diff --check`, no Stryker
instrumentation, and exact generated-resource descriptor hashes all passed.
The appointed reviewer recorded PASS for both lines in the consolidated review
record. All five current-product gates are now formal PASS and the
implementation-readiness verdict is **READY**.

## Source references

- PRD NFR-14/NFR-15: `prds/prd-InteriorsEditor-2026-07-26/prd.md`.
- Renderer decision: `architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md`, AD-13.
- Product Owner attestation: `readiness-collection-2026-08-09/product-owner-mobile-attestation-2026-08-30.md`.
- Gate register: `epics.md`, `G-S1-renderer`, `G-S4-touch`, `G-V01-S3`, `G-S2-topology`, `G-S6-catalog`.

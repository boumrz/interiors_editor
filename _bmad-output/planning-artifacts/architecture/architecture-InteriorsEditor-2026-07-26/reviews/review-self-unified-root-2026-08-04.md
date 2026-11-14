---
title: "InteriorsEditor — self-review: unified root and Catalog Control Plane"
review_type: self-review
reviewed: 2026-08-04
status: complete
reviewed_artifact: ../ARCHITECTURE-SPINE.md
verdict: pass-with-deferred-decisions
---

# Self-review: unified root and Catalog Control Plane update

## Result

No blocking inconsistency was found in the bounded update. The deferred items
below are intentional architecture decisions, not a readiness claim.

## Independent review disposition

A read-only adversarial/current-tech pass found four clarity issues; all were
fixed in the spine before this review completed:

1. Rstest is now scoped to TypeScript domain/application and DOM-independent
   UI-state seams, so the plan does not imply an unselected DOM environment or
   Rstest browser driver for React rendering.
2. AD-16 now pins the architectural web dependencies (including `react-dom`)
   while making the generated starter's remaining support dependencies subject
   to one reviewed, frozen pnpm lockfile instead of falsely calling each one an
   explicit architecture pin.
3. The high-level diagram now originates `CatalogGatewayPort` from the
   application rather than Domain, matching AD-2.
4. The Focus state diagram now explicitly allows exit from a pending native
   fullscreen request.

## Checks passed

1. **Local-first boundary.** AD-2 and AD-4 make `CatalogGatewayPort` an
   application-owned outbound seam and prohibit it from carrying or implementing
   Project, Revision, session History, Portable Backup or user-owned pinned
   blobs. AD-17 restricts PostgreSQL to catalog/provenance data.
2. **Outage semantics.** AD-14 and AD-17 preserve the source contract: service
   unavailability affects only browse/unpinned download; a locally healthy,
   fully pinned Project remains open/edit/Durable-save/local-undo-redo/backup
   capable. Integrity loss still, and only then, enters
   `ResourceRecoveryRequired`.
3. **Unified root and toolchain.** AD-16 replaces the prior frontend-only
   bootstrap with `apps/web` and `apps/catalog-control-plane`, keeps pnpm
   limited to the JavaScript workspace, selects Rspack/Rstest/Playwright and
   confines CSS Modules/global CSS responsibilities.
4. **Mobile performance and Focus.** AD-16 makes local authoring a load
   boundary and retains NFR-15 physical traces as the sole performance/device
   evidence. AD-15 remains an AppShell-only capability-first state machine and
   keeps Focus separate from Project mutation.
5. **No stale architecture premise.** A textual scan of the spine finds no
   remaining Vite, Vitest, `create-vite`, “backend absent”, or static-CDN-only
   architecture claim.

## Version and structural validation

- `lint_spine.py` completed with zero findings.
- npm registry checks confirm the selected Node-engine-compatible JavaScript
  package versions: `create-rspack`, `@rspack/core`, `@rspack/cli` 2.1.8;
  `@rstest/core` and `@rstest/adapter-rspack` 0.11.5;
  `@playwright/test` 1.62.1; React/react-dom 19.2.8; TypeScript 7.0.2;
  pnpm 11.20.0.
- The direct Node release index identifies `v24.19.0` as Krypton LTS. Official
  Kotlin and PostgreSQL release documentation identify Kotlin 2.4.10 and the
  supported PostgreSQL 18.4 minor line.
- The architecture frontmatter paths added for the PRD addendum and catalog
  control-plane contract both resolve.

## Explicit follow-up decisions

The Catalog Control Plane API/transport, resource-byte distribution,
publisher/operator authentication, Kotlin web framework/build system,
deployment/topology, PostgreSQL operation/backup, SLA, telemetry and retention
remain intentionally unresolved. The Rspack PWA integration and browser-output
target also await a first authorized scaffold and floor-device validation.

None of these unresolved choices may widen the remote boundary into account,
Project, Revision, History, Backup, sync or collaboration ownership.

## Companion reconciliation (2026-08-04)

`solution-design.md` previously described a static PWA as if no backend could
exist at all. It now names the AD-17 Catalog Control Plane in the container,
deployment, catalog-pipeline and alpha-boundary sections, while preserving the
stronger operational rule: a healthy local Project has no required remote
service dependency once its exact referenced bytes are pinned. The companion
also names `control-plane-unavailable` and `unpinned-download-unavailable` as
non-blocking catalog states, not Project recovery/read-only states.

The companion scan found no other stale no-backend claim in its active design
documents. `domain-model.md`'s future `cloud sync` reference is a prohibition
against silent last-write-wins, not an assertion that the Catalog Control Plane
does not exist, so it required no change.

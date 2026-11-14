---
title: "InteriorsEditor — current-tech/reality review: root delivery and docs layout"
review_type: architecture-current-tech-layout
status: complete
reviewed: 2026-08-04
reviewer: "independent current-tech/reality reviewer"
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../../../../../../docs/index.md
  - ../../../../../../README.md
  - ../.memlog.md
verdict: pass-with-follow-up
scope: "read-only reality and current-technology check of the root-delivery/docs-layout clarification only"
---

# Current-tech/reality review: root delivery and docs layout

## Verdict

**PASS WITH ONE NON-BLOCKING FOLLOW-UP.** The clarification now says exactly
what the delivery boundary needs to say: the future product is one repository
delivery whose internal build roots are `apps/web` and
`apps/catalog-control-plane`; it is not an `S-*` promotion. `README.md` and
`docs/index.md` accurately describe that as a planned layout, not a present
root scaffold or a completed BMAD migration.

No new named version, current-release, browser-support, or device-compatibility
assertion was introduced by the layout clarification in `README.md` or
`docs/index.md`. The existing AD-16/AD-17 pins were nevertheless rechecked and
are available at their stated exact versions. This does not turn the selected
pins into a mobile-performance claim: AD-16 correctly leaves that to the
physical NFR-15 evidence matrix.

## Reality checks

| Check | Result |
| --- | --- |
| Present repository state | `git rev-parse --is-inside-work-tree` is true; branch is `main`; `HEAD` is unborn (no commit). |
| Production-root surface | `apps/`, root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` are absent. The only discovered package manifests are inside S-2/S-3/S-4 evidence roots. |
| S-3 description | Its own manifest calls it a private `0.0.0-experimental` disposable synthetic durability/PWA prototype; its source/tests cover the README's narrow staging/checksum/atomic IndexedDB, writer-fence, recovery, offline-shell, and controlled-service-worker description. |
| Documentation entry | Every local target linked by `docs/index.md` resolves. The index routes readers through the canonical PRD/SPEC/companions/Spine rather than copying them into a second authority. |
| Existing exact pins | Official npm-registry lookups resolve `create-rspack`, `@rspack/core`, `@rspack/cli` 2.1.8; React/react-dom 19.2.8; TypeScript 7.0.2; Rstest core/adapter 0.11.5; and Playwright 1.62.1. Node's official release index lists v24.19.0 as Krypton LTS; the Kotlin 2.4.10 Maven POM and PostgreSQL 18.4 release page are available. |

The local shell currently uses Node v23.6.1, which is not a contradiction:
AD-16 explicitly prohibits using an unpinned host runtime for the future
scaffold, and no scaffold exists yet.

## Follow-up

### LAYOUT-CT-01 — Make the waiver reference exact when it prescribes scope

**Severity: Low; does not block this documentation/layout update.**

`S-*` is useful shorthand in AD-16, README, and the index, but it is not an
authorization glob. The controlling readiness record limits
`W-SPK-2026-08-04` to named roots and forbids product-root work. Before any
future documentation page tells an agent where evidence code may be written,
link or name that waiver and its exact permitted roots. Keep the current
no-promotion rule unchanged.

## Boundary retained

This review did not change a source of truth, authorize a scaffold, grant
`READY`, widen the waiver, or validate a product/device outcome. Physical
documentation consolidation still requires the approved path mapping, owner,
authority switch, and stable-ID/link validation named in the Spine.

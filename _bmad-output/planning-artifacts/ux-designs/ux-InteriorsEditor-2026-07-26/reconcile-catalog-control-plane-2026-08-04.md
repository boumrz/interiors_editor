---
title: "UX reconciliation — Catalog Control Plane boundary"
date: 2026-08-04
status: complete
workflow: bmad-ux Update
scope: "UX-owned DESIGN.md and EXPERIENCE.md only"
sources:
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/addendum.md
---

# UX reconciliation — Catalog Control Plane boundary

## Decision carried into UX

Kotlin/PostgreSQL implement only the narrow Catalog Control Plane. It may serve
versioned catalog metadata/resources and provenance, but it is not a user
Project, Revision, History, backup, account, sync, or collaboration service.

## Applied UX changes

- Added the non-blocking `catalog-control-plane-unavailable` and
  `unpinned-download-unavailable` catalog states.
- Defined the accessible message and labelled retry: catalogue access may fail,
  while the existing Project and already pinned resources remain locally usable.
- Preserved the durable placement gate: a not-yet-pinned resource can remain a
  cancelable preview but cannot create a Durable AssetInstance.
- Kept `ResourceRecoveryRequired` and read-only recovery exclusive to an actual
  missing/corrupt exact referenced resource found by integrity checking.
- Added the required future Playwright observation for this branch.

## Bounded review

The state is represented in both `AppShell` and `StatusBanner`; no new visual
component is required. The interaction remains valid in Focus because the
banner is non-blocking and blocking recovery has higher priority. The UX does
not imply browser/system fullscreen, service availability, remote Project
storage, or physical-device validation.

## Validation performed

- Parsed the YAML front matter of `DESIGN.md` and `EXPERIENCE.md` successfully.
- Searched the two artifacts for all state and recovery terms above.

This is a bounded owner self-validation performed by root only because the
agent-thread limit prevented a separate fresh UX task. It is not an independent
review and does not certify implementation readiness.

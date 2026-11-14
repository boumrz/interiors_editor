---
title: "Catalog Control Plane contract"
status: draft
updated: 2026-08-25
sources:
  - ../../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/addendum.md
  - ../../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
---

# Catalog Control Plane contract

## Boundary

The control plane may publish versioned curated catalog metadata, resources and
content version/hash. Licensing, provenance, grant and notice records are not
Alpha contract fields or admission gates. It is not a User Project service: it must not create account identity or accept,
store, synchronize, recover, or otherwise own a Project, Revision, session
History, or Portable Backup.

Transport, API shape, deployment, resource distribution, service level, and
retention are architecture decisions, not this contract.

## Availability semantics

- A locally healthy Project whose exact referenced resources are pinned remains
  usable without the control plane: open, edit, Durable save, local undo/redo,
  and Portable Backup continue locally.
- A control-plane outage may block catalog browse/search and downloading an
  unpinned resource. A proposed placement remains a cancelable preview and
  cannot become Durable until its exact bytes are pinned and
  `BackupFeasibilityPolicy` passes.
- `control-plane-unavailable` and `unpinned-download-unavailable` are
  non-blocking catalog states. They are not `ResourceRecoveryRequired` and do
  not make a healthy Project read-only.
- `ResourceRecoveryRequired` is entered only when integrity checking finds a
  missing or corrupt exact referenced resource. If the control plane is then
  reachable, it is merely one source for verified exact-byte repair.

## Verification obligations

1. With the control plane unavailable, a Project with all referenced bytes
   pinned still opens, edits, publishes a Durable Revision, undo/redoes locally,
   and exports a self-contained Portable Backup.
2. An unavailable unpinned catalog resource has an accessible retry/cancel UX,
   creates no Durable AssetInstance, and does not cause Project recovery.
3. A missing/corrupt referenced hash remains read-only recovery whether the
   control plane is reachable or not; any network-retrieved repair passes
   size/media/hash validation before use.

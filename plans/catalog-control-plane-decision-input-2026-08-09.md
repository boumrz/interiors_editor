---
title: Catalog Control Plane Decision Input
date: 2026-08-09
status: superseded-by-2026-08-25-scope-correction
target_workflow: bmad-architecture update
---

# Catalog Control Plane Decision Input

## Purpose and authority boundary

This is an input to the bounded `G-CP-ADR` workflow. It preserves AD-17's
remote perimeter and does not create a Kotlin service or adopt a
provider/identity/retention policy.

## Scope correction — 2026-08-25

This input predates the Product Owner's removal of licensing from Alpha. Its
legal-asset sections are historical only and do not block any current slice.
If `G-CP-ADR` is revived, it may cover only catalog metadata/resources/hashes,
technical format/size/hash, exact pin, backup feasibility and the no-Project-
data perimeter.

## Already binding

- The only Alpha backend is a catalog control plane; it publishes curated,
  versioned catalog metadata/resource descriptors/bytes and hashes.
- It must never accept, store, synchronize, recover or own a User Project,
  Revision, session History, Portable Backup or user-pinned bytes.
- A healthy locally pinned Project remains editable, undoable and backup-ready
  while the control plane is unavailable.
- A placement is not Durable until exact local bytes are pinned and
  `BackupFeasibilityPolicy` succeeds.

## Decisions required

1. Kotlin build/test baseline, API/transport contract and versioning.
2. Metadata and resource-byte delivery model, hash/ETag/cache semantics and
   cancellation/failure reason mapping.
3. PostgreSQL schema/migration, backup/restore procedure and measured RPO/RTO
   for catalog data only.
4. Publisher/operator authentication, provider/region/IAM, audit logging,
   CORS, abuse limits, privacy and retention.
5. The exact `CatalogGatewayPort` contract and negative tests proving that no
   endpoint or database row carries user Project data.

## Technical asset prerequisites

For each reusable catalog asset family, the content owner supplies a
format/size/hash manifest and demonstrates exact pin plus backup feasibility.
The owner selects free or self-authored models outside the application; no
legal/provenance/grant/declaration/notice record is part of Alpha.

## Required evidence after adoption

- Reproducible Kotlin build/test and catalog-only API/transport corpus.
- Negative boundary corpus: no account, Project, Revision, history, sync or
  backup data can enter the service or PostgreSQL.
- Publisher/operator authorization, migration/restore drill, log/privacy and
  cache/CORS evidence from named Security/Operations owners.
- Representative technical manifest, pin/backup/PNG corpus and independent
  review.

`G-CP-ADR` blocks catalog control-plane work; it must not be misrepresented as
proof that generic local-web readiness is complete.

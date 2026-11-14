---
title: Pre-READY Closure Waiver — S-2 and S-6
status: active
date: 2026-08-30
authorizer: Roman Zheltov, Product Owner
source: current Codex conversation
terminalReviewer: Roman Zheltov
supersedesFor: readiness-only production boundaries described below
---

# Pre-READY Closure Waiver — S-2 and S-6

## Recorded Product Owner authorisation

On 2026-08-30 the Product Owner explicitly authorised: (1) the previously
blocked production changes needed to execute the complete `G-S2-topology`
TCC-A1 contract, and (2) creation and approved in-product use of the missing
self-authored catalog evidence assets, together with the production change
needed to preserve versioned catalog provenance through the S-6 durable and
portable-backup route. The Product Owner requires a truthful `READY` verdict
only after those conditions are actually evidenced.

## Permitted work

This waiver permits only the following pre-`READY` closure work, including its
tests and evidence records:

1. In `apps/web/src/domain/**`, extend the existing, production-owned TCC-A1
   corpus runner and its adapters so every source-owned contract family runs
   against the production topology kernel. It may not create a second topology
   authority or change geometry semantics beyond what the accepted contract
   already requires.
2. In `apps/web/**`, carry immutable `CatalogVersion` and catalog asset identity
   from exact catalog admission/pin through durable item placement, portable
   backup, import/recovery and test evidence. It may not add a screen, account,
   network product flow or unrelated feature.
3. In `apps/catalog-control-plane/src/main/resources/catalog/**`, create a
   minimal, static, self-authored GLB evidence matrix for the active Alpha
   catalog sections and floor/wall anchors, with exact resource metadata and
   hashes. Generated assets are limited to generic, non-branded geometric
   demonstration objects; no third-party source, texture or model may be used.
4. In `_bmad-output/**`, record RED/GREEN evidence, immutable resource/corpus
   hashes, results and the terminal human-review form.

## Rights instruction for generated evidence assets

The Product Owner approves admission and all Alpha use of the new generic
self-authored evidence assets created under this waiver: in-app rendering and
thumbnails, validation/optimisation, local pinning, Portable Backup/private
transfer and rendered PNG download/share if exposed. This is a product-owner
authorisation for these newly created project evidence assets; it is not a
statement about any third-party resource. Every asset must identify its
generated-in-project provenance in the grant dossier.

## Limits retained

No commit is authorised. The changes must be TDD-backed, preserve the PRD/SPEC
and Architecture Spine invariants, and remain limited to gate closure. The
waiver does not authorise a general implementation phase, an unrelated UI
redesign, external publication, third-party asset use or a `READY` verdict
without passing execution and review evidence. Roman Zheltov is the designated
terminal human reviewer for both gates.

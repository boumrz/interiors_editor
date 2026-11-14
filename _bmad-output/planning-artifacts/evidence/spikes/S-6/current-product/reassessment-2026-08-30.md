---
title: G-S6 Current-Product Independent Reassessment
date: 2026-08-30
status: final
scope: active-alpha-catalog
verdict: NOT_PASS
authorRole: independent-evidence-review
---

# G-S6: independent current-product reassessment

## Exact verdict

**`G-S6-catalog = NOT PASS`.** The Product Owner's 2026-08-30 confirmation
of the eight self-authored assets, together with the recorded mobile/physical
acceptance, closes those two evidence classes for the existing eight-resource
set. It does not make that set a representative current-Alpha catalog matrix
and does not turn the currently floor-only custom-GLB durable route into a
versioned catalog-resource placement route.

A document describing the existing eight floor-furniture assets as the
``minimal representative matrix`` cannot truthfully change this result. It
would contradict the active scope rather than supply missing evidence.

## Active-scope test

The current authoritative user value is not a furniture-only catalog:

- PRD `FR-26` requires browse categories furniture, plumbing,
  appliances/electronics, lighting and accessories.
- `CAP-6` requires the catalog to cover furniture, plumbing, appliances and
  accessories, and requires floor/wall placement to keep a stable host.
- PRD `FR-28` requires placement only on an `AnchorClass`-compatible surface;
  its wall-item consequences are explicit. The S-6 plan requires the sample
  set to validate dimensions, units, anchor, footprint and variant-slot
  metadata.

The current publication is technically well-formed but contains eight assets
all marked `section: furniture`, `anchorClass: floor` and `variantSlots: []`.
The application honestly exposes the other four sections as empty states. That
is acceptable incremental UI behaviour from Story 5.1; it is not evidence that
the actual representative-catalog scope is covered.

Therefore a full G-S6 matrix needs, at a minimum, actual admitted catalog
resources that cover every required catalog section and both `floor` and
`wall` anchor classes. There is no source that permits silently treating the
empty sections or a resource-free wall panel as catalog-resource samples.

## Wall anchor versus variants

### Wall-anchor catalog asset

**Required for G-S6 under the current, unchanged scope.** A wall-backed
catalog sample is necessary to prove the catalog pipeline's `anchorClass:
wall` metadata, resource admission, pinning and durable/backup path. The
existing resource-free parametric wall panel proves a different product route;
Story 5.3 explicitly says that a future model-backed/catalog wall candidate
must still cross the exact-resource pin and `BackupFeasibilityPolicy` boundary.

### Variant asset

**A new resource-backed variant GLB is not an unavoidable current G-S6
requirement.** Active Alpha supports named, local `ItemColorVariantId` values
for parametric floor/wall items. Story 6.1 deliberately accepts
`variantSlots: []` for GLB assets and rejects a variant reference on such an
asset; resource-backed variants are a later conditional path. The matrix must
still state and test that `variantSlots: []` is intentional for each current
GLB and that the no-variant rejection route is preserved. It must not invent a
catalog variant merely to fill a column.

Consequently, the minimal honest matrix is not "floor furniture only": it is
one or more admitted samples for each required section, including at least one
wall-anchored catalog resource, with an explicit no-resource-variant row where
appropriate. A resource-backed variant sample becomes required only if the
Product Owner expands Alpha to promise such a catalog variant.

## Current technical evidence and remaining non-mobile gap

The current implementation supplies useful partial evidence:

- `catalog-envelope-source.json`, `CatalogEnvelope.kt` and the web
  `HttpCatalogGateway` enforce versioned metadata plus format, byte length and
  SHA-256 descriptors.
- Exact GLB preflight, local pinning, `BackupFeasibilityPolicy`, offline reopen
  and self-contained backup/import have working evidence for a selected
  floor catalog GLB.
- The rights-holder dossier covers the eight existing models, and Product
  Owner mobile acceptance covers the stated physical mobile scope.

However, current preloaded catalog placement is materialized as a
`CustomGlbAssetDefinition` through `CreateCustomGlbFloorItemUseCase`. Its
durable definition contains a hash and GLB metadata but no catalog asset ID or
`CatalogVersion`; the AppShell allocates a `preloaded-glb:` local definition
ID. Thus existing floor-resource backup tests demonstrate exact bytes, but not
the full required catalog-specific chain:

`versioned catalog asset/version -> exact pin -> durable catalog placement ->
Portable Backup -> restore/recovery`.

That is a non-mobile, functional evidence gap. It remains even if every
physical device trace is accepted.

## Conditions for a truthful PASS

1. Publish a small, real, rights-confirmed catalog matrix covering the active
   sections and both anchors; retain the exact descriptors and manifest hash.
2. Make the catalog-origin/version identity survive the durable placement and
   portable-backup route, or adopt a source-contract decision that explicitly
   defines an equivalent immutable catalog reference.
3. Run a corpus for every matrix row through validation, pin,
   BackupFeasibilityPolicy, durable publish, offline reopen, backup, restore
   and missing/corrupt-resource recovery, retaining outcomes and hashes.
4. Record a fresh independent terminal review of that current-product evidence
   with a `PASS` verdict. The historical S-6 spike remains `PAUSED` and cannot
   be relabelled retroactively.

No additional mobile trace or rights document is needed for the eight existing
assets. The remaining work is the matrix and catalog-origin resource evidence
above.

## Evidence consulted

- `_bmad-output/planning-artifacts/epics.md` (`G-S6-catalog`)
- `plans/alpha-implementation-plan.md` (S-6 entry/exit criteria)
- `_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md`
  (`FR-26`–`FR-28`)
- `_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md` (`CAP-6`, `CAP-7`)
- `_bmad-output/planning-artifacts/evidence/readiness-collection-2026-08-09/asset-usage-grant-dossier.md`
- `apps/catalog-control-plane/src/main/resources/catalog/catalog-envelope-source.json`
- `apps/web/src/ui/preloaded-glb-catalog.ts`, `apps/web/src/ui/AppShell.tsx`,
  `apps/web/src/domain/project.ts`,
  `apps/web/src/application/create-custom-glb-floor-item.ts`
- `_bmad-output/implementation-artifacts/5-3-place-wall-item-with-stable-host.md`,
  `6-1-change-allowed-item-variant-or-color.md`,
  `8-4-open-and-save-existing-project-in-airplane-mode.md`, and
  `8-8-export-self-contained-portable-backup.md`

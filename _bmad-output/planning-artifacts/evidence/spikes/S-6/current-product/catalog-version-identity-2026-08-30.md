---
title: S-6 Catalog-Version Identity Closure Evidence
date: 2026-08-30
status: final
scope: narrow-catalog-origin-provenance
verdict: PASS_FOR_NARROW_IMPLEMENTATION_SCOPE
terminalHumanReviewer: Roman Zheltov
---

# S-6 catalog-version identity: exact-resource closure

## Scope and non-claim

This is a narrow implementation-evidence record for the missing catalog-origin
link identified in the independent reassessment. It records a versioned catalog
identity across the existing resource route:

`CatalogVersion asset -> verified exact GLB pin -> Durable Revision -> Portable
Backup -> verified import/restore`.

It does **not** replace the independent reassessment or declare the wider
`G-S6-catalog` gate passed. The catalog-resource matrix, rights evidence and
physical traces have their own records. No catalog asset, manifest, topology,
or central readiness document was changed by this slice.

## Durable contract added

`CustomGlbAssetDefinition` now optionally carries a complete immutable
`CatalogVersionAssetOrigin`:

- `source: "CatalogVersion"`;
- `catalogAssetId`;
- `catalogVersion`;
- exact 64-hex `catalogEnvelopeHash`.

The origin fields are all-or-nothing. Legacy custom GLB definitions remain
valid when every origin field is absent; a partial, whitespace-padded,
wrong-source, or malformed-hash origin is rejected before it can become
durable. The JSON transfer parser applies the same exact-key and provenance
rules, so backups and imports cannot add or weaken provenance out of band.

The preloaded-catalog mapper supplies the immutable identity from the verified
publication and AppShell carries it into the existing custom-GLB placement
draft. The existing exact-byte verifier remains the gate before resource
pinning, `BackupFeasibilityPolicy`, and atomic durable publication.

## TDD evidence

The initial RED command was:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs src/domain/project-json-transfer.test.ts src/domain/custom-glb-asset.test.ts src/ui/preloaded-glb-catalog.test.tsx src/application/import-portable-backup.test.ts
```

It produced **51 passed / 4 failed** as intended: absent catalog-origin JSON
round-trip rules, missing origin validation, absent publication mapping, and
rejection of the versioned imported definition. Production changes were made
only after that RED result.

The final focused command was:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs src/application/export-portable-backup.test.ts src/application/import-portable-backup.test.ts src/domain/custom-glb-asset.test.ts src/domain/project-json-transfer.test.ts src/ui/preloaded-glb-catalog.test.tsx
```

Final result: **66 passed / 0 failed** across five files. New behavior coverage
asserts all of the following:

1. a selected catalog asset writes its catalog asset ID, publication version,
   and envelope hash into the durable custom-GLB definition;
2. the canonical JSON member round-trips that identity and rejects partial,
   padded, wrong-source, and shortened-hash variants;
3. Portable Backup contains the exact referenced GLB bytes and preserves the
   catalog identity in `project/project.json`;
4. Portable Backup import/restore pins the decoder-verified exact bytes before
   publication and retains the same catalog identity in the imported Durable
   Revision;
5. malformed technical metadata and unavailable/mismatched resource cases
   remain rejected before durable publication.

The first narrowed mutation measurement exposed meaningful untested guards:
acceptance of a complete origin, string type checks, and both anchors of the
64-hex envelope hash. The test hardening added a valid-origin acceptance case
plus rejecting type-confused values, non-hex values, one-character values, and
valid-hash prefix/suffix smuggling. It also exercises the JSON parser with an
array that stringifies to a valid-looking hash.

The mutation-RED command, with the required source check temporarily replaced
by the discovered `source === ""` mutant, was:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs src/domain/custom-glb-asset.test.ts --testNamePattern "accepts one exact catalog origin"
```

It failed **1 test** at the valid-origin acceptance assertion. The exact
`CatalogVersion` check was restored immediately; the two-file GREEN command
then passed **31/31**:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs src/domain/custom-glb-asset.test.ts src/domain/project-json-transfer.test.ts
```

## Sequential mutation evidence and restoration

After the workspace had a confirmed 1,689-test green checkpoint and no
concurrent source writes, the initial in-place narrowed mutation measurement
identified 20 survivors and one timeout. After the RED-to-GREEN hardening
above, one sequential narrowed rerun executed:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --filter @interiors/web exec stryker run stryker.config.mjs --mutate "src/domain/custom-glb-asset.ts:92-110,src/domain/project-json-transfer.ts:529-546"
```

It completed with exit code 0 in 2m49s. Report:
`apps/web/reports/mutation/production-mutation.json`.

| Scope | Killed | Survived | Timeout | Mutation score |
| --- | ---: | ---: | ---: | ---: |
| `custom-glb-asset.ts` | 54 | 2 | 0 | 96.43% |
| `project-json-transfer.ts` | 39 | 0 | 0 | 100.00% |
| Total | 93 | 2 | 0 | 97.89% |

No behaviorally meaningful survivor or timeout remains. The two surviving
`MethodExpression` mutants are genuinely equivalent:

1. at `custom-glb-asset.ts:103`, changing
   `catalogAssetId.trim().length > 0` to `catalogAssetId.length > 0` cannot
   change the result because the immediately following conjunct still requires
   `catalogAssetId.trim() === catalogAssetId`;
2. at `custom-glb-asset.ts:106`, the identical reasoning applies to
   `catalogVersion`.

For an empty string both forms are false. For whitespace-only or padded values,
the mutated length check can become true but the next exact-trim conjunct is
false; for a valid unpadded nonempty string both are true. The Stryker backup
was removed automatically. A direct scan for `stryMutAct` and `stryCov` in both
mutated files was empty before final checks, confirming original source
restoration.

## Final checks

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --filter @interiors/web typecheck
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --filter @interiors/web lint
```

Both commands passed. No commit was created.

## Terminal human review

**Roman Zheltov** is the assigned terminal human reviewer. Review must confirm
that the versioned catalog identity visible in the durable Project member,
backup archive, and imported Project matches the selected catalog publication
and that the exact resource bytes remain the referenced SHA-256 payload. This
record makes no assumption about ownership beyond the Product Owner's separate
asset-rights authorization.

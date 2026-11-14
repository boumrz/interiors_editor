---
title: S-6 self-authored catalog resource matrix
status: complete-awaiting-terminal-human-review
date: 2026-08-30
authorizer: Roman Zheltov, Product Owner
terminal_reviewer: Roman Zheltov
scope: G-S6 catalog resource/category/anchor evidence
---

# S-6 self-authored catalog resource matrix

## Decision and scope

Roman Zheltov directly authorised creation and use of the missing evidence
resources in the current Codex conversation on 2026-08-30. The resulting
resources are deliberately small, self-authored, static GLB primitives. They
are evidence resources, not a claim that the Alpha catalogue now has a
production-quality model library.

The historical eight user-owned furniture assets remain unchanged. The new
four assets cover every remaining source-required section and both valid anchor
classes:

| Asset ID | Source section | Category | Anchor | Dimensions mm | Exact GLB descriptor |
| --- | --- | --- | --- | ---: | --- |
| `evidence-bathroom-sink` | plumbing | plumbing | floor | 600 × 480 × 930 | `d86ee150670306e9fc705848345b8fe78ca7bd8d6993eec28fbb2a92f30f187c`, 1,052 bytes |
| `evidence-countertop-appliance` | appliances-electronics | appliance | floor | 550 × 450 × 430 | `b569c982d39756b4fd5735372a5272c63a6c3df7e066cba6a45a40ffb47430a6`, 1,056 bytes |
| `evidence-floor-vase` | accessories | accessory | floor | 300 × 300 × 600 | `cd58deda7dfc510f4dd8ff330c155976cd9674335d9c3518e74914fac705dc76`, 964 bytes |
| `evidence-wall-sconce` | lighting | lighting | wall | 220 × 190 × 280 | `fcfc3ff594a2a4182da87e08bb36ea5dfa0128803e14d54d599b419775a05f38`, 972 bytes |

The source files are under
`apps/catalog-control-plane/src/main/resources/catalog/evidence-assets/` and
are reproducibly written by `generate-evidence-assets.mjs`. All four use only
the core glTF 2.0 static profile: one indexed cube mesh composed by node
transforms; no image, external URI, animation, skin, camera or extension.
Thumbnail descriptors are intentionally absent because the adopted envelope
schema makes thumbnails optional and no decorative placeholder is admissible
evidence.

## Contract admission evidence

The versioned envelope and exact map are updated as
`alpha-2026-08-30.1` in:

- `apps/catalog-control-plane/src/main/resources/catalog/catalog-envelope-source.json`;
- `apps/catalog-control-plane/src/main/resources/catalog/catalog-resource-files-v1.json`.

The existing `CatalogSeedPreparer` harness constructs an ephemeral operator
asset root from the unchanged historical catalogue root and the new evidence
resource root, then checks exact filename, byte length, SHA-256 and
`StaticCatalogGlbProfile-1` before publication. It admits 12 assets and 20
resources and asserts all five source sections plus both `floor` and `wall`
anchors.

The initial RED test ran before the assets/map/envelope existed and failed at
the expected inventory boundary (`expected: <12> but was: <8>`). After adding
the exact resources and descriptors, the complete catalog-control-plane suite
was run:

```text
cd apps/catalog-control-plane && ./gradlew test
37 tests completed, 0 failed — BUILD SUCCESSFUL
```

This includes the real PostgreSQL publication/integrity path, which asserts the
published catalogue contains 12 `catalog_asset` rows and 20 exact
`catalog_resource` rows. It does not modify `apps/web`; its separate
CatalogVersion → pin → durable placement → Portable Backup → restore proof is
owned by the catalog-identity work and must be read together with this resource
matrix before `G-S6-catalog` receives a final status.

As a separate non-mutating decoder check, the pinned Three.js `0.185.1`
`GLTFLoader` parsed the exact GLB bytes successfully: sink 3 scene nodes,
appliance 3, vase 2 and wall sconce 2. Re-running the generator into a fresh
temporary directory and comparing each file byte-for-byte reproduced the four
published SHA-256 descriptors above.

## Operator staging boundary

`CATALOG_ASSET_ROOT` is explicitly an operator-provided directory. For this
version it must contain the filenames in the immutable resource map: the
existing eight user-owned catalogue models/thumbnails and these four exact GLB
files. The test builds that directory only as a temporary verification root; it
does not promote these evidence files into the web app or create a network
publication.

## Terminal review assignment

Roman Zheltov is the assigned human reviewer. The review is complete only when
he verifies the four source paths, their displayed SHA-256/byte descriptors,
the `alpha-2026-08-30.1` envelope entries and the passing Gradle result, then
records a PASS/CONCERNS decision in the final readiness package.

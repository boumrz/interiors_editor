# Catalog retains the selected wall — 2026-10-25

Opening the catalog cleared `selectedWallId`. A selected wall model then fell back to the first eligible host, so it could publish on another wall. The intended overlap warning also disappeared when an existing legacy panel was on the explicitly selected wall.

`ITEM-E2E-04E` now deliberately chooses the non-default exterior wall (maximum opaque UUID, while derived hosts are ordered with the minimum first). After reopening the catalog and choosing the real sconce GLB, it checks the exact selected wall identity, the overlap warning naming the saved panel, one explicit confirmation and the resulting Durable Revision/item counts. Choosing a different host cannot pass randomly.

- **RED:** `red.log` and `red-error-context.md` show the exact UUID mismatch on the old production source.
- **GREEN:** `green-wall-and-floor-regressions.log` — 10/10 pass, including this case plus real wall-model rehosting, semantic side, duplication and the remaining floor/context-loss regressions.
- **Production change (root owner):** `openBuiltInCatalog` retains the selected wall identity. The later placement command continues to choose and validate an eligible host. No fixture workaround changed the chosen wall.
- This evidence is also the direct inverse/reversion check for the deleted clearing statement: restoring the old statement produces the recorded same-host failure. The separate Stryker report in `../moved-opening-guard` covers the new domain guard; it does not claim to mutate AppShell.
- Tests ran in an isolated snapshot with pinned Node 24.19.0, a real Chrome engine and an iPhone 13 browser profile. This is browser emulation, not a physical-phone observation.

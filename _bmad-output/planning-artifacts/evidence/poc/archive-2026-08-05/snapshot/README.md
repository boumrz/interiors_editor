# InteriorsEditor

Mobile-first PWA editor for precise interior planning in millimetres, with
local-first Project ownership and offline recovery as product invariants.

## Current status — 2026-08-05

The production application is **not ready for delivery**: the current final
BMAD readiness verdict is
[`NOT_READY`](_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-05.md).
The later D-022 policy work remains non-canonical preflight work and does not
change this verdict.
The owner separately authorized the bounded
[`W-POC-2026-08-04`](_bmad-output/planning-artifacts/root-phone-poc-waiver-2026-08-04.md)
to create one local, phone-first web POC in `apps/web`; it is not a release
authorization or a production scaffold.

The owner-approved production target is one repository-root delivery:

- `apps/web` — React, TypeScript, Rspack, Rstest and CSS Modules;
- `apps/catalog-control-plane` — the narrow Kotlin/PostgreSQL catalog and
  provenance control plane only;
- `docs/` — the curated human-facing documentation entry point.

The only currently authorized temporary evidence roots are the exact paths
named by waiver `W-SPK-2026-08-04`; their `S-*` names are not a general
authorization to create or write another spike. They are isolated, synthetic
experiments, not application modules, and must never be promoted by copying
their code into the product.
The Git repository is initialized on `main` with no commit; commits still
require explicit owner approval.

## Documentation

Start at [the documentation index](docs/index.md). It links to the canonical
PRD, SPEC and required companions, Architecture Spine, epics, project context
and the current readiness evidence.

`_bmad-output/` remains the non-runtime provenance archive while the readiness
gate is open. It will be consolidated only through an approved path mapping
and authority switch, so that stable IDs and source links remain verifiable.

## What is implemented today

The root `apps/web` folder now contains the bounded, runnable phone editor
POC: synthetic plan state, a guarded divider action, InApp Focus and Rstest +
Playwright coverage. It runs through the version-pinned `npm run poc:*`
commands; see the [POC walkthrough](docs/poc/README.md). It has no browser
storage, PWA cache, network API, Kotlin/PostgreSQL service, durable Project or
3D engine, and it must not be represented as production functionality.

An isolated S-3 browser evidence prototype exercises only synthetic durability
behaviour: staging/checksum/atomic IndexedDB publication, fencing, recovery,
offline shell and controlled service-worker updates. Its code and tests live
under its waiver-approved root and do not represent the future editor UI,
geometry, renderer, catalog or backend.

## Next delivery gate

Before root delivery may advance beyond the bounded POC, the remaining
product/architecture decisions, bounded spike evidence and final BMAD
readiness gate must be closed to `READY`. Physical iOS/Android/PWA, lifecycle,
storage and performance evidence remains separate from desktop browser
automation.

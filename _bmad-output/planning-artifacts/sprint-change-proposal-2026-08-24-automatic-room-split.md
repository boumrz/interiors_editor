---
title: Sprint Change Proposal — Automatic Room Split
date: 2026-08-24
status: implemented-and-verified
decision_owner: Roman Zheltov
triggering_scope: Story 3.1 / Story 2.2 wall-induced Room split
---

# Sprint Change Proposal — Automatic Room Split

## Trigger and decision

The shipped consequence panel «Разделение помещения» asks the person to choose
which successor retains Room identity, name, type, height and history. Roman
Zheltov rejected that interaction on 2026-08-24: drawing and confirming a
valid Wall must immediately show the spaces made by the Wall. The successor
name is not a user decision in this flow; every successor must retain the
predecessor's `heightMm`.

This is a Product Owner-approved scope correction, not a new capability.

## Chosen path

Direct adjustment is selected (low implementation scope, low product risk):

1. Remove the AddWall Room-metadata successor chooser and its default
   2600-mm successor policy.
2. On a valid wall-induced split, derive every successor Room in the same
   confirmed atomic command and copy the exact height of its predecessor.
3. Do not use a left/right choice to preserve `roomId`, name, type or history.
4. Keep explicit, cancellable conflict preview only where safe automatic
   preservation is impossible: Room merge, Opening, asset placement or surface
   host consequences.

No epic is added or reordered. The historical Story 3.1 implementation is
superseded; it remains in dated evidence, while all future acceptance and
roadmap wording follows the rule above.

## Contract and backlog impact

| Owner | Required correction |
|---|---|
| PRD `FR-15` | Specify automatic predecessor-height inheritance for AddWall split; retire metadata recipient choice. |
| Architecture `AD-3`, `AD-7`, `AD-22` | Treat basic AddWall split as a complete candidate; preserve conflict preview for actual safety conflicts. |
| SPEC `CAP-3` + geometry/TCC companions | Make no-dialog split and exact `heightMm` inheritance normative and corpus-tested. |
| UX `EXPERIENCE.md` | Remove Room split from `ConflictPreview`; leave merge/host safety states intact. |
| Story 2.2 / 3.1 roadmap | Delete the retired panel/default-height acceptance target; add RED→GREEN coverage for automatic split. |

## Acceptance evidence for the replacement slice

- Confirming a valid cardinal or 45° wall split creates the derived successor
  Rooms without a second modal.
- Each successor has the precise predecessor `heightMm` after reopen and
  inverse/redo where applicable.
- No successor-selection action can alter `roomId`, name, type or history.
- Existing merge and unresolved Opening/asset/surface-host conflict paths stay
  non-durable until their own explicit safe resolution.
- Domain, application and mobile-browser evidence cover the change; no Alpha
  readiness or physical-device claim is implied by this correction.

## Implementation handoff

One developer owns the vertical slice: update the topology reconciliation
policy, application/controller route, consequence UI and focused tests in TDD
order. The Product Owner's wording in the trigger section is the approval to
apply the correction; no commit is authorised by this proposal.

## Implementation evidence

Completed on 2026-08-24 without a commit: the former successor-preview and
resolution route was deleted from domain, application/controller and phone UI;
the original atomic `AddWall` publication now materializes every successor at
the predecessor's exact `heightMm`. The replacement browser scenario proves
that no Room-metadata dialog is rendered. Full source regression is 1,239
Rstest; both TypeScript configurations, Biome (240 files), production Rspack,
six affected mobile-browser scenarios and all three PWA scenarios passed.
Scoped Stryker on the changed application route killed 1/1 mutants (100%).

---
baseline_commit: NO_VCS
---

# Story 3.1: Вывести устойчивые Rooms из замкнутой topology

Status: done

## Story

Как пользователь,
я хочу, чтобы замкнутые части моего плана становились узнаваемыми Room и не
теряли свою идентичность при локальной правке,
чтобы продолжать работать с теми же помещениями, а не со случайными полигонами.

## Minimal Alpha Acceptance Criteria

1. После одной valid Durable topology command каждый поддерживаемый simple
   bounded Face 0°/45°/90° становится одной Room. Открытый graph, graph bridges,
   unbounded exterior и неположительная/ambiguous Face не создают ложных Rooms.
2. Rectangular, triangular, trapezoid и concave outer rings сохраняют точную
   polygonal форму. Usable polygon, area, perimeter и face fingerprint остаются
   derived projections PlanGraph, а не отдельными editable geometry fields.
3. Одинаковая versioned topology даёт одинаковый normalized fingerprint
   независимо от порядка/direction Walls и starting Vertex. Поддерживаемая
   локальная thickness/move/split правка сохраняет однозначный `roomId`,
   `heightMm` и совместимые metadata.
4. Обычная valid Wall, делящая Room, сразу публикует всех successors с точным
   predecessor `heightMm` и не показывает left/right Room chooser. Merge или
   host-loss использует отдельный explicit consequence preview и fresh confirm.
5. Cancel, invalid topology, stale base или потерянный writer fence не создают
   partial Room, Revision или History entry. Nested/touching rings в минимальной
   Alpha-границе fail closed как `AMBIGUOUS_BOUNDED_WALK`, а не материализуются
   как случайные Rooms.
6. Durable Room identities, counts and polygons переживают reload; Plan и 3D
   строятся из одной canonical Revision.

## Tasks / Subtasks

- [x] Derive Rooms only from supported bounded PlanGraph Faces.
- [x] Сохранить exact rectangular/triangular/trapezoid/concave polygons и
      derived measurements.
- [x] Нормализовать fingerprint независимо от wall order/direction/start point.
- [x] Reconcile однозначную локальную правку с stable Room identity/metadata.
- [x] Автоматически наследовать predecessor height для каждого split successor.
- [x] Route merge/host ambiguity через explicit atomic consequence outcome.
- [x] Fail closed для open, invalid, touching и nested topology без partial Room.
- [x] Проверить phone construction, split/merge, identity, reload и Plan/3D.

### Review Findings

- [x] [Review][Patch] Diagonal nested rings bypass the fail-closed boundary [apps/web/src/domain/derive-plan-faces.ts:544]
- [x] [Review][Patch] Splitting a 45-degree boundary changes the normalized Room fingerprint [apps/web/src/domain/derive-plan-faces.ts:620]
- [x] [Review][Patch] Polygonal wall exterior normals depend on canonical winding [apps/web/src/domain/derived-orthogonal-plan-faces.ts:688]
- [x] [Review][Patch] Missing-Room recovery can allocate metadata for a collapsed usable polygon [apps/web/src/domain/general-wall-project.ts:393]
- [x] [Review][Patch] Derived Room projections omitted usable-floor area and perimeter, forcing a second UI calculation [apps/web/src/domain/derived-orthogonal-plan-faces.ts:41]
- [x] [Review][Architecture] Independent acceptance classifies the unresolved
  D-022 exact representation/`MeasurementFormatPolicy` route for 45-degree
  miter/bevel boundaries as an external architecture gate, not an unmet
  published AC of this minimal Story 3.1 slice. It remains open in its source
  of truth and is not claimed resolved here. [geometry contract §§1, 7.1;
  roadmap D-022]
- [x] [Review][Defer] `DerivedOrthogonalFace.areaMm2` truncates half-square-millimetre centerline areas [apps/web/src/domain/derive-plan-faces.ts:592] — deferred, pre-existing; no current production consumer uses this value and user-visible measurements consume the derived usable-polygon projection rather than this centerline value.

## Dev Notes

- Trace: `CAP-3`; `FR-14`, `FR-15`; `NFR-1`, `NFR-3`, `NFR-4`, `NFR-24`,
  `NFR-26`; `AD-1`, `AD-2`, `AD-3`, `AD-6`, `AD-7`, `AD-12`, `AD-19`;
  `V-06`.
- PlanGraph is the sole geometry source. Room stores only stable semantic
  identity/properties attached to a derived fingerprint; projection polygons
  and renderer meshes remain disposable.
- A Room with one outer ring plus preserved void rings is not part of this
  Product Owner-approved minimal Alpha closure. Full hole offset/collapse and
  S-2 outer/void corpus remain a separate topology gate; current nested rings
  reject atomically rather than being approximated or split into fake Rooms.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** The existing production path already
  derives exact simple bounded Rooms, excludes open/exterior walks, preserves
  stable identity across supported thickness/move/split edits, automatically
  copies split height and routes merges through the explicit Story 2.6 outcome.
  Rectangular, 45-degree and concave paths persist and reopen from the same
  canonical graph in Plan/3D. No production change was required.
- Added one characterization test proving unsupported nested closed rings reject
  as `AMBIGUOUS_BOUNDED_WALK` instead of materializing a partial/second Room.
  Final focused evidence is 196/196 Rstest checks across face derivation,
  projection, domain, application and controller. Eleven iPhone-13
  browser-emulation scenarios are green cumulatively through the external
  tunnel: 10 passed in the combined run; the concave scenario had already
  completed its geometry/identity assertions but exceeded the 5-second 3D lazy
  load while showing `Загружаем 3D…`, then passed on isolated rerun.
- Changed-file Biome passes. No production code changed, so no new mutation
  score is claimed; prior source-changing Room/lineage mutation evidence remains
  recorded in sprint status and roadmap.
- **Review-patch evidence — 2026-08-28.** Resolved diagonal nested-ring
  containment, diagonal split fingerprint normalization, winding-independent
  outward normals, and missing-Room recovery that could allocate metadata for
  a collapsed usable polygon. Focused mutation testing killed 20/21 targeted
  mutants (95.24%; the only survivor is the equivalent `winding > 0` → `>= 0`
  change for a non-degenerate face). The recovery tests prove both a collapsed
  rectangle and a collapsed 45-degree triangle return no-op before identity
  allocation. Targeted 150/150, full 1,546/1,546 Rstest, Biome, TypeScript
  checks, production build, browser 150 passed / 1 skipped, and PWA 5/5 are
  green. The diagonal split acceptance scenario now proves that the predecessor
  `roomId` appears on exactly one successor after both publication and reload.
  Story remains in `review`: face derivation, general mutation and
  acceptance/E2E review groups are complete, but no independent final
  acceptance is claimed.
- **Usable-room-metrics review patch — 2026-08-28.** `DerivedOrthogonalRoomFace`
  now carries ephemeral `usableFloorAreaMm2` and `usableFloorPerimeterMm`,
  derived only from the finished inward-offset tile or usable polygon. The UI
  consumes those projection values rather than recomputing geometry; they are
  neither persisted nor usable as a second geometry source. Rectangle,
  45-degree triangle/trapezoid, concave polygon, and V2 projection coverage
  exercise the values. A focused mutation run killed 13/14 mutants (92.86%);
  the sole survivor reverses the sign immediately passed to `Math.abs`, so it
  is equivalent for an already-simple valid polygon. Current validation is
  TypeScript, Biome, full Rstest 1,548/1,548, the diagonal and concave
  browser scenarios, and the offline PWA mutation scenario. Story stays in
  `review` pending the D-022 measurement-precision decision and independent
  acceptance.
- **Acceptance closure — 2026-08-28.** Independent review accepted all six
  Minimal Alpha AC: bounded-face derivation fails closed for ambiguous/nested
  topology; polygonal usable measurements remain derived projections; lineage,
  split height and CAS/fence outcomes preserve the canonical Durable Revision.
  D-022 remains an explicitly external architectural decision and is not
  represented as closed by this Story.
- Current validation: 202/202 independently focused Rstest across derivation,
  projection, lineage/publication and measurements; current full 1605/1605
  Rstest, Biome, both TypeScript configurations and production build are
  green. No new source mutation claim is made by this documentation-only
  acceptance checkpoint.

### File List

- `_bmad-output/implementation-artifacts/3-1-derive-stable-rooms-from-closed-topology.md`
- `apps/web/src/domain/derive-plan-faces.ts`
- `apps/web/src/domain/derive-plan-faces.test.ts`
- `apps/web/src/domain/derived-orthogonal-plan-faces.ts`
- `apps/web/src/domain/derived-orthogonal-plan-faces.test.ts`
- `apps/web/src/domain/derived-project-v2-plan.ts`
- `apps/web/src/domain/derived-project-v2-plan.test.ts`
- `apps/web/src/domain/general-wall-project.ts`
- `apps/web/src/domain/general-wall-project.test.ts`
- `apps/web/src/application/general-wall-project-mutations.ts`
- `apps/web/src/application/general-wall-project-mutations.test.ts`
- `apps/web/src/ui/room-measurement.ts`
- `apps/web/src/ui/room-measurement.test.tsx`
- `apps/web/stryker.usable-room-metrics.config.mjs`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-28: Independent acceptance found no P1/P2 against the six published
  AC; Story moved from `review` to `done` without claiming D-022 resolved.
- 2026-08-26: Created the missing implementation artifact, recorded the minimal
  fail-closed nested-ring boundary as executable evidence and moved Story 3.1
  to `review`.
- 2026-08-28: Added the independent-review fixes and made usable-floor metrics
  part of the derived Room projection; Story remains in `review`.

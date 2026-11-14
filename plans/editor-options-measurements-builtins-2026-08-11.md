---
title: "Editor options, measurements and built-in greybox library"
status: complete
date: 2026-08-11
scope: "Waiver-authorized legacy editor UX only; no V1/V2→canonical migration and no READY claim"
---

# Vertical slice: usable phone editor shell

## Goal

Пользователь видит измерения созданного плана во время рисования, открывает
инструменты из компактного `Опции`, а встроенный greybox-предмет выбирает по
понятной карточке с preview до placement.

## Approved acceptance criteria

- «Прямоугольная комната» не показывается как пользовательский инструмент;
  замкнутые wall faces остаются единственным источником derived Room.
- У каждой отображаемой derived комнаты видны площадь и габариты в 2D, включая
  активный wall tool; по подтверждённому пользовательскому решению visual wall
  centerline и measurement guide показываются пунктиром.
- На телефоне снизу нет rail с инструментами: рядом находятся только `Опции`,
  undo и redo; открытые Options имеют явное закрытие и 44px controls.
- «Встроенные предметы» открывают не remote catalog, а local procedural
  greybox-library: категория, габариты и preview до выбора; выбор создаёт лишь
  текущий parametric item draft, а не durable CatalogAsset.
- Все новые UI interaction tests используют accessible queries и actual browser
  interaction; targeted mutation covers new deterministic presentation helpers.

## Explicitly deferred

- Numeric length editing for arbitrary walls and target-area resize. Area remains
  derived; the transform intent, anchor/aspect/shared-wall/opening/item policy,
  inverse and conflict preview require a SPEC/UX/Architecture update followed by
  canonical PlanGraph commands.
- Any V1→V2 promotion. V1/V2 remain legacy quarantine fixtures. Canonical
  cutover requires a separate explicit copy-on-write migration after corpus
  adoption.
- External catalog resources, AssetUsageGrant, resource pinning and backup.

## TDD route

1. RED browser regression: no rectangular-room action; persistent measurement
   guide while wall mode is active; Options opens local built-ins and a card
   selects a draft.
2. GREEN: presentation-only measurement guide, options dialog and built-in
   preview cards.
3. MUTATE: scope deterministic preview/measurement helper; add behavioral
   assertions for threshold, empty and selected states when applicable.
4. Run Rstest, lint, typecheck, production build and full Playwright; obtain an
   independent read-only review. No commit without explicit approval.

## Validation record

- `lint`: PASS (128 files).
- `typecheck`: PASS.
- `Rstest`: PASS (735 tests, 54 files).
- production build: PASS.
- Playwright browser regression: PASS (27 tests).
- Playwright PWA regression: PASS (2 tests).
- scoped Stryker `editor-presentation`: PASS, 119/121 killed, 98.35%; the two
  survivors are equivalent under the public safe-integer preconditions.
- independent final review: PASS after the Options backdrop/input-shield and
  focus-restoration regressions; no P0/P1 in the slice scope.
- Browser harness stability: development chunks use stable names, while
  production continues to use content hashes. This prevents a new page from
  receiving an HTML shell whose transient dev hash was already superseded.

## Completion boundary

This is completed **waiver-authorized legacy UX evidence**, not a READY gate,
canonical PlanGraph adoption, or a claim of a complete production alpha.

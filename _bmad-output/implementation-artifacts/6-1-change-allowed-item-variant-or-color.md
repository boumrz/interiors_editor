---
baseline_commit: NO_VCS
---

# Story 6.1: Изменить разрешённый вариант или цвет предмета

Status: done

## Story

Как пользователь,
я хочу применить к предмету разрешённый color или material variant,
чтобы сравнить его в моём интерьере, не повреждая исходную модель.

## Minimal Alpha Acceptance Criteria

1. Параметрический floor- или wall-ItemInstance показывает только объявленные
   именованные варианты единственного Alpha-слота `body`. Выбор варианта
   открывает доступное подтверждение; cancel не меняет Project или History.
2. Confirm выполняет одну Durable command и сохраняет стабильный domain
   `colorVariantId`. Hex-цвет остаётся строго проверяемой производной проекцией,
   а renderer material object не входит в сериализуемое состояние.
3. Unknown variant, stale/missing/locked Item и GLB без объявленного
   recolorable slot отклоняются до публикации с доступной причиной. Текущий
   внешний вид, footprint, dimensions, floor/wall host и History не меняются.
4. Local Project JSON принимает только объявленный `variantId` с точно
   соответствующей цветовой проекцией и не принимает variant reference у
   GLB-backed Item. Legacy Item без `colorVariantId` остаётся открываемым.
5. Undo, redo и reopening Durable Revision детерминированно восстанавливают
   тот же variant reference и вид. UI прямо обещает только изменение слота
   «Корпус», без изменения размера, положения, host или фотореализма.
6. Phone-browser evidence покрывает confirm/cancel, одну Revision, floor/wall
   variants, Undo/Redo и reload; production PWA остаётся регрессионно зелёной.

## Tasks / Subtasks

- [x] Объявить стабильные именованные Alpha-варианты единственного `body` slot.
- [x] Перевести floor/wall recolor commands с произвольного hex на
      `ItemColorVariantId` и сохранять один validated reference.
- [x] Добавить единый phone-first confirm/cancel flow для выбранного floor- или
      wall-предмета.
- [x] Сохранить честный no-variant route для GLB и atomic reject для
      unsupported, missing и locked targets.
- [x] Сделать JSON boundary строгой для variant/color correspondence и
      GLB-backed Items.
- [x] Подтвердить durable Undo/Redo/reopen, внешний tunnel, PWA и mutation
      evidence.

## Review Findings

- **2026-08-28 — wall cancel/redo/reload evidence.** `ITEM-E2E-04G` теперь
  отменяет доступный диалог варианта для настенной панели и подтверждает, что
  исходный цвет и число Durable Revision не меняются. Затем тот же сценарий
  повторно открывает диалог, подтверждает ровно одну Revision, проверяет
  Undo/Redo и после reload восстанавливает stable `alpha-warm-wood` reference
  с его цветовой проекцией. Вместе с существующим floor-сценарием это даёт
  phone-browser evidence для confirm/cancel, floor/wall, истории и reopening.
- [x] [Review][P1] Floor- и wall-recolor публикации используют exact-base CAS.
  Stale dialog возвращает `stale-base`, не становится `saved`, не добавляет
  History entry и перезагружает актуальную Durable Revision контроллера.

## Dev Notes

- Trace: `CAP-7`, `CAP-8`; `FR-33`; cross-cutting `FR-38`, `FR-39`, `FR-40`;
  `NFR-3`, `NFR-4`, `NFR-10`, `NFR-17`, `NFR-18`, `NFR-21`, `NFR-24`,
  `NFR-26`; `AD-2`, `AD-3`, `AD-8`, `AD-12`, `AD-14`; `UX-DR8`, `UX-DR9`,
  `UX-DR11`, `UX-DR18`, `UX-DR30`; `V-12`; `EV-06`, `EV-10`, `EV-11`,
  `EV-13`, `EV-14`, `EV-17`.
- Текущие Alpha-варианты полностью локальны и не вводят отдельный referenced
  resource. Поэтому confirm не запускает новый pin/`BackupFeasibilityPolicy`;
  этот gate остаётся обязательным для будущего resource-backed variant.
- Surface finishes, floor/wall assignments и независимые Project variants
  исключены из Alpha решением Product Owner и не входят в эту Story.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Семь локальных вариантов получили
  stable IDs, русские имена и один declared recolorable slot `body`. Floor и
  wall domain commands принимают только этот закрытый vocabulary и сохраняют
  `colorVariantId`; dimensions, placement, room/wall host и unrelated Items
  остаются неизменными.
- Palette больше не публикует изменение немедленно. Выбор открывает доступный
  диалог «Подтвердить вариант цвета», который называет вариант и явно говорит,
  что меняется только «Корпус». Cancel не создаёт Revision; confirm создаёт
  ровно одну. GLB-карточка по-прежнему честно сообщает, что изменяемые варианты
  не объявлены.
- JSON boundary сохраняет legacy compatibility для Items без variant ID, но
  отклоняет неизвестный ID, несовпадающий cached hex и любую локальную Alpha
  variant reference у GLB-backed Item. Это не позволяет импорту обойти
  non-recolorable domain policy.
- External iPhone-13 browser scenarios доказали cancel/confirm, одну Durable
  Revision, floor/wall reference, Undo/Redo и reload. Один и тот же сценарий
  прошёл локально и через действующий Cloudflare tunnel.
- TDD начинался красным: прежний recolor API принимал raw color и не сохранял
  stable reference. Отдельный RED воспроизвёл принятие variant ID у GLB через
  Project JSON. Финальный scoped Stryker результат — 65/65 killed, 100% для
  variant declarations, floor/wall mutation и новых JSON guards.
- Final evidence: 1342/1342 Rstest, warning-free 250-file Biome lint, обе
  TypeScript-конфигурации, production Rspack build, 2/2 связанных iPhone-13
  browser scenarios через внешний tunnel и 5/5 production PWA E2E.
- **Review evidence — 2026-08-28.** Локально `ITEM-E2E-04G` прошёл после
  усиления cancel/redo/reload assertions; Biome и обе TypeScript-конфигурации
  оставлены зелёными. Story остаётся в `review`: это evidence, не независимый
  sign-off и не release gate.
- **Acceptance closure — 2026-08-28.** Independent повторная приёмка приняла
  все шесть Minimal Alpha AC. После RED-регрессий stale-base для floor и wall
  recolor use cases публикуют только через
  `publishNextRevision(candidate, baseRevisionId)`; CAS rejection не создаёт
  saved state либо History и возвращает UI к actual Durable Revision.
- Final evidence for this closure: 90/90 focused Rstest, 1605/1605 full
  Rstest, warning-free 264-file Biome, обе TypeScript-конфигурации, production
  build, 2/2 связанных phone-browser scenarios и 5/5 production PWA E2E.
  Focused mutation: 52/52 killed (100%) для обоих recolor publication paths.

### File List

- `_bmad-output/implementation-artifacts/6-1-change-allowed-item-variant-or-color.md`
- `apps/web/src/domain/item-color-variant.ts`
- `apps/web/src/domain/project.ts`
- `apps/web/src/domain/parametric-item.ts`
- `apps/web/src/domain/parametric-wall-item.ts`
- `apps/web/src/domain/project-json-transfer.ts`
- `apps/web/src/domain/project-json-transfer.test.ts`
- `apps/web/src/domain/recolor-parametric-floor-item.test.ts`
- `apps/web/src/domain/parametric-item.test.ts`
- `apps/web/src/domain/parametric-wall-item.test.ts`
- `apps/web/src/application/recolor-parametric-floor-item.ts`
- `apps/web/src/application/recolor-parametric-floor-item.test.ts`
- `apps/web/src/application/recolor-parametric-wall-item.ts`
- `apps/web/src/application/recolor-parametric-wall-item.test.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/stryker.item-color-variant.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-28: Fixed stale-base CAS for floor/wall recolor, passed independent
  acceptance, and moved Story from `review` to `done`.
- 2026-08-26: Completed the minimal Alpha ItemInstance color/variant flow and
  moved Story 6.1 to `review`.
- 2026-08-28: Added review evidence for wall-variant cancellation, redo, and
  durable reopen in `ITEM-E2E-04G`.

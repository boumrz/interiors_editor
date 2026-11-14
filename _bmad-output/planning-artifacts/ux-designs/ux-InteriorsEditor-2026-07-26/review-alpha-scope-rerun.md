---
title: "Финальный короткий rerun: Alpha scope и interaction contracts"
status: final-rerun
reviewed: 2026-08-30
reviewer: independent-alpha-scope-rerun
reviewed_artifacts:
  - DESIGN.md
  - EXPERIENCE.md
  - mockups/correction-brief-2026-08-30.md
  - mockups/README.md
  - mockups/calm-spatial-studio-editor-v2-2026-08-30.png
  - mockups/calm-spatial-studio-catalogue-preparation-v2-2026-08-30.png
  - mockups/calm-spatial-studio-safety-v3-2026-08-30.png
  - mockups/calm-spatial-studio-failure-states-v2-2026-08-30.png
sources_checked:
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/glossary.md
  - ../../../specs/spec-interiors-editor-alpha/editor-interaction-and-grid-contract.md
out_of_scope:
  - "По решению Product Owner не проверяются доказательства на работающей PWA для 360 px, экранной клавиатуры, safe areas, contrast matrix и DOM-alternative."
---

# Вердикт

**PASS для Alpha scope: 0 Blocker · 0 High · 0 Medium.** Все RAXS-01…RAXS-06
закрыты. Это не заменяет общий implementation-readiness gate.

## Закрытия

- **RAXS-01:** pre-pin/pre-backup кадр теперь содержит только preparation и
  `Отмена`; ready `PlacementPreview` вынесен в отдельный v3 reference с
  `Готово для размещения` и `Поставить`.
- **RAXS-02:** SPEC, глоссарий, companion, spines, brief и mockup index теперь
  согласны: `Plan / 3D` — persistent `EditorTopBar` ViewSwitch; `ActionDock` —
  единственная нижняя command surface с `Рука и выбор` на Plan и максимум тремя
  context actions. Второго ToolRail нет.
- **RAXS-03:** есть отдельный reference с catalog outage и post-validation
  persistence failure; CTA и уровень блокировки различены.
- **RAXS-04:** из Opening brief удалены неавторизованные `Порог` и `Высота
  подоконника`; остались source-backed host/kind/width/height/offset/interval.
- **RAXS-05:** `Измерить` имеет Wall SelectionCard/Object list entry route,
  one/two-target semantics, stale → `Выбрать заново` и отдельный reference.
- **RAXS-06:** duplicate и lock/unlock заданы в Item properties, включая
  reversible command, undo/redo и Locked AssetInstance state.

Дополнительно подтверждено: Focus/fullscreen и Room finishes не возвращены;
3D остаётся нейтральной projection; Door/Window остаётся wall-hosted Opening
без navigation, lock/key или open/close lifecycle; `AssetInstance` —
канонический термин в source contracts.

## Low polish (не блокирует scope)

1. `EXPERIENCE.md` в UXF-6 один раз всё ещё пишет `ItemInstances`; заменить на
   `AssetInstances`, как требует glossary.
2. В общем списке примеров action name остаётся `Сохранить копию`. Для
   persist-failure правильный и уже используемый в state/visual contract текст
   — `Экспортировать данные для восстановления`; стоит убрать двусмысленный
   пример при следующей редактуре copy.


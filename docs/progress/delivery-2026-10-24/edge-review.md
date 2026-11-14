# Edge Case Hunter — 2026-10-24

Метод: установленный `.agents/skills/bmad-review-edge-case-hunter/SKILL.md`, шаги 1–5, включая вторичную проверку удалённых обязанностей из `references/deletion-check.md`.

Вход: `/tmp/interiors-delivery-2026-10-24/review/implementation.diff`, ненулевой текстовый diff. Проверены изменённые ветви recovery/controller, точного восстановления из GLB и Portable Backup, pin staging, локальной библиотеки/томбстоунов и связанные UI-переходы отмены, истории и ресурсов. Дополнительно прочитаны вызываемые ими методы. Проверка относится к этому назначенному слою, а не ко всем 10 052 строкам diff или всему продукту.

Ограничение независимости: использован ранее участвовавший агент с транспортным контекстом и собственными изменениями в других участках. Новый агент недоступен из-за лимита потоков. Это отдельный проход по путям состояния; он не равен полностью слепому внешнему ревью. Прежние выводы не использовались как доказательство. Три заранее исключённых замечания (rename error ID, 44px recovery hub button, старое viewport assertion) не включены.

Обнаружен один новый воспроизводимый незакрытый путь. Вторичная проверка удалённых обязанностей не добавила отдельных доказанных регрессий: перенос PlanProjection/плановой презентации и renderer shared helpers сохраняет указанные вызовы, а снятие автоматического discard для недоказанных staging leases явно заменено консервативным удержанием корней.

## Доказательство

Публичные команды контроллера, без чтения/изменения private-полей:

1. Открыть проект с моделью A и доступными её байтами.
2. `restartProject`, `configureRectangularRoom`, `createCustomGlbFloorItem` с моделью B. A остаётся корнем Undo, B входит в текущую ревизию.
3. Удалить байты A из подставленного ресурсного хранилища; `refreshSessionHistoryIntegrity` возвращает `history-resource-issue`.
4. Удалить байты B; повторная проверка возвращает `current-resource-issue`, состояние — `recovery-needed`.
5. `repairCustomGlbResources([точные байты B])` возвращает `rejected`, хотя UI текущего восстановления требует B. Причина: старый `historyResourceIssue` остаётся установленным, а repair API берут его хеши через `??` раньше хешей текущего проекта.

Та же адресная развилка используется single-file и backup repair. Защита должна менять только диагностику при входе в current recovery, сохраняя Undo/Redo: после точного ремонта `finishExactResourceRepair` уже повторно проверяет все исторические корни.

RED: [edge-review-reproduction-red.log](edge-review-reproduction-red.log). Изолированная копия: `/tmp/interiors-delivery-2026-10-24/edge-review-workspace`; тест `src/app/edge-review.test.ts:200`. Выполнен напрямую закреплённым Node 24.19.0 / Rstest 0.11.5; оригинальные исходники и зависимости не менялись. Подготовительные ошибки harness устранены до зафиксированного RED; итоговый лог показывает именно отклонение repair, а не ошибку окружения.

Finding передан агенту `code_health`, владельцу controller/recovery, для исправления и регрессионного GREEN. На момент этого отчёта закрытие ещё не подтверждено.

## Findings

```json
[
  {
    "location": "apps/web/src/app/project-controller.ts:980-982",
    "trigger_condition": "После ошибки ресурса только в истории пропадает другой ресурс текущего проекта",
    "guard_snippet": "this.historyResourceIssue = undefined; // entering current-resource recovery; retain undo/redo stacks",
    "potential_consequence": "Точные GLB и резервные копии текущей модели отвергаются; восстановление блокируется старым диагнозом истории"
  }
]
```

Снимок diff SHA-256: `7424ee6e59cc167a4fd24eaf71df8bdee23ac318a5b9a7af18313694050be30e`.
Снимок проверенного controller SHA-256: `f3241cc502b5496a3a6d3a476cdd47a7bc598e905bf239a0df1d2e438d7bdb12`.

## Resolution подтверждено implementation owner

`enterCurrentResourceRecovery` теперь очищает только устаревший history diagnostic, сохраняя Undo/Redo. Три public-flow regression проверяют single GLB, batch и Portable Backup: текущий ресурс восстанавливается, затем повторно показывается history issue, после его ремонта Undo возвращает исходную версию. Полный финальный suite: 1834 unit и 213 browser PASS. Фактические RED/GREEN и SHA находятся в `recovery-mutations/summary.json`.

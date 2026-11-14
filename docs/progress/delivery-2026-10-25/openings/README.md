# Проёмы и прямые жесты: проверка 25 октября 2026

Автоматическое размещение проёма и чистые вычисления жестов реализованы без изменения доменных моделей, codec или persistence. Политика и исходный scope зафиксированы до реализации в `spec-phone-editor-fixes-2026-10-25.md`.

| Отдельный финальный mutation-прогон | Killed | Survived | Raw score |
| --- | ---: | ---: | ---: |
| Полный `opening-creation-draft.ts` | 241 | 58 | 80,60% |
| Полный `opening-gesture.ts` | 102 | 6 | 94,44% |

Оба прогона прошли установленный порог 80%. Это разные scopes, общий процент проекта не вычислялся. Raw survivors сохранены; их классификация не меняет счётчики. [summary.json](summary.json) содержит команды, SHA-256, исходные результаты и историю усиления тестов. Оригинальные JSON-отчёты сжаты без потерь; SHA записан и для сжатого файла, и для исходных JSON-байтов.

29 тестов двух чистых модулей проверяют геометрию, обратные стены и все диагональные направления, настоящий canonical collision check, shared-room minimum height, точный подоконник, нечётную ширину и integer fallback, отсутствие изменения исходного Project и лексические границы ввода. Дополнительный mixed integer/fractional host case убивает ошибочную замену `every` на `some`.

## Контракт и предел поиска

`validateOpeningCreationDraft` сохраняет прежний тип результата. Поле `draft.offsetMm` оставлено для совместимости формы, но не является входным authority. Новый Door получает sill=0; Window сохраняет введённую высоту подоконника, по умолчанию 900 мм. Численные размеры не уменьшаются автоматически.

Алгоритм выводит допустимые integer-центры из длины host и ширины проёма; исключает положительные пересечения с другими проёмами и настенными предметами, учитывая вертикальный интервал последних. Касание границ разрешено. Предпочтение получают 100-мм позиции около середины стены, при равенстве — меньший offset. В узком интервале без grid-позиции допускается точный целочисленный центр. После отклонения основных кандидатов проверяются точные края интервалов.

Предел — **8192 позиции и один предварительный canonical probe**, максимум 8193 вызова проверки. Перебора каждого миллиметра нет. Каждый возвращённый valid input проходит существующий `addDoorOpeningToProject` или `addWindowOpeningToProject` с локальным preview ID. Источник, реальные ID и durable state не меняются.

Это не доказательство полного поиска всех integer-позиций около криволинейных Door clearance. Если интервалы существуют, но ограниченный поиск не нашёл вариант, сообщение говорит о неудачном подборе. Утверждение об отсутствии свободного интервала используется только при пустом наборе интервалов. Последняя текстовая правка убирает совет менять скрытый offset; дополнительная ветка маршрутизации в delivery не вошла.

`openingDragOffsetFor` считает относительный физический offset вдоль исходной оси и snap-ит только delta с шагом 100 мм; половина шага округляется от нуля. Сохраняются начальный захват и phase старого off-grid offset. Helper не меняет host и не прячет недопустимую позицию через clamp.

`wallSplitPointForPointer` использует 100-мм component lattice относительно canonical start. Обе координаты диагонали квантуются вместе. Endpoint не превращается в split; минимальная длина частей и host reconciliation остаются доменными проверками.

## Browser evidence и независимый review

Тесты `phone-editor-fixes-e2e.spec.ts` создают собственные проекты через UI и используют настоящие Chromium CDP touch events. IDB читается только для проверки durable результата; скрытые handlers и private React state не вызываются.

В review root-жестов получены реальные RED, затем исправления root-owner:

1. Потеря реального pointer capture и отпускание над DOM вне SVG оставляли ghost contact и съедали следующий drag.
2. Escape оставлял destructive split host-conflict confirmation.
3. Invalid overlap preview не объяснял ошибку до отпускания пальца.
4. Escape перед capture loss очищал ref раньше contact bookkeeping и снова оставлял ghost contact.
5. Второй палец над DOM header обходил SVG pinch arbiter и публиковал перенос; глобальный guard отменяет только активное прямое редактирование.

Также root-owner закрыл узкое окно между сменой controller state и React render через синхронное сравнение свежего saved Project перед submit. Реальные тесты проверяют no-op, Escape, pointercancel, pinch, bounds/overlap без Revision, следующий drag после отмены, diagonal Undo/Redo и resize/drag/reopen существующего off-grid Window без потери подоконника. Окончательный browser count и точные runtime hashes находятся в `summary.json`.

## Повтор mutation scopes

Из `apps/web`, с pinned Node 24.19.0:

```sh
node ./node_modules/@stryker-mutator/core/bin/stryker.js run ../../docs/progress/delivery-2026-10-25/openings/stryker.phone-opening-placement.config.mjs
node ./node_modules/@stryker-mutator/core/bin/stryker.js run ../../docs/progress/delivery-2026-10-25/openings/stryker.phone-opening-gesture.config.mjs
```

Конфигурации используют `inPlace` для TypeScript 7. Измеренные прогоны выполнялись только в независимых реальных source copies; исходный checkout не инструментировался. В копиях не запускались `pnpm exec` или установка зависимостей. В этот каталог не перенесены runtime workspace, node_modules или сгенерированные сборки.

## Остаточные ограничения

Шесть gesture survivors меняют избыточные guards, после которых те же non-finite/unsafe значения отклоняются следующими проверками. Их raw статус остаётся `Survived`. Все 58 placement survivors не объявляются эквивалентными: среди них есть context-sensitive предфильтры, defensive budgets и legacy copy branches. Полный список — [survivor-triage.json](survivor-triage.json).

Browser emulation и unit/mutation evidence не являются проверкой производительности или функциональности на физическом телефоне. Коммиты не создавались.

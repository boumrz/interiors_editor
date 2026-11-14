# Drawing dimensions — independent integration verification

25 октября 2026. Read-only browser review на изолированной копии текущих root
исходников через порт 49374. Проверка не меняла рабочие исходники и не вызывала
HMR в проверяемой копии. Это focused evidence, не итоговый общий release gate.

## Условия

Headless Chrome через установленный Playwright, mobile/touch context,
`deviceScaleFactor: 1`, locale `ru-RU`. Создан новый проект и стандартный
прямоугольный контур. Проверяется фактическое SVG/HTML размещение после
ResizeObserver и двух animation frames. «200%» означает root font-size 200%;
это не physical-device Safari и не page zoom. Подписи размеров сохраняют
предусмотренные 14 CSS px.

Ожидаемые восемь подписей: стены по осям 4100/3100 (по две), помещение в чистоте
4000/3000, общие наружные габариты 4200/3200. Оценивались реальные DOM bounding
boxes, pairwise пересечения, header/dock/legend intersections и scroll width.

## Основные результаты

| Экран | Текст | Подписи | Legend/label | Label/label | Header/dock vs labels | Horizontal overflow | Crowded / clipped |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 393×852 | 100% | 8/8 | 0 | 0 | 0 | нет | 0 / 0 |
| 393×852 | 200% | 8/8 | 0 | 0 | 0 | нет | 0 / 0 |
| 360×480 | 200%, legend closed | 8/8 | 0 | 0 | 0 | нет | 0 / 1 |
| 360×480 | 200%, legend expanded | 0, справка занимает область | 0 | 0 | 0 | нет | не применяется |
| 360×480 | 200%, legend re-collapsed | 8/8 восстановлены | 0 | 0 | 0 | нет | 0 / 1 |

В коротком viewport при свёрнутой легенде `clipped=true` относится к линии общего размера 4200,
сама подпись видима. Это ограничение малого exposed viewport, не скрытая
потеря числовой подписи. Ни одна подпись не помечена crowded.

Первоначальный finding закрыт для этих трёх состояний: actual legend height
входит в layout bounds; легенда больше не закрывает подписи. Формулировки
легенды теперь связывают axis/clear/outer с видом размера и не ошибочно
называют все наружные подписи габаритами. В коротком viewport details по
умолчанию свёрнут. Повторное сворачивание после открытия восстанавливает
тот же полный набор восьми подписей.

Снимки: [обычный экран](drawing-dimensions-integration-normal.png),
[200% текст](drawing-dimensions-integration-enlarged.png),
[короткий экран 200%](drawing-dimensions-integration-short-enlarged.png).
Полные численные [DOM metrics](drawing-dimensions-integration-metrics.json).

## Повторная проверка раскрытой легенды — finding resolved

На свежем final root snapshot ограничение высоты aside учитывает реальные
canvas/header/dock размеры, а содержимое прокручивается. На 360×480/200%
раскрытая легенда имеет высоту 226.31 CSS px: её нижний край 351.31 px,
верхний край dock 367.31 px. Пересечения нет; сохранён зазор 16 px.
Проверено `overflow-y: auto`, clientHeight 226, scrollHeight 299 и фактическое
изменение scrollTop при прокрутке. Исходный finding о тексте под dock закрыт.

Переход closed → expanded → closed проверен последовательно на одном
проекте: 8 → 0 → 8 подписей. Во время чтения раскрытой справки на этом
экстремально коротком viewport свободная высота для корректного dimension
layout отсутствует; после сворачивания полный исходный набор немедленно
восстанавливается. Ложных позиций/NaN и пересечений не возникает.
Пояснение ограниченной области находится в прокручиваемом содержимом
легенды. В остальных двух размерах экрана раскрытая легенда сохраняет
все восемь подписей без clipping/crowding.

[Expanded screenshot](drawing-dimensions-integration-short-expanded.png),
[re-collapsed screenshot](drawing-dimensions-integration-short-recollapsed.png).
Во всех пяти состояниях legend/dock intersection false, нет horizontal
overflow и пересечений числовых подписей друг с другом либо с chrome.
Новых actionable findings в пределах этой повторной проверки нет.

## Проверенные исходники

SHA-256 в frozen copy:

- `PlanProjection.tsx`: `865994baf5f8c66a1d174f776950cf4e4757cfabfbbdf979b5f8c80807c73353`
- `AppShell.module.css`: `053df33a98fe58cff4888a5b00c96e1d11b4466d233aa01d55ee974eae4e76dc`
- `DrawingDimensions.tsx`: `02a17e7708482dbd3cc834ca8ec7dd79f49734b8c6331e7a96ab1cc118b3ef76`
- `drawing-dimension-layout.ts`: `a11bacd0817abac1a63331a74f169d59aafe4d1c8a2283ce611f24afd415095f`

Источники: [integration renderer](../../../../apps/web/src/ui/DrawingDimensions.tsx),
[projection](../../../../apps/web/src/ui/PlanProjection.tsx),
[screen-space layout](../../../../apps/web/src/ui/drawing-dimension-layout.ts).
12/12 layout unit tests отдельно PASS. Диагностический smoke mutation run и его
ограничения описаны [отдельно](drawing-dimension-layout-mutation-smoke.md);
63.47% этого подмножества нельзя представлять как пройденный mutation gate.

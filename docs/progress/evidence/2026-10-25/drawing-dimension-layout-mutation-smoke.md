# Screen-space dimension layout — diagnostic mutation evidence

Дата: 25 октября 2026. Это диагностический report, **не mutation gate PASS**.
Production исходники во время mutation run не изменялись. Stryker 9.6.1 работал
в отдельной полной копии модуля с Node 24.19.0, command runner, concurrency 1,
`inPlace: true` только внутри `/tmp/interiors-phone-fixes-2026-10-25/layout-mutations`.
Установка зависимостей и модификация общих node_modules не выполнялись.

## Scope и результат

- Source: [drawing-dimension-layout.ts](../../../../apps/web/src/ui/drawing-dimension-layout.ts).
- Source SHA-256: `a11bacd0817abac1a63331a74f169d59aafe4d1c8a2283ce611f24afd415095f`.
- Mutate: весь этот модуль; source в JSON report побайтно совпал с рабочим файлом.
- Suite: отдельный [Node smoke harness](drawing-dimension-layout-mutation-smoke.mjs),
  **подмножество** сценариев основного Rstest suite, не его замена.
- 438 mutants: 277 killed, 1 timeout, 160 survived; score 63.47%; no-coverage 0,
  errors 0. Break threshold 0 — report-only, поэтому успешный exit сам по себе
  не означает прохождение порога 80%.
- Полный исходный [JSON report](drawing-dimension-layout-mutation-smoke.json).
- Основные [12 Rstest tests](../../../../apps/web/src/ui/drawing-dimension-layout.test.tsx)
  отдельно PASS: x/z witnesses, rotated transform, readable diagonal/reverse,
  fixed CSS-pixel offsets/ticks, room-clear inward, collision/obstacles,
  clipped true endpoints, explicit unavailable/offscreen/font outcomes,
  overflow rejection и восемь реальных rectangle annotations на 393×852.

## Ограничения и triage

Survivors распределяются по source sections: priority/order 14,
input/projection/font 39, normal/angle/label-size 32,
candidate/score/leader 47, rect/clip helpers 28. Эти группы описывают smoke
harness: нельзя объявить их все эквивалентными либо автоматически считать
пробелами полного Rstest suite. Например, smoke не повторяет отдельный test
поворотной матрицы и полный восьмиразмерный phone fixture.

Убедительно избыточны отдельные mutants `150, 151, 419`:
деление вместо умножения на `normalSign` сохраняет результат, поскольку
normalSign всегда +1 или -1; `p <= 0` совпадает с `p < 0` после раннего выхода
из ветки `p === 0` в clipper. Это ограниченное доказательство конкретных
операторов, не blanket waiver для остальных survivors.

Полезный следующий mutation pass — основное Rstest suite против того же
точного source snapshot. Приоритет triage: clipping со всех четырёх сторон
при ненулевом origin viewport; разные missing/NaN witnesses и ошибки font
callback; замеры с повёрнутой проекцией; крупные/короткие labels с leader;
конкурирующие kinds и bounds/obstacles при увеличенном тексте. Любое новое
усиление должно сохранять реальные witness anchors и не добавлять ложные
endpoint ticks на краю видимой области.

## Воспроизведение

Создать отдельную временную папку, скопировать туда проверенный исходник под
именем `drawing-dimension-layout.ts` и smoke harness под именем
`layout-node-tests.mjs`; source module имеет только type imports, которые
Node 24 стирает. Сначала выполнить harness Node 24.19.0. Для Stryker использовать
существующую установленную версию 9.6.1, command `node layout-node-tests.mjs`,
`mutate: ["drawing-dimension-layout.ts"]`, command runner и in-place режим
только в этой копии. Не запускать pnpm install в папке с общими symlink deps.

# Performance budgets и device-functional acceptance

Статус: **утверждён для Alpha 2026-08-29**. Нефункциональный договор
сохраняет WebGL2, render-on-demand, adaptive quality и recovery, но не содержит
аппаратного benchmark или отдельного performance release gate. Требуемая
`NFR-15` functional-проверка уже подтверждена владельцем продукта на iPhone 15
Pro Max и Samsung S24 Ultra.

## 1. Что нельзя деградировать

При нехватке ресурсов сохраняются:

- целочисленная геометрия в мм, topology и атомарность команд;
- Durable Revision, autosave/recovery, undo/redo и Portable Backup;
- доступность 2D, экспорта и понятного fallback;
- значения размеров, размещения и пользовательские свойства.

Можно уменьшать DPR, тени, texture resolution, antialiasing, детализацию
декоративных объектов и частоту второстепенных preview. Ни одна ступень не
меняет Project, History или сохранённые размеры.

## 2. Reference scenes и инженерские ориентиры

RS-1 — первая прямоугольная Room с Door, Window и до 15 предметов. RS-2 —
диагностическая квартира: до 6 Rooms, 80 WallSegments после split, 12 Openings,
60 AssetInstances, 750k видимых triangles, 250 draw calls и 128 MiB оценочных
GPU resources. Эти числа помогают находить регрессии; они не обещают одинаковую
производительность на любом устройстве и не блокируют Alpha release.

Целевые cold/warm startup, frame-time, long-task, memory и thermal измерения
остаются добровольной инженерской диагностикой. При заметной задержке UI обязан
не скрывать её за ложным состоянием saved/loaded и сохранять безопасный
fallback; количественные пороги не образуют alpha gate.

## 3. 3D runtime contract

- Статичная сцена работает render-on-demand вне gesture/animation.
- Active gesture может временно снизить quality, не меняя canonical model.
- WebGL2 остаётся Alpha baseline; WebGPU — только progressive enhancement.
- Forced WebGL context loss восстанавливает disposable 3D scene из current
  Durable Revision без reload Project; этот путь остаётся automated regression.
- Повторная невозможность восстановить renderer даёт честный reduced-quality
  или 2D-safe path, не удаляя Project и не подменяя его данными renderer.

## 4. Memory и lifecycle diagnostics

Рост ресурсов после повторного открытия/закрытия 3D, утрата Durable Revision,
необъяснимая выгрузка процесса или потеря input являются инженерскими дефектами
для исправления. Для Alpha не требуются 15-minute thermal-run, аппаратный
профайлинг, минимальное устройство или отдельная независимая лаборатория.

## 5. NFR-15 device-functional acceptance

Владелец продукта выполнил functional-проверку 2026-08-29 на:

| Устройство | Проверённые contexts | Подтверждённые сценарии |
| --- | --- | --- |
| iPhone 15 Pro Max | browser и установленная PWA | локальный Project, 2D/3D, предметы, Safari→Home Screen backup handoff, safe PWA update |
| Samsung S24 Ultra | browser и установленная PWA | локальный Project, 2D/3D navigation, постановка, перемещение и дискретное вращение предметов |

Эта проверка достаточна для Alpha. iPhone 13 mini, iPhone 17, Galaxy A53,
Galaxy S26, точные OS/browser baselines, repeated cold/warm runs, RS-2
frame-time distribution, thermal traces и независимый reviewer не являются
обязательными условиями Alpha.

## 6. После изменения продукта

После кода, затрагивающего browser/mobile/PWA/offline путь, обязательны green
автоматизированные domain, browser и production-PWA регрессии. Новая физическая
проверка нужна только если Product Owner сочтёт конкретную функцию рискованной
для уже принятых двух устройств; она не требует расширять device matrix без
нового product decision.

---
title: "Коррекция Alpha-объёма: без покрытий, копий проектов и PNG"
date: 2026-08-25
status: approved-by-product-owner
owner: Roman Zheltov
---

# Коррекция Alpha-объёма: без покрытий, копий проектов и PNG

## 1. Причина и решение

Владелец продукта 2026-08-25 явно исключил из реализации Alpha:

1. назначение покрытий пола и стен;
2. создание независимой копии Project как варианта;
3. сохранение или системную отправку PNG-снимка Plan/3D.

Это осознанное сокращение MVP, а не технический дефект. Утверждение владельца
является одобрением этой коррекции и её реализации.

Граница решения: нейтральная display-only геометрия пола и стен остаётся в
2D/3D, иначе исчезнет сама визуализация комнаты. Остаются также варианты и
цвета **предметов**, Portable Backup/import, обычный экспорт Project и
переименование/корзина Project. Не остаётся ни picker/assignment/material
resource для `Floor(Room)`/`WallSide`, ни независимый Project-дубликат, ни
PNG/download/share route.

## 2. Impact analysis

| Область | Изменение |
| --- | --- |
| PRD | `FR-3`, `FR-34`, `FR-35`, `FR-37`, `FR-46` становятся retired и не переиспользуются. `FR-33` сохраняется только для разрешённых вариантов/цветов ItemInstance. |
| SPEC | `CAP-1` больше не обещает duplicate; `CAP-7` становится capability вариантов предмета без SurfaceAssignment; `CAP-10` сохраняет Portable Backup/import без visual snapshot/comparison. |
| Roadmap | `V-12` сокращается до вариантов предмета; `V-13` исключается; `V-17` больше не включает PNG. |
| Epics | Stories 6.2, 6.4, 6.5, 8.1 и 8.10 retired. 6.3 уже retired с потолочной областью; 6.1 остаётся. |
| Architecture/UX | `SurfaceAssignment`, `Floor(Room)` и `WallSide` как продуктовые material-addresses удаляются; AppShell не имеет действий duplicate/PNG. Базовый renderer остаётся нейтральной disposable-проекцией. |
| Code/tests | Удаляются DuplicateProject use case/controller/UI/E2E, PNG export helper/UI/E2E/mutation config. Не затрагиваются переносимый backup, Project export/import, item colour variant или safe Trash. |

## 3. Выбранный путь

Прямое сокращение текущего объёма с небольшим rollback уже начатых путей.
Риск низкий: покрытия пола/стен не имеют активной доменной реализации, а
дубликат и PNG изолированы в отдельных application/UI модулях. Риск для
пользователя снижается: Alpha сфокусирована на точном плане, 3D и предметах,
без трёх вторичных сценариев, которые увеличивают storage, ресурсные и
тестовые обязанности.

## 4. Handoff и критерии завершения

Класс изменения: **moderate** — требуется синхронная правка источников
требований, roadmap и реализации.

Критерии:

- в активных PRD/SPEC/roadmap/epics нет действующего обязательства назначать
  покрытия пола/стен, дублировать Project или выдавать PNG;
- интерфейс не предлагает эти три действия;
- приложение не регистрирует соответствующие use cases;
- Portable Backup/import, экспорт Project, корзина и варианты/цвет предмета
  продолжают работать;
- тесты, typecheck, lint и production build проходят.

Исторические evidence, старые screenshots и dated reviews не переписываются:
они остаются свидетельством прошлой области, но не являются active scope.

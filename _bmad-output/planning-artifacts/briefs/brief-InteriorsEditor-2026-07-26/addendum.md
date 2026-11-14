---
title: Product Brief Addendum — InteriorsEditor
status: draft
created: 2026-07-26
updated: 2026-07-26
---

# Addendum

## Evidence Snapshot

Полный конкурентный разбор находится в
[market landscape](../../research/market-landscape-2026-07-26.md). Основные
следствия для продукта:

- Home Planner уже обещает mobile authoring, миллиметровую точность, много комнат, материалы и custom assets. Функциональный checklist не создаёт позиционирование.
- Floorplanner подтверждает жизнеспособность браузерного 2D/3D-планировщика, но не строит обещание вокруг phone-first offline authoring.
- Planner 5D, Homestyler и HomeByMe сильнее по каталогу, AI и рендерам; конкурировать с ними в этих измерениях на старте нерационально.
- magicplan сильнее в capture/report/estimate; LiDAR и сметы не нужны для проверки выбранного JTBD.
- IKEA Kreativ показывает ценность короткого flow, но замкнут на каталог ритейлера.

## Strategic Wedge

| Ось | Обещание alpha | Как доказать |
| --- | --- | --- |
| Time to useful plan | Базовый вариант за одну короткую сессию | Task time и completion без помощи |
| Touch precision | Миллиметры без CAD-интерфейса | Ошибки ввода, corrections, SUS/SEQ |
| Local ownership | Проект без аккаунта и сети | Airplane-mode и portable backup test |
| Predictable performance | Редактируемость важнее эффектов | Reference-scene device gate |

PWA сама по себе не является преимуществом. Пользовательская ценность появляется только если install-free старт, offline и mobile UX объективно сокращают путь до решения.

## Alpha Hypotheses

| ID | Гипотеза | Проверка | Сигнал опровержения |
| --- | --- | --- | --- |
| H-1 | Люди готовы вручную ввести размеры, если первый точный план получается быстро | 5–8 problem interviews + prototype usability | Большинство требует scan/import плана до начала |
| H-2 | Constraint grid 0°/45° проще свободного CAD drawing на телефоне | Сравнить task errors и time | Пользователь регулярно упирается в нужные произвольные углы |
| H-3 | Local-first/no-account заметно повышает готовность попробовать | Landing/prototype preference test | Участники считают cloud sync обязательнее privacy/offline |
| H-4 | Небольшой generic catalog + parametric box закрывает проверку размещения | Usability на реальных планах | Отсутствие конкретных SKU блокирует большинство решений |
| H-5 | Door-as-navigation помогает воспринимать связность комнат | Prototype test | Пользователи предпочитают minimap/room list и игнорируют двери |
| H-6 | Custom import не блокирует базовый alpha JTBD | Interview/ranking | Большинство не может проверить свой сценарий без своей модели |

## Provisional Catalog Strategy

- Начать с 100–150 оптимизированных generic assets, но не считать число обязательством до content spike.
- Обязательно представить категории: seating, tables, beds, storage, kitchen, bathroom/plumbing, major appliances, electronics, lighting, rugs, plants, mirrors and wall art.
- Для редкого объекта дать параметрический `Box W×D×H` с названием, цветом и footprint.
- Каждый asset содержит реальные размеры, pivot, anchor class, 2D footprint, clearance zones, recolorable slots, thumbnail, hash/version и license metadata.
- Не копировать manufacturer assets без подтверждённых прав.

## Monetization Hypotheses

Монетизация не является частью alpha gate. Наиболее согласованная с позиционированием модель:

- бесплатно: локальные проекты, точное построение, базовый каталог, offline, backup и image export;
- платно позже: cloud sync, collaboration, private asset library, расширенный каталог, high-quality rendering, retailer catalogs;
- не ставить paywall перед сохранением или повторным открытием первого проекта;
- проверить willingness-to-pay не раньше подтверждения core task success.

## Research Before Build

1. Пять problem interviews с людьми, планировавшими ремонт за последние 12 месяцев.
2. Разбор трёх реальных планировок: простая ортогональная, помещение с 45° стеной, несколько связанных комнат.
3. Paper/mobile prototype четырёх действий: draw wall, exact dimension, place item, change room.
4. Renderer, topology, offline, import и touch spikes из technical research.
5. Выбор reference-device matrix и фиксированного alpha benchmark project.
6. Лицензионная стратегия для каталога и пользовательских импортов.

## Decision Policy

Критическое решение фиксируется не потому, что «звучит разумно», а когда есть один из трёх видов основания:

- напрямую утверждено владельцем продукта;
- подтверждено пользовательским наблюдением;
- подтверждено техническим spike на реальных устройствах.

До этого оно остаётся `[ASSUMPTION]` или `Deferred`, даже если используется для планирования.

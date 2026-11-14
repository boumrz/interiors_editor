---
title: "Реестр продуктовых и технических решений"
status: active
updated: 2026-08-04
owner: Roman
---

# Назначение

Здесь собраны решения, которые сильнее всего меняют scope, UX или архитектуру.
Это не список задач. `Adopted` связывает все downstream-документы; `Proposed`
требует подтверждения владельца; `Spike` решается измерением; `Deferred`
сознательно отложено; `Rejected` не должно незаметно вернуться в scope.

# Уже принятые решения

| ID | Решение | Основание | Влияние |
|---|---|---|---|
| D-001 | Продукт mobile-first PWA, телефон — primary authoring device | исходное видение | UX и alpha evidence строятся на real mobile |
| D-002 | Все физические размеры domain — целые миллиметры | исходное требование + geometry risk | одна точность для 2D, 3D, save и export |
| D-003 | 2D Plan — canonical model; 3D — производная проекция | техническое исследование | renderer нельзя сделать source of truth |
| D-004 | Альфа local-first и не требует аккаунта/backend | позиционирование и базовая потребность | offline, recovery и backup входят в gate |
| D-005 | Альфа описывает один Level с несколькими комнатами | scope control | этажи/лестницы исключены |
| D-006 | WebGL2 — обязательный baseline; WebGPU не блокирует альфу | browser research | одна обязательная renderer-ветка |
| D-007 | Изменения проходят через атомарные Commands с undo/redo | data/topology safety | UI setters не мутируют Project напрямую |
| D-008 | BMAD 6.10.0 — единственный process spine для SDD | integration research | competing orchestration frameworks не ставятся |
| D-009 | Агентная модель controlled-hybrid, один writer на артефакт | agent research | parallel research/review, centralized synthesis |
| D-010 | Реализация не начинается до readiness gate | запрос владельца | текущий результат — только документы |

## Дополнения и supersession принятых решений — 2026-08-04

Исторические строки ниже не переписываются: новые решения явно уточняют их
границы и становятся источником для downstream-артефактов.

| ID | Решение | Основание | Влияние |
|---|---|---|---|
| D-051 | `D-004` уточнено: Alpha остаётся local-first и не требует account или remote user-data backend, но включает узкий Kotlin/PostgreSQL Catalog Control Plane только для versioned catalog metadata/resources, provenance, `AssetUsageGrant` и notices | явное подтверждение владельца стека; PRD FR-54; AD-17 | Project, Revision, session History, Portable Backup и user-owned pinned bytes остаются локальными; outage затрагивает только browse/download ещё не pinned ресурса и не создаёт `ResourceRecoveryRequired` |
| D-052 | superseded 2026-08-22: Room Walk, `Walk edge`, `AdjacencyGraph` и Door transition исключены из Alpha | явное подтверждение Product Owner; sprint change proposal 2026-08-22 | Door остаётся wall-hosted Opening без `passable`/`locked`, access/key, lock/unlock или open/close state/interactions; `ItemInstance` lock/unlock из FR-30 не меняется |
| D-053 | Исполнение adopted `AD-16` подтверждается отдельным `G-WEB-AD16` / `WEB-BOOTSTRAP-01`, а не расширяет Kotlin/PostgreSQL `G-CP-ADR` | утверждённый стек владельца; AD-16/AD-17; независимый quality review | После final `READY` V-01 доказывает один frozen web root/lockfile, Rspack/Rstest/Playwright boundary и CSS Modules; backend ADR остаётся ограниченным только control-plane choices |

# Предлагаемые продуктовые решения

| ID | Вопрос | Предлагаемое решение | Почему | Нужен ответ не позже |
|---|---|---|---|---|
| D-011 | Что значит «гридфинити»? | бесконечная сетка редактора + constraint snapping; не Gridfinity storage | соответствует контексту стен | до topology spike |
| D-012 | Направления и длина диагонали | кратные 45°; integer endpoints авторитетны, для желаемой длины `L` используется `n = round(L/√2)`, preview показывает фактическую длину | сохраняет целые мм без ложной «точной» иррациональной длины | до topology spike |
| D-013 | Ввод вне сетки | точный numeric input разрешён; gesture следует snap policy | реальные измерения не обязаны кратны grid | до UX/topology spike |
| D-014 | Collision | стены/outside-room могут блокировать; предмет–предмет предупреждает | не мешает экспериментам | до placement slice |
| D-015 | GLB import | Alpha+, не gate базовой Alpha | высокая безопасность/memory/storage цена | до фиксации Alpha scope |
| D-016 | Каталог Alpha | 100–150 generic optimized items, выбранных по scenario coverage | качество покрытия важнее числа | до asset pipeline |
| D-017 | Сравнение вариантов | backup/duplicate + undo в Alpha; named variants позже | уменьшает model/UI scope | до roadmap approval |
| D-018 | superseded 2026-08-22 | Room Walk удалён из Alpha scope | не создавать отдельный mode, edge или transition | — |
| D-019 | Регистрация | не нужна для первого и повторного local результата | часть позиционирования | до UX freeze |
| D-020 | Телеметрия | только consent-aware, без содержимого проекта | privacy/local-first | до alpha instrumentation |

# Предлагаемые контрактные решения после независимого review

Эти правила уже применены в документах как согласованный provisional baseline,
чтобы не оставлять реализации взаимоисключающие варианты. Product Owner
утверждает либо меняет их на G-0; изменение требует impact analysis.

| ID | Вопрос | Предлагаемое решение | Почему | Нужен ответ не позже |
|---|---|---|---|---|
| D-041 | Reference line стены | WallSegment — centerline; usable Room выводится inward offset до внутренних поверхностей | убирает расхождение размеров, площади и shared walls | до G-0/S-2 |
| D-042 | Источник высоты | только `Room.heightMm`; shared Wall использует максимум соседних Room, Opening — доступный минимум | исключает конфликт Wall/Room height | до G-0/S-2 |
| D-043 | Размещение предметов | discriminated floor/wall/ceiling placement со stable host address | делает topology impact, материалы и restore однозначными | до G-0/S-2 |
| D-044 | Что значит saved | только `Durable Revision` после staging-write/checksum/atomic publish; validation недостаточно | UI, history и recovery не обещают несуществующую сохранность | до G-0/S-3 |
| D-045 | Удаление Project | сначала Trash/restore, затем отдельный permanent delete | задаёт честную recovery boundary | до G-0/S-3 |
| D-046 | Portable Backup | всегда self-contained; exact referenced bytes pin-ятся до Durable mutation и проходят BackupFeasibilityPolicy; неполный export не называется backup | гарантирует offline export без CDN и не допускает валидный неэкспортируемый Project | до G-0/S-3/S-6 |
| D-047 | Несколько local contexts | один fenced writer; iOS Safari/Home Screen считаются разными contexts, handoff через backup | предотвращает silent overwrite и ложное обещание общего storage | до G-0/S-3 |
| D-048 | Project/backup hard limits | принять provisional versioned таблицы companion как старт spike, затем заменить только по device evidence | запрещает каждому slice выбирать собственные пределы | до G-0/S-1/S-2/S-3 |
| D-049 | History resources и damaged Project | обе session-history ветки являются GC roots и ограничены SessionRetentionPolicy; recovery выводит exact repair/полный RecoveryChangeSet, а history-only issue — ещё explicit DiscardSessionHistory при healthy current | сохраняет обещание redo и запрещает молчаливый/частичный repair | до G-0/S-3 |
| D-050 | Лицензия catalog/output/backup | Human-approved AssetUsageGrant покрывает in-app render/thumbnails, model+subresources, optimization/transcoding, `.interiors`, private 3D transfer, rendered PNG download/share и notice placement; без полного grant asset не входит в Alpha catalog | catalog, PNG и self-contained backup не должны противоречить license gate | до G-0/S-6 |

# Решения через spikes

| ID | Spike | Кандидаты/вопрос | Evidence | Решение |
|---|---|---|---|---|
| D-021 | Renderer | Three.js + R3F против Babylon.js | RS-1/RS-2 на real devices, lifecycle, bundle, context loss | ADR-R1 |
| D-022 | Topology | библиотека/собственный kernel, integer normalization | golden corpus, property tests, timings | ADR-G1 |
| D-023 | Storage | IndexedDB Blob против OPFS/hybrid | iOS/Android quota, migrations, hard-close recovery | ADR-S1 |
| D-024 | Touch | gesture thresholds, mode split, bottom sheets | task completion/error observations | UX amendment |
| D-025 | GLB | limits, Draco/Meshopt/KTX2 allowlist | hostile corpus, decoded memory, cancellation | ADR-A1 |
| D-026 | Catalog pipeline | optimization/cache tiers | visual quality, storage, decode time, provenance | ADR-C1 |

# Отложено

| ID | Решение | Причина возврата |
|---|---|---|
| D-027 | Несколько этажей | подтверждённый спрос после Alpha и отдельная vertical model |
| D-028 | Cloud sync/collaboration | local value доказана; определены identity/conflict/privacy |
| D-029 | AR/LiDAR capture | manual planning validated; platform research оправдывает cost |
| D-030 | AI-дизайн | есть повторяемая задача, которую AI улучшает измеримо |
| D-031 | WebGPU production path | WebGL2 Alpha стабильна и WebGPU даёт измеримую пользу |
| D-032 | Marketplace/checkout | каталог и коммерческая модель подтверждены |
| D-033 | Фотореалистичный renderer | spatial planner value доказана; device budget позволяет |

# Отклонённые направления для текущей альфы

| ID | Направление | Причина |
|---|---|---|
| D-034 | «Скопировать весь Floorplanner/Planner 5D» | не даёт phone-first фокуса и разрушает scope |
| D-035 | Universal 3D import | недоказанная ценность и неограниченный attack/resource surface |
| D-036 | WebGPU-only | недостаточный cross-device baseline |
| D-037 | Scene graph как project database | расходятся 2D/3D, тесты и migrations |
| D-038 | Постоянный autonomous agent swarm | drift, конфликт writer ownership и лишняя стоимость |
| D-039 | Установка второго SDD orchestration framework | два источника процесса и терминологии |
| D-040 | Fork legacy floor-planner как старт без аудита | скрытые допущения, устаревший стек и лицензирование ассетов |

# Как принимать решения

1. Владелец отвечает за value, scope, supported user и privacy.
2. Измеримый технический спор идёт в time-boxed spike с заранее записанным
   вопросом и критериями.
3. Решение получает stable ID и фиксируется в этом реестре и соответствующем
   artifact/ADR.
4. Изменение Adopted-решения требует impact по CAP/FR/UX/architecture/roadmap.
5. Отсутствие ответа не даёт реализации право выбрать скрыто; действует
   записанное provisional правило либо slice остаётся заблокированным.

# Ближайший пакет подтверждения владельцем

До официального BMAD readiness review нужно подтвердить `D-011`–`D-020`,
`D-041`–`D-050`, зафиксировать границы `D-051` через `G-CP-ADR` и записать
`D-053` как post-`READY` условие V-01: `WEB-BOOTSTRAP-01` выполняется только
внутри Story 1.1. Также нужно назвать конкретные floor devices. Самые дорогие
ошибки сейчас — ошибочное
понимание grid, неоднозначная сохранность/переносимость, расширение Catalog
Control Plane до remote Project-сервиса, включение GLB в обязательную Alpha и
неопределённая нижняя граница мобильной производительности.

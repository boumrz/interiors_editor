---
title: "InteriorsEditor Alpha — регистр рисков"
status: draft
artifact_type: risk-register
created: 2026-07-26
updated: 2026-08-24
review_cadence: "на каждом BMAD gate и после изменения Alpha scope"
owner: "Product Owner"
sources:
  - ../specs/spec-interiors-editor-alpha/SPEC.md
  - ../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../specs/spec-interiors-editor-alpha/asset-import-contract.md
  - ../specs/spec-interiors-editor-alpha/performance-budgets.md
  - prds/prd-InteriorsEditor-2026-07-26/prd.md
  - architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - architecture/architecture-InteriorsEditor-2026-07-26/solution-design.md
  - ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - research/market-landscape-2026-07-26.md
  - research/technical-feasibility-2026-07-26.md
  - research/agent-system-and-skills-2026-07-26.md
---

<!-- markdownlint-disable MD013 MD025 -->

# Регистр рисков

## 1. Как читать документ

Регистр описывает неопределённые будущие события, которые могут сорвать
продуктовую проверку, повредить пользовательские данные или сделать Alpha
непригодной на телефоне. Это не backlog функций и не список уже принятых
архитектурных решений.

### 1.1 Risk, assumption и decision — разные сущности

- **Risk** — неопределённое событие с вероятностью и влиянием. Только оно
  получает стабильный `R-*`.
- **Assumption** — рабочее утверждение, принятое без достаточного evidence.
  Если оно окажется неверным, реализуется связанный risk.
- **Decision** — осознанно выбранное правило или ограничение. Оно не имеет
  вероятности; решения хранятся в `CAP-*`, `FR-*`, `NFR-*`, `AD-*` или будущем
  ADR.

Пример:

- `AD-5` «WebGL2 baseline» — decision;
- `A-6` «WebGL2 покрывает выбранный device floor» — assumption;
- `R-014` «на утверждённом floor phone WebGL2 path не выдерживает сцену» —
  risk.

Нельзя «закрыть» risk, просто переписав его как assumption. Нужны evidence,
изменение scope, mitigation или явное принятие Product Owner.

### 1.2 Шкалы

**Вероятность** до появления статистики является ordinal assessment:

- `Низкая` — нет ранних сигналов, событие требует нескольких независимых
  условий;
- `Средняя` — правдоподобно, но ещё не наблюдалось в проектном evidence;
- `Высокая` — уже есть сигнал, типичный отраслевой failure mode или ключевое
  решение пока отсутствует.

**Влияние:**

- `Критическое` — потеря/искажение данных, security/privacy breach, неверная
  геометрия без предупреждения или невозможность основного JTBD;
- `Высокое` — блокирует Alpha gate или существенную часть device matrix;
- `Среднее` — требует обхода, снижает completion/доверие, но не уничтожает
  базовую ценность;
- `Низкое` — локальный управляемый ущерб без влияния на основную проверку.

**Статус:** `Open`, `Mitigating`, `Monitoring`, `Accepted`, `Transferred`,
`Closed`.
`Monitoring` означает, что исходное расхождение устранено, но остаётся
контроль повторного drift.
`Accepted` требует имени владельца, срока пересмотра и явно описанного
остаточного влияния.

## 2. Сводка приоритетов

Критический фокус до implementation readiness:

| Приоритет | Риски | Почему сейчас |
| --- | --- | --- |
| P0 | R-006, R-007, R-008, R-009, R-012, R-014, R-016, R-017, R-027 | Без решений/spikes можно построить неверное ядро или потерять Project |
| P1 | R-001, R-002, R-003, R-010, R-011, R-013, R-015, R-018, R-022, R-023, R-024, R-026, R-028 | Блокируют полезность, доверие, device gate или управляемость проекта |
| P2 | R-004, R-005, R-020, R-021, R-025, R-029, R-030 | Не должны отвлекать от P0/P1, но требуют ранних guardrails |
| Monitor | R-019 | Исходное расхождение устранено; проверяется повторный drift контрактов |

Нумерация отражает identity, а не текущий приоритет. ID не переиспользуются
после закрытия risk.

## 3. Product и market

### R-001 — Продукт воспринимается как commodity

| Поле | Значение |
| --- | --- |
| Категория | Product / market |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | Рынок уже предлагает mobile 2D/3D, каталоги, материалы и custom assets; PWA сама по себе не является moat |
| Ранний сигнал | Интервьюируемые сравнивают только число моделей, AI или качество рендера и не ценят точность/local-first |
| Mitigation | Тестировать promise «точно и быстро на телефоне»; измерять time-to-useful-plan и решение, а не feature count |
| Trigger | Менее согласованного порога участников формулируют конкретное решение после UJ; позиционирование не отличают от Home Planner/Planner 5D |
| Owner | Product Owner / Research |
| Contingency | Сузить сегмент и JTBD; усилить workflow точности/восстановления вместо расширения feature list |
| Статус | Open |

### R-002 — Vision не подтверждён реальными пользователями

| Поле | Значение |
| --- | --- |
| Категория | Product discovery |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | Текущие документы основаны на конкурентном и техническом research; проблемные интервью и наблюдаемые mobile sessions ещё не представлены |
| Ранний сигнал | Пользователь не знает размеры, не готов вводить их вручную или не принимает решение по результату |
| Mitigation | 10–15 problem interviews; минимум 5 наблюдаемых usability-сессий на итерацию; hypothesis log |
| Trigger | `SM-1`/`SM-2` ниже согласованного порога либо основной drop-off до первой Room |
| Owner | Product Owner / Research |
| Contingency | Пересобрать primary segment, onboarding или manual-input assumption до масштабирования разработки |
| Статус | Open |

### R-003 — Scope creep лишает Alpha проверяемого ядра

| Поле | Значение |
| --- | --- |
| Категория | Product / delivery |
| Вероятность | Высокая |
| Влияние | Критическое |
| Evidence | Конкуренты создают давление добавить AI, scan, render, branded catalog, import и collaboration; GLB уже выделен в Alpha+ |
| Ранний сигнал | В одном roadmap-инкременте появляются CAP-12, AI/AR, cloud или большой каталог до доказательства UJ-1–UJ-6 |
| Mitigation | Жёсткий Non-goals; gate `CAP-1–CAP-11`; любое расширение через decision record и повторный readiness review |
| Trigger | Изменение Alpha scope без обновления PRD/SPEC/traceability и Product Owner approval |
| Owner | Product Owner / Orchestrator |
| Contingency | Заморозить новые направления, вернуть отдельный discovery track, пересчитать Alpha gate |
| Статус | Mitigating |

### R-004 — Installability PWA ошибочно считается ценностью

| Поле | Значение |
| --- | --- |
| Категория | Product / acquisition |
| Вероятность | Средняя |
| Влияние | Среднее |
| Evidence | Установка PWA неодинакова на платформах и не решает JTBD сама по себе |
| Ранний сигнал | Пользователь не понимает install prompt или уходит до создания первого Project |
| Mitigation | Первый полезный результат в browser tab; installation предлагать после сохранённого Project |
| Trigger | Install prompt снижает completion либо большая доля пользователей не умеет вернуться к standalone app |
| Owner | Product Owner / UX |
| Contingency | Понизить установку до необязательного retention-механизма; улучшить return path |
| Статус | Open |

### R-005 — Монетизация разрушает local-first trust

| Поле | Значение |
| --- | --- |
| Категория | Business model |
| Вероятность | Средняя |
| Влияние | Высокое |
| Evidence | Pricing и permanent free boundary остаются открытыми; paywall перед save/reopen противоречит обещанию владения Project |
| Ранний сигнал | Рассматривается ограничение core save, reopen, backup или точных размеров |
| Mitigation | До public Alpha определить, что local core и переносимость не блокируются неожиданно |
| Trigger | Pricing experiment влияет на `CAP-1`, `CAP-2`, `CAP-9` или `CAP-10` |
| Owner | Product Owner |
| Contingency | Монетизировать cloud, private assets, collaboration или тяжёлый render, сохранив локальное ядро |
| Статус | Open |

## 4. Product semantics и geometry

### R-006 — «Гридфинити» означает не тот продуктовый контракт

| Поле | Значение |
| --- | --- |
| Категория | Product semantics |
| Вероятность | Средняя |
| Влияние | Критическое |
| Evidence | Документы предполагают бесконечную constraint grid, но исходный термин также обозначает отдельный storage standard |
| Ранний сигнал | Product Owner ожидает другое поведение grid, чем зафиксировано в A-1 |
| Mitigation | Получить явное подтверждение термина и переименовать пользовательское понятие в constraint grid |
| Trigger | Первое расхождение в prototype review или формулировке acceptance criteria |
| Owner | Product Owner |
| Contingency | Остановить topology/touch work и переиздать затронутые SPEC/PRD/UX decisions |
| Статус | Open |

### R-007 — Grid, snap и diagonal rounding остаются неоднозначными

| Поле | Значение |
| --- | --- |
| Категория | Geometry / product rule |
| Вероятность | Высокая |
| Влияние | Критическое |
| Evidence | Endpoint quantization `n = round(L/√2)` задана provisional; visual step, snap step, off-grid numeric input и само правило ещё не утверждены владельцем |
| Ранний сигнал | Touch и numeric input дают разные endpoints либо длина меняется после reopen |
| Mitigation | Product decision + topology/touch spike; одна versioned `SnapPolicy`; golden boundary corpus |
| Trigger | Любой prototype фиксирует поведение библиотеки до решения владельца |
| Owner | Product Owner / Architect |
| Contingency | Пометить поведение experimental, не начинать feature implementation, заменить policy с миграцией fixture |
| Статус | Open |

### R-008 — 45° и T/X-junction создают невалидную topology

| Поле | Значение |
| --- | --- |
| Категория | Geometry |
| Вероятность | Высокая |
| Влияние | Критическое |
| Evidence | Исследование называет topology главным техническим риском; X-intersection policy и tolerance не выбраны |
| Ранний сигнал | Cracks, duplicate segments, self-intersections, платформозависимый split |
| Mitigation | S-2 Topology; integer-mm kernel; explicit intersection policy; property tests и golden corpus |
| Trigger | Один golden case различается между engines/runs или rejected Command меняет Revision |
| Owner | Architect / Geometry owner |
| Contingency | Сузить допустимые операции/пересечения Alpha, но не сохранять невалидный Plan |
| Статус | Open |

### R-009 — Room identity переносит metadata не в ту комнату

| Поле | Значение |
| --- | --- |
| Категория | Geometry / data integrity |
| Вероятность | Высокая |
| Влияние | Критическое |
| Evidence | Split/merge reconciliation не определён; finishes/name зависят от устойчивого `roomId` |
| Ранний сигнал | Покрытие или имя «прыгает» после локального изменения Wall |
| Mitigation | Формальная lineage/overlap policy; ambiguous preview; split/merge fixtures; no silent assignment |
| Trigger | Неоднозначное сопоставление или разные результаты при перестановке обхода polygon |
| Owner | Product Owner / Architect |
| Contingency | Требовать явного выбора пользователя; временно сбрасывать только спорные metadata с предупреждением и undo |
| Статус | Open |

### R-010 — Ошибка единиц или округления разрушает доверие

| Поле | Значение |
| --- | --- |
| Категория | Correctness |
| Вероятность | Средняя |
| Влияние | Критическое |
| Evidence | Renderer использует metres, UI показывает мм/м², диагонали требуют явного rounding |
| Ранний сигнал | 1 мм drift, отличающиеся размеры в 2D/3D/export или площади после reload |
| Mitigation | Integer-mm source; typed units; adapter-only conversion; round-trip/property/mutation tests |
| Trigger | Любой golden Project меняет semantic hash или размер |
| Owner | Architect / QA |
| Contingency | Остановить candidate, восстановить последнюю schema/adapter, мигрировать только после доказанного fix |
| Статус | Mitigating |

### R-011 — Collision policy даёт ложную уверенность или мешает эксперименту

| Поле | Значение |
| --- | --- |
| Категория | Product semantics / safety |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | Не решено, что blocking, warning или допустимо для Wall, предметов и clearance zones |
| Ранний сигнал | Пользователь принимает warning за проверку строительных норм либо не может намеренно сравнить тесный вариант |
| Mitigation | Versioned CollisionPolicy по категориям; явный текст «не проверка норм»; UX research |
| Trigger | Разные экраны блокируют один конфликт по-разному или участник неверно трактует результат |
| Owner | Product Owner / UX |
| Contingency | Перейти к warning-only с явными исключениями для invalid geometry; убрать нормативные формулировки |
| Статус | Open |

## 5. Mobile UX, accessibility и compatibility

### R-012 — Touch UX непригоден для точной геометрии

| Поле | Значение |
| --- | --- |
| Категория | UX |
| Вероятность | Высокая |
| Влияние | Критическое |
| Evidence | Точная работа одним пальцем на 360 px — основное отличие и непроверенная гипотеза |
| Ранний сигнал | Mis-taps, zoom thrashing, высокая доля undo, необходимость desktop/keyboard |
| Mitigation | S-4 Touch до catalog expansion; большие handles, snap/magnifier, numeric sheet, gesture state machine |
| Trigger | UJ-1/UJ-2 не выполняются без помощи либо touch error rate превышает согласованный порог |
| Owner | UX / Product Owner |
| Contingency | Сузить набор direct manipulation, усилить пошаговый/numeric workflow, не расширять 3D editing |
| Статус | Open |

### R-013 — Canvas делает критичные сценарии недоступными

| Поле | Значение |
| --- | --- |
| Категория | Accessibility |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | 2D/3D canvas сам по себе не даёт достаточной семантики assistive technology |
| Ранний сигнал | Нельзя выбрать/описать объект, исправить ошибку или проверить adjacency через DOM alternative |
| Mitigation | Numeric/list alternative; semantic controls; VoiceOver/TalkBack и 200% zoom manual gate |
| Trigger | Критическое действие доступно только жестом/canvas или focus теряется после ошибки |
| Owner | UX / Accessibility reviewer |
| Contingency | Ограничить недоступный режим как визуальное дополнение и обеспечить эквивалентный structured workflow |
| Статус | Open |

### R-014 — WebGL2 path не выдерживает floor device

| Поле | Значение |
| --- | --- |
| Категория | Renderer / compatibility |
| Вероятность | Высокая |
| Влияние | Критическое |
| Evidence | Device floor не выбран; mobile GPU/memory/thermal различаются; WebGPU не может быть обязательным fallback |
| Ранний сигнал | Долгий first frame, p95 frame time вне budget, black canvas, process eviction |
| Mitigation | S-1 Renderer на одинаковых RS; WebGL2 baseline; adaptive ladder; 2D-only recovery |
| Trigger | Любой floor device не проходит reconciled RS-1/RS-2 gate |
| Owner | Architect / QA Performance |
| Contingency | Снизить visual budgets/catalog complexity или честно повысить support floor; domain accuracy не снижать |
| Статус | Open |

### R-015 — GPU resources и thermal деградируют в длинной сессии

| Поле | Значение |
| --- | --- |
| Категория | Renderer / performance |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | Textures, high DPR, draw calls, disposal и repeated scene lifecycle критичны на мобильных |
| Ранний сигнал | Монотонный memory growth, нагрев, throttling, удвоение ресурсов после background/foreground |
| Mitigation | Render-on-demand, DPR cap, budgets, disposal tests, 10–15-minute thermal run |
| Trigger | Resource growth после 10 open/close cycles или unrecovered context loss |
| Owner | Renderer owner / QA Performance |
| Contingency | Более ранняя degradation ladder, proxy/LOD, ограничение одновременно hydrated assets |
| Статус | Open |

### R-016 — Browser storage eviction или quota приводит к потере Project

| Поле | Значение |
| --- | --- |
| Категория | Persistence / data integrity |
| Вероятность | Средняя |
| Влияние | Критическое |
| Evidence | Browser storage не гарантирован навсегда; iOS/Android lifecycle и quota различаются |
| Ранний сигнал | Project исчезает после паузы, очистки storage или near-quota write |
| Mitigation | S-3 Storage/PWA; atomic revisions/journal; persist request; storage health; portable backup; read-only ResourceRecoveryRequired с exact-byte repair/atomic removal и explicit history discard только для history-only issue |
| Trigger | Последняя Durable Revision не читается после fault-injection на floor device |
| Owner | Persistence owner / QA |
| Contingency | Read-only/export recovery; cache cleanup без удаления Project; честное ограничение поддержки |
| Статус | Open |

### R-017 — Service worker и schema version становятся несовместимыми

| Поле | Значение |
| --- | --- |
| Категория | PWA / migration |
| Вероятность | Средняя |
| Влияние | Критическое |
| Evidence | Активный/ожидающий worker, cached shell и local schema могут принадлежать разным версиям |
| Ранний сигнал | Project не открывается после deploy, reload происходит во время gesture |
| Mitigation | AD-11 ReleaseManifest handshake; Durable boundary; version-tolerant read; migration fixtures; copy-on-write; rollback/export |
| Trigger | Новый runtime не распознаёт readable/writable schema либо автоматическая activation оставляет Project без recovery path |
| Owner | PWA/Persistence owner / Architect |
| Contingency | Вернуть совместимый immutable artifact, открыть Project read-only и предложить backup |
| Статус | Open |

### R-018 — Platform API fragmentation ломает promised fallback

| Поле | Значение |
| --- | --- |
| Категория | Compatibility |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | Install, share, file, persistence, OPFS и standalone behavior различаются |
| Ранний сигнал | Функция работает только по user-agent branch или только в desktop emulation |
| Mitigation | Capability detection; explicit fallback; browser + standalone matrix; OPFS/IndexedDB spike |
| Trigger | Один обязательный journey зависит от отсутствующего API без альтернативы |
| Owner | Platform owner / QA |
| Contingency | Download вместо Share, IndexedDB Blob вместо OPFS, browser mode вместо install-only path |
| Статус | Open |

## 6. Performance contract и данные

### R-019 — Performance contracts могут повторно разойтись

| Поле | Значение |
| --- | --- |
| Категория | Quality governance |
| Вероятность | Средняя |
| Влияние | Высокое |
| Evidence | **Resolved 2026-07-26:** PRD NFR-5/NFR-6/NFR-7 и `performance-budgets.md` выровнены: RS-2 = 6 Room, 60 ItemInstances, 750k visible triangles, 250 draw calls, 128 MiB; p95 frame time ≤33.3 ms; cold ≤3 s и warm offline ≤1.5 s |
| Ранний сигнал | Любой из документов меняет состав RS-2, percentile, startup target или условия измерения без синхронного изменения второго |
| Mitigation | Один versioned RS-2 fixture; совместный review PRD и performance companion; отчёт всегда указывает fixture/device/build version |
| Trigger | CI/docs review обнаруживает различающиеся значения либо performance report не указывает канонический fixture |
| Owner | Architect / QA Performance |
| Contingency | Приостановить PASS, вернуть оба документа к последнему согласованному контракту и оформить совместное изменение |
| Статус | Monitoring — исходное расхождение закрыто, drift guard активен |

### R-020 — Portable Backup неполон или невосстановим

| Поле | Значение |
| --- | --- |
| Категория | Data portability |
| Вероятность | Средняя |
| Влияние | Критическое |
| Evidence | Контракт теперь требует pinned resources, exportable Project envelope и self-contained `.interiors`, но boundary roundtrip/device storage ещё не подтверждены |
| Ранний сигнал | Durable placement возможен без pin/sizing либо import даёт missing resources/semantic drift |
| Mitigation | BackupFeasibilityPolicy до Durable mutation; SessionRetentionPolicy и history GC roots; versioned manifest/checksums/license notices; archive/path/decode limits; publish-as-new staging; clean-offline-profile boundary corpus |
| Trigger | Валидный Project превышает backup envelope, export требует network или import меняет existing Project |
| Owner | Product Owner / Persistence owner |
| Contingency | Отказать атомарно; сохранить existing Project; предложить read-only manifest report |
| Статус | Mitigating — policy задана, evidence ещё нет |

## 7. Assets, import, legal и security

### R-021 — Custom GLB отвлекает ресурсы от Alpha entry

| Поле | Значение |
| --- | --- |
| Категория | Scope / technical |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | Import требует parser security, hostile corpus, memory budgets, storage и UX; CAP-12 уже определён как Alpha+ |
| Ранний сигнал | S-5 или FR-48–FR-52 задерживают S-1–S-4 и UJ-1–UJ-6 |
| Mitigation | Отдельный gate и owner; не повышать CAP-12 без Product Owner decision |
| Trigger | Import work оказывается на critical path первой закрытой Alpha |
| Owner | Product Owner / Orchestrator |
| Contingency | Полностью park CAP-12; оставить Parametric Placeholder для отсутствующего предмета |
| Статус | Mitigating |

### R-022 — Недоверенный GLB вызывает OOM, fetch или зависание

| Поле | Значение |
| --- | --- |
| Категория | Security / performance, Alpha+ |
| Вероятность | Средняя |
| Влияние | Критическое |
| Evidence | Малый файл может декодироваться в большую geometry/texture memory; extensions и URI расширяют attack surface |
| Ранний сигнал | Freeze, process kill, network request из preview, retained resources после cancel |
| Mitigation | Static self-contained GLB; worker; magic/schema/allowlist; decoded limits; timeout/cancel/dispose |
| Trigger | Hostile corpus нарушает UI responsiveness, no-network или cleanup assertion |
| Owner | Import/Security owner |
| Contingency | Отключить feature flag; удалить decoder/extension из allowlist; сохранить Project неизменным |
| Статус | Open |

### R-023 — Каталог становится бесконечным контентным проектом

| Поле | Значение |
| --- | --- |
| Категория | Catalog / scope |
| Вероятность | Высокая |
| Влияние | Высокое |
| Evidence | Число 100–150 — assumption, не доказанная coverage; каждая модель требует optimization/metadata/license |
| Ранний сигнал | Редкие SKU блокируют core, app shell/cache растёт, content work опережает topology/touch evidence |
| Mitigation | UJ-driven category matrix; generic assets; Parametric Placeholder; strict pipeline/budgets |
| Trigger | Asset count используется как Done без coverage или нарушает RS/bundle budget |
| Owner | Product Owner / Asset steward |
| Contingency | Сократить starter set до task coverage; заменить декоративные модели proxies/placeholders |
| Статус | Open |

### R-024 — Лицензии и provenance загрязняют каталог или код

| Поле | Значение |
| --- | --- |
| Категория | Legal / supply chain |
| Вероятность | Средняя |
| Влияние | Высокое |
| Evidence | Catalog source/owner не выбран; OSS repositories предлагаются только как references |
| Ранний сигнал | Asset/code не имеет source/license либо grant не покрывает in-app render/thumbnail, model+subresources, optimization/transcoding, `.interiors`, private 3D transfer, rendered PNG share или placement required notice |
| Mitigation | Mandatory human-approved AssetUsageGrant с evidence/reviewer; notices в bundle, UI и при необходимости самом PNG; license gate; SBOM; legal review; не копировать reference repo вслепую |
| Trigger | Unknown/restrictive license или unknown/incomplete/forbidden grant попадает в candidate manifest/dependency set |
| Owner | Asset steward / Product Owner |
| Contingency | Удалить загрязнённый asset/dependency, заменить собственным или разрешённым, уведомить о затронутых exports |
| Статус | Open |

### R-025 — Metadata, diagnostics или telemetry раскрывают проект

| Поле | Значение |
| --- | --- |
| Категория | Privacy / security |
| Вероятность | Средняя |
| Влияние | Критическое |
| Evidence | Consent/provider не выбран; filenames, geometry и screenshots могут попасть в logs по ошибке |
| Ранний сигнал | Free-form exception payload содержит name/path/serialized Project |
| Mitigation | Allowlisted diagnostic envelope; schema tests; redaction; local-by-default; explicit consent/opt-out |
| Trigger | Любое внешнее событие содержит запрещённое поле или отправляется до consent |
| Owner | Privacy/Security owner |
| Contingency | Отключить telemetry, отозвать/удалить данные по процедуре, исправить schema и провести incident review |
| Статус | Open |

### R-026 — Dependency/version drift или supply-chain issue меняет поведение

| Поле | Значение |
| --- | --- |
| Категория | Technical / supply chain |
| Вероятность | Средняя |
| Влияние | Высокое |
| Evidence | Stack — snapshot кандидатов, а не установленные/pinned зависимости; renderer/storage APIs развиваются |
| Ранний сигнал | Spike и implementation используют разные major/minor версии или dependency меняет serialized/runtime semantics |
| Mitigation | Выбор только после spikes; exact lockfile; changelog/security review; adapter boundaries; SBOM |
| Trigger | Обновление меняет geometry, loader, PWA lifecycle или browser support без ADR/evidence |
| Owner | Architect / Dependency owner |
| Contingency | Pin/rollback dependency; переключить adapter; повторить affected corpus/device gates |
| Статус | Open |

## 8. Delivery и agent system

### R-027 — Device matrix выбирается слишком поздно

| Поле | Значение |
| --- | --- |
| Категория | Product / quality governance |
| Вероятность | Высокая |
| Влияние | Критическое |
| Evidence | Точные модели, RAM, OS и browser остаются TBD, но определяют renderer/storage/UX budgets |
| Ранний сигнал | Architecture или assets оптимизируются под desktop/emulation |
| Mitigation | Product Owner утверждает floor/typical devices до QG-0; spikes выполняются на них |
| Trigger | Любой численный NFR объявлен final без named physical devices |
| Owner | Product Owner / QA Performance |
| Contingency | Приостановить freeze; купить/получить доступ к устройствам или честно сузить support matrix |
| Статус | Open |

### R-028 — Multi-agent работа создаёт противоречивые источники истины

| Поле | Значение |
| --- | --- |
| Категория | Agent governance |
| Вероятность | Средняя |
| Влияние | Высокое |
| Evidence | Параллельные агенты ускоряют research, но write-heavy collaboration повышает риск конфликтов; уже требуется CAP/FR/NFR/AD ownership |
| Ранний сигнал | Два writers меняют один canonical artifact или roadmap выбирает противоречащие требования молча |
| Mitigation | Controlled-hybrid; один writer на artifact/slice; bounded briefs; independent review; reconciliation gate |
| Trigger | Расхождение PRD/SPEC/UX/Architecture либо silent merge |
| Owner | Orchestrator |
| Contingency | Остановить downstream work, назначить canonical owner, оформить decision table и повторный review |
| Статус | Mitigating |

### R-029 — Агент расширяет scope или начинает реализацию до READY

| Поле | Значение |
| --- | --- |
| Категория | Agent governance / delivery |
| Вероятность | Средняя |
| Влияние | Высокое |
| Evidence | Проект находится в definition phase; rules прямо запрещают application code до READY/waiver |
| Ранний сигнал | Появляются package/config/source/tests или новые capabilities без Product Owner approval |
| Mitigation | AGENTS gate; отдельные BMAD tasks; artifact ownership; readiness review; no commit без разрешения |
| Trigger | Любой implementation artifact до gate либо undocumented scope addition |
| Owner | Orchestrator / Product Owner |
| Contingency | Остановить работу, изолировать/удалить неутверждённый результат только с разрешения владельца, повторить readiness |
| Статус | Mitigating |

### R-030 — Verification suite становится медленной и недостоверной

| Поле | Значение |
| --- | --- |
| Категория | Quality operations |
| Вероятность | Средняя |
| Влияние | Среднее |
| Evidence | Property, mutation, browser, device и performance suites дороги; без tiering команда начнёт их обходить |
| Ранний сигнал | skipped tests, stale fixtures, необъяснимый quarantine, mutation/device runs не запускаются |
| Mitigation | Быстрые per-slice suites + scheduled/full candidate gates; deterministic seeds; fixture ownership; baseline/ratchet |
| Trigger | Gate report неполон или длительность приводит к регулярному manual bypass |
| Owner | QA / Orchestrator |
| Contingency | Пересечь suite по риску, распараллелить read-only execution, убрать дубли и сохранить обязательные high-risk gates |
| Статус | Open |

## 9. Assumption watchlist

Assumptions принадлежат PRD/SPEC и не получают новые risk ID. Регистр только
показывает, какой risk реализуется, если предположение неверно.

| Assumption | Как проверить | Связанные risks |
| --- | --- | --- |
| A-1 Gridfinity = constraint grid | Явное подтверждение Product Owner и touch prototype | R-006, R-007 |
| A-2 Один Level достаточен | Problem interviews и Alpha recruitment criteria | R-001, R-002 |
| A-3 Manual touch/numeric input закрывает JTBD | Наблюдаемые UJ-1/UJ-2 sessions | R-002, R-012 |
| A-4 100–150 generic assets достаточно | Catalog task-coverage matrix и UJ-3 | R-001, R-023 |
| A-5 GLB не блокирует Alpha entry | Recruitment feedback и placeholder completion | R-003, R-021 |
| A-6 WebGL2 покрывает device floor | S-1 на named floor devices | R-014, R-015, R-027 |
| A-7 Cloud/account не нужны для первой ценности | Offline/local usability и return studies | R-002, R-004, R-005 |
| A-8 Рабочее имя не является брендом | Отдельное naming/brand решение | R-001 |

## 10. Decision watchlist

Следующие решения не являются risks; отсутствие решения повышает связанные
риски:

| Decision owner | Требуемое решение | Deadline gate | Risks |
| --- | --- | --- | --- |
| Product Owner | Значение constraint grid, snap/off-grid и endpoint quantization | До S-2/S-4 exit | R-006, R-007, R-008 |
| Product Owner + Architect | Room split/merge и Opening fit | До S-2 exit | R-009 |
| Product Owner + UX | Collision blocking/warning semantics | До placement slice | R-011 |
| Product Owner + QA | Named device matrix | До любого final NFR | R-014, R-015, R-016, R-018, R-027 |
| Product Owner | Утвердить self-contained backup, provisional limits и reminder UX | До persistence slice | R-016, R-017, R-020 |
| Product Owner + Asset steward | Minimum catalog coverage и provenance owner | До asset pipeline | R-023, R-024 |
| Product Owner + Privacy | Consent, telemetry и retention | До external Alpha telemetry | R-025 |
| Product Owner | CAP-12 остаётся Alpha+ или повышается | До roadmap freeze | R-003, R-021, R-022 |
| Architect | Renderer, geometry kernel и blob store ADRs | После S-1–S-3 | R-008, R-014–R-018, R-026 |

## 11. Review protocol

Регистр пересматривается:

- после каждого product/architecture/spike decision;
- перед BMAD readiness;
- перед началом каждого vertical slice;
- при новом SEV-0/SEV-1 defect или security/privacy finding;
- при изменении device matrix, Alpha scope, dependency, schema или catalog
  license;
- перед каждым Alpha candidate.

На review для каждого `Open/Mitigating` risk фиксируются:

1. новый evidence или его отсутствие;
2. изменение вероятности/влияния;
3. выполненная mitigation;
4. активированный trigger;
5. owner и следующий проверяемый шаг;
6. residual risk и waiver, если он принимается.

Risk закрывается только когда событие больше не может повлиять на текущий scope,
либо mitigation подтверждена соответствующим evidence. «Мы уже написали код»
не является основанием для `Closed`.

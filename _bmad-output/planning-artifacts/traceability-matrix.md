---
title: "InteriorsEditor — матрица трассировки Alpha"
status: draft
created: 2026-07-26
updated: 2026-11-22
scope: "Alpha entry CAP-1–CAP-11; Alpha+ CAP-12"
requirements_source: "prds/prd-InteriorsEditor-2026-07-26/prd.md"
capabilities_source: "../specs/spec-interiors-editor-alpha/SPEC.md"
architecture_source: "architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md"
roadmap_source: "roadmap-to-alpha.md"
---

# Матрица трассировки Alpha

**Обычная сборка Telegram, 22 ноября 2026.** CAP-13 → FR-55–58, FR-61 → NFR-21/28/29 → AD-26/28/34 → истории 10.2, 10.3, 10.5, 10.14, 10.15 и 10.18. Проверяются новая редакция, отключение общего подсчёта до входа и в настройках, отдельное разрешение повторных входов на устройстве, два суточных итога и блокировка прежних маршрутов при переключении и откате. Публичная активация требует фактов о действующей инфраструктуре и физической приёмки. [Условия выпуска](sprint-change-proposal-2026-11-22-public-candidate.md)

> **Актуализация 2026-11-04:** исторические таблицы и статусы ниже сохраняют
> прежний Alpha checkpoint; итоговый исторический READY от 2026-08-30 не является
> Telegram readiness. Текущая additive трассировка CAP-13 / FR-55–58 / NFR-28 /
> AD-25–30 / UXF-8 и S0–S7 приведена в конце. Владелец разрешил прежний
> конфликт AssetUsageGrant 2026-11-04: formal licensing admission не является
> Alpha gate; техническая resource policy и другие gates сохраняются.

## 1. Назначение и правила чтения

Документ связывает канонические capability из
[SPEC](../specs/spec-interiors-editor-alpha/SPEC.md) с требованиями
[PRD](prds/prd-InteriorsEditor-2026-07-26/prd.md), пользовательскими потоками
[EXPERIENCE](ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md),
архитектурными решениями
[Architecture Spine](architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md),
срезами [roadmap](roadmap-to-alpha.md) и ожидаемыми доказательствами.

Правила:

- PRD владеет `FR-*` и `NFR-*`, SPEC — `CAP-*`, Architecture Spine — `AD-*`;
- `PRD UJ-*` и `UXF-*` — разные пространства идентификаторов: первые описывают
  продуктовые истории, вторые — детализированные UX-потоки;
- `V-*` — Alpha-срезы roadmap, `P-*` — отдельные Alpha+ срезы импорта;
- capability не закрывается наличием UI: должны существовать перечисленные
  проверяемые evidence;
- все `EV-*` ниже имеют статус **planned** для production gate: waiver-spikes
  могут дать только ограниченную synthetic evidence и не закрывают эти строки;
- при изменении ID в roadmap эта матрица обновляется в той же PR/сессии.

## 2. Каталог планируемых доказательств

| Evidence | Планируемый проверяемый результат | Gate / источник |
| --- | --- | --- |
| `EV-01` | Product Owner письменно утверждает пользователя, JTBD, Alpha boundary, non-goals и решения `D-011`–`D-020`, `D-041`–`D-050`; у каждого оставшегося вопроса есть owner и gate | G-0, decision register |
| `EV-02` | Problem interviews и наблюдаемый mobile prototype подтверждают ручной ввод, constraint grid, жесты, wall-hosted Opening и достаточность Parametric Placeholder | G-1, S-4 |
| `EV-03` | Golden/property corpus доказывает integer-mm roundtrip, направления, intersections, snapping, инварианты и атомарный отказ topology-команд | S-2 |
| `EV-04` | Fixtures доказывают face derivation, Room identity при локальной правке, split/merge policy и Opening fit | S-2, V-06–V-07 |
| `EV-05` | Один versioned Project даёт семантически одинаковые 2D/3D и восстановление после WebGL context loss | S-1, V-03 |
| `EV-06` | Command/history tests и fault injection доказывают atomic validation, переход `PendingDurability → Durable`, session undo/redo, GC roots обеих веток, SessionRetentionPolicy, confirm/cancel history-only recovery и восстановление последней `Durable Revision` | V-01–V-17 |
| `EV-07` | Real-device storage suite покрывает kill/restart, quota, copy-on-write migration, corrupt/missing resource, read-only exact-byte/atomic recovery, iOS browser↔Home Screen handoff, writer fencing и сохранение читаемой `Durable Revision` | S-3, V-16 |
| `EV-08` | Install/offline/update/capability suite проходит в browser и standalone на утверждённой iOS/Android matrix; automatic worker activation не подменяет active editor | S-3, V-15, V-16 |
| `EV-09` | Самодостаточный Portable Backup с exact referenced resources и hashes восстанавливается offline с 0 мм diff; archive атомарно отклоняется | V-17 |
| `EV-10` | Catalog task matrix закрывает representative rooms; каждый asset имеет dimensions, budget и hash; Durable reference pin-ится, проходит BackupFeasibilityPolicy и имеет explicit recovery state | S-6, content gate, V-09–V-12 |
| `EV-11` | Browser/usability suite проверяет placement, exact transform, **ItemInstance** lock/delete/duplicate, collision tiers, Parametric Placeholder и material applicability; Door lock state не входит в этот evidence | V-09–V-12 |
| `EV-12` | Версионированные RS-1/RS-2 проходят startup, frame-time, long-task, memory, thermal, disposal и degradation budgets на реальных устройствах | S-1, S-6, V-18 |
| `EV-13` | Automated и manual accessibility review покрывает WCAG 2.2 AA DOM controls, 44×44 px, zoom 200%, screen reader, numeric alternatives и reduced motion | V-19 |
| `EV-14` | Privacy/diagnostics review доказывает consent, data minimization, отсутствие geometry/file/binary в telemetry и полезность non-sensitive reason codes | V-19 |
| `EV-15` | Независимые участники выполняют согласованные `PRD UJ-1`–`UJ-6` на реальных телефонах; зафиксированы SM-1–SM-6 и практическое решение пользователя | V-20, G-8 |
| `EV-16` | Hostile GLB corpus доказывает local-only preflight, hard limits, cancel/timeout, no-network, cleanup, atomic registration и backup roundtrip | S-5, P-01–P-03; Alpha+ |
| `EV-17` | Architecture/port contract tests и dependency checks доказывают отсутствие React/renderer/browser типов в domain и один mutation path | G-3, все implementation slices |
| `EV-19` | ADR-selected Kotlin/PostgreSQL contract, schema/migration и integration suites доказывают versioned catalog metadata/resources/hash perimeter без account/Project/Revision/History/Backup/user-pinned-byte storage; Playwright `CATALOG-E2E-01`–`05` отдельно доказывают visible outage/local-continuity outcomes | `G-CP-ADR`, V-09-CP, V-15–V-17 |
| `EV-20` | `WEB-BOOTSTRAP-01` доказывает exact AD-16 web baseline: один frozen JavaScript lockfile, React/TypeScript/Rspack/CSS Modules, Rstest+Rspack adapter и Playwright против одного `apps/web`; Vite/Vitest, второй lockfile и Kotlin tests в JS runner отсутствуют | `G-WEB-AD16`, V-01, final `READY` |

## 3. CAP → требования → UX → архитектура → срез → evidence

| Capability | Требования PRD | Пользовательские потоки | Архитектура | Roadmap | Planned evidence |
| --- | --- | --- | --- | --- | --- |
| `CAP-1` Локальные проекты и восстановление | Primary: `FR-1`, `FR-2`, `FR-4`, `FR-5`. Cross: `FR-43`–`FR-45`, `FR-47`. `NFR-3`, `NFR-10`–`NFR-13`, `NFR-21`, `NFR-23`–`NFR-26` | PRD `UJ-1`, `UJ-3`, `UJ-4`, `UJ-6`; UX `UXF-1`, `UXF-5` | `AD-2`, `AD-3`, `AD-4`, `AD-11`, `AD-12` | `V-01`, `V-14`–`V-17`, `V-19`, `V-20` | `EV-01`, `EV-06`–`EV-09`, `EV-14`, `EV-15`, `EV-17` |
| `CAP-2` Ограниченное редактирование плана | Primary: `FR-6`–`FR-13`. Cross: `FR-39`, `FR-40`. `NFR-1`, `NFR-3`–`NFR-5`, `NFR-17`–`NFR-19`, `NFR-24`, `NFR-26` | PRD `UJ-1`, `UJ-2`; UX `UXF-1`, `UXF-2` | `AD-1`–`AD-3`, `AD-7`, `AD-12` | `V-02`, `V-04`, `V-05`, `V-19`, `V-20` | `EV-01`–`EV-03`, `EV-06`, `EV-13`, `EV-15`, `EV-17` |
| `CAP-3` Комнаты и параметры | Primary: `FR-14`–`FR-16`. Cross: `FR-6`, `FR-13`. `NFR-1`, `NFR-3`, `NFR-4`, `NFR-24`, `NFR-26` | PRD `UJ-1`, `UJ-2`, `UJ-3`; UX `UXF-1`, `UXF-2`, `UXF-4` | `AD-1`–`AD-3`, `AD-6`, `AD-7`, `AD-12` | `V-02`, `V-06`, `V-19`, `V-20` | `EV-02`–`EV-04`, `EV-06`, `EV-15`, `EV-17` |
| `CAP-4` Проёмы | Primary: `FR-17`–`FR-19`. Cross: `FR-10`–`FR-12`, `FR-40`. `NFR-1`, `NFR-3`, `NFR-4`, `NFR-24`, `NFR-26` | PRD `UJ-2`; UX `UXF-2` | `AD-1`, `AD-2`, `AD-3`, `AD-6`, `AD-7`, `AD-12` | `V-07`, `V-19`, `V-20` | `EV-02`, `EV-04`–`EV-06`, `EV-13`, `EV-15`, `EV-17`; Door/Window use one wall-hosted validation route without navigation semantics |
| `CAP-5` Синхронные 2D и 3D | Primary: `FR-21`–`FR-23`. Cross: `FR-25`. `NFR-1`, `NFR-2`, `NFR-4`–`NFR-6`, `NFR-8`, `NFR-14`, `NFR-16`, `NFR-19`, `NFR-20`, `NFR-26` | PRD `UJ-1`–`UJ-4`; UX `UXF-1`–`UXF-5` | `AD-1`, `AD-2`, `AD-5`, `AD-10`, `AD-12`, `AD-13`, `AD-16` | `V-01`, `V-03`, `V-18`–`V-20` | `EV-05`, `EV-06`, `EV-12`, `EV-13`, `EV-15`, `EV-17`, `EV-20` |
| `CAP-6` Каталог и размещение | Primary: `FR-26`–`FR-32`. Cross: `FR-38`–`FR-40`, `FR-54`. `NFR-3`, `NFR-5`, `NFR-6`, `NFR-10`, `NFR-17`–`NFR-19`, `NFR-21`, `NFR-24`, `NFR-26` | PRD `UJ-1`, `UJ-3`, `UJ-5`; UX `UXF-3` | `AD-2`, `AD-3`, `AD-8`, `AD-12`, `AD-14`, `AD-16`, `AD-17` | `V-01`, `V-09`, `V-09-CP`, `V-10`, `V-11`, `V-19`, `V-20` | `EV-02`, `EV-06`, `EV-10`–`EV-13`, `EV-15`, `EV-17`, `EV-19`, `EV-20`; `CATALOG-E2E-01`–`05` |
| `CAP-7` Варианты предметов | Primary: `FR-33`. Cross: `FR-38`–`FR-40`, `FR-54`. `NFR-3`, `NFR-4`, `NFR-10`, `NFR-13`, `NFR-21`, `NFR-24`, `NFR-26` | PRD `UJ-3`; UX `UXF-4` | `AD-2`, `AD-3`, `AD-8`, `AD-12`, `AD-14`, `AD-17` | `V-09-CP`, `V-12`, `V-19`, `V-20` | `EV-06`, `EV-10`, `EV-11`, `EV-14`, `EV-15`, `EV-17`, `EV-19` |
| `CAP-8` Безопасная история изменений | Primary: `FR-38`–`FR-40`. Cross: все mutation requirements, особенно `FR-5`, `FR-7`–`FR-12`, `FR-17`–`FR-19`, `FR-28`–`FR-30`, `FR-33`, `FR-45`. `NFR-3`, `NFR-4`, `NFR-11`–`NFR-13`, `NFR-24`, `NFR-26` | PRD `UJ-1`–`UJ-6`; UX `UXF-1`–`UXF-6` | `AD-2`–`AD-4`, `AD-7`, `AD-12` | `V-02`, `V-04`, `V-05`, `V-10`, `V-11`, `V-16`, все последующие mutation slices, `V-19`, `V-20` | `EV-03`, `EV-04`, `EV-06`, `EV-07`, `EV-11`, `EV-15`, `EV-17` |
| `CAP-9` Устанавливаемая offline PWA | Primary: `FR-41`–`FR-43`, `FR-47`. Cross: `FR-1`, `FR-5`, `FR-54`. `NFR-7`, `NFR-10`, `NFR-11`, `NFR-13`–`NFR-18`, `NFR-20`, `NFR-21`, `NFR-23`, `NFR-25`–`NFR-26` | PRD `UJ-4`; UX `UXF-1`, `UXF-5` | `AD-2`, `AD-4`, `AD-5`, `AD-10`–`AD-12`, `AD-14`, `AD-16`, `AD-17` | `V-01`, `V-09-CP`, `V-15`, `V-16`, `V-18`–`V-20` | `EV-07`, `EV-08`, `EV-10`, `EV-12`–`EV-15`, `EV-17`, `EV-19`, `EV-20`; `CATALOG-E2E-01`–`05` |
| `CAP-10` Переносимость проекта | Primary: `FR-44`, `FR-45`. Cross: `FR-5`. `NFR-1`, `NFR-3`, `NFR-4`, `NFR-10`, `NFR-12`, `NFR-13`, `NFR-16`, `NFR-18`, `NFR-21`, `NFR-23`, `NFR-24`, `NFR-26` | PRD `UJ-3`, `UJ-6`; UX `UXF-5` | `AD-2`–`AD-4`, `AD-11`, `AD-12`, `AD-14` | `V-17`, `V-19`, `V-20`; Alpha+ extension `P-03` | `EV-06`, `EV-07`, `EV-09`, `EV-13`–`EV-15`, `EV-17`; Alpha+ `EV-16` |
| `CAP-11` Адаптивная производительность | Primary: `FR-25`. Cross: `FR-21`–`FR-23`, `FR-26`–`FR-33`, `FR-41`, `FR-42`. `NFR-5`–`NFR-9`, `NFR-14`–`NFR-17`, `NFR-20`, `NFR-25`–`NFR-26` | PRD `UJ-1`–`UJ-5`; UX `UXF-1`–`UXF-5` | `AD-2`, `AD-5`, `AD-10`, `AD-12`–`AD-14` | `V-03`, `V-09`, `V-18`–`V-20` | `EV-05`, `EV-08`, `EV-10`–`EV-15`, `EV-17` |
| `CAP-12` Ограниченный импорт GLB — Alpha+ | Primary: `FR-48`–`FR-52`. `NFR-3`, `NFR-5`, `NFR-6`, `NFR-8`, `NFR-13`, `NFR-16`, `NFR-21`–`NFR-26` | PRD `UJ-A1`; UX `UXF-6` | `AD-2`, `AD-3`, `AD-8`, `AD-9`, `AD-10`, `AD-12` | `P-01`–`P-03`; отдельный gate `G-A+` | `EV-06`, `EV-07`, `EV-09`, `EV-12`, `EV-14`, `EV-16`, `EV-17` |

## 4. Обратное покрытие FR

В таблице указан первичный capability-owner. Cross-cutting capability не
переопределяет requirement и не создаёт вторую реализацию.

| FR | Primary CAP | Cross-cutting CAP | Roadmap slice |
| --- | --- | --- | --- |
| `FR-1`, `FR-2`, `FR-5` | `CAP-1` | `CAP-8`, `CAP-9` для commit/offline границ | `V-01`, для recovery также `V-14` |
| `FR-4` | `CAP-1` | `CAP-8` | `V-14` |
| `FR-3` | retired 2026-08-25 | — | — |
| `FR-6`, `FR-13` | `CAP-2`, `CAP-3` | `CAP-8` | `V-02` |
| `FR-7`–`FR-12` | `CAP-2` | `CAP-3`, `CAP-4`, `CAP-8` по последствиям topology | `V-04`, `V-05` |
| `FR-14`–`FR-16` | `CAP-3` | `CAP-8` | `V-06` |
| `FR-17`–`FR-19` | `CAP-4` | `CAP-8` | `V-07` |
| `FR-21`–`FR-23` | `CAP-5` | `CAP-11` | `V-03` |
| `FR-25` | `CAP-11` | `CAP-5` | `V-18` |
| `FR-26`, `FR-27`, `FR-28` | `CAP-6` | `CAP-11` | `V-09` |
| `FR-54` | `CAP-6`, `CAP-7`, `CAP-9` | local continuity in `CAP-1`, `CAP-10` | `V-09-CP`; browser continuity in `V-15`–`V-17` |
| `FR-29`, `FR-30` | `CAP-6` | `CAP-8`, `CAP-11` | `V-10` |
| `FR-31`, `FR-32` | `CAP-6` | `CAP-8`, `CAP-11` | `V-11` |
| `FR-33` | `CAP-7` | `CAP-8`, `CAP-11` | `V-12` |
| `FR-34`–`FR-37` | retired 2026-08-25 (FR-36: 2026-08-24) | — | — |
| `FR-38`–`FR-40` | `CAP-8` | все capability с пользовательскими mutations | `V-02`, `V-04`, `V-05`, затем acceptance каждого mutation slice |
| `FR-41`, `FR-42` | `CAP-9` | `CAP-1`, `CAP-11` | `V-15` |
| `FR-43`, `FR-47` | `CAP-9` | `CAP-1`, `CAP-11` | `V-16` |
| `FR-44`, `FR-45` | `CAP-10` | `CAP-1`, `CAP-8` | `V-17` |
| `FR-46` | retired 2026-08-25 | — | — |
| `FR-48`, `FR-49`, `FR-51` | `CAP-12` | `CAP-8`, `CAP-11` | `P-01` |
| `FR-50` | `CAP-12` | `CAP-6`, `CAP-11` | `P-02` |
| `FR-52` | `CAP-12` | `CAP-1`, `CAP-8`, `CAP-10` | `P-02`, `P-03` |

**Итог FR coverage:** все 45 активных `FR-*` покрыты, orphan FR нет.
`FR-3`, `FR-34`–`FR-35`, `FR-37` и `FR-46` retired 2026-08-25; `FR-20` и
`FR-24` retired 2026-08-22 вместе с Walk; `FR-36` и `FR-53` retired 2026-08-24
вместе с потолочным scope и Focus/fullscreen. Идентификаторы не
переиспользуются. `FR-1`–`FR-47` (кроме retired `FR-3`, `FR-20`, `FR-24`,
`FR-34`–`FR-37`, `FR-46`) и `FR-54` относятся к Alpha entry,
`FR-48`–`FR-52` — к Alpha+.

## 5. Обратное покрытие NFR

| NFR | Capability coverage | Основное evidence |
| --- | --- | --- |
| `NFR-1` | `CAP-2`, `CAP-3`, `CAP-5`, `CAP-10` | `EV-03`, `EV-05`, `EV-09` |
| `NFR-2` | `CAP-5` | `EV-05`, `EV-17` |
| `NFR-3` | `CAP-1`–`CAP-8`, `CAP-10`, `CAP-12` | `EV-03`, `EV-06`, `EV-16` |
| `NFR-4` | `CAP-2`–`CAP-5`, `CAP-7`, `CAP-8`, `CAP-10` | `EV-03`–`EV-06`, `EV-09`, `EV-11` |
| `NFR-5`, `NFR-6` | `CAP-2`, `CAP-5`, `CAP-6`, `CAP-11`, `CAP-12` | `EV-12`, Alpha+ `EV-16` |
| `NFR-7` | `CAP-9`, `CAP-11` | `EV-08`, `EV-12` |
| `NFR-8` | `CAP-5`, `CAP-11`, `CAP-12` | `EV-12`, Alpha+ `EV-16` |
| `NFR-9` | `CAP-11` | `EV-12` |
| `NFR-10` | `CAP-1`, `CAP-6`, `CAP-7`, `CAP-9`, `CAP-10` | `EV-07`–`EV-11`, `EV-19` |
| `NFR-11` | `CAP-1`, `CAP-8`, `CAP-9` | `EV-06`, `EV-07` |
| `NFR-12` | `CAP-1`, `CAP-8`, `CAP-10` | `EV-07`, `EV-09` |
| `NFR-13` | `CAP-1`, `CAP-6`–`CAP-10`, `CAP-12` | `EV-06`, `EV-07`, `EV-09`, `EV-19`, Alpha+ `EV-16` |
| `NFR-14` | `CAP-5`, `CAP-9`, `CAP-11` | `EV-05`, `EV-08`, `EV-12` |
| `NFR-15` | `CAP-5`, `CAP-9`, `CAP-11` | `EV-08`, `EV-12`, `EV-18` |
| `NFR-16` | `CAP-5`, `CAP-9`–`CAP-12` | `EV-08`, `EV-12`, `EV-18`, Alpha+ `EV-16` |
| `NFR-17` | `CAP-2`, `CAP-5`, `CAP-6`, `CAP-9`, `CAP-11` | `EV-02`, `EV-13`, `EV-18` |
| `NFR-18` | `CAP-2`, `CAP-5`, `CAP-6`, `CAP-9`, `CAP-10` | `EV-13`, `EV-18` |
| `NFR-19` | `CAP-2`, `CAP-5`, `CAP-6` | `EV-02`, `EV-13`, `EV-18` |
| `NFR-20` | `CAP-5`, `CAP-9`, `CAP-11` | `EV-05`, `EV-13`, `EV-18` |
| `NFR-21` | `CAP-1`, `CAP-6`, `CAP-7`, `CAP-9`, `CAP-10`, `CAP-12` | `EV-09`, `EV-14`, `EV-19`, Alpha+ `EV-16` |
| `NFR-22` | `CAP-12`; `N/A by scope` для Alpha | Alpha+ `EV-16` |
| `NFR-23` | `CAP-1`, `CAP-9`, `CAP-10`, `CAP-12` | `EV-14`, Alpha+ `EV-16` |
| `NFR-24` | `CAP-1`–`CAP-12` | `EV-01`, `EV-17` |
| `NFR-25` | `CAP-1`, `CAP-9`, `CAP-11`, `CAP-12` | `EV-12`, `EV-14`, Alpha+ `EV-16` |
| `NFR-26` | `CAP-1`–`CAP-12` | `EV-03`–`EV-17` по соответствующей границе |
**Итог NFR coverage:** 26 активных `NFR-*` покрыты, orphan NFR нет.
`NFR-27` retired 2026-08-24 вместе с Focus/fullscreen и не переиспользуется.

## 6. Coverage audit

| Проверка | Результат | Примечание |
| --- | --- | --- |
| Capability | `12/12` | `CAP-1`–`CAP-11` Alpha; `CAP-12` Alpha+ |
| Functional requirements | `51/51 active` | `FR-20`, `FR-24` и `FR-53` retired; `FR-54` additionally requires `G-CP-ADR` / V-09-CP contract evidence |
| Non-functional requirements | `26/26 active` | `NFR-27` retired; все active NFR имеют capability и planned evidence |
| PRD journeys | `7/7` | Alpha `UJ-1`–`UJ-6`; Alpha+ `UJ-A1` |
| UX flows | `6/6` | `UXF-1`–`UXF-5` Alpha; `UXF-6` Alpha+ |
| Architecture decisions | `17/17` referenced | `AD-13` остаётся renderer-гипотезой до S-1; AD-16 requires `G-WEB-AD16`/`WEB-BOOTSTRAP-01` at V-01, while AD-17 requires `G-CP-ADR` before V-09-CP implementation |
| Alpha slices | active `V-01`–`V-20` plus `V-09-CP` | Focus slices are retired; IDs синхронизированы with the approved 2026-08-24 scope |
| Alpha+ slices | `P-01`–`P-03` referenced | не блокируют Alpha entry |

Coverage означает полноту планирования, а не готовность реализации. До
появления фактических `EV-*` и успешного readiness gate все строки остаются
обязательствами, а не доказанными возможностями.


## Telegram extension — трассировка 2026-11-04

[PRD и addendum](prds/prd-InteriorsEditor-2026-07-26/prd.md),
[SPEC и companions](../specs/spec-interiors-editor-alpha/SPEC.md),
[Architecture](architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md),
[UX](ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md),
[эпики](epics.md) и [roadmap](roadmap-to-alpha.md) остаются владельцами
соответствующих контрактов. Строки ниже — planned coverage, не evidence PASS.

| Requirement | Capability / architecture / UX | Story / этап | Будущее доказательство |
|---|---|---|---|
| FR-55 общий Telegram editor/lifecycle | CAP-1–9/11/13; AD-25/27; UXF-8 | 10.2/10.6–10.12/10.15; S2/S4–S7 | Эквивалентность core outcome, Back/Close, offline readiness, настоящая physical acceptance NFR-28 |
| FR-56 проверенный local account scope | CAP-1/8/9/13; AD-26; UXF-8 | 10.2/10.3/10.11/10.12; S2/S6 | До первой записи 10.2: signed identity, Web Lock, atomic fence/stage/receipt, no-ABA, conditional pin cleanup и полный S2 race corpus; 10.3 расширяет A→B→A/physical isolation, общего GC в S2 нет |
| FR-57 двусторонний внешний backup | CAP-1/8–10/13; AD-29–31; UXF-8 | 10.4/10.5/10.15; S3/S7 | PPJ/V1 и отдельный registered browser namespace; trusted owner, полная representability legacy backup и local corpus; actual iOS/Android file pairs остаются acceptance evidence. |
| FR-58 coexistence/release | CAP-1/9/10/13; AD-25/28/29; UXF-8 | 10.1/10.2/10.13–10.15; S1/S2/S7 | Старый PWA worker/offline/update, shell-bound manifest, immutable URLs, независимый rollback |
| NFR-28 physical Telegram | CAP-1–11/13; AD-25–29; UXF-8 | 10.2/10.3/10.6–10.15; S2–S7 | iPhone 15 Pro Max и Samsung S24 Ultra либо утверждённые замены; версии OS/Telegram; полный путь, floor/wall exact pin, Back/Close, offline, account isolation, внешний roundtrip |

FR-1–54 и NFR-1–26 сохраняют владельцев и историческую applicability; 40 прежних
active Alpha entry FR плюс FR-55–58 дают 44, FR-48–52 остаются 5 Alpha+,
9 FR retired. NFR-1–26 плюс NFR-28 — 27 active; NFR-27 retired. CAP-12 остаётся
Alpha+, UXF-7 retired; новые строки не повышают GLB, FBX/ZIP, PNG, Focus, Walk,
finishes или независимые варианты Project. CAP-1–11 и CAP-13 сохраняют
применимость на соответствующих поверхностях; PWA install/cold offline N/A для
Telegram, но обязательны для Web/PWA.

| UX requirement | Story / будущее evidence |
|---|---|
| UX-TMA-01, UX-TMA-02 host, scope, failure | 10.2/10.3/10.13 — safe host/identity/manifest states, A→B→A |
| UX-TMA-03, UX-TMA-04, UX-TMA-05 Back, pending, Close | 10.7/10.11 — state matrix, focus/cancel, retry/recovery |
| UX-TMA-06, UX-TMA-07 viewport, gesture, accessibility | 10.6/10.7 — 360 px/200%, stale projection, pointer cancel |
| UX-TMA-08 lifecycle/renderer | 10.3/10.8/10.11 — fence/base, no mutation, 2D fallback |
| UX-TMA-09 подготовка/offline | 10.10/10.13 — per-mode readiness и catalog outage |
| UX-TMA-10, UX-TMA-11 честный file handoff/import | 10.4/10.5/10.15 — внешний файл и reselect, strict staged import |
| UX-TMA-12 общие controls и REL/FUP | 10.6–10.9 — принятые interaction paths без retired UI |


Связи указывают планируемые stories и будущие evidence, не выполненный PASS.
Уточнения TMA-05/14–16 подтверждены и внесены в соответствующие stories;
покрытие означает наличие планируемого пути и доказательства, не готовый результат.

| Требование | Stories | Источники | Будущее доказательство |
|---|---|---|---|
| TMA-01 общее ядро | 10.1–10.3, 10.13 | CAP-9/13; FR-55/58; NFR-26; AD-2/25 | boundary/import tests, одинаковая команда и две composition |
| TMA-02 отдельный entry | 10.1/10.2/10.13 | CAP-9/13; FR-55/58; NFR-16/28; AD-25/26 | SDK blocked, invalid host/timeout, два entry |
| TMA-03 worker/build isolation | 10.1/10.13/10.14 | CAP-9/13; FR-41/47/58; NFR-10/24; AD-11/25/28 | старый worker, offline/update, независимые outputs/cache |
| TMA-04 release compatibility | 10.2/10.13/10.14 | CAP-1/9/13; FR-47/58; NFR-12/24; AD-11/28 | shell/manifest mismatch без SW, migration/read-only, старый lazy client |
| TMA-05 editor parity | 10.2/10.6/10.8/10.9/10.15 | CAP-1–8/11/13; FR-1–2/4–19/21–23/25–33/38–40/55; NFR-1–4/26/28; AD-1–8/13/20–27 | одинаковые доменные результаты и фактический physical путь; явные parity AC и regression |
| TMA-06 theme/viewport/a11y | 10.6/10.7/10.15 | CAP-2/9/13; FR-55; NFR-16–20/28; AD-25/27 | 360 px/200%, keyboard/safe area, физические устройства |
| TMA-07 Back/Close/gestures | 10.6/10.7/10.15 | CAP-1/2/8/13; FR-39/55; NFR-3/17–20/28; AD-3/27 | state-priority matrix, stale projection, physical Back/swipe |
| TMA-08 lifecycle | 10.3/10.7/10.11/10.15 | CAP-1/5/8/13; FR-5/55/56; NFR-8/11/28; AD-4/26/27 | resume/fence/kill, WebGL fallback, physical lifecycle |
| TMA-09 network | 10.10/10.15 | CAP-6/9/13; FR-42/54/55; NFR-10/28; AD-14/27/28 | loss before/after per-mode readiness; PWA cold offline отдельно |
| TMA-10 scopes | 10.2/10.3/10.12/10.15 | CAP-1/8/13; FR-56; NFR-11/21/28; AD-4/26 | Scope Web Lock, atomic fence/receipt, no-ABA и полный commit/journal/exclusive cleanup corpus до writable 10.2; общего GC нет; 10.3 расширяет A→B→A/physical |
| TMA-11 storage/recovery | 10.3/10.11/10.12/10.15 | CAP-1/8/13; FR-5/38/43/56; NFR-3/11–13/28; AD-3/4/26 | quota, crash, exact repair, history roots, physical storage |
| TMA-12 двусторонний backup | 10.4/10.5/10.15 | CAP-1/10/13; FR-44/45/57; NFR-1/12/28; AD-29 | source-owner disposition, реальные файлы, оба направления, 0 мм/hash |
| TMA-13 handoff | 10.4/10.5/10.15 | CAP-1/10/13; FR-44/45/57; NFR-13/21/28; AD-29 | внешний файл/reselect на iOS и Android, cancel/oversize |
| TMA-14 identity/privacy | 10.2/10.3/10.15 | CAP-1/9/13; FR-55/56; NFR-21/23/28; AD-26 | signed vectors, no common fallback/upload/token/PII; negative permissions checks |
| TMA-15 каталог | 10.8–10.10/10.13/10.15 | CAP-6/7/13; FR-26–33/54/55; NFR-10/21/28; AD-14/17/24/28 | floor/wall exact bytes и reopen, outage, catalog route |
| TMA-16 диагностика/выпуск | 10.13–10.15 | CAP-9/11/13; FR-54/58; NFR-21/23–26/28; AD-17/25/28 | runbook, privacy-safe diagnostics, два release/rollback; diagnostics/privacy checks |

| Критерий | Stories и будущее доказательство | Источники |
|---|---|---|
| TMA-AC-01 | 10.1/10.13: browser/PWA без SDK, core regression | CAP-9/13; FR-55/58; NFR-26; AD-25 |
| TMA-AC-02 | 10.1/10.10/10.13: старый worker, offline и update | CAP-9/13; FR-41/42/47/58; NFR-10/12; AD-11/25 |
| TMA-AC-03 | 10.2/10.6/10.8/10.9/10.15: полный путь на iOS/Android | CAP-1–6/13; FR-55; NFR-28; AD-25/27 |
| TMA-AC-04 | 10.6/10.7/10.15: viewport/keyboard/Back/swipe на клиентах | CAP-2/9/13; FR-55; NFR-17–20/28; AD-27 |
| TMA-AC-05 | 10.10/10.15: offline до/после readiness | CAP-9/13; FR-55; NFR-10/28; AD-27 |
| TMA-AC-06 | 10.7/10.11/10.12: crash/failure/fence и сохранный Durable | CAP-1/8/13; FR-5/55; NFR-3/11–13; AD-3/4/27 |
| TMA-AC-07 | 10.2: Web Lock + atomic fencing/receipt/no-ABA и полный commit/journal/exclusive cleanup corpus до записи; 10.3/10.12/10.15: дополнительные A→B→A и physical isolation | CAP-1/8/13; FR-56; NFR-11/21/28; AD-26 |
| TMA-AC-08 | 10.4/10.5/10.15: реальные файлы в обе стороны, 0 мм/hash/new ID | CAP-10/13; FR-57; NFR-1/28; AD-29 |
| TMA-AC-09 | 10.4/10.5/10.15: внешний reselect на iOS и Android | CAP-10/13; FR-57; NFR-21/28; AD-29 |
| TMA-AC-10 | 10.2–10.5/10.8/10.13/10.15: нет upload/token/initData logs | CAP-9/10/13; FR-56/57; NFR-21/23; AD-17/26/29 |
| TMA-AC-11 | 10.1/10.13/10.14: изоляция build/worker/manifest/assets | CAP-9/13; FR-41/47/58; NFR-24/26; AD-25/28 |
| TMA-AC-12 | 10.1–10.15: RED/GREEN, required mutation и regression evidence | CAP-1–11/13; FR-55–58; NFR-26; AD-12/25–29 |
| TMA-AC-13 | 10.15: actual evidence/runbook, fake не physical | CAP-9/13; FR-55–58; NFR-28; AD-25–29 |

**Проверка зависимостей:** 10.4–10.5 зависят от source-owner disposition;
10.6–10.14 не получают зависимости от них только из-за номера. 10.15 собирает
локальные результаты, но полная transfer acceptance отдельно требует 10.4–10.5.
Всем implementation paths предшествуют approved planning package и применимый
READY либо waiver. Прежний licensing conflict разрешён владельцем; техническая
resource policy сохраняется. Реальный bot/HTTPS, physical isolation и NFR-28,
внешний handoff и production release остаются pending. Этот workflow не
назначает retirement implementation story и не объявляет Telegram READY.


### Коррекция S2 и source gates — 2026-11-04

Readiness review выявил, что прежняя карта не делала barrier/generation/teardown
явным обязательством первой writable Story 10.2. Исправленная Story 10.2 включает
эти guards и полный controlled commit/journal/exclusive cleanup corpus до первой публикации; общего GC в S2 нет;
Story 10.3 расширяет проверку и physical-release evidence. Ни одна строка этой
матрицы не свидетельствует, что tests выполнены или unsafe промежуточная запись
допустима. Исторический на тот момент V1/PPJ-A1 source-owner gate позднее снят
регистрацией SPEC; implementation/evidence остаются. Licensing conflict был
открыт на момент этого снимка и позднее разрешён владельцем; PRD owner согласовал FR-16/REL-05 и FR-9/REL-08; SPEC-owner подтвердил reconciliation CAP-2/3;
project-context называет type/height route, но общая фраза о metadata требует
уточнения; применимый readiness recheck нужен до затронутой parity; реальные bot/origins и NFR-28, внешний
file roundtrip, release/rollback и отдельный retirement gate — pending.
[Readiness report](implementation-readiness-report-2026-11-04.md) записывает
`NEEDS_WORK` для Epic 10 и ограниченный `READY` для S1; этот update не заменяет
новую применимую оценку.


### Source-owner S2/S3 disposition — актуальная трассировка

| Источник | Story / gate | Обязательное будущее доказательство |
|---|---|---|
| CAP-1/8/13; FR-55/56; NFR-3/11/13/21/26/28; AD-4/26; [полный S2 disposition](architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md) | 10.2 до первого writable create/import/repair/delete; 10.3 расширяет A→B→A/physical | Scope Web Lock, atomic fence/base/stage/receipt, monotonic uint64 no-ABA IDs, no-publish/conditional cleanup, atomic pin/protect, takeover/adoption и полный race corpus по ссылке; без unsafe browser `recover()`. |
| Те же источники; SessionRetentionPolicy | 10.2/10.3/10.12 | Общего GC в baseline нет и S2 его не создаёт; реальные exclusive pin cleanup/reconcile, сохранение exact bytes/roots и conservative retention при ambiguity. |
| CAP-1/10/13; FR-44/45/57; NFR-1/12/28; AD-29/30; PPJ/V1 registry | 10.4/10.5 implementation после применимого gate; 10.15 acceptance | SPEC зарегистрировал V1-wire и witness-gated legacy; выполнить closed grammar/single dispatch, `-0`/UTF-16/own-undefined, worst-case proof и old recovery→new exact export; реальные files/physical evidence до acceptance. Sole-copy без пути — conditional owner case. |

Положительный signed fixture опубликован tma.js maintainers, а не официальным
Telegram SDK; официальный источник задаёт протокол и ключи. Фиксированный test
clock не меняет production freshness. S1 verified в
[отчёте](../../docs/progress/telegram-extension-2026-11-04/S1/README.md), S2
validator/session queue — лишь частичный прогресс, не runtime/storage или PASS.
Source-owner S2 reconciliation и текущий downstream update требуют отдельного
применимого readiness recheck. Physical evidence и другие независимые gates не
закрыты; прежний licensing conflict позднее разрешён. Новый READY не объявляется.


### Актуальная source-owned регистрация AD-26 / AD-30

| Контракт | Stories и конкретная проверка |
|---|---|
| Единая scoped IDB v2; AD-26 / CAP-1/8/13 / FR-55–56 / NFR-3/11/13/26 | 10.2–10.3: v1 upgrade сохраняет identity/protocolVersion/counter и abort/blocked/late callbacks; strict durability ordinary writes; scope lock, atomic stage/fence/receipt/pin, no-ABA, conditional cleanup, recovery; Undo/Redo exact owned Revision pointer без overwrite. Corpus и все guards до первой записи. |
| SPEC PPJ / runtime-v1-wire / V1-legacy с witness; AD-30 / CAP-1/10/13 / FR-44/45/57 / NFR-1/12/13/28 | 10.4–10.5: закрытая grammar, raw precedence/single dispatch; PPJ остаётся независимым, V1 exact signed zero/UTF-16/own-undefined и PPJ-disjoint witness. Engineering выполняет worst-case и recovery tests после применимого gate; до замены exporter/acceptance нужны proof и реальные build/file пары. |
| FR-57 ambiguous sole-copy | 10.4–10.5 / 10.15: хранить исходник, проверить старый контекст → upgrade → новый exact export; если конкретный sole-copy path невозможен, отдельное решение Product Owner. Не ждать этого выбора для независимого code path. |

S1 verified; bounded scoped-IDB-v2/session queue — частичный S2 с отдельными
26/26 native и 2072/2072 unit логами, не product entry, полный protocol или
physical PASS. Сохранены account isolation, NFR-28, delivery и retirement gates;
формальный licensing admission не является Alpha gate по решению владельца. Прежняя строка/текст о незарегистрированном AD-30 описывали
исторический снимок; регистрации не равнозначны implementation, verification
или новому readiness verdict.


### Catalog admission — решение владельца 2026-11-04

| Источник / область | Актуальное правило и доказательство |
|---|---|
| AGENTS; PRD FR-28/44; SPEC CAP-6/7/10; AD-14 | Владелец отбирает бесплатные/собственные модели вне продукта. AssetUsageGrant и licensing/provenance/declaration/attribution/notice admission не являются Alpha gate; прежний source conflict разрешён. |
| Stories 10.4–10.5/10.8–10.9; FR-28/44/54; NFR-13/21 | Format/size/hash/security, exact resource pin, BackupFeasibilityPolicy, fencing и запрет Project/file upload остаются обязательными; физические и format evidence оцениваются отдельно. |

Это source-owner решение не доказывает тесты, реальный Telegram, приёмку или READY.


### AD-31 — browser registered storage, 2026-11-05

| Источник / требование | Stories и будущие доказательства |
|---|---|
| CAP-1/8/9/10/13; FR-44/45/47/57/58; NFR-3/10–13/28; AD-4/25/30/31; UXF-8 | 10.4–10.5: отдельное явное действие, trusted browser namespace и общий core; прежние DB/codec/import/export/History сохраняются. Новый storage не использует Telegram identity и не получает данные из файла для выбора owner. |
| FR-45 / SPEC Project & Backup §1.4 / AD-31 | 10.5: новый raw ID ≠ source; предварительная проверка обоих известных stores и atomic no-overwrite в destination. Cross-DB precheck не атомарен; simultaneous/future raw-ID collision остаётся двумя scoped записями без overwrite. |
| FR-2/4/5/38/44/45/54/55/57/58; CAP-1/6/8/9/10/13; AD-4/14/25/31 | 10.5: `(namespace, raw ID)` передаётся во все open/edit/rename/delete, writer/takeover, history, pending/retry, recovery/repair, resources/library/pin, два exports и поздние async; unknown owner даёт отказ/reselection. |
| FR-44/45; NFR-10/13/21; CAP-1/8/10/13; AD-4/30/31 | 10.4–10.5: exact legacy-backup representability и правильный порядок validation/smoke/cancel до IDs/pin/staging; полноценный offline legacy backup каждого healthy нового Project и его последующих edits/history, точные локальные ресурсы owner. |
| FR-45/47/58; NFR-3/11–13; CAP-1/8/9/13; AD-4/25/31 | 10.5: real IDB crash/quota/receipt, first-use/unknown marker/anti-ABA, forced collision, две partial-failure ветви, старые builds/cleanup и неизменный PWA corpus; отдельные startup/update/rollback handshakes. |
| FR-5/45/57; NFR-3/11/13; CAP-1/8/10; AD-4/31 | 10.5: sealed pending reselect только при полном private same-source proof до IDs, без активной publication/history transition; другие результаты сохраняют старый candidate и roots. |
| FR-44/57; NFR-28; CAP-10/13; AD-30/31 | 10.4–10.5/10.15: реальные external file/build pairs и физический iOS/Android roundtrip отдельно от native browser tests; old PWA не видит новый namespace, подтверждённый файл создаёт копию, не sync. |

Эти строки обозначают планируемые проверки. До реализации необходим отдельный
применимый scoped readiness для AD-31; чтобы не включать небезопасный ingress,
полный local corpus и FR-44 proof предъявляются до включения, а не как уже
готовые результаты до начала разработки. Никакой общий release READY,
physical PASS или изменение Alpha licensing policy этим update не заявляется.

## Доводка мобильного редактора, 22 ноября

Этапы, зависимости и связь CAP/FR/NFR/AD с Epic 3/5/8/10 зафиксированы в
[согласованном пакете](sprint-change-proposal-2026-11-22-mobile-editor-finish.md#трассировка-и-подготовка-bmad).
Мобильный срез проверяется отдельно от записи нового угла. Совместимая сборка
для отката и сохранность Portable Backup нужны до активации записи. Проверка
Android и iOS использует тот же архив, что публикация.

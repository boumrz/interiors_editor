---
title: "InteriorsEditor — предварительная проверка implementation readiness"
status: CONCERNS
review_type: unofficial-precheck
official_bmad_gate: not-run
implementation_authorized: false
created: 2026-07-26
updated: 2026-07-26
alpha_scope: "CAP-1–CAP-11; FR-1–FR-47"
alpha_plus_scope: "CAP-12; FR-48–FR-52; does not block Alpha entry"
---

# Предварительная проверка implementation readiness

## 1. Вердикт

**CONCERNS — пакет стратегически связный, но реализация не разрешена.**

Это не официальный результат workflow `bmad-check-implementation-readiness`.
Официальный gate не запускался, потому что утверждённые epics/stories,
результаты обязательных исследований и принятые spike ADR ещё отсутствуют.
Статус этого документа нельзя цитировать как `READY`.

Сильная сторона пакета — уже определены один Alpha JTBD, границы
`CAP-1`–`CAP-11`, 52 функциональных и 26 нефункциональных требований,
touch/offline/error states, архитектурные инварианты и evidence-gated roadmap.
[Матрица трассировки](traceability-matrix.md) не оставляет orphan `CAP`, `FR`
или `NFR` на уровне планирования.

Главная проблема — большинство самых рискованных утверждений пока являются
гипотезами: удобство точного построения на телефоне, детерминированная topology,
mobile storage recovery и performance floor не подтверждены пользователями и
реальными устройствами. Документальная полнота не заменяет эти доказательства.

## 2. Область проверки

Проверены:

- [Product Brief](briefs/brief-InteriorsEditor-2026-07-26/brief.md) и addendum;
- [PRD](prds/prd-InteriorsEditor-2026-07-26/prd.md) и addendum;
- [SPEC](../specs/spec-interiors-editor-alpha/SPEC.md) и все companions;
- [UX DESIGN](ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md) и
  [EXPERIENCE](ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md);
- [Architecture Spine](architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md),
  solution design, domain model, три независимых review и
  [review disposition](architecture/architecture-InteriorsEditor-2026-07-26/reviews/review-disposition.md);
- [market](research/market-landscape-2026-07-26.md),
  [technical](research/technical-feasibility-2026-07-26.md) и
  [agent-system](research/agent-system-and-skills-2026-07-26.md) research;
- [decision register](decision-register.md),
  [roadmap](roadmap-to-alpha.md) и
  [traceability matrix](traceability-matrix.md);
- [project context](../project-context.md) и
  [BMAD integration guide](../../docs/BMAD-INTEGRATION.md).

Проверка относится к planning snapshot 2026-07-26. Она не оценивает код:
application code, package manifest, tests и deployment намеренно отсутствуют.

## 3. Alpha entry и Alpha+ проверяются раздельно

| Контур | Обязателен для первой закрытой Alpha | Что не должно его блокировать |
| --- | --- | --- |
| Alpha entry | `CAP-1`–`CAP-11`, `FR-1`–`FR-47`, применимые `NFR-*`, `V-01`–`V-20` | custom GLB, universal import, cloud, account, multi-level |
| Alpha+ | `CAP-12`, `FR-48`–`FR-52`, `UJ-A1`, `UXF-6`, S-5, `P-01`–`P-03`, `EV-16` | не влияет на разрешение пригласить первых Alpha-тестеров |

`CAP-12` не является blocker Alpha entry, пока:

1. Parametric Placeholder из `FR-32` позволяет пройти representative tasks;
2. исследование H-6 не показывает, что большинству нужен собственный 3D-asset
   до получения базовой ценности;
3. Alpha gate явно помечает `NFR-22` и импорт-специфичные части других NFR как
   `N/A until Alpha+`, а не как незаметно «выполненные»;
4. Portable Backup Alpha не обещает перенос ImportedAsset, которого в этом
   scope ещё нет.

## 4. Инвентаризация артефактов

### 4.1 Существуют

| Артефакт | Текущий статус | Оценка precheck |
| --- | --- | --- |
| BMAD Method `6.10.0`, core + bmm + Codex skills | установлен и описан | process foundation есть |
| Product Brief + addendum | draft | ясное позиционирование; требует owner approval и user evidence |
| Market, technical, agent-system research | research complete на дату среза | достаточная база решений; изменяемые факты перепроверить перед выбором dependencies |
| PRD + addendum | draft | `FR-1`–`FR-52`, `NFR-1`–`NFR-26`, journeys и non-goals заданы |
| SPEC + glossary + geometry/import/performance/project-backup companions | draft / provisional | capability contract есть; geometry, durability, backup и project limits заданы, открытые device/import значения не скрыты |
| UX DESIGN + EXPERIENCE | draft; visual brand partial | flows, modes, states и accessibility заданы; жесты не валидированы |
| Architecture Spine + solution design + domain model | draft | инварианты сильные; renderer/storage/topology choices не подтверждены spikes |
| Три независимых architecture review | `CONCERNS` / `NOT_READY` на исходный draft | findings сохранены как audit trail; ясные противоречия исправлены, spike-зависимые решения остаются открыты |
| Decision register | active | решения имеют IDs и deadlines; `D-011`–`D-020`, `D-041`–`D-050` не утверждены |
| Evidence-gated roadmap | pre-implementation draft | gates G-0…G-9, V-01…V-20 и Alpha+ P-01…P-03 заданы |
| [Vertical implementation plan](../../plans/alpha-implementation-plan.md) | blocked-pre-implementation | acceptance и RED/GREEN/MUTATE/KILL/REFACTOR для будущих срезов заданы; не является BMAD stories |
| [Quality strategy](quality-strategy.md) | draft | claims, evidence layers, corpora, device и Alpha gates заданы |
| [Risk register](risk-register.md) | active | product, geometry, platform, content, agent и delivery risks имеют triggers/owners |
| Traceability matrix | draft | `CAP 12/12`, `FR 52/52`, `NFR 26/26`; фактические evidence пока planned |
| Project context, AGENTS rules, BMAD integration guide | active/draft | однозначно запрещают преждевременный код и задают ownership |

### 4.2 Отсутствуют либо не завершены

| Артефакт / evidence | Почему нужен | Влияние |
| --- | --- | --- |
| Письменное утверждение Product Owner для G-0, `D-011`–`D-020` и `D-041`–`D-050` | превращает assumptions в принятые продуктовые решения | blocker G-1/G-3 |
| Interview/prototype evidence G-1 | проверяет H-1–H-6 и реальную пригодность phone authoring | blocker значительной feature implementation |
| Результаты S-1–S-4 и S-6, corpora, traces и принятые ADR | закрывают renderer, topology, storage, touch и catalog-pipeline risks | blocker зависимых slices |
| Конкретная device matrix и сериализованные RS-1/RS-2/RS-3 | делает NFR измеримыми на реальном floor | blocker G-3/G-8 |
| Финальный architecture re-review после spike ADR | три исходных review и lint уже выполнены; нужен повторный `PASS` по принятому stack | blocker official readiness |
| Owner/reviewer approval quality strategy, risk register и vertical implementation plan | drafts существуют, но ещё не прошли human acceptance и story reconciliation | blocker создания финальных stories |
| BMAD epics и implementation-ready stories | официальный readiness проверяет реализацию требований через stories | blocker official readiness |
| Story-level trace `FR/NFR → acceptance → test/evidence` | текущая матрица заканчивается на roadmap slice | blocker каждого implementation slice |
| Официальный BMAD implementation-readiness report | единственный разрешённый процессом финальный gate | blocker реализации |
| Инициализированный Git repository, branch/worktree и CI policy | нужен безопасный TDD/review workflow | blocker первого production change |
| Каталоговый manifest, provenance/license/AssetUsageGrant register и content gate evidence | Alpha требует законные catalog render, thumbnails, self-contained backup и PNG share | blocker S-6, `V-09`, `V-17` и G-8 |
| Privacy/telemetry decision и текст для тестера | local-first promise нельзя подменять скрытой аналитикой | blocker `V-19`/public Alpha |

Наличие quality/risk/implementation-plan документов само по себе не закрывает
строку: они должны быть проверены, утверждены и согласованы с этой матрицей и
roadmap.

## 5. Blockers

### B-01. Planning package не утверждён владельцем

Brief, PRD, SPEC, UX, Architecture и roadmap остаются draft. До письменного
подтверждения G-0 нельзя считать выбранными Alpha boundary, язык первого теста,
метрики и предлагаемые решения `D-011`–`D-020`, `D-041`–`D-050`.

**Закрытие:** owner approval с явными принятыми/отклонёнными решениями и
обновлением затронутых source-of-truth документов.

### B-02. Не подтверждён основной продуктовый риск

Нет наблюдаемого evidence, что пользователь без CAD-навыков способен на
телефоне точно построить связанные комнаты и получить решение быстрее
приемлемой альтернативы. Market research подтверждает наличие категории, но не
эту гипотезу конкретного продукта.

**Закрытие:** G-1 `PASS`: interviews, representative plans, mobile prototype,
сравнение с конкурентом, результат по H-1–H-6 и минимальная catalog task
matrix.

### B-03. Обязательные технические риски не сняты

`AD-13` остаётся renderer-гипотезой; topology library/kernel, Room
reconciliation, persistence/blob path, gesture thresholds и воспроизводимый
catalog pipeline не выбраны. S-1–S-4 и S-6 не выполнены на реальных
устройствах/контенте.

**Закрытие:** сначала G-2 `PASS` фиксирует неизменяемые spike protocols и
разрешение `READY`/spike-only waiver; затем G-3 `PASS` даёт reproducible
corpora/traces и принятые ADR для renderer, topology, storage/recovery,
interaction model и asset pipeline.

По действующим `AGENTS.md` даже spike-код запрещён до `READY`. Если доказательство
G-2 технически требует executable prototype, Product Owner должен сначала
выдать узкий письменный waiver только на disposable spike с указанными
границами, без превращения его в production foundation.

### B-04. Acceptance floor пока не измерим

Модели iOS/Android, OS/browser/RAM/GPU floor не названы; performance values и
device candidates остаются provisional/TBD. Без этого нельзя проверить
`NFR-5`–`NFR-9`, `NFR-14`–`NFR-16` и обещание «на телефоне».

**Закрытие:** G-3 утверждает device matrix, versioned reference scenes,
финальные budgets/degradation ladder и repeatable measurement protocol.

### B-05. Архитектура не прошла собственный reviewer gate

Architecture Spine имеет status `draft`. Независимые rubric/adversarial/current-
tech reviews и lint выполнены; их clear failures исправлены в контрактах, но
исходные вердикты остаются `CONCERNS`/`NOT_READY`, а spike-зависимый ADR set
отсутствует.

**Закрытие:** после S-1–S-4 и S-6 принять ADR, повторить независимый review и
lint, закрыть disposition и только затем обновить status.

### B-06. Нет BMAD epics/stories

Roadmap и vertical implementation plan определяют результаты, acceptance и
TDD-цикл, но официальный BMAD набор epics/stories и story-level
acceptance/evidence ещё не создан. Наличие `V-*` не доказывает, что каждый
`FR/NFR` будет реализован и проверен внутри конкретной story.

**Закрытие:** утверждённый implementation plan, quality strategy и risk
register → интерактивный `bmad-create-epics-and-stories` → reverse trace без
orphan requirements.

### B-07. Официальный gate не пройден

`bmad-check-implementation-readiness` не запускался и не может вернуть `READY`
до закрытия предыдущих blockers.

**Закрытие:** initial workflow на G-2 разрешает только protocols/spikes через
`READY` либо узкий spike-only waiver; после spike evidence официальный workflow
на G-3 повторно завершён со статусом `READY` для feature implementation.

### B-08. Репозиторий и delivery boundary не подготовлены

Каталог ещё не инициализирован как Git repository; нет зафиксированных
branch/worktree, review и CI правил для первого change.

**Закрытие:** до выхода из G-2 определить и проверить non-destructive Git/CI
protocol. Это не разрешает application code раньше owner approval и `READY`.

## 6. Решения, открытые по gate

| Решение | Severity / дедлайн | Что нельзя делегировать реализации |
| --- | --- | --- |
| Смысл Gridfinity, visual/snap step, numeric off-grid и утверждение endpoint-правила (`D-011`–`D-013`) | **Blocker S-2/V-04** | versioned geometry policy и отображаемая фактическая длина |
| X-intersection, tolerances и Room split/merge identity | **Blocker S-2/V-06** | автоматический split/reject и перенос room metadata |
| Поведение Opening при изменении/развороте Wall | **Blocker V-07** | absolute/relative offset либо atomic reject |
| Minimum device matrix и окончательные budgets | **Blocker G-3/V-18** | поддерживаемый floor и граница degraded/unsupported |
| Renderer binding и storage/blob adapter (`D-021`, `D-023`) | **Blocker зависимых slices** | решение только по одинаковому device evidence |
| Collision tiers (`D-014`) | **Blocker V-11** | что блокирует commit, а что остаётся warning |
| Утверждение backup/project limits, resource pin, SessionRetentionPolicy и exact/atomic resource recovery | **Blocker V-09/V-10/V-14/V-16/V-17** | exportable Project envelope, обе History-ветки как GC roots, explicit history discard, read-only recovery, Trash/permanent delete |
| Catalog task matrix, sourcing и provenance/license owner (`D-016`, `D-050`) | **Blocker S-6/V-09/V-17/G-8** | какие assets легально покрывают in-app render/thumbnails, backup/private 3D transfer и rendered PNG share |
| UI language/geography и desktop fallback | **Should address before V-19** | support promise и исследовательская аудитория |
| Telemetry consent, diagnostics и opt-out (`D-020`) | **Blocker V-19/public Alpha** | допустимый data contract |
| Базовые versus named variants (`D-017`) | **Proposed; owner confirmation G-0** | Alpha содержит independent duplicate; named comparison остаётся позже |
| Door Walk mode (`D-018`) | **Proposed; validate S-4/V-08** | read-only переход не должен быть единственным способом увидеть adjacency |
| GLB limits/allowlist/storage/backup (`D-025`) | **Alpha+ only** | S-5 и `G-A+`; не блокирует Alpha entry |
| Монетизация, cloud, AR/AI, multi-level | **Deferred** | не должны возвращаться скрытым scope Alpha |

## 7. Should-address findings

Эти пункты не дают разрешения обойти blockers, но уменьшают rework:

1. Утвердить visual direction и brand отдельно от interaction UX. Текущий
   нейтральный `DESIGN.md` достаточен для прототипа, но не для финального
   визуального acceptance.
2. Утвердить provisional Project/backup/history limits, minimum wall/opening
   dimensions, resource recovery и Trash/permanent-delete policy.
3. Уточнить microcopy и focus behavior для quota, corrupt backup, context loss,
   missing-resource recovery, unsupported WebGL2 и update mismatch на реальных
   assistive technologies.
4. Определить ownership content pipeline: кто проверяет размеры, optimization,
   лицензию и human-approved AssetUsageGrant: in-app render/thumbnails,
   model+subresources, optimization/transcoding, `.interiors`, private 3D
   transfer, rendered PNG download/share и placement notices.
5. Утвердить baseline и исследовательский протокол для SM-1–SM-6: размер
   выборки, профиль участника, допустимая помощь и способ считать task failure.
6. Зафиксировать, какие части Alpha доступны в 2D при недоступном/потерянном
   WebGL2, чтобы compatibility screen не блокировал backup и диагностику.
7. Перед выбором npm versions повторить актуальность research snapshot и
   закрепить совместимость lockfile только после renderer spike.

## 8. Alignment findings, закрытые в ходе precheck

Следующие обнаруженные расхождения уже устранены в source artifacts и не
считаются открытыми:

- Alpha boundary выровнена: `CAP-1`–`CAP-11` / `FR-1`–`FR-47`; GLB —
  `CAP-12` / `FR-48`–`FR-52` Alpha+;
- basic independent Project duplicate остаётся в Alpha (`FR-3`), расширенные
  named variants — позже;
- UX-flow IDs получили отдельное пространство `UXF-1`–`UXF-6` с явными
  ссылками на PRD `UJ-*`;
- RS-2, startup и frame-time targets в performance companion синхронизированы
  с `NFR-5`–`NFR-7`;
- GLB cameras/lights отклоняются согласно `FR-51`, а не неявно удаляются.
- стены определены centerline-сегментами, usable Room — внутренним offset, а
  высота принадлежит Room как единственному источнику истины;
- сохранение разделено на `Validated`, `PendingDurability` и `Durable`; history
  ограничена сессией, обе ветки являются GC roots, stale writer не может
  публиковать state;
- Portable Backup сделан самодостаточным, несёт license notices и проверяется
  в чистом offline profile; missing resource имеет read-only recovery contract;
- Alpha `UJ-5` оставлен за Parametric Placeholder, импорт вынесен в `UJ-A1`.

## 9. Criteria to reach `READY`

Alpha entry может претендовать на официальный `READY` только когда одновременно
выполнено следующее:

- [ ] G-0: Product Owner утвердил Brief, PRD, SPEC, Alpha boundary, non-goals и
  решения `D-011`–`D-020`, `D-041`–`D-050`.
- [ ] G-1: H-1–H-6 проверены наблюдаемыми пользователями; core phone-authoring
  flow и Parametric Placeholder признаны жизнеспособными.
- [ ] G-2: для S-1–S-4 и S-6 заранее утверждены неизменяемые experiment,
  metrics, pass/pause/kill, ADR output и owners; initial official readiness
  имеет `READY` либо выдан узкий spike-only waiver.
- [ ] G-3: S-1–S-4 и S-6 завершены на real-device/content matrix; приняты ADR,
  corpora и measurement traces; повторный официальный readiness имеет `READY`.
- [ ] Geometry, Room identity, Opening, collision, backup, catalog provenance,
  privacy и device policies имеют однозначные owners и deadlines; нет
  phase-blocker без решения.
- [ ] Performance budgets и RS fixtures согласованы с PRD; все provisional
  correctness values либо утверждены, либо блокируют зависимый slice.
- [ ] Architecture reviewer gate и lint пройдены; Architecture Spine отражает
  принятые ADR и не выдаёт гипотезу за adopted decision.
- [ ] Roadmap, implementation plan, quality strategy и risk register
  согласованы и утверждены.
- [ ] BMAD epics/stories созданы интерактивно; каждый `FR-1`–`FR-47` и
  применимый `NFR` связан с testable acceptance и planned evidence.
- [ ] Reverse coverage на уровне stories равна `FR 47/47`, применимые
  `NFR 100%`; approved `N/A` имеют письменное основание.
- [ ] Официальный `bmad-check-implementation-readiness` завершён статусом
  `READY` без открытого blocker.
- [ ] Git/branch/worktree/CI policy подготовлена, а Product Owner отдельно
  разрешил начать первый production slice.

S-5, `P-01`–`P-03`, `FR-48`–`FR-52` и `EV-16` не входят в этот checklist.
Для CAP-12 позже выполняется отдельный `G-A+` и повторная readiness-проверка
только Alpha+ scope.

## 10. Разрешённый следующий шаг

Разрешено продолжать только product decisions, исследовательский дизайн,
документацию, review и подготовку официальных BMAD workflows. Application code
не начинать. Если для G-1/G-3 нужен executable prototype, сначала требуется
узкий письменный waiver владельца в соответствии с `AGENTS.md`.

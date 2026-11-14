---
title: "InteriorsEditor — adversarial divergence review"
review_type: adversarial-divergence
status: final
created: 2026-07-26
reviewer: independent
verdict: NOT_READY
scope: "Brief, PRD, SPEC companions, UX, Architecture, Roadmap, Plan, Trace, Quality, Risk"
source_mutations: none
---

# Adversarial divergence review

## Verdict

**NOT READY для feature implementation.**

Пакет хорошо определяет направление и честно помечает многие гипотезы, но пока
не является однозначным build contract. Обнаружено 5 critical, 10 high и
6 medium смысловых findings. Главный риск — не механическая трассировка, а
несколько конкурирующих источников физической истины: внутренняя геометрия
комнаты против осей стен, высота Room против высоты Wall, обещанный
`AnchorClass` против неполной модели размещения и domain commit против durable
save.

Mechanical coverage `CAP/FR/NFR` намеренно не повторяется: оно уже проверено в
[traceability matrix](../../../traceability-matrix.md). Этот review атакует
смысл требований, failure semantics, границы Alpha и исполнимость контракта.

Severity:

- **Critical** — два разумных исполнителя построят несовместимые модели либо
  будет нарушена точность/сохранность данных;
- **High** — вероятен крупный rework, ложное продуктовое обещание или
  небезопасный failure path;
- **Medium** — решение можно отложить до названного slice, но нельзя оставить
  реализации на усмотрение.

## Findings

### AR-01 — Critical: внутренняя геометрия Room не определена относительно Wall

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
§5.2 `FR-6` и `FR-13`; [geometry contract](../../../../specs/spec-interiors-editor-alpha/geometry-contract.md),
§2 и §7; [domain model](../domain-model.md), §2 `Vertex`/`WallSegment`.

`FR-6` требует создать комнату по **внутренним** ширине и глубине. Канонический
PlanGraph при этом содержит вершины, сегменты и толщину стены, а Room выводится
из Face. Ни один контракт не говорит, что проходит по сегменту: ось стены,
структурная грань или чистовая внутренняя поверхность.

При стене 100 мм два корректных на вид алгоритма дадут разницу 100 мм в размере
комнаты. На разных толщинах, 45° и стыках расхождение затронет площадь,
периметр, openings, collision и 3D.

**Remediation:** определить каноническую reference line стены, правила
offset/join/miter, смысл «внутреннего размера», площадь/периметр и алгоритм
rectangular starter; добавить числовые golden examples для одинаковых и разных
толщин, углов 90°/45°.

**Owner:** Product Owner + Geometry Architect.

### AR-02 — Critical: высота Wall и ceiling height Room образуют две истины

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
§5.2 `FR-10` и §5.3 `FR-16`; [geometry contract](../../../../specs/spec-interiors-editor-alpha/geometry-contract.md),
§2 и §8; [domain model](../domain-model.md), `WallSegment.heightPolicy` и
`Room.heightMm`.

Пользователь может отдельно изменить высоту Wall и ceiling height Room.
Не определено, что происходит у общей стены двух комнат разной высоты, какой
объект владеет верхом стены, где строится ceiling и как валидировать высокий
Opening.

**Remediation:** выбрать одну авторитетную vertical policy: например,
Room/Level height с явным Wall override и формальным профилем общей стены.
Зафиксировать поведение shared wall, ceiling surface, openings, 3D projection,
undo и migration.

**Owner:** Product Owner + Domain/Geometry Architect.

### AR-03 — Critical: wall/ceiling placement нельзя выразить доменной моделью

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
Glossary `AnchorClass`, `FR-28`, `FR-32`; [domain model](../domain-model.md),
§2 `AssetInstance`; [geometry contract](../../../../specs/spec-interiors-editor-alpha/geometry-contract.md),
§9.

Требования разрешают `floor`, `wall` и `ceiling` assets, включая зеркало,
картину и свет. `AssetInstance` хранит только `levelId`, planar position,
elevation и rotation step. В нём нет host Wall/Room surface, локальных
координат на поверхности, normal/side и rehost policy.

Такую модель нельзя детерминированно сохранить при move/split/delete Wall.
Обычная мировая позиция оставит картину висеть в воздухе или перепривяжет её к
другой стороне стены.

**Remediation:** либо ограничить Alpha floor-only placement и синхронно
изменить PRD/SPEC/catalog, либо добавить anchor-specific placement model:
`hostSurfaceAddress`, локальные `u/v`, normal/side, orientation и атомарные
правила rehost/orphan.

**Owner:** Product Owner + Domain Architect + UX.

### AR-04 — Critical: «точная» длина 45° математически не исполнима как записано

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-7`, `FR-8`, `FR-13`; [geometry contract](../../../../specs/spec-interiors-editor-alpha/geometry-contract.md),
§1 и §4; [PRD addendum](../../../prds/prd-InteriorsEditor-2026-07-26/addendum.md),
§Provisional Numeric Policies.

При 45° и integer-mm endpoints должно выполняться `Δx = Δz = n`, а длина
равна `n√2`. Почти ни одна введённая пользователем целая длина в мм не может
быть одновременно точной длиной сегмента и дать целые endpoints. Сейчас
контракт обещает exact numeric length, а правило округления оставляет открытым.

**Remediation:** назвать авторитетную величину: endpoint delta, проекция на ось
или фактическая евклидова длина. Для недостижимого значения определить preview,
округление, показ фактической длины и возможность отмены. Добавить boundary
examples, включая `1000 мм`.

**Owner:** Product Owner + Geometry Architect + UX.

### AR-05 — Critical: `Committed Command` не равен однозначно durable Revision

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
Glossary и `FR-5`; [Architecture Spine](../ARCHITECTURE-SPINE.md), `AD-3`;
[solution design](../solution-design.md), §3; [domain model](../domain-model.md),
§7.

`Committed Command` определяется как валидное доменное изменение, `FR-5`
обещает сохранять каждое такое изменение. Solution design допускает состояние
`saving` и отказ persistence после появления целой Revision. Не сказано,
считается ли эта Revision committed, можно ли продолжать новые команды и что
восстановится после kill до retry.

**Remediation:** формализовать state machine
`Draft → Validated → PendingDurability → Durable/Failed`, точку публикации
projection/history, правила очереди, retry/backup и поведение новых команд при
ошибке. Термин `Committed` должен иметь одно значение во всех документах.

**Owner:** Application/Persistence Architect + Product Owner.

### AR-06 — High: у Project нет hard limits

**Evidence:** [performance budgets](../../../../specs/spec-interiors-editor-alpha/performance-budgets.md),
§2 `RS-3`; [geometry contract](../../../../specs/spec-interiors-editor-alpha/geometry-contract.md),
§3 и §11; [domain model](../domain-model.md), `ProjectLimitPolicy`; [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`NFR-6`.

`RS-3` отсылает к «согласованному hard limit», но чисел для координат, стен,
rooms, openings, instances, unique assets и материалов нет. `NFR-6` описывает
reference scene, а не максимально допустимый Project.

**Remediation:** создать versioned Project Limits contract с warning/hard
границами, decoded cost и отказом для UI/backup import. Ограничения должны быть
проверены на floor devices и мигрируемы.

**Owner:** Product Owner + Performance Architect + Security.

### AR-07 — High: Portable Backup не гарантирует заявленную переносимость

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
Glossary, `FR-44`, `FR-45`; [domain model](../domain-model.md),
`AssetDefinitionRef`; [solution design](../solution-design.md), §7–§9.

Project хранит ссылку на `CatalogVersion`, а каталоговые binaries/material
resources живут отдельно на CDN/cache. Backup назван достаточным для
восстановления, но не определено, что произойдёт после удаления старого
catalog manifest или resource с origin.

**Remediation:** выбрать одно: self-contained resource bundle; долговременная
retention гарантия всех referenced catalog versions; либо честный
semantic-only backup с manifest completeness и обязательным degraded restore.
Нужен тест восстановления после недоступности исходного catalog version.

**Owner:** Architecture + Content Pipeline Owner + Product Owner.

### AR-08 — High: multi-tab local concurrency имеет domain error, но не UX

**Evidence:** [domain model](../domain-model.md), §5 `baseRevisionId`;
[EXPERIENCE](../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md),
§8–§9; [solution design](../solution-design.md), §6–§7.

Domain отклоняет stale revision либо допускает явный safe rebase. Однако один
пользователь может открыть Project в browser tab и standalone PWA
одновременно; UX не содержит conflict/stale-project state и нет single-writer
protocol.

**Remediation:** принять exclusive edit lock, view-only secondary instance или
явный conflict-copy flow; определить BroadcastChannel/storage events,
foreground takeover, stale command reason code и recovery copy.

**Owner:** Application/Persistence Architect + UX.

### AR-09 — High: wall-side finish identity не переживает topology по контракту

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-35`, `NFR-4`; [geometry contract](../../../../specs/spec-interiors-editor-alpha/geometry-contract.md),
§5–§8; [domain model](../domain-model.md), `SurfaceAddress`;
[implementation plan](../../../../../plans/alpha-implementation-plan.md),
`V-12`.

Две стороны shared Wall могут иметь разные finishes, а topology может
split/merge/reverse Wall. `SurfaceAddress` перечислен, но не определён. Поэтому
материал может поменяться сторонами, исчезнуть или перейти на другой segment.
План обещает side-address tests до появления самой семантики адреса.

**Remediation:** адресовать сторону через устойчивый half-edge/adjacent Room и
формально определить перенос assignments при reverse, split, merge и удалении
Room. Добавить golden cases до `V-12`.

**Owner:** Geometry/Domain Architect + UX.

### AR-10 — High: PRD UJ-5 смешивает Alpha entry и Alpha+

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
§3 `UJ-5`; [SPEC](../../../../specs/spec-interiors-editor-alpha/SPEC.md),
§Success signal; [roadmap](../../../roadmap-to-alpha.md), `R-7`, `G-8`,
`V-20`; [EXPERIENCE](../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md),
`UXF-3` и `UXF-6`.

Один PRD journey содержит entry-ветку с Parametric Placeholder и Alpha+-ветку
GLB. При этом Alpha gate требует `UJ-1–UJ-5`. Два тестировщика могут законно
считать UJ-5 пройденным по разным веткам.

**Remediation:** разделить на стабильные ID, например `UJ-5E` и `UJ-A1`, либо
определить обязательный entry scenario отдельным acceptance artifact. Обновить
SPEC success signal, V-20, Quality и Trace.

**Owner:** Product Manager / SDD artifact owner.

### AR-11 — High: обещана проверка прохода без требования измерять проход

**Evidence:** [Brief](../../../briefs/brief-InteriorsEditor-2026-07-26/brief.md),
Problem/Core JTBD; [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`UJ-1`, `FR-13`, `FR-31`; [market research](../../../research/market-landscape-2026-07-26.md),
§10.2.

Продукт обещает понять, «остаётся ли проход». `FR-31` показывает пересечение
footprint и заранее заданных clearance zones, а `FR-13` измеряет стены/Room.
Измерение расстояния между предметами и ширины прохода оставлено в SHOULD.
Collision warning не доказывает проходимость и легко воспринимается как норма.

**Remediation:** либо добавить Alpha requirement для точного расстояния/ширины
с явно ненормативной семантикой, либо сузить Brief/PRD до визуальной проверки
пересечений и габаритов.

**Owner:** Product Owner + UX.

### AR-12 — High: «Never lose the project» превышает гарантии browser storage

**Evidence:** [Brief](../../../briefs/brief-InteriorsEditor-2026-07-26/brief.md),
Product Principles; [SPEC](../../../../specs/spec-interiors-editor-alpha/SPEC.md),
`CAP-1`; [solution design](../solution-design.md), §7; [risk register](../../../risk-register.md),
`R-016`.

Документы правильно признают eviction и обязательность backup, но верхний
product promise читается как абсолютная гарантия. Приложение не контролирует
очистку site data, OS eviction, удаление browser profile или потерю устройства.

**Remediation:** ограничить обещание last committed Revision при сохранности
origin storage; показать storage durability status, backup reminder и точные
исключения до начала работы. Не использовать абсолютное «никогда» вне
проверяемой fault matrix.

**Owner:** Product Owner + UX + Persistence Owner.

### AR-13 — High: Portable Backup import не имеет собственного resource contract

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-45`; [solution design](../solution-design.md), §10–§11;
[quality strategy](../../../quality-strategy.md), §7.

Malformed/oversized backup признан угрозой и тестовым случаем, но нет контракта
на file bytes, decoded bytes, nesting, entity counts, blobs, timeout,
cancellation и worker/main-thread boundary. GLB защищён отдельным companion,
а обязательный Alpha import — нет.

**Remediation:** создать Portable Backup contract с schema, limits, staging,
checksums, cancellation/progress, zip/decode policy и stable errors. Связать с
Project Limits из AR-06.

**Owner:** Security + Persistence Architect.

### AR-14 — High: roadmap разрешает начать catalog до завершения planning core

**Evidence:** [roadmap](../../../roadmap-to-alpha.md), `G-6` entry и таблица
`V-09`; [implementation plan](../../../../../plans/alpha-implementation-plan.md),
§Порядок и зависимости и `V-09`.

`G-6` требует `G-5 = PASS`, а диаграмма ставит `V-04…V-08` до interior loop.
Однако явные dependencies `V-09` содержат только S-1/S-4/S-6 и `V-03`.
Автоматический или буквальный планировщик может начать catalog/placement до
Rooms/Openings/Walk и проверить его на неверной spatial model.

**Remediation:** добавить `V-08`/`G-5 PASS` как dependency либо явно описать
разрешённый параллельный floor-only prototype и запрет считать его production
`V-09`.

**Owner:** Roadmap/Planning Owner.

### AR-15 — High: `FR-24` обещает движение, а V-08 поставляет teleport

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-24`; [EXPERIENCE](../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md),
§5.3 и §6; [implementation plan](../../../../../plans/alpha-implementation-plan.md),
`V-08`.

`FR-24` говорит, что пользователь может перемещаться в допустимом пространстве.
`V-08` помечает этот FR закрытым минимальным room-to-room transition и прямо
исключает free-roam physics. Door teleport полезен, но не равен перемещению по
комнате.

**Remediation:** либо переписать `FR-24` как inspect/door-transition mode, либо
добавить отдельный slice для ограниченного local movement, camera height,
wall/item collision, reset и input semantics.

**Owner:** Product Manager + UX.

### AR-16 — Medium: нет состояния «asset готов офлайн»

**Evidence:** [SPEC](../../../../specs/spec-interiors-editor-alpha/SPEC.md),
`CAP-6`, `CAP-7`, `CAP-9`; [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-37`; [solution design](../solution-design.md), §8–§9;
[implementation plan](../../../../../plans/alpha-implementation-plan.md),
`S-6`, `V-09`, `V-12`.

Документы используют «уже использованный», «предварительно загруженный» и
«materialized» asset, но не определяют момент offline guarantee. Item metadata
может быть committed до durable cache его mesh/texture, после чего offline
проект внезапно показывает placeholder.

**Remediation:** ввести resource state machine
`metadata-ready → loading → cached/offline-ready → missing/stale/failed`,
индикатор в UI и правило, блокирует ли placement commit отсутствие ресурса.

**Owner:** Catalog/PWA Architect + UX.

### AR-17 — Medium: history boundary после reopen не определена

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-38`; [SPEC](../../../../specs/spec-interiors-editor-alpha/SPEC.md),
`CAP-8`; [solution design](../solution-design.md), §6–§7;
[domain model](../domain-model.md), §7.

History существует отдельно от ProjectState и отсутствует в предложенной
persistence schema. Не сказано, сохраняется ли undo/redo после ordinary
close/reopen, входит ли оно в backup и где именно проходит boundary после
recovery, migration и import.

**Remediation:** определить lifecycle матрицу history для reload, kill,
duplicate, migration, backup import и app update; показывать boundary в UI и
закрепить retention policy.

**Owner:** Product Owner + Application/Persistence Architect.

### AR-18 — Medium: `free contour` появился в UX без requirement и slice

**Evidence:** [EXPERIENCE](../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md),
`UXF-1` и §8; [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-6`, `FR-7`; [roadmap](../../../roadmap-to-alpha.md), `V-02`, `V-04`.

Первый экран предлагает прямоугольник или «свободный контур». PRD и roadmap
описывают rectangular starter, затем constrained wall-by-wall editing.
Формулировка может обещать arbitrary/freehand polygon и открыть flow до того,
как topology slice существует.

**Remediation:** переименовать в «строить стенами 0°/45°/90°» и включать после
`V-04`, либо создать отдельный requirement с точной constraint semantics.

**Owner:** UX + Product Manager.

### AR-19 — Medium: `NFR-22` одновременно обязателен и не применим к Alpha

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`NFR-22`, §7.1/7.2; [quality strategy](../../../quality-strategy.md), §1 и
Alpha gate; [roadmap](../../../roadmap-to-alpha.md), `G-8`, `V-20`;
[traceability matrix](../../../traceability-matrix.md), CAP-12/NFR coverage.

`NFR-22` описывает только untrusted GLB, но Quality и V-20 говорят о
`NFR-1–NFR-26` для Alpha entry. Precheck предлагает `N/A`, однако canonical PRD
не содержит applicability metadata.

**Remediation:** ввести applicability table или переименовать в
`NFR-A+-22`; Alpha gate должен считать его `not applicable by scope`, а не
«выполненным исключением».

**Owner:** Product Manager + QA/Trace Owner.

### AR-20 — Medium: delete acceptance допускает две несовместимые политики

**Evidence:** [PRD](../../../prds/prd-InteriorsEditor-2026-07-26/prd.md),
`FR-4`; [implementation plan](../../../../../plans/alpha-implementation-plan.md),
`V-14`; [domain model](../domain-model.md), §4.

И requirement, и slice оставляют выбор: необратимое удаление **либо** undo.
Acceptance, принимающий оба результата, не является контрактом; особенно при
shared asset blobs и обещании data ownership.

**Remediation:** до stories выбрать trash/undo window или irreversible delete,
определить retention, last-reference cleanup, crash during delete и связь с
Portable Backup.

**Owner:** Product Owner + Persistence Architect.

### AR-21 — Medium: статусы `AD-*` используются непоследовательно

**Evidence:** [Architecture Spine](../ARCHITECTURE-SPINE.md), `AD-1`–`AD-14`;
[roadmap](../../../roadmap-to-alpha.md), S-1/S-6 и capability map;
[traceability matrix](../../../traceability-matrix.md), Architecture coverage.

Часть решений помечена `[ADOPTED]`, `AD-13` названа гипотезой, а `AD-9` и
`AD-14` не имеют явного статуса. При этом downstream artifacts используют их
как governing decisions. Stable ID не отвечает, можно ли уже строить story на
этом правиле.

**Remediation:** каждому `AD-*` дать machine-readable status
`proposed/adopted/superseded/deferred`, evidence/decision owner и gate.
Downstream trace должен ссылаться на proposed AD как dependency, а не как
закрытую архитектуру.

**Owner:** Architecture Owner.

## Remediation order

1. До topology/renderer stories закрыть AR-01–AR-05; решения должны попасть в
   PRD/SPEC companions/Architecture, а не только в review response.
2. До G-2 readiness утвердить contracts и owners для AR-06–AR-15 либо
   превратить их в заранее ограниченные spike questions с falsifiable exit.
3. До соответствующих slices закрыть AR-16–AR-21; Medium finding без owner и
   срока становится High.
4. После изменений повторить PRD → SPEC → Architecture → roadmap/plan/trace
   reconciliation и официальный readiness.

**Release/readiness recommendation:** сохранить пакет как сильный strategic
draft, но не повышать Architecture Spine до final и не создавать feature code.
Допустимы product decisions, contracts, user research и заранее разрешённые
disposable spikes.

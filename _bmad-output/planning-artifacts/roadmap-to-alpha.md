---
document_title: "InteriorsEditor — roadmap до самостоятельно полезной Alpha"
status: draft
created: 2026-07-26
updated: 2026-11-22
owner: Roman
planning_model: evidence-gated
calendar_commitments: none
alpha_scope:
  - CAP-1
  - CAP-2
  - CAP-3
  - CAP-4
  - CAP-5
  - CAP-6
  - CAP-7
  - CAP-8
  - CAP-9
  - CAP-10
  - CAP-11
alpha_plus_scope:
  - CAP-12
sources:
  - ../specs/spec-interiors-editor-alpha/SPEC.md
  - prds/prd-InteriorsEditor-2026-07-26/prd.md
  - architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - research/market-landscape-2026-07-26.md
  - research/technical-feasibility-2026-07-26.md
implementation_plan: ../../plans/alpha-implementation-plan.md
---

<!-- markdownlint-disable MD013 MD036 -->

# Roadmap до самостоятельно полезной Alpha

**Обычная сборка Telegram, 22 ноября 2026.** CAP-13 → FR-55–58, FR-61 → NFR-21/28/29 → AD-26/28/34 → истории 10.2, 10.3, 10.5, 10.14, 10.15 и 10.18. Проверяются новая редакция, отключение общего подсчёта до входа и в настройках, отдельное разрешение повторных входов на устройстве, два суточных итога и блокировка прежних маршрутов при переключении и откате. Публичная активация требует фактов о действующей инфраструктуре и физической приёмки. [Условия выпуска](sprint-change-proposal-2026-11-22-public-candidate.md)

> **Актуализация 2026-11-04:** старый Web/PWA Alpha реализован и его итоговый
> исторический readiness `READY` от 2026-08-30 относится только к прежнему
> scope. Telegram extension находится в S0 и требует утверждённого planning
> package и свежего применимого READY либо письменного waiver. Разделы ниже —
> исторические записи своего времени; актуальные S0–S7 и решение владельца о
> catalog admission представлены в конце документа. История не переписывается.

## 1. Назначение

Этот roadmap отвечает не на вопрос «к какой дате выпустить приложение», а на
вопрос «какие доказательства должны последовательно снизить продуктовый,
геометрический, платформенный и UX-риск». Переход между этапами происходит
только по evidence gate. Сам факт написания кода, количество экранов или число
моделей в каталоге не считается прогрессом, если пользователь ещё не может
принять решение о своей планировке.

Целевой результат Alpha:

> Приглашённый пользователь без CAD-навыков самостоятельно строит на телефоне
> точный план одного уровня с несколькими связанными комнатами, расставляет
> предметы реального размера, меняет допустимые варианты предметов, проверяет результат в 3D,
> закрывает приложение и восстанавливает ту же согласованную ревизию офлайн.

Alpha включает `CAP-1`–`CAP-11`, active `FR-1`–`FR-47` (кроме retired
`FR-3`, `FR-20`, `FR-24`, `FR-34`–`FR-37` и `FR-46`) и `FR-54`. Ограниченный
пользовательский GLB (`CAP-12`, `FR-48`–`FR-52`) относится к Alpha+ и не
блокирует приглашение первых тестировщиков, пока Product Owner явно не изменит
границу.

### Approved scope correction — 2026-08-25

Лицензирование не входит ни в один Alpha-срез. `AssetUsageGrant`,
`assetUsageDeclaration`, legal/provenance admission, attribution, notice,
license ledger и rendered-output rights-check удалены как feature, gate и
evidence. Владелец подготавливает бесплатные либо созданные им модели вне
приложения. Сохраняются только технические проверки формата/размера/hash,
точный pin, `BackupFeasibilityPolicy`, recovery и self-contained backup.
Более ранние упоминания этих лицензионных артефактов ниже являются
историческим checkpoint и не задают текущую работу.

## 2. Неподвижные правила roadmap

1. До утверждения planning package и результата официального BMAD
   implementation-readiness `READY` код приложения не создаётся.
2. Каноническая геометрия хранится как planar graph в целых миллиметрах; 3D
   остаётся производной проекцией.
3. Каждый будущий implementation slice имеет одного writer, один наблюдаемый
   результат и отдельное подтверждение критериев владельцем продукта.
   **Актуальная поправка владельца 2026-11-04:** в разрешённом scope выполнять
   последовательные срезы без остановки для отдельного подтверждения каждого;
   результаты и проверки сохраняются, отдельные physical, release и retirement
   решения и ранее установленные safety gates не отменяются.
4. Риск проверяется до масштабирования зависимой от него функции: topology до
   сложного UI, storage lifecycle до обещания offline, renderer до каталога.
5. Прототип spike не становится production foundation автоматически. Его
   результат — измерения, corpus и ADR; production path создаётся отдельным
   TDD-срезом.
6. На реальном устройстве снижается визуальное качество, но не точность,
   история или сохранность проекта.
7. Account, cloud sync и remote Project/Revision/History/Portable Backup
   backend не создаются «на будущее» в рамках Alpha. Единственное ограниченное
   исключение — Kotlin/PostgreSQL Catalog Control Plane по `FR-54`/`AD-17`;
   оно публикует технические catalog metadata/resources и hashes, не принимает user Project data и требует
   отдельный `G-CP-ADR` до своего implementation slice.

## 3. Как принимаются решения

### 3.1 Допустимые основания

Решение меняет статус с `ASSUMPTION` на принятое только при наличии хотя бы
одного достаточного основания:

- явное решение Product Owner;
- наблюдаемое пользовательское исследование;
- воспроизводимый spike на согласованных реальных устройствах;
- применимое продуктовое или техническое ограничение с проверяемым источником.

### 3.2 Статусы gate

| Статус | Смысл |
| --- | --- |
| `NOT ENTERED` | входные условия ещё не выполнены |
| `IN EVIDENCE` | собираются заранее определённые доказательства |
| `PASS` | все обязательные exit criteria выполнены |
| `PAUSED` | доказательств недостаточно или обнаружен устранимый blocker |
| `KILLED/PIVOTED` | проверяемый подход отвергнут; продолжение возможно только по новой гипотезе |

`PAUSED` не заменяется оптимистичным обещанием «исправить позже». Решение о
`KILLED/PIVOTED` относится к продукту, capability либо техническому пути, а не
обязательно ко всему проекту.

## 4. Карта результатов

| Результат | Пользовательское доказательство | Основной scope |
| --- | --- | --- |
| R-0. Утверждённое видение | владелец подтверждает пользователя, JTBD, Alpha boundary и non-goals | Brief, PRD, SPEC |
| R-1. Сняты критические неизвестные | рискованные гипотезы имеют interview/prototype/device evidence | H-1–H-6, S-1–S-4 + S-6 |
| R-2. Build-ready пакет | для production — финальный BMAD `READY`; `W-SPK-2026-08-04` допускает только isolated S-1/S-2/S-3/S-4/S-6 evidence и не заменяет readiness | все Alpha requirements |
| R-3. Полезная комната | пользователь создаёт точную комнату, видит её в 3D и возвращается к ней | CAP-1, CAP-2, CAP-5, CAP-8 |
| R-4. Полезный план квартиры | несколько комнат и проёмы согласованы | CAP-2–CAP-5, CAP-8 |
| R-5. Проверяемый интерьер | предметы и их допустимые варианты позволяют принять решение о размещении, а versioned catalog не получает Project data | CAP-6, CAP-7, CAP-11, FR-54 |
| R-6. Надёжная мобильная PWA | проект переживает offline, kill, update и перенос в обычном phone-first редакторе | CAP-1, CAP-5, CAP-9, CAP-10, CAP-11 |
| R-7. Alpha candidate | UJ-1–UJ-6 проходят на device matrix в бюджетах | CAP-1–CAP-11 |
| R-8. Закрытая Alpha | независимые участники завершают core task и дают evidence для следующей итерации | продуктовые SM-1–SM-6 |
| R-9. Проверенный custom import | self-contained GLB проходит preflight, commit, reuse и backup; расширение на FBX/ZIP с текстурами возможно только через отдельно принятый scope-change и тот же bounded GLB route | CAP-12; proposed `IMP-*` |

Номера результатов задают зависимости, а не календарную последовательность.
Независимое discovery может идти параллельно, но зависимый gate не обходится.

## 5. Evidence gates

### G-0. Product framing

**Вход**

- доступны product brief, market research, PRD, SPEC и список допущений;
- Product Owner готов принять или отклонить границу Alpha.

**Работа и evidence**

- подтвердить primary user и основной JTBD;
- явно определить, что «гридфинити» означает constraint/infinite editor grid;
- подтвердить `CAP-1`–`CAP-11` как Alpha, `CAP-12` как Alpha+;
- согласовать non-goals, язык/географию первого теста и provisional metrics;
- выбрать, какие решения остаются hypothesis до исследования.

**Exit**

- нет неявного расхождения Brief ↔ PRD ↔ SPEC по Alpha boundary;
- каждое открытое решение имеет owner, evidence method и gate;
- Product Owner письменно подтверждает R-0.

**Pause**

- не определён primary user или пользовательская работа;
- Gridfinity понимается сторонами по-разному;
- GLB, cloud, scan или photorealism одновременно объявлены обязательными без
  изменения PRD/SPEC.

**Kill/pivot**

- владелец решает, что продукт должен быть desktop CAD, профессиональным BIM
  или AI-визуализатором: текущий roadmap закрывается и создаётся новый;
- базовая ценность больше не связана с точным phone-first planning.

### G-1. Problem and interaction evidence

**Вход**

- G-0 = `PASS`;
- подготовлены сценарии UJ-1–UJ-6 и критерии исследования.

**Работа и evidence**

- problem interviews с людьми, планировавшими ремонт/переезд/крупную покупку;
- разбор реальных планов: ортогонального, диагонального и многокомнатного;
- mobile interaction prototype для стены, размера, двери, предмета, undo;
- сравнительное наблюдение с доступным мобильным конкурентом;
- фиксация evidence за/против H-1–H-6 без превращения мнения в requirement.

**Exit**

- пользователь понимает точный ручной ввод и получает полезный результат без
  CAD-обучения;
- constraint 0°/45°/90° не блокирует representative plans;
- Parametric Placeholder способен заменить custom import для core task;
- выбран gesture contract-кандидат и известны основные ошибки;
- сформулирован минимальный catalog task matrix.

**Pause**

- участники не могут закончить paper/prototype flow без подсказки;
- реальным планам регулярно нужны произвольные углы, кривые или несколько
  уровней;
- сравнение вариантов, collision или Door-as-navigation остаются неоднозначны.

**Kill/pivot**

- большинство целевых пользователей отказывается начинать без scan/import
  исходного плана, а manual authoring не даёт более быстрого решения;
- phone authoring устойчиво хуже приемлемой альтернативы и numeric controls не
  устраняют проблему;
- core task не приводит к конкретному решению о планировке.

### G-2. Spike protocols and preliminary readiness

**Вход**

- G-1 дал жизнеспособную модель взаимодействия;
- утверждена provisional reference-device matrix и reference scenes;
- доступны draft PRD, UX, SPEC и Architecture Spine.

**Работа и evidence**

- без application code определить одинаковые входы, corpus, измерения,
  pass/pause/kill и ADR output для S-1–S-4 и S-6;
- выполнить reconciliation `CAP-* ↔ FR-* ↔ NFR-* ↔ AD-*`;
- определить test, migration, device, asset и privacy evidence;
- зафиксировать отдельный `G-WEB-AD16`: exact React/TypeScript/Rspack/CSS
  Modules/Rstest/Playwright boundary, one JS lockfile и named future
  `WEB-BOOTSTRAP-01`; Kotlin/PostgreSQL decisions остаются вне этого gate;
- создать BMAD epics/stories из утверждённых вертикальных срезов;
- провести независимый adversarial review;
- запустить официальный BMAD implementation-readiness workflow.

**Exit**

- каждый spike имеет заранее заданный experiment и не может выбрать удобную
  метрику постфактум;
- нет orphan requirements, conflicting units или неучтённого phase blocker;
- для каждого будущего slice определены acceptance, dependency и owner;
- readiness дал `READY` для production path, **либо** Product Owner оформил
  узкий письменный **spike-only waiver** только для выполнения S-1–S-4 и S-6;
  второй путь не открывает bootstrap или `V-*`;
- `G-WEB-AD16` документирован до V-01, но его runtime evidence честно остаётся
  `NOT EXECUTED` до final `READY` и разрешённого web scaffold;
- создан Git/worktree/branch protocol, но application code ещё отсутствует.

**Pause**

- readiness = `CONCERNS`/`NOT READY` и письменного spike-only waiver нет;
- отсутствует трассировка requirement → slice → evidence;
- недоступны реальные устройства или representative fixtures;
- Product Owner не подтвердил acceptance и privacy/telemetry policy.

**Kill/pivot**

- независимый review показывает, что scope не проверяет утверждённый JTBD;
- spike нельзя сформулировать как ограниченный проверяемый вопрос: сначала
  уменьшается неопределённость или меняется product boundary.

### G-3. Technical risk retirement and final SDD readiness

**Вход**

- G-2 = `PASS`;
- для executable spike действует `READY` либо письменный spike-only waiver;
  waiver даёт только evidence path и не открывает bootstrap/`V-*`;
- доступны реальные устройства, corpus и одинаковый measurement protocol.

**Работа и evidence**

- выполнить S-1 Renderer, S-2 Topology, S-3 Storage/PWA, S-4 Touch и
  S-6 Asset catalog pipeline;
- сформировать ADR, corpus, raw measurements и rejected alternatives;
- проверить технический pipeline representative catalog set: format/size/hash,
  exact pin и backup feasibility;
- выбрать minimum device floor и уточнить performance budgets;
- обновить PRD/SPEC/Architecture/roadmap реальными решениями;
- повторно провести reconciliation и официальный BMAD readiness.

**Exit**

- S-1–S-4 и S-6 = `PASS`;
- renderer, topology, persistence, gesture path и asset catalog pipeline имеют
  принятые ADR/evidence;
- выбран реальный minimum device floor;
- зафиксированы schema/resource-recovery/history-GC boundary и техническая
  catalog policy для exact bytes/hashes;
- все provisional значения, влияющие на correctness, утверждены или явно
  блокируют конкретный slice;
- readiness = `READY`;
- spike-only waiver прекращает действие и не разрешает feature code сам по
  себе.

**Pause**

- spike работает только на desktop/emulation;
- topology даёт недетерминированные комнаты либо дрейф мм;
- iOS или Android теряет последнюю `Durable Revision` при kill/update;
- renderer держит budget только за счёт изменения domain semantics;
- каталог не имеет воспроизводимого technical pin/backup gate;
- final readiness = `CONCERNS`/`NOT READY`.

**Kill/pivot**

- WebGL2 не позволяет выполнить core scene на разумном device floor даже после
  согласованной деградации;
- browser storage не обеспечивает восстанавливаемое локальное ядро, а
  обязательный remote user-data backend разрушает утверждённый value proposition;
- constrained topology нельзя сделать детерминированной в заданном scope;
- стоимость устранения риска требует другой product boundary: сначала
  обновляются Brief/PRD/SPEC, затем G-2/G-3 запускаются заново.

### G-4. Walking skeleton — одна полезная комната

**Вход**

- G-3 = `PASS`;
- S-1–S-4 и S-6 ADR/evidence доступны implementation owner.

**Срезы**

- V-01: локальный Project создаётся, именуется, открывается и восстанавливается;
- V-02: точная прямоугольная Room, измерения и безопасная history;
- V-03: та же Revision доступна в согласованном 2D/3D.

**Exit**

- новый пользователь создаёт комнату в мм, видит её в 3D, закрывает и открывает
  без semantic drift;
- failed command и abrupt close не повреждают last valid revision;
- доменные проверки работают без DOM/GPU.

**Pause**

- вертикальный path обходит Command/Revision или пишет renderer state;
- save/reopen меняет размер хотя бы на 1 мм;
- 3D требует неподдерживаемого baseline.

**Kill/pivot**

- walking skeleton не выполняется на выбранном телефоне в согласованном UX и
  performance envelope; пересматривается renderer/device/scope, а не строятся
  следующие функции поверх него.

### G-5. Planning core — связанная квартира

**Вход**

- G-4 = `PASS`;
- topology corpus покрывает T/X intersections, diagonal и room split/merge.

**Срезы**

- V-04: constrained topology editing;
- V-05: безопасное изменение и нормализация topology;
- V-06: derived Rooms и параметры;
- V-07: двери, окна и wall-hosted Opening;

**Exit**

- пользователь строит две и более комнаты со стеной 45°;
- комнаты предсказуемо переживают локальную правку; valid AddWall split
  сохраняет exact predecessor `heightMm` у каждого successor без второго
  metadata-диалога;
- Opening остаётся валидным или команда атомарно отклоняется;
- 2D и 3D показывают согласованные Room и wall-hosted Opening без navigation
  edge или transition.

**Pause**

- valid AddWall split открывает выбор левой/правой metadata Room либо меняет
  predecessor `heightMm`; merge или host consequence переносит данные молча;
- touch и numeric input дают разные topology;
- undo не восстанавливает полную связность.

**Kill/pivot**

- approved representative plans не укладываются в constrained model;
- алгоритм room identity остаётся недетерминированным после S-2 и ограниченного
  scope reduction.

### G-6. Interior decision loop

**Вход**

- G-5 = `PASS`;
- S-6 = `PASS`;
- `G-CP-ADR = PASS` до `V-09-CP`;
- representative catalog matrix, technical pin/backup path, cache tiers и
  runtime budgets утверждены.

**Срезы**

- V-09: найти и разместить первый предмет реального размера;
- V-09-CP: Kotlin/PostgreSQL Catalog Control Plane публикует/отдаёт versioned
  catalog metadata/resources и hashes по AD-17 без remote Project ownership;
- V-10: точно изменить, дублировать и отменить размещение;
- V-11: увидеть collision/clearance и использовать
  Parametric Placeholder;
- V-12: применить разрешённый цвет/вариант предмета.

**Exit**

- пользователь отвечает на вопрос «помещается ли предмет и остаётся ли проход»;
- Durable placement имеет pinned backup-ready resource; неожиданно missing
  resource существующего Project включает read-only recovery с exact repair,
  полным RecoveryChangeSet либо explicit history discard только для
  history-only scope;
- catalog resources имеют технически проверенные exact bytes и
  детерминированный offline fallback;
- service outage даёт только non-blocking browse/unpinned-download state;
  fully pinned local Project не становится read-only и не теряет local
  open/edit/Durable save/undo-redo/Portable Backup;
- warning не выдаётся за проверку строительных норм.

**Pause**

- catalog first-load или память нарушают budgets;
- без custom GLB невозможно пройти большинство representative tasks;
- collision policy заставляет пользователя бороться с ложными блокировками.

**Kill/pivot**

- generic catalog + Parametric Placeholder не дают практического решения;
- невозможность подготовить технически пригодный минимальный набор в заданных
  budgets требует пересмотра catalog scope и sourcing до продолжения.

### G-7. Ownership, offline and portability

**Вход**

- G-4–G-6 = `PASS`;
- migration fixtures и lifecycle fault scenarios утверждены.

**Срезы**

- V-14: явное удаление и recovery boundary;
- V-15: installable PWA и airplane-mode edit;
- V-16: storage health, missing-resource recovery и safe update;
- V-16-RC-current: подтверждённый deletion-only RecoveryChangeSet для current
  V1 Project; history/`Both`, shared-store lease, semantic GLB validation и
  Portable Backup остаются отдельными следующими срезами;
- V-17: portable backup roundtrip.

**Exit**

- один fixture переживает save → kill → offline reopen → update → backup
  export/import без semantic drift;
- quota/migration/update failure не перезаписывает последнюю читаемую revision;
- forced GC не ломает undo/redo; rejected replacement сохраняет redo-ветку;
- missing/corrupt resource даёт read-only recovery, verified exact repair либо
  один атомарный RecoveryChangeSet без partial Durable state;
- history-only issue требует exact repair либо explicit
  `DiscardSessionHistory`; cancel сохраняет обе ветки;
- установка не обязательна для первого полезного результата;
- пользователь может вынести проект из browser storage.

**Pause**

- тест проходит только в online/devtools simulation;
- service worker обновляет активную сессию без safe-save boundary;
- backup не самодостаточен в заявленном Alpha scope.

**Kill/pivot**

- supported browser lifecycle систематически удаляет Project без возможности
  предупредить/восстановить/экспортировать; обещание local-first пересматривается
  до набора пользователей.

### G-8. Alpha candidate and invited testing

**Вход**

- G-4–G-7 = `PASS`;
- закрыты V-01–V-17, а acceptance V-18–V-20 подтверждены;
- device lab, privacy notice и feedback channel готовы.

**Работа и evidence**

- V-18: adaptive performance и восстановление 3D-контекста;
- V-19: guided accessible core flow и privacy-safe diagnostics;
- V-20: независимый end-to-end Alpha rehearsal;
- UJ-1–UJ-6, fault injection, accessibility и 15-minute device runs;
- наблюдаемые сессии без помощи разработчика.

**Exit — разрешение пригласить Alpha-тестеров**

- `CAP-1`–`CAP-11` имеют подтверждённое evidence;
- active `FR-1`–`FR-47` (кроме retired `FR-3`, `FR-20`, `FR-24`, `FR-34`–`FR-37` и `FR-46`), `FR-54` и
  Alpha-применимые `NFR-1`–`NFR-21`, `NFR-23`–`NFR-26`
  закрыты либо имеют явный approved exception, не разрушающий Alpha promise;
- `NFR-22` отмечен `N/A by scope` для Alpha и проверяется только в Alpha+;
- 100% golden roundtrips дают 0 мм semantic drift;
- reference scenes проходят final device/performance budgets;
- пользователь выполняет UJ-1–UJ-6 без developer intervention;
- recovery, quota, context loss и update имеют безопасный выход;
- catalog assets прошли technical resource manifest, exact pin и
  backup readiness;
- `FR-54` Control Plane boundary подтверждён отдельным contract/integration
  evidence, а browser outage не маскируется под resource recovery;
- telemetry выключена либо consent/minimization подтверждены;
- известные ограничения показаны тестеру до начала работы.

**Pause**

- core completion ниже утверждённого порога или сценарий требует сопровождения;
- есть crash/data-loss/context-loss-without-recovery;
- не пройден хотя бы один minimum supported device;
- critical accessibility, privacy, technical resource или migration finding открыт.

**Kill/pivot**

- Alpha не приводит к конкретному решению пользователя даже при технически
  корректном flow;
- required device floor оказывается существенно выше целевого рынка;
- повторное исследование опровергает phone-first manual planning как полезную
  работу. Тогда не наращивается scope: возвращаемся к G-0/G-1.

### G-9. Alpha learning loop

**Вход**

- G-8 = `PASS`;
- тестеры приглашены контролируемыми когортами.

**Работа и evidence**

- измерять completion, time-to-useful-plan, error/undo patterns, recovery и
  принятое решение, а не vanity metrics;
- группировать findings по severity и затронутым `CAP/FR/NFR`;
- исправлять critical correctness/data-loss до расширения когорты;
- менять requirement только через PRD → SPEC → Architecture → roadmap.

**Exit**

- основные failure patterns стабилизированы;
- Product Owner принимает одно из решений: продолжить Alpha hardening,
  расширить scope, перейти к Beta discovery либо pivot/stop;
- Alpha+ рассматривается отдельно и не маскирует провал core loop.

**Pause**

- диагностика не позволяет воспроизвести сбой без сбора содержимого проекта;
- критические findings копятся быстрее, чем закрываются;
- участники не соответствуют primary-user profile.

**Kill/pivot**

- подтверждённая полезность или надёжность не достигается после ограниченной
  итерации core flow; новые витринные функции не используются как компенсация.

### G-A+. Ограниченный GLB

**Вход**

- G-8 как минимум = `PASS` либо Product Owner письменно повысил CAP-12;
- S-5 = `PASS`;
- hard limits, allowlist, storage и backup policy зафиксированы.

**Срезы**

- P-01: локальный выбор GLB, preflight, cancel и безопасный отказ;
- P-02: preview, dimensions/axis/anchor confirmation и atomic registration;
- P-03: reuse, deletion/disposal и portable backup roundtrip.

**Exit**

- `CAP-12`, `FR-48`–`FR-52` и asset-import contract имеют corpus evidence;
- импорт не инициирует network fetch и не меняет Project до commit;
- malformed/oversized asset не вызывает unrecoverable UI block или data loss;
- hard limits подтверждены на minimum supported device.

**Pause**

- limit выбран по размеру файла без decoded-resource measurements;
- cancel оставляет worker/GPU/blob resources;
- backup теряет imported asset или молча восстанавливает неполный Project.

**Kill/pivot**

- безопасный локальный importer не укладывается в mobile memory/thermal budget;
- custom import не улучшает completion core tasks: capability остаётся
  экспериментальной или заменяется параметрическим объектом/curated ingestion.

## 6. Spikes S-1…S-6

Spikes — горизонтальные исключения, потому что они снимают риск для конкретного
следующего вертикального среза. Они time-boxed по заранее определённому вопросу,
но roadmap не обещает календарную длительность.

Для Alpha обязательны `S-1`–`S-4` и `S-6`. `S-5` относится только к Alpha+ и
не блокирует приглашение первых тестировщиков.

| ID | Вопрос | Минимальный эксперимент | Evidence / выход | Разблокирует | Pass | Pause / kill подхода |
| --- | --- | --- | --- | --- | --- | --- |
| S-1 Renderer | Three.js direct, R3F или Babylon лучше держит mobile 2D/3D boundary? | одинаковые RS-1/RS-2, WebGL2, picking, incremental rebuild, context loss, dispose | traces, bundle/startup/frame/memory data, `ADR-001` | V-03, V-09–V-10, V-12, V-18 | один path проходит budgets на device matrix без engine types в domain | pause при desktop-only evidence; kill кандидата при crash/leak/semantic coupling |
| S-2 Topology | как детерминированно вести integer-mm graph, faces, Room identity и Opening? | 0°/45°/90°, T/X intersection, split/merge, openings, undo на golden corpus | corpus, property results, tolerance/rounding policy, `ADR-002` | V-02, V-04–V-07 | corpus детерминирован на целевых engines, rejected command не меняет Revision | pause при открытых split/merge rules; kill library/path при platform-dependent result |
| S-3 Storage/PWA | какой local-first protocol переживает mobile lifecycle, несколько iOS-контекстов и update? | IndexedDB revision/journal, blob candidates, kill/restart, quota, migration, history-branch forced GC, current/history resource recovery + explicit history discard, browser↔Home Screen handoff, writer lease/fencing, автоматическая SW activation | recovery demo/corpus, support matrix, schema/writer/update/GC protocol, `ADR-003` | V-01, V-14–V-17 | тот же fixture восстанавливается без потери Durable Revision; undo/redo roots сохранены; exact/atomic repair и confirm/cancel history discard работают; stale writer не публикует state | pause без real-device run; kill path при silent loss/corruption, broken redo или partial repair |
| S-4 Touch | какой gesture/numeric contract позволяет точно редактировать одной рукой? | wall/vertex/dimension/door/item/undo/cancel на mobile prototype | task recordings, error taxonomy, accessible alternatives, `ADR-005` | V-02, V-04, V-07, V-09, V-10, V-19 | core actions выполняются без hover/keyboard, targets ≥44×44 CSS px | pause при конфликте camera/edit gestures; kill gesture path при устойчивой неуправляемости |
| S-5 GLB | какие форматы/extensions/limits безопасны на minimum device? | valid/boundary/hostile GLB, decoded budgets, cancel, repeat import/delete, no-network assertion | hostile corpus, confirmed limits, cleanup traces, `ADR-004` | P-01–P-03, не блокирует Alpha | static self-contained GLB проходит bounded pipeline; отказ атомарен | pause при неподтверждённых limits; kill importer path при OOM, fetch или утечке ресурсов |
| S-6 Asset catalog pipeline | как воспроизводимо оптимизировать, версионировать и сохранять технически пригодные catalog assets? | representative set из бесплатных или созданных владельцем моделей проходит format/size/hash, optimization/manifest/exact-pin/backup flow | versioned manifest, hashes, boundary backup и device traces | V-09, V-09-CP, V-12, V-15, V-17, V-18 | сборка детерминирована, exact bytes проходят pin и BackupFeasibilityPolicy, Durable reference exportable | pause без technical manifest/device traces; kill source/path при nondeterministic output или budget overflow |

После terminal status прототипы S-1…S-6 очищаются по действующему waiver;
их source не переводится в production автоматически. Versioned corpus/trace
может стать входом только для отдельного TDD vertical slice после final READY.

## 7. Вертикальные срезы

Детальные acceptance и TDD-цикл находятся в
[alpha implementation plan](../../plans/alpha-implementation-plan.md).

| Slice | Наблюдаемый результат | Trace | Зависимости |
| --- | --- | --- | --- |
| V-01 | пользователь создаёт, именует, открывает и после закрытия получает локальный Project; `WEB-BOOTSTRAP-01` проверяет AD-16 web baseline | CAP-1; FR-1, FR-2, FR-5; NFR-3, NFR-11; AD-16 | S-3, `G-WEB-AD16`, final READY |
| V-02 | точная прямоугольная Room создаётся в мм, измеряется и undo/redo-ится как одно намерение | CAP-2, CAP-3, CAP-8; FR-6, FR-13, FR-38–FR-40; NFR-1–NFR-4 | S-2, S-4, V-01 |
| V-03 | одна Revision переключается между 2D и воспроизводимым 3D; Room surfaces display-only и не создают selection | CAP-5, CAP-11; FR-21–FR-23; NFR-2, NFR-9, NFR-14 | S-1, V-02 |
| V-04 | пользователь создаёт один точный constrained Wall через touch/numeric path | CAP-2, CAP-8; FR-7, FR-8, FR-12; NFR-1, NFR-3, NFR-5 | S-2, S-4, V-02 |
| V-05 | пользователь изменяет/нормализует topology без частичного состояния | CAP-2, CAP-8; FR-9–FR-12; NFR-1–NFR-4 | V-04 |
| V-06 | замкнутые faces становятся устойчивыми Rooms с параметрами | CAP-3; FR-14–FR-16; NFR-3, NFR-4 | V-05 |
| V-07 | Door/Window валидно принадлежат Wall и имеют согласованную Plan/3D проекцию без navigation semantics | CAP-4; FR-17–FR-19; NFR-3, NFR-4 | V-06 |
| V-09 | пользователь находит и размещает catalog item реального размера | CAP-6, CAP-11; FR-26–FR-28; NFR-5, NFR-6 | S-1, S-4, S-6, V-03 / G-5 PASS |
| V-09-CP | Catalog Control Plane publishes/serves versioned metadata/resources and hashes without accepting Project data | CAP-6, CAP-7, CAP-9; FR-54; NFR-10, NFR-13, NFR-21 | V-09, S-6, `G-CP-ADR`, final READY |
| V-10 | transform/actions предмета точны и обратимы, обе session-history ветки сохраняют нужные resources | CAP-6, CAP-8; FR-29, FR-30, FR-38; NFR-1, NFR-3, NFR-5 | V-09 |
| V-11 | collision/clearance и Parametric Placeholder поддерживают практическую проверку | CAP-6, CAP-8; FR-31, FR-32 | V-10 |
| V-12 | разрешённый цвет/вариант предмета переживает reopen/offline fallback | CAP-7; FR-33; NFR-4, NFR-10 | S-6, V-09 |
| V-14 | confirmed permanent deletion без recoverable lifecycle предсказуемо | CAP-1; FR-4; NFR-11–NFR-13 | S-3, V-01 |
| V-15 | PWA устанавливается и редактирует existing Project offline | CAP-1, CAP-9; FR-41, FR-42; NFR-10, NFR-14–NFR-16 | S-3, S-6, V-14 |
| V-16 | storage pressure, missing-resource recovery и update имеют безопасный атомарный выход | CAP-1, CAP-9; FR-43, FR-47; NFR-11–NFR-16 | V-15 |
| V-17 | backup восстанавливает Project атомарно | CAP-10; FR-44, FR-45; NFR-1, NFR-12, NFR-13, NFR-21 | S-6, V-16 |
| V-18 | reference scene остаётся управляемой, качество адаптируется, context loss восстанавливается | CAP-5, CAP-9, CAP-11; FR-25; NFR-5–NFR-9, NFR-14–NFR-20 | S-1, S-6, V-09–V-17 |
| V-19 | новый пользователь проходит доступный guided core flow и может приложить privacy-safe diagnostics | все Alpha CAP; NFR-17–NFR-21, NFR-23–NFR-26 | V-01–V-18 |
| V-20 | независимый тестер выполняет UJ-1–UJ-6 на реальном телефоне без разработчика | CAP-1–CAP-11; active FR-1–FR-47, FR-54; Alpha-применимые NFR; SM-1–SM-6 | V-19, V-09-CP, device gate, S-6 technical-content evidence |
| P-01 | oversized/unsafe GLB отклоняется локально и атомарно | CAP-12; FR-48, FR-49, FR-51; NFR-22 | S-5 |
| P-02 | допустимый GLB preview-ится, классифицируется и становится AssetDefinition | CAP-12; FR-50, FR-52 | P-01 |
| P-03 | custom asset переиспользуется, удаляется без утечек и переносится в backup | CAP-12, CAP-10; FR-44, FR-45, FR-52 | P-02, V-17 |

## 8. Зависимости и критические решения

| Dependency / решение | Нужно до | Owner | Evidence |
| --- | --- | --- | --- |
| Смысл grid, visual/snap step, off-grid numeric input и утверждение endpoint-правила `n = round(L/√2)` | G-3 / S-2 | Product + UX + Architecture | real plans, touch test, golden corpus |
| Minimum iOS/Android/browser/RAM/GPU matrix | G-3 | Product + QA/Performance | S-1/S-3 runs |
| AddWall split-height inheritance; Room merge identity and metadata safety policy | V-06 | Product + Architecture | S-2 corpus + no-dialog split UX + merge preview |
| Opening relocation при изменении Wall | V-07 | Product + Architecture | topology examples |
| Collision blocking/warning tiers | V-11 | Product + UX | usability tasks |
| Утверждение self-contained `.interiors`, provisional limits и reminder UX | V-17 | Architecture + Product | S-3 clean-profile offline roundtrip |
| Catalog task matrix, technical resource manifest и cache tiers | V-09/V-17 | Product + Content | S-6 sample manifest + pin/backup/device traces |
| `G-WEB-AD16`: exact web root/lockfile/React/TypeScript/Rspack/CSS Modules/Rstest/Playwright boundary | V-01 | Architecture + web implementation owner | `WEB-BOOTSTRAP-01`: frozen-lock install, Rspack build, Rstest run, Playwright smoke; no second JS lockfile/Vite/Vitest/Kotlin runner leakage |
| `G-CP-ADR`: Kotlin build/test, API/transport/resource delivery, PostgreSQL operations and publisher/operator boundary | V-09-CP | Architecture + backend/catalog owner | bounded ADR + contract/schema/integration evidence; no user Project data |
| Analytics consent и допустимые diagnostics | V-19 | Product + Privacy | review + research protocol |
| Final performance budgets и degradation ladder | V-18 | QA/Performance + Architecture | S-1 + S-6 reference runs |
| GLB hard limits, allowlist, Draco/Meshopt/KTX2 policy | G-A+ | Architecture + Security | S-5 |
| Git repository, branch/worktree и CI policy | G-2 | Project owner | readiness evidence |

Реальные устройства, бесплатные/созданные владельцем 3D-ассеты и время целевых пользователей
для наблюдаемых тестов являются внешними зависимостями. Их отсутствие означает
`PAUSED`, а не разрешение заменить evidence эмулятором или мнением агента.

## 9. Общие pause/kill triggers

### Pause и устранить причину

- найдено расхождение между `CAP-*`, `FR-*`, `NFR-*` и `AD-*`;
- phase-blocker из PRD не имеет владельца или метода проверки;
- один из minimum devices недоступен для gate;
- есть известный путь silent data loss, mm drift или partial commit;
- catalog asset не проходит техническую проверку размера/media/hash или pin/backup;
- метрика собирает геометрию, filename, screenshot или binary без consent;
- acceptance criteria среза не подтверждены человеком.

### Kill конкретную функцию или технический путь

- renderer/storage/topology candidate провалил заранее заданный spike и
  существует более безопасная альтернатива;
- feature не улучшает completion/decision outcome, но заметно ухудшает
  performance, memory или простоту;
- импортируемый формат нельзя ограничить и безопасно освобождать на телефоне;
- catalog source не проходит technical resource policy либо бюджеты;
- desktop/cloud/AI scope не обслуживает утверждённый Alpha JTBD.

### Pivot или закрыть продуктовую гипотезу

- исследования опровергают готовность primary user вручную строить план на
  телефоне;
- полезный результат требует scan/BIM/desktop, то есть другого продукта;
- после технически корректного flow пользователи не принимают практического
  решения и не возвращаются к сохранённому проекту;
- приемлемый device floor исключает целевой рынок.

## 10. Что намеренно не получает место в Alpha roadmap

- несколько Level, лестницы, крыши, curved/arbitrary-angle walls;
- LiDAR, AR, image tracing, AI furnishing/restyle;
- photoreal cloud rendering;
- account, cloud sync, collaboration и view-only link;
- BIM/IFC/DWG, сметы, нормы и retailer checkout;
- retailer/branded SKU marketplace;
- универсальный импорт OBJ/FBX/DAE/USDZ;
- desktop-first feature parity.

Возврат любого пункта требует нового product evidence, обновления PRD,
повторной деривации SPEC и readiness, а не добавления «маленькой задачей» в
текущий slice.

## 10.1. Коррекция курса 2026-08-16: custom import и mobile UX

### Решение и исходное состояние

Product Owner подтвердил два release-blocking наблюдения на телефоне: ZIP с
FBX и texture sidecars даёт чёрную модель; импорт эквивалентного GLB отображает
новый asset правильно и неожиданно меняет текстуры ранее добавленного asset.
Второе наблюдение является нарушением изоляции ресурсов. Одновременно весь
mobile editor/catalog требует remediation: content может перекрываться или
теряться за пределами usable viewport.

Проверка текущего туннеля в synthetic browser viewport `393×852` и `320×568`
подтвердила structural UX risk: dialog одновременно содержит два importer-а,
browse-каталог, tabs, card grid и sticky action; его fixed grid с
`overflow: hidden` не даёт гарантированного scroll path для расширенного
import review. Это полезный reproduction signal, но не заменяет наблюдение на
физическом телефоне или NFR-15 evidence.

На дату 2026-08-16 `G-IMP-UX` получил статус **`PAUSED`**. Текущий direct GLB и
экспериментальный FBX/ZIP code path не закрывают Story 5.1 или Epic 9 только
по наличию интерфейса/туннеля. Полный impact и handoff находятся в
[`sprint-change-proposal-2026-08-16-import-ux-remediation.md`](sprint-change-proposal-2026-08-16-import-ux-remediation.md).

### Evidence после получения exact fixtures (2026-08-16)

Product Owner предоставил private fixtures `white-armchair-fbx-1k-9mb.zip`
и эквивалентный `white_armchair_fbx_1k_9mb.glb`. ZIP содержит один binary FBX
и четыре image sidecar, включая double suffix `.jpg.jpeg`; equivalent GLB
содержит четыре embedded images и четыре texture bindings. Synthetic browser
показал, что isolated import preview ZIP уже получает texture bindings, то
есть конкретно этот path не воспроизводит чёрную модель до постановки.

Вместо прежней недоказанной гипотезы найден и зафиксирован lifecycle defect:
когда в live 3D scene появляется следующая parsed custom GLB, контроллер
сохранял первый disposable Three scene, потому что различал только «есть
custom GLB / нет custom GLB». В результате новый asset не обязан был получить
свои cloned objects/materials/textures. Регрессионный тест теперь требует
rebuild scene при смене состава parsed custom GLB; ручные mutation checks
убивают как инверсию ветки, так и удаление structure key.

Mobile evidence также продвинулся: `PROJECT-E2E-04B` покрывает `320×568`, ZIP
sidecars, scroll import review, durable placement, карточку «Кастомное» с
renderer canvas и повторную постановку pinned resource. Реальная карточка
exact armchair подтверждена через tunnel; thumbnail показывает материалы,
а не default greybox. Это implementation evidence, но не physical-device
acceptance: A/B GLB+FBX 3D, reopen/context-loss и Android/iPhone walkthrough
остаются обязательными для закрытия `IMP-01…03` и `UXR-02`.

### Граница scope

Действующие SPEC/PRD разрешают лишь self-contained GLB как Alpha+; FBX и
архивы там отклоняются. Поэтому подтверждённый приоритет «GLB и FBX/ZIP с
текстурами должны работать» добавлен в roadmap как **proposed scope change**,
а не как молчаливая смена contract:

- GLB восстанавливается первым в пределах CAP-12/AD-9;
- FBX/ZIP допускается только как bounded static binary ingress, который
  детерминированно создаёт self-contained GLB и проходит тот же policy route;
- universal FBX/OBJ/DAE/USD import, arbitrary scene features и remote texture
  resolution остаются non-goals;
- promotion до Alpha и новые `FR-*`/`CAP-*` возможны только после approved
  PRD → `bmad-spec` → Architecture → UX reconciliation.

### G-IMP-UX. Надёжный import и usable mobile shell

**Вход:** exact user FBX/ZIP и equivalent GLB доступны как private fixtures;
Product Owner принял scope-change proposal; S-5 получает protocol на texture
integrity, no-network, memory/disposal и phone evidence.

| Slice | Результат | Зависимости |
| --- | --- | --- |
| `IMP-01` | Characterize exact A→B regression: import, preview, place, reload, context-loss/dispose и reverse order повторяются автоматически; до PASS FBX не называется готовым. | fixture, GLB ingress |
| `UXR-01` | Editor/catalog/import разложены на named layout states; каждая surface имеет один scroll owner, explicit Back/Close и non-overlapping sticky action. | S-4, UX owner |
| `IMP-02` | Self-contained GLB с embedded textures одинаково выглядит в isolated preview, 3D, reopen и clean-profile backup roundtrip; A не изменяется после B. | `IMP-01`, AD-9 |
| `IMP-03` | One static binary FBX/ZIP + admissible JPG/PNG/WebP sidecars конвертируется локально в normalized GLB с сохранёнными allowed material-texture bindings; unsupported case получает safe reject. | `IMP-02`, approved scope, S-5 |
| `IMP-04` | Complete import создаёт local `CustomAssetLibrary` card в «Кастомное» с renderer-derived thumbnail. Import не ставит предмет автоматически; durable placement отдельно pin-ит exact bytes. | Architecture decision, AD-4/AD-8, CAP-10 |
| `UXR-02` | Regression matrix всех overlay/keyboard/text-scale/orientation states проходит automation и owner walkthrough на iPhone и Android. | `UXR-01`, `IMP-04` |

**Exit:**

1. GLB и approved FBX/ZIP fixture имеют подтверждённые texture bindings,
   material/thumbnail visual checks и A/B isolation after reload/disposal;
   texture count в JSON сам по себе не является evidence.
2. No external fetch; cancel/error/timeout/fence-loss не создаёт Project
   Revision, custom-library entry или dangling resource. Durable Project
   reference имеет pin и проходит BackupFeasibilityPolicy.
3. «Кастомное» — локальный общий каталог с хорошим thumbnail, построенным из
   того же normalized resource и привязанным к source hash/version. Это не
   generic placeholder и не скрытая зависимость Portable Backup.
4. Для `320×568`, `375×667`, `393×852`, landscape, keyboard-open и text-200%
   нет clipped primary action, unlabeled horizontal overflow, stacked
   non-blocking overlays или pointer-through. Последний focusable item всегда
   достижим поверх sticky action.
5. Synthetic Playwright checks зелёные, затем Product Owner подтверждает flow
   на iPhone 15 Pro Max и Samsung S24 Ultra в browser/PWA contexts. Эта
   two-device functional-проверка — достаточная `NFR-15` evidence для Alpha.

**Pause/kill:** pause без exact fixture, source-owner reconciliation или
phone-memory evidence; kill FBX path, если bounded static subset не сохраняет
текстуры/безопасность в budget. В таком случае GLB остаётся supported route, а
неподтверждённый FBX не маскируется под успешный import.

## 10.2. Checkpoint 2026-08-18: device-observed implementation

### Статус

**`IN EVIDENCE`**, не `PASS`. Product Owner функционально проверил текущий
editor/import/catalog flow на физическом устройстве. Это меняет roadmap тем,
что реализованный путь больше не считается только synthetic browser
гипотезой; это не подменяет ни одну release-приёмку.

### Что добавлено в наблюдаемый путь

- direct self-contained GLB проходит local preflight, preview, user
  confirmation, регистрацию и повторную постановку (`CAP-12`, `FR-48`–`FR-52`,
  `NFR-22`, `AD-9`);
- локальное преобразование одного bounded FBX/ZIP с texture sidecars в GLB
  устраняет проверенные regression cases чёрной модели и resource bleed после
  переключения custom asset (`IMP-01`–`IMP-03`, `AD-9`, `AD-10`);
- verified custom resource появляется в общем device-local «Кастомное» с
  renderer-derived preview, переживает reload и может быть поставлен в другой
  local Project; Project definition/reference возникает только при
  подтверждённой постановке. Missing/malformed/hash-mismatched bytes не
  получают preview/placement, а exact re-import восстанавливает card без
  Project Revision. Late hydration/import не заменяет свежую card/выбор, а
  same-hash import в активный Project переиспользует его definition. При reopen
  здорового legacy Project его verified project-owned resource промотируется в
  common library без новой Project Revision (`IMP-04`, `CAP-6`, `CAP-10`,
  `AD-4`, `AD-8`);
- common-library card проверяет local bytes через static-GLB preflight и
  SHA-256 до preview/placement. Missing, malformed либо hash-mismatched bytes
  не дают вечную «загрузку», renderer input или placement: card остаётся
  disabled с явным повторным import исходного GLB; exact re-import возвращает
  ready-state без Project Revision (partial `IMP-04`, `FR-28`, `FR-43`,
  `FR-52`, `AD-9`);
- reopen Durable Project проверяет `byteLength` и SHA-256 каждого pinned
  custom-GLB resource в local store. Отсутствующий или повреждённый resource
  переводит Project в read-only `recovery-needed` и не подменяется greybox-ом;
  один unresolved resource восстанавливается exact GLB, а несколько — только
  complete one-to-one набором отсутствующих/повреждённых исходных GLB в одном
  IndexedDB transaction; healthy local bytes не перезаписываются. Legacy
  one-file путь fail-closed для multi-resource recovery; integrity reopen
  возвращает прежнюю Durable Revision без History entry (partial `IMP-02`,
  `V-16`, `CAP-1`, `CAP-9`, `FR-43`, `FR-47`, `AD-9`, `AD-10`);
- isolated custom-GLB preview и placed 3D object больше не имеют раздельных
  GLTF lifecycle: общий local-only runtime loader materialize-ит texture source
  до владения renderer-ом, валидирует non-empty finite bounds и не отдаёт
  failed root в WebGL. Aliased Three textures получают один canvas source до
  закрытия decoded image; resource, который AppShell ещё читает, честно остаётся
  loading, а не получает ложный re-import. Это закрывает **runtime hardening
  subset** `IMP-02`, но не device visual parity, context-loss или backup/reopen
  roundtrip (`CAP-12`, `FR-48`–`FR-52`, `AD-9`, `AD-10`);
- восемь bundled GLB candidate cards имеют честный renderer-derived preview;
  запрос постановки во время загрузки ждёт bytes и выполняется после их
  готовности (partial `CAP-6`, `FR-26`–`FR-28`, `AD-8`).

Automation после runtime-hardening: `lint`, `typecheck`, production build,
full web suite (`1049` tests), 84 mobile-browser E2E и 3 production-PWA E2E
— green. Targeted mutation проверил общий GLB loader (56 killed / 2 survived /
3 timeout из 61) и materializer (79 killed / 6 survived из 85); scores выше
configured high threshold 80%, remaining survivors equivalent defensive forms.

Дополнение checkpoint: atomic exact-byte batch recovery проходит full web suite
из 1,056 tests, `typecheck`, `lint`, production build и targeted iPhone
recovery regression. Targeted mutation: controller 135 killed / 27 survived
(83%), IndexedDB batch adapter 4 killed / 1 survived (80%); оба результата
достигают configured high threshold. Это не является full backup/reopen или
device-performance evidence.

### Что не продвигается этим evidence

1. Визуальный дизайн и visual UX **не приняты** Product Owner и намеренно
   исключены из текущей итерации. Поэтому нет claim по визуальной приёмке,
   `NFR-17`–`NFR-20` или `UXR-02`.
2. FBX/ZIP остаётся proposed bounded scope change: действующие PRD/SPEC
   ограничивают `CAP-12` self-contained GLB. Его promotion требует явного
   owner decision и PRD → SPEC → Architecture → UX reconciliation.
3. Исторический checkpoint для bundled third-party GLBs не продвигает их в
   Alpha CatalogAsset. С 2026-08-25 любой Alpha asset оценивается только по
   техническим format/size/hash/pin/backup требованиям; прежние упоминания
   `AssetUsageGrant`, provenance и notices отменены этим scope correction.
4. Current recovery slice доказывает integrity diagnosis и exact-byte batch
   repair custom-resource при open. Нужны полный `RecoveryChangeSet` с
   удалением/заменой references, repair session history, self-contained
   backup/reopen roundtrip и accepted `NFR-15` two-device functional path.
   Expanded cold/warm/RS-2/thermal/context-loss traces remain diagnostics.

### Операционная оценка

После синхронизации tracker: 13 `backlog`, 24 `in-progress`, 10 `review`,
0 `done` из 47 stories. Прозрачная рабочая формула `0% / 50% / 80% / 100%`
даёт `(13×0 + 24×0.5 + 10×0.8 + 0×1) / 47 = 42.6%`. Это приблизительно **43%
реализации roadmap**, а не 43% готовности Alpha release. Release readiness
остаётся 0%: нет `done` stories и не пройдены обязательные gates.

## 10.3. Коррекция scope и текущая operational-оценка 2026-08-25

Product Owner исключил из Alpha отдельные пользовательские срезы: финишные
покрытия пола и стен, потолок и потолочный свет, независимое дублирование
Project, PNG download/share, focus/fullscreen, лицензионный/legal контур
каталога и recoverable Project Trash. Это не означает удаления нейтральной
геометрии пола, обычного выбора разрешённого варианта/цвета ItemInstance,
Portable Backup или прямого подтверждённого удаления Project.

В tracker осталось **38 активных stories**: 5 `done`, 10 `review`, 21
`in-progress` и 2 `backlog`; ещё 8 stories имеют статус `retired` и в Alpha
не входят. Для рабочей прозрачной оценки применяется прежняя формула
`done = 100%`, `review = 80%`, `in-progress = 50%`, `backlog = 0%`:

`(5 × 1 + 10 × 0.8 + 21 × 0.5 + 2 × 0) / 38 = 61.8%`.

Следовательно, ориентировочно **62% функционального implementation evidence
готово и 38% остаётся**. Это оценка активного функционального roadmap, а не
готовность выпуска: ни `G-3`, ни последовательные `G-4`…`G-8` не имеют
`PASS`. External evidence register по-прежнему `awaiting-assignment`; до
назначения реальных владельцев, независимых reviewers и наблюдаемых участников
ни один из этих separate gate не может быть закрыт. NFR-15 device acceptance
не входит в этот список: он уже завершён владельцем продукта.

Лицензирование не является Alpha blocker. Для catalog/custom asset остаётся
только технический evidence: versioned manifest, format/size/hash, exact pin,
BackupFeasibilityPolicy, self-contained backup и независимый device review.

## 10.4. Operational update 2026-08-26

Для собственно Alpha (Epic 1–8, без retired и Alpha+ Epic 9) tracker сейчас
содержит **35 активных stories**: 5 `done`, 25 `review`, 4 `in-progress` и 1
`backlog`. По той же прозрачной формуле это
`(5 × 1 + 25 × 0.8 + 4 × 0.5 + 1 × 0) / 35 = 77.1%`: ориентировочно **77.1%
функционального implementation evidence готово и 22.9% остаётся**. Следующие
абзацы этого раздела сохранены как хронологический журнал итераций; их более
ранние проценты являются checkpoint-значениями, а не текущей оценкой.

Текущий concave-Room increment углубляет Story 2.2, но не меняет её дискретный
статус `in-progress`, поэтому процент по формуле не увеличивается. Он снимает
конкретный S-2/V-04/V-06 риск: touch-drawn L-shaped contour теперь сохраняется
как точная Room, восстанавливается после reload и использует правильную
concave-триангуляцию в 3D; collapsed inset по-прежнему fail-closed.

Следующий post-closure increment углубляет Story 2.3: у выбранной замкнутой
Room пользователь может touch-жестом перенести equal-leg degree-two cardinal
corner на общую 45-degree линию его двух anchors. Preview и cancel остаются
недолговечными; confirm создаёт ровно одну Durable Revision, сохраняет `Room
ID`/`heightMm`, а reload и 3D получают тот же exact integer-mm PlanGraph.
Shared-Vertex handles вынесены поверх Wall hit-areas, поэтому junction contact
не делает действие недоступным на телефоне. Unequal-leg, mixed-direction и
degree-three candidates остаются недоступными, а collinear segments с разной
толщиной fail-closed. Evidence: 1,316 Rstest, TypeScript, Biome, production
build, три затронутых phone-browser E2E и 94.44% scoped mutation. Story 2.3 и
общая формула остаются `in-progress`/66.9%: произвольные post-closure edits,
Opening/Item hosts и полный S-2 corpus ещё не закрыты.

Текущий post-closure thickness increment расширяет review-evidence Story 2.5
на точные полигональные Room. У выбранной boundary Wall в touch-drawn
L-shaped Room допустимое изменение `100 → 120 мм` теперь проходит существующий
phone inspector → canonical mutation → atomic publish path, не двигает
centerline/endpoints, сохраняет `Room ID`/`heightMm`, пересчитывает exact usable
polygon и остаётся доступным после reload и в 3D. Кандидат, схлопывающий inset
узкого concave-полигона, отклоняется до Durable Revision с
`ROOM_USABLE_AREA_COLLAPSE`. Mutation-анализ удалил эквивалентный ранний guard
в пользу одного exact derived validator. Evidence: 1,318 Rstest, TypeScript,
Biome, production build, 134/134 mobile-browser E2E, 5/5 production PWA E2E,
100% focused mutation и тот же iPhone-сценарий через внешний tunnel. Story 2.5
остаётся `review`, поэтому дискретная Alpha-only формула не меняется: **66.9%
готово, 33.1% остаётся**; physical-device и independent-review gates этим
synthetic evidence не закрываются.

Следующий post-closure increment углубляет Story 2.4: выбранную прямую
boundary Wall точной touch-drawn L-shaped Room теперь можно разделить
касанием внутри сегмента. Cancel не создаёт Revision; confirm атомарно
сохраняет исходный Wall ID на первой части, добавляет одну canonical Vertex и
одну tail Wall, не меняя `Room ID`/`heightMm` и exact usable polygon. Результат
восстанавливается после reload и остаётся тем же источником для 3D. Несогласованная
толщина двух collinear частей fail-closed до Durable Revision. Evidence: 1,319
Rstest, TypeScript, Biome, production build, 134/134 mobile-browser E2E, 5/5
production PWA E2E, 100% focused mutation и полный iPhone-emulation сценарий
через внешний tunnel. Story 2.4 остаётся `in-progress`: Opening/Item-hosted
split, T/X normalization и полный S-2 corpus ещё не закрыты. Поэтому
Alpha-only формула также остаётся **66.9% готово, 33.1% остаётся**; этот
increment не закрывает physical-device или independent-review gate.

Следующий reconciliation increment закрывает destructive Item-hosted вариант
Wall split для Story 2.4/5.3 (`CAP-2`, `CAP-6`, `CAP-8`; `FR-9`–`FR-12`,
`FR-28`, `FR-38`). Если touch-маркер разрезает footprint настенного предмета,
обычный confirm теперь показывает allocation-free consequence panel с точным
набором затронутых hosts. Cancel сохраняет Wall, Item и Revision без изменений;
подтверждение повторно сравнивает свежие Item/Opening IDs, удаляет только
затронутые ресурсы и публикует split одним Durable Revision. Предмет на другом
Wall и Opening вне разреза сохраняются; exact-touching interval по-прежнему
однозначно rehost-ится без destructive preview. Evidence: 1,324 Rstest,
TypeScript, Biome, production build, 135/135 mobile-browser E2E, 5/5 production
PWA E2E, 100% focused mutation (85/85) и полный iPhone-emulation
cancel/confirm/reload сценарий через новый внешний tunnel. Story 2.4 и 5.3
остаются `in-progress`: T/X normalization, diagonal/multi-segment host cases и
полный S-2 corpus ещё не закрыты. Alpha-only формула поэтому остаётся **66.9%
готово, 33.1% остаётся**; physical-device и independent-review gates не
продвигаются synthetic evidence.

Следующий T-junction increment углубляет Stories 2.4/3.4/5.3 (`CAP-2`,
`CAP-3`, `CAP-6`, `CAP-8`; `FR-9`–`FR-12`, `FR-28`, `FR-38`). Phone-drawn
точный T-контакт теперь не отклоняется только из-за существования wall-local
Item или Door. Allocation-free normalization до выдачи новых ID доказывает,
что каждый hosted interval целиком принадлежит ровно одному successor:
головная часть сохраняет стабильный Wall ID, а tail-host получает ID
материализованного successor и скорректированный local offset без физического
сдвига в Plan. Exact edge contact остаётся детерминированным. Контакт,
разрезающий wall-panel interval, включая diagonal Door case, fail-closed до
Revision и ID allocation. `RECONCILIATION-E2E-02E` доказывает одну Durable
Revision, неизменное физическое положение marker, сохранность после reload и
тот же 3D source. Evidence: 1,330 Rstest, обе TypeScript-конфигурации, Biome
lint для 249 файлов, production build, 136/136 mobile-browser E2E, 5/5
production PWA E2E, 90.09% focused mutation (100/111) и focused phone-сценарий
через внешний tunnel. Stories остаются `in-progress`: X normalization,
безопасная post-closure diagonal/multi-segment hosted lineage и полный S-2
corpus ещё не закрыты. Alpha-only формула не меняется: **66.9% готово, 33.1%
остаётся**; physical-device и independent-review gates этим synthetic evidence
не продвигаются.

Следующий exact-X increment углубляет те же Stories 2.4/3.4/5.3 и снимает
отдельный cardinal X/host риск (`CAP-2`, `CAP-3`, `CAP-6`, `CAP-8`;
`FR-9`–`FR-12`, `FR-28`, `FR-38`). Phone-drawn Wall, пересекающий interior
divider, теперь подтверждён отдельным durable сценарием: одна exact integer-mm
Vertex имеет ровно четыре incident canonical WallSegment, весь Project
публикуется одной Durable Revision, а wall-panel на незатронутом физическом
интервале переезжает на единственный successor ID с компенсированным local
offset. Marker не сдвигается в Plan; 12 Walls, 4 Rooms и Item сохраняются после
reload и остаются тем же source для 3D. Domain corpus дополнительно проверяет
shifted diagonal X с ненулевыми началами координат, отрицательный denominator
и half-mm reject до allocation. Evidence: 1,332/1,332 Rstest, обе TypeScript
конфигурации, Biome lint для 249 файлов, production build, 137/137
mobile-browser E2E, 5/5 production PWA E2E и 95% focused X mutation (95/100),
включая 100% hosted-lineage subset (36/36). `RECONCILIATION-E2E-02F` также
прошёл через действующий внешний tunnel после полного local run. Stories
остаются `in-progress`: multi-X chains, post-closure diagonal Room
reconciliation/hosted lineage, Opening-hosted X outcomes и полный S-2 corpus
ещё не закрыты. Alpha-only формула не меняется: **66.9% готово, 33.1%
остаётся**; physical-device и independent-review gates этим synthetic evidence
не продвигаются.

Следующий post-diagonal increment углубляет Stories 2.4/3.1/3.4 и закрывает
изолированный риск повторного редактирования уже полигональной Room (`CAP-2`,
`CAP-3`, `CAP-8`; `FR-9`–`FR-13`, `FR-38`). После durable диагонального
деления square Room пользователь может touch-жестом провести ещё одну Wall от
внешней границы до общей диагонали. Exact boundary-lineage отличает две
треугольные predecessor Room с одинаковым envelope: второй жест публикует
ровно одну Durable Revision, создаёт третью Room, сохраняет исходные
`heightMm = 2800` и выбранные metadata. На Plan остаются 8 canonical Walls и
3 derived Rooms; reload и 3D получают тот же Project. Domain evidence отдельно
подтверждает безопасный rehost незатронутой диагональной Door с сохранением
физического положения и вариант с дополнительным interior contact. Evidence:
1,335/1,335 Rstest, обе TypeScript-конфигурации, Biome lint для 249 файлов,
production build, 138/138 mobile-browser E2E, 5/5 production PWA E2E и 87.04%
focused mutation (47/54). `EDITOR-E2E-02WD` также проверяется через внешний
tunnel после полного local run. Stories остаются `in-progress`: general
multi-step polygon edits, multi-X chains, Opening-hosted X outcomes и полный
S-2/device corpus ещё не закрыты. Alpha-only формула не меняется: **66.9%
готово, 33.1% остаётся**; physical-device и independent-review gates этим
synthetic evidence не продвигаются.

Следующий polygon-to-rectangle lineage increment углубляет Stories 2.4/3.1
(`CAP-2`, `CAP-3`, `CAP-8`; `FR-9`–`FR-13`, `FR-38`) и снимает ещё один
multi-room риск post-closure редактирования. Touch-разрез прямоугольного плеча
закрытой L-shaped Room теперь создаёт один polygonal и один rectangular
successor с точной ссылкой на общий predecessor. В доменном сценарии соседняя
Room имеет высоту `3200 мм`, но новый прямоугольный successor корректно
наследует `2400 мм` своей L-shaped Room вместе с deterministic identity
lineage, а не глобальный максимум соседнего проекта. `EDITOR-E2E-02VD`
доказывает реальный phone touch path: 6 Walls/1 Room → одна Durable Revision →
9 Walls/2 Rooms, сохранённый исходный Room ID, reload и 3D. Evidence:
1,336/1,336 Rstest, обе TypeScript-конфигурации, warning-free Biome lint для
249 файлов, production build, 139/139 mobile-browser E2E, 5/5 production PWA
E2E и 100% focused mutation (16/16). Focused phone-сценарий также проверяется
через внешний tunnel после полного local run. Stories остаются `in-progress`:
более сложные mixed/void polygon chains, multi-X, Opening-hosted X outcomes и
полный S-2/device corpus ещё не закрыты. Alpha-only формула не меняется:
**66.9% готово, 33.1% остаётся**; physical-device и independent-review gates
этим synthetic evidence не продвигаются.

Следующий large-plan touch-scale increment углубляет Story 2.2 (`CAP-2`,
`CAP-8`; `FR-7`, `FR-8`, `FR-12`; `NFR-17`; `AD-7`) и исправляет
presentation/input риск на плане `40 000 × 30 000 мм`. Верхний предел
transient zoom теперь зависит от экранной проекции постоянной 100-mm lattice:
ячейку можно приблизить минимум до `44 CSS px`, тогда как обычный план
сохраняет прежний базовый предел `3×`. Physical 100-mm Wall занимает ровно
одну minor cell; grid и dashed preview используют non-scaling stroke и не
превращаются в толстые полосы при глубоком zoom. Wall hit-area имеет минимум
`44 CSS px`, а реальный phone touch-preview проверен на попадание обоих
endpoint в центры 100-mm cells. Camera/grid остаются disposable presentation
state и не меняют Durable geometry. Evidence: 1,338/1,338 Rstest, обе
TypeScript-конфигурации, warning-free Biome lint для 249 файлов, production
build, 140 mobile-browser сценариев green совокупно (139 unaffected в полном
прогоне и исправленный stale hit-target сценарий в focused rerun), 5/5
production PWA E2E и 100% focused mutation (17/17). Story 2.2 остаётся
`in-progress`: полный S-2 corpus, physical-device и independent-review gates
не закрыты. Alpha-only формула не меняется: **66.9% готово, 33.1% остаётся**.

Closure-first checkpoint переводит Story 2.2 в `review` по утверждённой
Product Owner минимальной Alpha-границе. Пользовательский vertical slice уже
доказывает прямое рисование Wall в свободной области и на поддерживаемой
геометрии, 0/45/90-degree origin-relative 100-mm candidate, фактические
length/direction до явного confirm/cancel, non-durable tap/micro-drag/
multi-touch, durable reopen и согласованный крупный touch-масштаб. Focused
closure rerun через внешний tunnel: 29/29 Rstest и 16/16 iPhone-13
browser-emulation scenarios. Общий S-2/device corpus и independent review
остаются отдельными gates; post-closure editing/host reconciliation продолжат
Stories 2.3/2.4/3.4/5.3. Текущий Alpha-only состав — 5 `done`, 14 `review`, 15
`in-progress`, 1 `backlog`; формула становится
`(5 × 1 + 14 × 0.8 + 15 × 0.5 + 1 × 0) / 35 = 67.7%`: **67.7% готово, 32.3%
остаётся**. Ни один release gate этим переходом не объявляется пройденным.

Следующий closure-first checkpoint переводит Story 2.3 в `review`. Минимальный
phone vertical slice уже включает direct-touch handles для поддерживаемой
Vertex/Wall, constrained integer-mm preview, non-durable cancel, одну atomic
Revision по confirm, сохранение unrelated PlanGraph и Room ID/height, а также
reload/3D parity. Direct global-coordinate controls остаются исключены из Alpha;
неподдерживаемые mixed-axis/junction gestures не маскируются как доступные.
Focused rerun через внешний tunnel: 111/111 Rstest и 6/6 iPhone-13
browser-emulation scenarios; предыдущий source-changing increment сохраняет
94.44% focused mutation evidence. Общий join/split/host reconciliation остаётся
Stories 2.4/3.4/5.3, а S-2/device/independent-review — отдельными gates. Текущий
состав — 5 `done`, 15 `review`, 14 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 15 × 0.8 + 14 × 0.5 + 1 × 0) / 35 = 68.6%`: **68.6% готово, 31.4%
остаётся**. Release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 2.4 в `review`. Минимальный phone
vertical slice уже доказывает endpoint/body join, selected-Wall touch split,
transient preview/cancel, одну atomic publication по confirm, exact T и
isolated cardinal X с общей canonical Vertex, stable IDs и безопасный
Door/Item rehost либо explicit consequence. Invalid candidate не оставляет
partial allocation или Revision. Focused evidence: 140/140 Rstest и 9/9
iPhone-13 browser-emulation scenarios green совокупно через внешний tunnel.
Два первых 3D assertion превысили 5 секунд, пока Cloudflare передавал dev lazy
chunks; network trace подтвердил pending requests, а isolated rerun прошёл 2/2.
Production geometry не менялась. General multi-X/post-closure diagonal lineage
и полный S-2/device/independent-review остаются отдельными gates. Текущий
состав — 5 `done`, 16 `review`, 13 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 16 × 0.8 + 13 × 0.5 + 1 × 0) / 35 = 69.4%`: **69.4% готово, 30.6%
остаётся**. Release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 2.6 в `review`. Минимальный phone
vertical slice теперь всегда показывает transient consequence preview до
удаления Wall или допустимой redundant inline Vertex: простой исход явно
сообщает, что Rooms/Openings/Items не затрагиваются; destructive исход
перечисляет точные hosts и требует Room metadata choice при merge. Cancel не
создаёт Revision, fresh confirm публикует один atomic reversible outcome,
stale/fence/invalid route fail closed. Vertex action приведён к однозначному
label `Удалить вершину`; merge сохраняет stable head Wall ID и допустимый wall
Item host. Final focused run: 194/194 Rstest и 8/8 iPhone-13
browser-emulation scenarios через внешний tunnel, changed-file Biome, обе
TypeScript-конфигурации и production build. Общий arbitrary-junction deletion
и S-2/device/independent-review остаются отдельными gates. Текущий состав — 5
`done`, 17 `review`, 12 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 17 × 0.8 + 12 × 0.5 + 1 × 0) / 35 = 70.3%`: **70.3% готово, 29.7%
остаётся**. Release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 3.1 в `review`. Минимальный Alpha
slice выводит exact Rooms из поддерживаемых simple bounded rectangular,
triangular, trapezoid и concave Faces, не создаёт Room из open/bridge/exterior
walk и сохраняет normalized identity независимо от Wall order/direction.
Поддерживаемые thickness/move/split edits удерживают Room ID/metadata, обычный
Wall split сразу наследует predecessor height, а merge/host ambiguity остаётся
explicit fresh-confirm outcome. Reloaded Plan/3D используют тот же canonical
graph. Characterization-test фиксирует минимальную границу: nested closed rings
атомарно reject-ятся как `AMBIGUOUS_BOUNDED_WALK`; полноценный outer+void Room
и S-2 hole corpus остаются отдельным topology gate. Focused evidence: 196/196
Rstest и 11/11 iPhone-13 browser-emulation scenarios green совокупно через
внешний tunnel. Один combined-run concave 3D assertion ожидал
`Загружаем 3D…` дольше пяти секунд и прошёл изолированно. Текущий состав — 5
`done`, 18 `review`, 11 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 18 × 0.8 + 11 × 0.5 + 1 × 0) / 35 = 71.1%`: **71.1% готово, 28.9%
остаётся**. Release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 3.2 в `review`. Отдельный non-canvas
flow «Помещения» теперь перечисляет текущие derived Rooms, адресует выбранный
stable `roomId` и одной Durable command сохраняет только name, closed Alpha
type и integer height. Width/depth, area, perimeter и Wall height не становятся
editable источниками; Plan/3D Room taps по-прежнему не создают selection или
history. Invalid 499-mm path объявляет причину, восстанавливает prior 2600 mm и
не публикует Revision; valid path меняет именно вторую из двух Rooms, переживает
reload и обновляет Plan/3D. Exact `shared-wall-height-opening-min` goldens
фиксируют adjacent 2400/2700 mm и derived shared Wall 2700 mm в domain и
disposable 3D; отдельная Opening policy остаётся на min 2400 mm. Final evidence:
1339/1339 Rstest, 249-file Biome, обе TypeScript-конфигурации, production build,
3/3 adjacent iPhone-13 browser scenarios и финальный isolated ROOM-E2E через
внешний tunnel. Manual wrong-roomId mutant убит двухкомнатным assertion и
восстановлен. Текущий состав — 5 `done`, 19 `review`, 10 `in-progress`, 1
`backlog`; формула `(5 × 1 + 19 × 0.8 + 10 × 0.5 + 1 × 0) / 35 = 72.0%`:
**72.0% готово, 28.0% остаётся**. Release readiness этим переходом не
объявляется.

Closure-first checkpoint переводит Story 3.4 в `review`. Минимальный Alpha
slice теперь безопасно проводит Opening через весь поддерживаемый lifecycle:
direct edit/delete остаётся cancellable и публикуется одной command;
однозначный Wall split сохраняет stable lineage host, а split-through и
удаление host Wall требуют точного delete/cancel preview. Понижение Room height
теперь не ограничено domain rejection: отдельный phone UI перечисляет affected
Openings, требует resize/delete для каждого, замораживает исходные Room-поля и
после fresh base/fence revalidation атомарно публикует Room плюс все resolutions.
Cancel и invalid outcome не создают Revision или partial Opening. Arbitrary
cross-wall rehome не является Alpha control: поддерживаемый host либо
однозначно сохраняется, либо применяется явный conflict outcome. Final
evidence: 1339/1339 Rstest, 249-file Biome, обе TypeScript-конфигурации,
production build, 5/5 production PWA E2E и 6/6 связанных iPhone-13 browser
scenarios в одном чистом прогоне через внешний tunnel. Manual `height - sill`
→ `height + sill` mutant
убит и production arithmetic восстановлена. Текущий состав — 5 `done`, 20
`review`, 9 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 20 × 0.8 + 9 × 0.5 + 1 × 0) / 35 = 72.9%`: **72.9% готово, 27.1%
остаётся**. Release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 5.1 в `review`. Phone-каталог теперь
показывает все обязательные Alpha-категории: «Мебель», «Сантехника», «Техника
и электроника», «Освещение» и «Аксессуары». Curated мебель остаётся доступной,
а ненаполненная категория сообщает собственное честное empty state, не создавая
фиктивный товар. Доступный local-index search фильтрует по name, Alpha category,
furniture subtype, AnchorClass и integer-mm dimensions. Карточки показывают
renderer-derived preview либо fallback, canonical name, category, габариты,
floor anchor, отсутствие вариантов и local readiness. Loading остаётся
actionable; unavailable даёт retry/close, не создаёт AssetInstance/Revision и
не переводит здоровый Project в read-only. Exact durable placement остаётся
Story 5.2, remote Catalog Control Plane — Story 5.6. Final evidence: 1339/1339
Rstest, 249-file Biome, обе TypeScript-конфигурации, production build, 6/6
каталоговых iPhone-13 browser scenarios одним чистым прогоном через внешний
tunnel и 5/5 production PWA E2E. Manual section-operator и category-search-term
mutants убиты и production восстановлен. Текущий состав — 5 `done`, 21
`review`, 8 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 21 × 0.8 + 8 × 0.5 + 1 × 0) / 35 = 73.7%`: **73.7% готово, 26.3%
остаётся**. Release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 6.1 в `review`. Семь именованных
локальных вариантов теперь адресуют единственный declared ItemInstance slot
`body` по стабильному `colorVariantId`. Floor- и wall-палитры сначала открывают
доступный confirm/cancel dialog: cancel не создаёт Revision, confirm публикует
одну Durable command, не меняя dimensions, placement, host или room geometry.
Unknown variant, stale/locked target и GLB без declared recolorable slot
fail-closed с сохранением текущего appearance/history. Project JSON принимает
legacy Items без reference, но отклоняет unknown/mismatched projection и
variant reference у GLB; Undo/Redo/reload восстанавливают тот же ID. Локальные
варианты не имеют отдельного runtime resource, поэтому новый pin не требуется;
resource-backed variants по-прежнему обязаны пройти `BackupFeasibilityPolicy`
до публикации. Final evidence: 1342/1342 Rstest, warning-free 250-file Biome,
обе TypeScript-конфигурации, production build, 100% focused mutation (65/65),
2/2 связанных iPhone-13 browser scenarios через внешний tunnel и 5/5
production PWA E2E. Текущий состав — 5 `done`, 22 `review`, 7 `in-progress`, 1
`backlog`; формула `(5 × 1 + 22 × 0.8 + 7 × 0.5 + 1 × 0) / 35 = 74.6%`:
**74.6% готово, 25.4% остаётся**. Release readiness этим переходом не
объявляется.

Closure-first checkpoint переводит Story 8.5 в `review`. Browser storage
estimate теперь проходит strict safe-integer boundary и показывает advisory
warning с 70%, critical с 90% либо честный unavailable state. Phone UI держит
доступными Project export, явный persistent-storage request и очистку кэша, не
выдавая browser grant за гарантию против OS/browser eviction. Named quota fault
не заменяет текущую Durable Revision: candidate остаётся unsaved, UI показывает
retry/export, а новые mutations ждут recovery. Service worker удаляет только
повторно загружаемый browse cache, сохраняя app shell, IndexedDB, current Project
и domain/history/resource roots; production PWA снова открывает Project offline.
Final evidence: 1342/1342 Rstest, warning-free 250-file Biome, обе
TypeScript-конфигурации, production build, 4/4 связанных iPhone-13 browser
scenarios через внешний tunnel, 1/1 production PWA cleanup scenario, 97.67%
storage-pressure mutation и 96.97% quota-persistence mutation. Текущий состав —
5 `done`, 23 `review`, 6 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 23 × 0.8 + 6 × 0.5 + 1 × 0) / 35 = 75.4%`: **75.4% готово, 24.6%
остаётся**. Physical-device pressure/eviction evidence остаётся отдельным
release gate; release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 8.4 в `review`. После первого online
production-PWA запуска exact каталоговая модель pin-ится вместе с healthy
Project. С отключённой сетью cached shell открывает Project и Item в 2D/3D,
публикует изменение ширины 4000 → 4300 мм через обычную Durable boundary и
выполняет offline Undo/Redo. Полное закрытие и новый offline browser process
восстанавливают ту же 4300-mm Revision и Item; сохранившаяся writer lease
честно требует явный takeover и не меняет Project. Never-downloaded GLB остаётся
non-durable unavailable с retry/cancel, а не скрытой сетевой зависимостью или
ложным exact asset. Final evidence: 1342/1342 Rstest, warning-free 250-file
Biome, обе TypeScript-конфигурации, production build, 5/5 production PWA E2E,
1/1 связанный iPhone-13 browser scenario через внешний tunnel и unchanged
89.83% pinned-loader mutation baseline. Текущий состав — 5 `done`, 24 `review`,
5 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 24 × 0.8 + 5 × 0.5 + 1 × 0) / 35 = 76.3%`: **76.3% готово, 23.7%
остаётся**. Remote Catalog Control Plane и physical-device matrix остаются
отдельными gates; release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 8.8 в `review`. Единственное видимое
действие Project export теперь всегда выдаёт versioned `.interiors`, а не
понижает resource-free Project до JSON interchange. Bundle содержит canonical
Project, schema/manifest, SHA-256 ledger и все exact referenced local GLB bytes
в детерминированном hash-порядке; session Undo/Redo History намеренно не входит
в source contract. Missing/corrupt/unverified resource и unsupported schema
fail-closed до ready output. `CATALOG-E2E-05` при отключённой сети фиксирует
отсутствие HTTP requests, экспортирует pinned GLB, удаляет исходные bytes и
восстанавливает отдельный healthy Project из downloaded bundle. Final evidence:
1345/1345 Rstest, warning-free 250-file Biome, обе TypeScript-конфигурации,
production build, 142/142 local mobile-browser E2E, 2/2 связанных сценария через
внешний tunnel, 5/5 production PWA E2E и 100% focused mutation: 52/52 envelope,
7/7 visible route. Текущий состав — 5 `done`, 25 `review`, 4 `in-progress`, 1
`backlog`; формула `(5 × 1 + 25 × 0.8 + 4 × 0.5 + 1 × 0) / 35 = 77.1%`:
**77.1% готово, 22.9% остаётся**. Remote Catalog Control Plane и
physical-device matrix остаются отдельными gates; release readiness этим
переходом не объявляется.

Closure-first checkpoint переводит Story 8.9 в `review`. Portable Backup
import теперь показывает phone-visible validation, staging, local read/render
smoke и saving progress и может быть явно отменён. Decoder ограничивает ZIP
paths/count/compression/unpacked bytes, сверяет manifest/ledger/source/checksums
и отличает corrupt, future-schema, cancellation и phone-limit outcomes. Exact
resources сначала записываются под operation-local compensation journal,
перечитываются из local store и повторно проходят byte length, SHA-256, GLB
preflight и canonical integer-mm 2D/3D projection. Только затем выделяются
новый Project ID/revision и выполняется atomic publication; отказ удаляет лишь
новые staged bytes и не меняет существующие Projects. Final evidence:
1385/1385 Rstest, warning-free 252-file Biome, обе TypeScript-конфигурации,
production build, 144-scenario local mobile-browser regression, связанные
external-tunnel scenarios, 5/5 production PWA E2E и focused mutation: smoke
100% (32/32), import 87.67% (128/146), decoder 82.25% (241/293). Текущий
состав — 5 `done`, 26 `review`, 3 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 26 × 0.8 + 3 × 0.5 + 1 × 0) / 35 = 78.0%`: **78.0% готово, 22.0%
остаётся**. Persistent orphan-byte GC и physical-device transfer остаются
release hardening/evidence; release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 5.3 в `review`. Phone placement
параметрического wall panel сохраняет только stable Wall host, semantic side и
integer-mm local dimensions/elevation/offset; renderer transforms не попадают в
Project state. Поддерживаемые reverse, split, T/X contact и inline merge
детерминированно удерживают lineage-compatible host после reload в Plan/3D.
Split через panel и delete его host Wall перечисляют точные affected Items и
требуют один explicit atomic remove/cancel outcome; confirm повторно выполняет
discovery по current candidate/fence, поэтому stale preview или persistence
failure не создаёт partial Item/Revision. Final evidence: 179/179 focused и
1385/1385 full Rstest, warning-free 252-file Biome, обе TypeScript-конфигурации,
production build, 10/10 local и 10/10 external-tunnel iPhone-13 browser
scenarios. Existing unchanged focused mutation: split rehost 90.0% (45/50),
split conflict 100% (85/85), delete conflict 90.48% (38/42), merge rehost 100%
(9/9), reverse 100% (38/38), local move 100% (88/88). Текущий состав — 5
`done`, 27 `review`, 2 `in-progress`, 1 `backlog`; формула
`(5 × 1 + 27 × 0.8 + 2 × 0.5 + 1 × 0) / 35 = 78.9%`: **78.9% готово, 21.1%
остаётся**. Broader topology-lineage и physical-device corpora остаются release
evidence; release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 7.1 в `review`. В session History
попадают только successful Durable publications; Undo/Redo публикуют один
complete canonical candidate и сохраняют обе branches при reject, stale base,
fence loss или persistence failure. `SessionRetentionPolicy` проверяет
current+undo+redo+prospective resource roots до mutation и не обрезает redo до
successful replacement. Exact current/undo/redo GLB hashes проверяются до
travel и после resume. History-only failure оставляет healthy current
видимым/exportable и read-only; exact repair плюс recheck возвращает обе ветки.
`DiscardSessionHistory` явно перечисляет потерю Undo/Redo, сохраняет branches
на cancel и после fresh current-manifest/writer-fence checks очищает их без
Project Revision. Новый controlled `HISTORY-E2E-01` доказывает этот цикл через
реальные phone UI и IndexedDB, включая неизменные current revision ID и число
Durable Revision. Final evidence: 76/76 focused и 1385/1385 full Rstest,
warning-free 252-file Biome, обе TypeScript-конфигурации, production build, 2/2
local и 2/2 external-tunnel history scenarios, 5/5 production PWA E2E и
unchanged 100% session-retention mutation (50/50). Full mobile run прошёл
144/145; единственный несвязанный `PROJECT-E2E-04G` 30-second timeout прошёл
isolated 1/1 за 3.7 s. Текущий состав — 5 `done`, 28 `review`, 1 `in-progress`,
1 `backlog`; формула `(5 × 1 + 28 × 0.8 + 1 × 0.5 + 1 × 0) / 35 = 79.7%`:
**79.7% готово, 20.3% остаётся**. Cross-store crash/forced-GC corpus остаётся
release hardening/evidence; release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 8.6 в `review`. Missing либо
hash-mismatched referenced custom GLB открывает Project только как явный
read-only `ResourceRecoveryRequired`: unsafe models не попадают в renderer,
редактирование и History заблокированы. Exact repair принимает только полный
one-to-one SHA-256 набор, пишет все bytes атомарно, повторно проверяет тот же
Project и не создаёт Revision. Если exact bytes недоступны, cancel сохраняет
current Revision, а fresh confirmed RecoveryChangeSet удаляет все unresolved
references ровно в одной следующей Durable Revision. Канонические
`CATALOG-E2E-04`/`RECOVERY-E2E-01` теперь доказывают одинаковое blocking
состояние при принудительном catalog-route outage, partial repair без записи,
no-Revision exact repair, cancel и one-Revision confirm через реальные phone UI
и IndexedDB. Final evidence: 1385/1385 Rstest, warning-free 252-file Biome, обе
TypeScript-конфигурации, production build, 2/2 local и 2/2 external-tunnel
recovery scenarios; existing mutation — diagnostic 100% (10/10), controller
repair 83.33% (135/162), atomic batch 80% (4/5), RecoveryChangeSet 81.98%
(91/111). Текущий Alpha-only состав — 5 `done`, 29 `review`, 0 `in-progress`,
1 `backlog`; формула `(5 × 1 + 29 × 0.8 + 0 × 0.5 + 1 × 0) / 35 = 80.6%`:
**80.6% готово, 19.4% остаётся**. Remote Catalog Control Plane остаётся Story
5.6, а persistent cross-store PinStagingLease и physical crash/forced-GC corpus
— release hardening/evidence; release readiness этим переходом не объявляется.

Closure-first checkpoint переводит Story 5.6 в `review`. Минимальный Alpha
catalog теперь является реальным вертикальным срезом: отдельный Kotlin/Ktor
control plane атомарно публикует одну versioned revision из 8 approved assets и
16 exact GLB/PNG resources в PostgreSQL 18.4; migration, publisher и SELECT-only
runtime используют разные credentials, а exact schema/object allowlist не имеет
Project, Revision, History, Backup, account, upload или generic JSON seam.
`CatalogGatewayPort` через same-origin proxy проверяет envelope/resource
ETag/SHA-256, размер, media type и PNG/GLB profile, показывает version/hash/bytes
до placement и оставляет outage/invalid/cancel только состояниями каталога.
Shared semantic/media/HTTP corpus исполняется в Kotlin и обязательная media
matrix — также в TypeScript; normalized rows доказуемо восстанавливают stored
canonical envelope. Mutation-run дополнительно обнаружил и закрыл принятие
невозможной Gregorian даты. Final evidence: 23/23 backend tests на exact
PostgreSQL, Kotlin PIT 98% line / 76% mutation / 77% test strength, 1399/1399
Rstest, warning-free 259-file Biome, обе TypeScript-конфигурации, production
build, focused web mutation 571/826 killed + 3 timeout (69.49%), 5/5 production
PWA, live `phone → proxy → Kotlin → PostgreSQL` и все 148 ordinary mobile
scenarios с актуальным green evidence (147/148 полный run плюс исправленный
единственный Service Worker scenario 1/1). `SC-V09-CP` сохранён только как
browser checkpoint. Текущий Alpha-only состав — 5 `done`, 30 `review`, 0
`in-progress`, 0 `backlog`; формула `(5 × 1 + 30 × 0.8) / 35 = 82.9%`:
**82.9% готово, 17.1% остаётся**. Это завершает функциональную реализацию всех
35 Alpha stories до уровня как минимум `review`, но не закрывает `G-READY`,
physical-device, independent-human, public-production или release gates.

Review closure переводит Story 5.6 из `review` в `done`: все 16 принятых
findings исправлены. Контракт теперь строго отклоняет trailing JSON, malformed
Unicode, reserved `current`, неоднозначные headers и весь запрещённый
Project/Revision/History/Backup/account perimeter до repository access;
unsupported methods имеют точный bodyless `405`/`Allow`/`no-store`. Runtime
проверяет собственную PostgreSQL identity/SELECT-only матрицу и полноту current
publication, range читает только запрошенные bytes, `catalogRun` зависит от
Flyway validation, а dependencies защищены checksum verification. Final
evidence: 37/37 Kotlin tests; expanded PIT 92% line, 63% mutation, 75% test
strength; 1399/1399 Rstest; warning-free 259-file Biome; обе TypeScript
конфигурации; production build; focused web mutation 591/849 + 3 timeout
(69.96%); 148/148 mobile scenarios; 5/5 production PWA; live
`phone → proxy → Kotlin → PostgreSQL`. Текущий Alpha-only состав — 6 `done`,
29 `review`, 0 `in-progress`, 0 `backlog`; формула
`(6 × 1 + 29 × 0.8) / 35 = 83.4%`: **83.4% готово, 16.6% остаётся**.
`G-READY`, physical-device, independent-human и public-production release gates
остаются `NOT_READY`.

Review closure Story 2.5 завершает Minimal Alpha thickness slice. Выбранная
Wall принимает integer-mm thickness 20–1000 мм, включая нечётные значения с
exact half-mm derived geometry; centerline, endpoints, Wall/Room identity и
`Room.heightMm` остаются canonical. Detached Wall не создаёт Room, unequal
joins и polygonal usable measurements пересчитываются детерминированно, а
collapsed polygon, retained rotated Item, expanded wall-body collision и
чужой Opening проверяются атомарно до Durable Revision. Собственный Opening
остаётся на стабильном host, no-op не публикуется, phone inspector сохраняет
Plan/3D/reload parity. Final evidence: 1534/1534 Rstest, clean Biome, обе
TypeScript-конфигурации, production build, 149 passed mobile scenarios с одним
environment-skipped live PostgreSQL test, 5/5 PWA и 81.18% focused mutation
по 356 mutants. Story 2.5 переходит в `done`. С учётом уже закрытых Story
1.3, 2.2, 2.3 и 2.4 текущий Alpha-only состав — 11 `done`, 24 `review`,
0 `in-progress`, 0 `backlog`; формула
`(11 × 1 + 24 × 0.8) / 35 = 86.3%`: **86.3% готово, 13.7% остаётся**.
Repository-wide schema-V1 boundary остаётся явно записанной deferred migration;
`G-READY` и physical/public release gates остаются `NOT_READY`.

Review closure Story 2.6 завершает Minimal Alpha destructive-edit slice.
Wall preview перечисляет точные affected Room/Opening/Item ID, Room merge требует
явного predecessor с видимыми name/type/height/ID, а cancel остаётся полностью
transient. Confirm привязан к previewed Durable Revision; CAS rejection
перечитывает actual current base и не позволяет повторно применить stale
preview. Удаление redundant Vertex поддерживает cardinal и 45° collinear Walls,
сохраняет ID первой Wall piece, polygonal Room и физический адрес wall Item;
Wall deletion использует точную Room lineage для floor Items и rehost-ит
валидные Opening/wall-Item адреса после coalescing. Final evidence: 1540/1540
Rstest, clean 259-file Biome, обе TypeScript-конфигурации, production build,
150 passed mobile scenarios с одним environment-skipped live PostgreSQL тестом,
5/5 PWA и 84.00% focused mutation (147/175). Story 2.6 и Epic 2 переходят в
`done`. Текущий Alpha-only состав — 12 `done`, 23 `review`, 0 `in-progress`,
0 `backlog`; формула `(12 × 1 + 23 × 0.8) / 35 = 86.9%`: **86.9% готово,
13.1% остаётся**. `G-READY` и physical/public release gates остаются
`NOT_READY`.

Эта оценка не является release readiness. `G-3`–`G-8` остаются без `PASS`, а
physical-device, independent-review, catalog technical-content и external
owner evidence всё ещё требуют назначения и выполнения.

## 11. Управление roadmap

- Product Owner утверждает gate и изменение scope.
- Один Orchestrator поддерживает трассировку и назначает одного writer на
  canonical artifact/slice.
- Subagents используются для независимого research/review, но не редактируют
  один и тот же артефакт параллельно.
- После каждого slice evidence прикладывается к story/ADR/test report; галочка
  без артефакта не закрывает requirement.
- Любое изменение плана объясняется, согласуется с Product Owner и только затем
  отражается в roadmap и implementation plan.

2026-08-28: после независимой приёмки всех шести Minimal Alpha AC Story 3.2
переведена в `done`. Это подтверждает только её non-canvas metadata flow и
связанные локальные/мобильные evidence; physical-device и release gates этим не
закрываются.

2026-08-28: после исправления и независимой повторной приёмки exact-base CAS
Story 3.4 переведена в `done`. Cancellable Opening lifecycle и Room-height
conflict re-entry не могут опубликовать stale candidate или обойти Durable
Revision; это не заменяет physical-device либо release evidence.

2026-08-28: после исправления CAS для Undo/Redo/retry и независимой повторной
приёмки всех семи AC Story 7.1 переведена в `done`. Небезопасная безусловная
публикация history travel устранена: stale, persistence failure и writer-lease
loss сохраняют source Revision и обе history branches; отсутствие CAS-порта
отказывает безопасно. Это не закрывает cross-store crash/forced-GC release
hardening и не меняет release gates.

2026-08-28: после независимой приёмки всех Minimal Alpha AC Story 5.1
переведена в `done`. Local furniture сохраняется при outage Catalog Control
Plane, каждая карточка показывает техническую готовность ресурса, а bounded
GLB loading ограничен через headers и body и отменяется закрытием overlay без
создания `AssetInstance` или Durable Revision. Это не переносит границы
pin/backup publication из Story 5.2 и не заменяет remote control-plane Story
5.6.

2026-08-28: после исправления stale publication и независимой повторной
приёмки всех семи Minimal Alpha AC Story 5.3 переведена в `done`. Wall-panel
candidate публикуется только с exact-base CAS; split/delete host-conflict
привязан к `previewRevisionId`, перечисляет exact affected Items и не может
подтвердить устаревший preview. Phone evidence подтверждает reverse, stable
host identity, semantic side/local offset и reload parity. Это не закрывает
неопубликованную Story 5.2 и не заменяет physical-device или release gates.

2026-08-28: после исправления stale publication и независимой повторной
приёмки всех шести Minimal Alpha AC Story 6.1 переведена в `done`. Floor- и
wall-recolor команды используют exact-base CAS: устаревший variant dialog
возвращает `stale-base`, не создаёт `saved` state или History entry, а UI
перезагружает actual Durable Revision. Phone confirm/cancel, Undo/Redo/reload
и production PWA regression остаются зелёными. Это не расширяет Alpha за
единственный локальный `body` slot и не отменяет policy для будущих
resource-backed variants.

2026-08-28: после независимой приёмки всех шести Minimal Alpha AC Story 3.1
переведена в `done`. Bounded Faces, polygonal usable projections, stable
lineage/height inheritance и CAS/fence outcomes подтверждены без второго
источника geometry. D-022 о точном численном представлении и общем
`MeasurementFormatPolicy` остаётся отдельным архитектурным gate и не объявлен
решённым этим закрытием.

2026-08-28: после исправления независимо найденного AC4 P1 и повторной
приёмки всех шести Minimal Alpha AC Story 8.4 переведена в `done`.
Context-local `sessionStorage` gate сохраняет observed foreign writer lease
при reload: истечение lease, heartbeat, reload и direct publication не могут
молча вернуть права записи; только confirmed takeover возвращает writable
access и перечитывает неизменённую Durable Revision. Evidence: 1,607 Rstest,
clean lint/typecheck/build, 5/5 production PWA, writer-lease browser scenario,
31/31 и 13/13 focused mutations killed. Physical-device matrix остаётся
отдельным release gate.

2026-08-28: после независимой приёмки всех пяти Minimal Alpha AC Story 8.5
переведена в `done`. Quota failure во время rename удерживает exact candidate
и expected CAS base до successful retry, stale-base discharge или recovery;
локальный retry в rename-dialog повторяет только этот candidate, а UI/handlers
блокируют новые Room и Item mutations. Evidence: 1,611 Rstest, clean
lint/typecheck/build, 5/5 production PWA, targeted quota phone scenarios 2/2
и independent ACCEPT. Full mobile browser run дал 153 pass, один expected skip
и два unrelated 3D timeouts, после чего оба failed scenario прошли isolated
rerun 2/2. Physical-device pressure/eviction остаётся отдельным release gate.

2026-08-28: после независимой приёмки всех шести Minimal Alpha AC Story 8.6
переведена в `done`. Missing/corrupt exact custom GLB открывает Project только
в `ResourceRecoveryRequired`; full exact batch-repair выполняется одной
IndexedDB-транзакцией и не создаёт Revision, а fresh confirmed
`RecoveryChangeSet` публикует только одну fenced следующую Durable Revision.
Evidence: 1,611 Rstest, clean lint/typecheck/build и canonical phone scenarios
`CATALOG-E2E-04`/`RECOVERY-E2E-01` 2/2. Cross-store `PinStagingLease` и
physical forced-GC/crash corpus остаются отдельным release hardening/evidence.

2026-08-28: после независимой приёмки всех шести Minimal Alpha AC Story 8.8
переведена в `done`. Единственный visible export route создаёт versioned
`.interiors` с canonical Project, manifest, SHA-256 ledger и exact pinned
resource bytes; current/Undo/Redo/prospective envelope отвергает mutation до
Durable publish. Evidence: 1,611 Rstest, clean lint/typecheck/build, 5/5 PWA
и offline phone export/restore scenarios `PROJECT-E2E-03C`/
`CATALOG-E2E-05` 2/2. Physical iOS/Android transfer matrix остаётся отдельным
release gate.

2026-08-28: после исправления independently found P1 и повторной приёмки всех
пяти Minimal Alpha AC Story 8.9 переведена в `done`. Cancellation после
render-smoke и во время revision checksum повторно проверяется до `saving`/
publish, компенсирует только operation-local staged resources и не создаёт
Project. Import остаётся staged, smoke-checked и атомарно публикуется лишь
полным candidate. Evidence: 1,612 Rstest, clean lint/typecheck/build, targeted
phone import scenarios 4/4, PWA 5/5 и focused mutation 122/140 killed (87.1%).
Full mobile run дал один unrelated `EDITOR-E2E-04F` WebGL2 timeout, но isolated
rerun прошёл 1/1. Physical transfer и orphan-byte crash/GC остаются отдельными
release gates.

Статус обновлён 2026-08-29: **35 из 35 active Alpha stories — `done`**;
Epics 1–8 закрыты. Product Owner принял `NFR-15` после уже выполненной
функциональной browser/PWA-проверки на iPhone 15 Pro Max и Samsung S24 Ultra.
Бывшие восемь device contexts, RS-2, cold/warm и thermal traces больше не
являются Alpha blocker. Формальный readiness report всё ещё отдельно отмечает
не относящиеся к историям G-1/G-S1/G-S2/G-V01-S3/G-S4/G-S6/G-CP-ADR — это не
основание возвращать снятую NFR-15 matrix в roadmap. Любые более ранние
упоминания восьми устройств или обязательных RS-2/thermal trace в этом
историческом журнале считаются superseded этой записью.

2026-08-28: после устранения framework-selection обхода и независимой
приёмки Story 4.1 переведена в `done`. Alpha-путь 3D снова является только raw
WebGL2; opaque custom-GLB readiness не перезапускает и не подменяет renderer,
а canonical-dimension greybox не создаёт Project mutation. Это закрывает P1
story, но не выбирает renderer по AD-13, не переводит `G-S1-renderer` в
`PASS` и не является device/performance/thermal/GLB-PBR evidence.


## Telegram extension — additive roadmap S0–S7, 2026-11-04

Этот раздел дополняет исторические V/P-срезы и их результаты, не перенумеровывает
их и не объявляет заново принятыми. Каноническая цепочка: [SPEC и companions](../specs/spec-interiors-editor-alpha/SPEC.md), [PRD](prds/prd-InteriorsEditor-2026-07-26/prd.md), [Architecture](architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md), [UX](ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md), [Epic 10](epics.md#epic-10-работать-со-своим-планом-в-telegram-сохраняя-webpwa), [расширение](../../plans/telegram-mini-app-extension-spec-2026-11-04.md) и [матрица](traceability-matrix.md#telegram-extension--трассировка-2026-11-04). Таблица отражает план; позднейший статус уточнён ниже: S1 verified, ограниченный
S2 выполнен частично, physical acceptance не подразумевается.

| Этап / ценность | Stories | CAP / FR / NFR / AD | Зависимость и будущее evidence |
|---|---|---|---|
| S0 — согласованный пакет | Epic 10, coverage, readiness workflow | CAP-13; FR-55–58; NFR-28; AD-25–29 | Owner approval и свежий применимый READY или written waiver до нового implementation; это не historical Alpha READY. |
| S1 — прежний Web/PWA пользователь продолжает работу | 10.1 | CAP-1/9/13; FR-5/41/42/47/58; NFR-3/10–13/26; AD-4/11/25/28 | После применимого gate; прежний Project, DB names/schema, old worker, offline/update, недоступный SDK; isolated output без live dist. Source-format collision сам S1 не блокирует. |
| S2 — Telegram Project создаётся и повторно открывается | 10.2–10.3 | CAP-1/8/9/13; FR-1/2/5/55/56/58; NFR-3/11/21/26/28; AD-25/26/28 | До первой записи: единая scoped IDB v2 с атомарным v1 upgrade/identity/counter, Web Lock, strict writes, atomic stage/fence/receipt/pin, no-ABA, conditional cleanup, exact owned-history pointer и полный corpus. 10.3 расширяет A→B→A/physical evidence; общего GC нет. |
| S3 — реальный перенос в обе стороны | 10.4–10.5 | CAP-1/8–10/13; FR-44/45/47/57/58; NFR-1/3/10–13/21/28; AD-4/25/29–31 | Зарегистрированные PPJ/V1; новый явно выбранный browser ingress использует отдельный namespace, общий core и проверку прежнего backup. Его полный local scope требует отдельного применимого readiness gate, implementation и полного scoped/old-PWA corpus; physical files/reselect и release — отдельные gates. |
| S4 — точный план и безопасная навигация | 10.6–10.7 | CAP-2–4/8/9/13; FR-7–19/38–40/55; NFR-1–4/17–20/28; AD-3/7/25/27 | Существующий scoped runtime; stale viewport/keyboard, pinch, Back/Close state matrix, REL/FUP, Web/PWA regression. От 10.4–10.5 не зависит. |
| S5 — floor/wall и 3D | 10.8–10.9 | CAP-5–8/11/13; FR-21–23/25–33/54/55; NFR-8/10/13/21/28; AD-8/13/14/17/23–25/27 | Реальные допущенные exact bytes, pin/policy, host/reopen/2D–3D и outage. Формальный grant не является Alpha gate по решению владельца; техническая resource policy и physical evidence сохраняются. |
| S6 — подготовленный offline и восстановление | 10.10–10.12 | CAP-1/6/8/9/13; FR-5/38/42/43/55/56; NFR-3/10–13/28; AD-3/4/25–27 | Per-mode readiness, offline до/после, lifecycle, quota, fence/GC/history; PWA cold offline — отдельная обязательная regression. От S3 не зависит. |
| S7 — проверяемые два выпуска | 10.13–10.15 | CAP-1/6/9–11/13; FR-41/42/47/54/58; NFR-21/24/26/28; AD-11/17/25/28/29 | Shell-bound manifest без SW, isolated outputs, сохранённые lazy URLs, atomic release/rollback rehearsal, runbook и real evidence. Полная transfer acceptance дополнительно ждёт S3. |

Каждый implementation slice имеет одного owner и запланированные RED → GREEN,
required mutation и regression checks. Ни roadmap, ни test fake, ни baseline
2030 tests не являются доказательством TMA. По AD-25/FR-58 Web/PWA и данные
сохраняются на S0–S7; границы для будущего retirement определяются сейчас, но
удаление browser-owned частей не является Story S0–S7 и требует отдельного
owner-check, доступа к старым данным, проверенного переноса/rollback и допуска.

**Открытые вопросы:** (1) прежний licensing conflict разрешён владельцем:
формальный AssetUsageGrant не является Alpha gate; технические проверки остаются;
(2) S3 source contract зарегистрирован, implementation и evidence остаются; (3) bot,
HTTPS origins, физические iOS/Android и account isolation — pending release
evidence; (4) если реальный local handoff невозможен, Product Owner отдельно
решает alternative/privacy/retention, upload не разрешён. Действующий preview
читает `apps/web/dist`: ни planning, ни изолированная репетиция не останавливают
процессы и не перезаписывают live output/origin; retained chunks сохраняются.


### Коррекция S2 после readiness review — исторический снимок

[Оценка 2026-11-04](implementation-readiness-report-2026-11-04.md) зафиксировала
`NEEDS_WORK` для всего Epic 10 и отдельный узкий технический `READY` для S1 /
Story 10.1 в описанных отчётом границах, с признанным для этого scope owner
поручением. Это записанный verdict отчёта, не переоценка данным workflow и не
разрешение расширить S1. После исправления S2 новая применимая оценка ещё нужна.

Первая writable Story 10.2 теперь включает все AD-26 guards и controlled
commit/journal/exclusive pin cleanup races до первой записи; общего GC в S2 нет; 10.3 не является обязательной поздней
поставкой защиты. На момент этого снимка format V1/PPJ-A1 ещё ожидал source
registration (последующее решение SPEC — ниже), AGENTS против
PRD/SPEC/AD-14 — у owners/readiness до зависимого asset admission/release, а
FR-16/REL-05 и FR-9/REL-08 уже согласованы PRD owner: type/height сохраняют
историческое name, отдельный split UI не обещается, контакты нормализуются.
SPEC-owner подтвердил reconciliation CAP-2/3. Project-context называет type/height
route, но общая фраза о metadata требует уточнения; применимый readiness recheck
и приёмка затронутой parity Story 10.6 остаются отдельными. Остальные source
conflicts этой коррекцией не разрешены. Реальные bot/origins, физическая изоляция и NFR-28, внешние файлы,
release/rollback и отдельный retirement gate остаются pending. Для S1 прежний
shell/worker должен быть реально сохранён и проверен с candidate на отдельном
origin; повторная регистрация того же worker не доказывает upgrade.


### Source-owner S2/S3 disposition — снимок до регистрации AD-30

SPEC-owner принял [полный S2 fencing disposition](architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md)
в свои companions. Story 10.2 требует весь protocol и race corpus до первой
writable операции: scope Web Lock, atomic stage/fence/receipt, uint64 no-ABA
allocation, no-publish/conditional cleanup, atomic resource protect/pin,
takeover/recovery и conservative retention при неясности. Browser bulk
`recover()` не применяется к Telegram; общего GC в baseline нет и S2 его не
добавляет, проверяются реальные exclusive pin cleanup/reconcile. Story 10.3
расширяет A→B→A и physical evidence. Standalone identity validator и session queue
не составляют scoped runtime/storage или Story PASS. Signed positive fixture
опубликован tma.js maintainers, не официальным Telegram SDK; protocol/key —
Telegram, старый fixture проверяется с injected clock без ослабления production.

S1 фактически реализован и проверен в [отчёте](../../docs/progress/telegram-extension-2026-11-04/S1/README.md);
2 mutation timeout и ограничение связи всех прогонов с исходным снимком указаны
в [readiness result](../../plans/telegram-mini-app-s0-readiness-result-2026-11-04.md).
Это не подтверждает будущую S2/S3 acceptance или lazy rollback из S7.

На момент этого снимка AD-30 ещё не был зарегистрирован SPEC и S3 был blocked;
последующая регистрация и текущий статус указаны ниже. Тогда оставались: empty V1/PPJ overlap, точный `-0`, полная versioned closed
grammar/routing и реальная build/schema/file evidence требуют source disposition.
FR-57 допускает conservative reject без потери bytes, однако старый путь
восстановления и новый exact export конкретного Project/build должны быть доказаны;
для единственной неоднозначной копии без проверенного пути нужен адресный owner
выбор до зависимой acceptance. Нельзя переписывать IDB/Revision/checksums или
заменять старые export/recovery до доказательства полного non-corrupt FR-44
export envelope. На момент этого снимка licensing conflict ещё был открыт;
последующее решение владельца ниже его снимает. Реальные device/account/file/
release gates сохраняются; эта поправка не объявляет новый READY.


### Текущее продолжение: единый scoped IDB v2 и зарегистрированный AD-30

SPEC зарегистрировал PPJ-A1, `runtime-v1-wire@1` и conservative V1-legacy с
обязательным PPJ-disjoint witness; прежнее утверждение выше о незарегистрированном
AD-30 относится к предыдущему снимку. Source contracts готовы для engineering;
исполняемый worst-case proof и проверка recovery нужны до rollout/acceptance,
но не как уже готовые code artifacts до допуска начать работу. Полные grammar,
UTF-16/own-undefined/-0, single dispatch и build/file matrix — в Stories 10.4–10.5.
Пустой ambiguous файл отклоняется с сохранением оригинала, старый путь и новый
exact export доказываются; если sole-copy не имеет доступного recovery path,
Product Owner адресно решает условный FR-57 case.

S2 использует одну scoped IDB v2 и atomic v1 upgrade с неизменным identity/
counter. Strict writes, полный prepared/published/no-publish/receipt/pin
protocol, exact owned-history pointer transitions и полный race corpus требуются
до первой writable операции. [26 native cases](../../docs/progress/telegram-extension-2026-11-04/S2/storage-v2-composite-green.log)
и [2072 unit](../../docs/progress/telegram-extension-2026-11-04/S2/base-bound-unit-green.log)
— отдельные bounded результаты; product entry не подключён, полная Story 10.2 не
DONE. S1 verified. Никакой общий scope GC, скрытый upload или retirement не
добавляются. Полный implementation следует после применимого gate непрерывно,
без дополнительных остановок на каждом срезе; обязательные safety, owner,
physical и release gates сохраняются. Этот документ не объявляет новый READY.


### Решение владельца: Alpha catalog admission, 2026-11-04

Владелец сохранил PRD/SPEC/AD-14 и привёл AGENTS к тому же правилу: бесплатные
или собственные модели выбираются вне приложения; формальный AssetUsageGrant,
licensing/provenance/declaration/attribution/notice admission не является Alpha
gate. Исторические записи о конфликте выше не являются действующим blocker.
Технические format/size/hash/security validation, exact pin и
BackupFeasibilityPolicy, а также запрет upload Projects/files сохраняются.
Physical NFR-28 и остальные независимые release gates этим не закрыты.


### AD-31 — отдельная browser область для зарегистрированного переноса, 2026-11-05

[Story 10.5](epics.md#story-105-вернуть-telegram-project-во-внешнюю-копию-webpwa)
и [source disposition](architecture/architecture-InteriorsEditor-2026-07-26/browser-registered-storage-disposition-2026-11-05.md)
фиксируют один implementation owner для полного local path: явный import →
validation/smoke/cancel → exact legacy-backup representability → scoped
ImportUseCase → новый browser namespace с собственной DB, Project/Revision,
resources/library, fence, journal/receipt и history roots → общий editor. Старые
browser DB names/schema/data/history/paths и полный FR-44 backup не меняются;
Telegram identity не подделывается, namespace выбирает trusted browser composition.

Raw Project ID import отличается от source ID и проверяется по обоим известным
stores до принятия; destination атомарно защищает `add` от overwrite и no-ABA.
Проверка двух DB не атомарна: concurrent/future legacy producer может создать тот
же raw ID, поэтому каждая карточка и все operations/async callbacks следуют
trusted `(namespace, raw ID)`; совпавшие записи различимы и не сливаются. Отказ
любой проверки закрывает новый import без fallback, а доступная legacy область
продолжает безопасную работу. При partial failure directory честно неполная.

Для **локального implementation scope** нужна отдельная применимая readiness
оценка: ранее узкий S3 gate не покрывал AD-31. Она проверяет полноту плана, не
требует заранее готовых test results вместо разрешения реализации. До включения
registered ingress один owner выполняет RED→GREEN и required mutation corpus:
new-store lifecycle/anti-ABA, two-context fence/receipt/pin, raw-ID collisions,
все команды и owner routing, history/resources/recovery/both exports, pending и
same-source reselection, partial failure каждой области, полный прежний PWA
corpus и offline FR-44 backup каждого healthy нового Project. Применимый local
READY не означает release READY или NFR-28; реальные old/new build-file pairs,
physical iOS/Android и внешний handoff остаются отдельным evidence.

## Доводка мобильного редактора, 22 ноября

Этапы, зависимости и связь CAP/FR/NFR/AD с Epic 3/5/8/10 зафиксированы в
[согласованном пакете](sprint-change-proposal-2026-11-22-mobile-editor-finish.md#трассировка-и-подготовка-bmad).
Мобильный срез проверяется отдельно от записи нового угла. Совместимая сборка
для отката и сохранность Portable Backup нужны до активации записи. Проверка
Android и iOS использует тот же архив, что публикация.

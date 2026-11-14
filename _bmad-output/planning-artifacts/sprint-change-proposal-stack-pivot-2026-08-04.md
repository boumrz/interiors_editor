---
title: "InteriorsEditor — Sprint Change Proposal: смена стека, persistence и root-layout"
date: 2026-08-04
project: InteriorsEditor
workflow: bmad-correct-course
mode: Batch
scope_classification: Major
decision: "PRD MVP Review до Architecture"
status: "approved-for-routing; proposal-only"
approval:
  product_owner: Roman
  standing_written_authorization:
    - "Я полностью всё подтверждаю, не спрашивай меня каждый раз, просто делай, что должен"
  batch_authorization: "Proposal may be produced without per-section prompts."
  boundary: "Авторизация не принимает неуточнённый продуктовый контракт backend."
trigger:
  requested_frontend: "React + TypeScript + Rspack + Rstest + CSS Modules; разрешена любая дизайн-система."
  requested_backend: "Kotlin + PostgreSQL."
  requested_repository: "Одно unified repository/application в корне workspace; документация остаётся по разделам в _bmad-output/."
artifacts:
  created:
    - _bmad-output/planning-artifacts/sprint-change-proposal-stack-pivot-2026-08-04.md
  deliberately_not_modified:
    - _bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md
    - _bmad-output/specs/spec-interiors-editor-alpha/SPEC.md
    - _bmad-output/specs/spec-interiors-editor-alpha/*.md
    - _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
    - _bmad-output/planning-artifacts/epics.md
    - _bmad-output/planning-artifacts/roadmap-to-alpha.md
    - _bmad-output/planning-artifacts/traceability-matrix.md
    - _bmad-output/project-context.md
    - _bmad-output/planning-artifacts/implementation-readiness-*.md
    - _bmad-output/**/*.memlog.md
    - application source, package/build/test configuration, generated assets, deployment configuration
---

# Sprint Change Proposal — смена стека, persistence и root-layout

## 1. Суть изменения

Запрошено: React + TypeScript + Rspack + Rstest + CSS Modules для client,
Kotlin + PostgreSQL для backend и одно unified repository/application в корне
workspace. Client toolchain и root layout являются архитектурными решениями.
Однако Kotlin/PostgreSQL — не простая замена инструмента: текущий продукт
явно обещает, что базовое редактирование не требует backend, аккаунта или сети.

Конфликт подтверждён источниками истины:

| Текущий источник | Конфликтующий контракт |
| --- | --- |
| `SPEC.md`, Constraint 6 и Non-goals | Базовые сценарии не требуют account, backend или сети; accounts, cloud sync и collaboration вне scope. |
| PRD, `NFR-10`, `NFR-21`, Alpha Scope и `A-7` | Core editing не зависит от active backend; Project data не покидают устройство без consent; account/sync/collaboration не нужны для первого полезного продукта. |
| Architecture, `AD-4` и structural seed | Durable Project metadata и blobs local-first; browser и iOS Home Screen — разные local contexts с Portable Backup handoff. В alpha runtime backend отсутствует. |
| Architecture, `AD-16` и Stack | Bootstrap ориентирован на Vite/Vitest, а не на Rspack/Rstest. |
| Decision register `D-004`, `D-028` и roadmap rule 7 | Alpha local-first без account/backend; cloud sync/collaboration отложены; backend не создаётся «на будущее» в Alpha. |

В stack instruction не определены user journey, FR/NFR, CAP, API, account
model, sync, hosting, availability server или authority remote data. Если
Architecture выберет эти свойства сама, она скрыто перепишет продуктовый
контракт. Поэтому безопасный маршрут — сначала передать решение о
persistence/продуктовой роли в `bmad-prd`, а уже затем обновлять Architecture
или bootstrap.

Это **major product-and-architecture pivot**, а не прямое изменение стека. Он
не создаёт application artifact и не авторизует implementation.

## 2. Change-navigation checklist

| Пункт checklist | Статус | Вывод |
| --- | --- | --- |
| 1.1 Triggering Story | [N/A] | Проект pre-implementation; проблему не выявила Story. Trigger — новое stack/persistence/root-layout instruction. |
| 1.2 Core problem | [x] Done | Strategic pivot: запрошен backend persistence при утверждённом local-first/no-backend alpha contract. |
| 1.3 Evidence | [x] Done | Конфликт подтверждают SPEC Constraint 6, PRD `NFR-10`/`NFR-21`/`A-7`, `AD-4`, runtime diagram/seed, `D-004`, `D-028` и roadmap. |
| 2.1–2.5 Epic impact | [!] Action-needed | Все Epics наследуют local durability boundary. Напрямую затронуты Epic 1 и Epic 8/S-3; geometry, catalog, history, backup и PWA slices надо заново вывести после продуктового решения. Сегодня они не молча отменяются. |
| 3.1 PRD conflict | [!] Action-needed | PRD владеет решением о purpose backend, offline behaviour, privacy и persistence authority. |
| 3.2 Architecture conflict | [!] Action-needed | `AD-4`, `AD-16`, Stack и structural seed конфликтуют с новым stack/backend; менять их можно только после upstream resolution. |
| 3.3 UX conflict | [N/A now] | Rspack, Rstest, CSS Modules, разрешённая дизайн-система и root layout сами по себе не меняют UX contract. `bmad-ux` нужен лишь при подтверждённом user-visible изменении. |
| 3.4 Other artifacts | [!] Action-needed | SPEC, project context, epics, roadmap, traceability и readiness — downstream targets; этот proposal их не редактирует. |
| 4.1 Direct adjustment | [ ] Not viable | Прямая правка Architecture/epics нарушила бы PRD/SPEC ownership и выдумала бы backend behaviour. |
| 4.2 Rollback | [N/A] | Application implementation отсутствует, откатывать нечего. |
| 4.3 PRD MVP review | [x] Viable | Это минимальный безопасный способ определить продуктовый контракт до technical design. |
| 4.4 Selected path | [x] Done | Сначала `bmad-prd`, затем owner-ordered re-derivation downstream artifacts. |
| 5.1–5.5 Proposal and handoff | [x] Done | Ниже заданы owner-bound proposals и gated order. |
| 6.1–6.2 Review | [x] Done | Proposal сохраняет stable IDs и source ownership, не создаёт remote-product requirement. |
| 6.3 Batch approval | [x] Done | Standing written authorization подтверждает proposal и routing, но не подменяет отсутствующее persistence decision. |
| 6.4 Sprint status | [N/A] | Scope ограничен одним change-control document; sprint status и epics не меняются. |
| 6.5 Next steps | [x] Done | Required workflow order и decision gates приведены в section 5. |

## 3. Impact analysis

### Затронутые границы

- **Project authority и durability.** `Durable Revision`, atomic local
  publication, recovery, writer fencing, undo/redo resource roots и Portable
  Backup сейчас определены как device-local behaviour. PostgreSQL может быть
  unrelated, supplementary, replicated или authoritative; это разные продукты,
  и один вариант нельзя вывести из выбранной технологии.
- **Offline promise.** `CAP-1`, `CAP-9`, `CAP-10`, `FR-41`–`FR-45` и
  `NFR-10` требуют, чтобы уже созданный Project открывался, редактировался и
  становился Durable offline. Backend не может молча ослабить это обещание.
- **Privacy и access boundary.** Remote persistence может обрабатывать
  geometry, asset metadata или user content. `NFR-21` запрещает отправлять
  такие данные без consent. Этот proposal не добавляет identity или transfer
  requirement.
- **Portability и recovery.** Server нельзя заранее считать заменой
  self-contained `.interiors` backup, resource pinning, recovery rules или
  handoff между local contexts. Нужна явная preservation/replacement rule.
- **Build и repository topology.** React/TypeScript совместимы с текущим UI
  direction, но Rspack/Rstest/CSS Modules заменяют Vite/Vitest bootstrap
  assumptions. Одиночный root repository совместим с документацией в
  `_bmad-output/`, но его executable module boundaries должны быть спроектированы,
  а не угаданы.

### Impact на Epics

| Area | Воздействие после PRD decision |
| --- | --- |
| Epic 1 / S-3 | Прямое: Project repository, durable publication, writer fencing, recovery и local-context boundary могут потребовать новых AC. |
| Epics 2–7 | Косвенное: их Command, history и resource guarantees наследуют persistence authority Epic 1; этот proposal не меняет geometry или renderer rule. |
| Epic 8 | Прямое: PWA/offline, storage pressure, Portable Backup/import, update и physical evidence зависят от resolved backend/local contract. |
| Epic 9 | Условное: custom GLB остаётся Alpha+, пока Product Owner отдельно не меняет scope. Stack pivot не повышает его приоритет. |
| Gates/readiness | После reconciliation upstream artifacts нужен новый run. Текущие `READY`/waiver boundaries не меняются. |

### Риск, effort и timeline

- **Product/implementation risk:** high, пока не определены backend role и
  durable authority.
- **Documentation/replanning effort:** medium–high; owner artifacts надо
  re-derive, а не вручную подправить.
- **Timeline impact:** material, но не оценивается до PRD decision. Proposal
  не предполагает дату реализации, API, hosting или migration.

## 4. Recommended approach

Выбран **Option 3 — PRD MVP Review** с последующим controlled downstream
replan. Это не означает автоматическое сокращение Alpha. Это означает, что
`bmad-prd` сначала определяет, входит ли и как именно Kotlin/PostgreSQL в
продукт, прежде чем Architecture примет их как technical fact.

Указанный stack записан как change signal. Он не разрешает сам по себе сделать
PostgreSQL Project source of truth, добавить sync/account, потребовать
connectivity, хранить user data на сервере или изменить backup promise. Но и
отклонять backend преждевременно: `bmad-prd` должен явно установить его
user-visible и data-safety purpose.

До этого решения:

1. не создаются scaffold, package manifest, build/test configuration, Kotlin
   service, database, API, migration или deployment artifact;
2. Architecture остаётся authoritative для текущей local-first Alpha;
3. существующие `CAP-*`, `FR-*`, `NFR-*` и `AD-*` не редактируются и не
   перенумеровываются вручную; и
4. readiness report не правится для имитации `READY`.

## 5. Detailed change proposals и exact routing order

### 5.1 Product contract — owner: `bmad-prd` (первый required writer)

**Текущий текст (old).** PRD говорит, что core editing не зависит от active
backend (`NFR-10`), защищает local Project data (`NFR-21`) и считает
cloud/account/sync ненужными для первого полезного продукта (`A-7`).

**Требуемая новая работа.** В fresh `bmad-prd` update зафиксировать одно явное
product decision, отвечающее на следующие вопросы без добавления чужих функций:

1. Какой user/problem outcome требует Kotlin + PostgreSQL в этой Alpha?
2. Становится ли какой-либо remote store authoritative для Project или это
   отдельная supporting capability?
3. Какие offline-open/edit/Durable-Revision guarantees сохраняются, и как
   выглядит поведение при недоступном remote system?
4. Требует ли решение identity, access control, consent, retention или
   deletion behaviour? Если нет — это надо явно сказать, а не добавить по
   умолчанию.
5. Остаётся ли Portable Backup обязательным self-contained recovery и
   cross-context handoff? Если нет — нужна replacement rule с той же safety
   boundary.

Только после решения workflow вправе создавать/изменять PRD-owned `FR-*`,
`NFR-*`, scope, non-goals и assumptions. Он же добавляет собственный memlog
через `_bmad/scripts/memlog.py`; этот proposal этого не делает.

### 5.2 Capability contract — owner: `bmad-spec` (после PRD и снова после Architecture при необходимости)

**Текущий текст (old).** SPEC Constraint 6 исключает backend/account/network
dependency, а Non-goals исключают accounts и cloud synchronization.

**Требуемая новая работа.** Fresh `bmad-spec` re-derives kernel и companions из
утверждённого PRD outcome. Он сохраняет stable `CAP-*` IDs, вводит новую
capability только при реальной продуктовой необходимости и меняет
persistence/backup companion только если PRD изменил контракт. Ручная правка
`SPEC.md` или companion запрещена.

### 5.3 Architecture и root layout — owner: `bmad-architecture` (только после 5.1–5.2)

**Текущий текст (old).** `AD-4` — local-first browser persistence, `AD-16` —
Vite/Vitest-oriented bootstrap, structural seed сообщает, что в alpha runtime
backend отсутствует.

**Требуемая новая работа.** Fresh `bmad-architecture` update обязан:

- заменить bootstrap/tooling assumptions на React + TypeScript + Rspack +
  Rstest + CSS Modules; exact versions и compatibility evidence принадлежат
  Architecture и здесь не угадываются;
- определить Kotlin/PostgreSQL boundary ровно в пределах утверждённого PRD
  contract, включая связь с local Project durability, offline, backup и
  privacy;
- описать одно root repository/application topology с сохранением
  `_bmad-output/` как sectioned documentation; не изобретать API, deployment
  model или дополнительный repository;
- сохранить domain/application isolation и disposable 2D/3D projections, если
  upstream owner явно не изменит их; и
- решить, какие `AD-*` сохраняются, меняются или дополняются новыми stable ID,
  и записать решение в architecture memlog предписанным script.

«Разрешена любая дизайн-система» — implementation freedom, а не новый UX
requirement. Это не authorizes непроверенное visual/interaction change.

### 5.4 UX contract — owner: `bmad-ux` (conditional gate)

**Текущий текст (old).** UX обещает полезную local work без account/network и
содержит recovery/offline/local-context states.

**Proposal.** Не запускать этот update только ради Rspack, Rstest, CSS Modules,
дизайн-системы или root layout. Запустить fresh `bmad-ux` после PRD лишь если
approved product contract меняет user-visible flow/state: например offline
behaviour, consent, recovery, account/access behavior или data transfer. Он не
вправе выдумывать такой UI.

### 5.5 Downstream planning и verification — owners после Architecture

| Owner/workflow | Текущее состояние | Требуемое будущее изменение |
| --- | --- | --- |
| `bmad-generate-project-context` | Context повторяет local-first storage и no-network rules. | Обновить только confirmed post-Architecture rules. |
| `bmad-create-epics-and-stories` | Epic 1/S-3 и Epic 8 кодируют local-first persistence и no backend runtime. | Re-derive affected epics, stories, gates и trace links из PRD/SPEC/UX/Architecture; не hand-edit workaround. |
| PM/Technical Writer change-control | Roadmap, decision register и traceability повторяют no-backend/local-first decisions. | Reconcile только после публикации upstream решений; не добавлять requirements. |
| `bmad-check-implementation-readiness` | Существующие reports — historical evidence, а не editable planning sources. | Запустить fresh independent verdict после reconciliation всех affected source artifacts. |

### 5.6 Required order

Каждый пункт выполняется в fresh Codex/BMAD task. `bmad-help` может сначала
подтвердить маршрут, ничего не меняя. Required owner sequence:

1. **`bmad-prd` (update)** — решить backend/persistence product contract.
2. **`bmad-ux` (update, только если step 1 меняет user-visible contract)** —
   определить только вытекающие experience states/flows.
3. **`bmad-spec` (update/re-derive)** — отразить approved PRD/UX contract;
   manual CAP edit запрещён.
4. **`bmad-architecture` (update)** — принять Rspack/Rstest/CSS Modules,
   Kotlin/PostgreSQL и unified-root design в соответствии со steps 1–3.
5. **`bmad-spec` (refresh, если Architecture меняет load-bearing companion или
   constraint)** — поглотить adopted architecture без переписывания stable IDs.
6. **`bmad-generate-project-context` (update)** — перенести только final
   product/architecture invariants.
7. **`bmad-create-epics-and-stories` (update)** — re-derive affected backlog
   и acceptance coverage.
8. **PM/Technical Writer downstream reconciliation** — обновить roadmap и
   traceability по approved IDs; это не замена steps 1–7.
9. **`bmad-check-implementation-readiness`** — выдать новый independent
   verdict. Код регулируется только `READY` или subsequent explicit waiver.

## 6. Implementation handoff

**Classification:** Major — fundamental replan с участием Product Manager и
Solution Architect.

**Handoff recipients:**

- Product/PRD owner решает единственный вопрос, который нельзя вывести из
  выбранной технологии.
- UX owner действует только по confirmed user-visible consequence.
- SPEC owner сохраняет `CAP-*` и re-derives canonical contract.
- Architecture owner решает stack, ports, persistence realization и root
  topology после upstream contract.
- Epics/roadmap owners восстанавливают traceability и gates после изменения
  source of truth.
- Independent readiness reviewer проверяет пакет, но не retrofits report.

Success означает, что итоговые документы непротиворечиво отвечают на Project
authority, offline durability, backup, privacy и chosen stack; root repository
имеет documented topology; downstream IDs trace к своим owners; readiness
проверена заново. Success **не** означает, что Kotlin service, PostgreSQL
database, scaffold или deployment уже созданы.

## 7. Truly unresolved decision points

Эти пункты намеренно оставлены открытыми, а не заполнены proposal:

1. User-facing purpose Kotlin + PostgreSQL в Alpha.
2. Участвует ли remote store в Project authority/durability и как это
   сохраняет или меняет offline-first behaviour.
3. Нужны ли выбранному backend identity, consent, retention, deletion или
   access behaviour. Account, sync и hosting не предполагаются.
4. Остаются ли Portable Backup и iOS/browser local-context handoff
   неизменными при введении remote boundary.
5. Exact unified-root module layout, tool versions, database/migration policy
   и deployment topology — Architecture decisions после product contract, а не
   default assumptions.

## 8. Completion record

Этот Batch `bmad-correct-course` proposal завершён. Создан только данный
change-control document. PRD, UX, SPEC, Architecture, epics, roadmap,
readiness report, context, `.memlog.md`, code, package/configuration, tests,
generated artifacts и deployment artifacts не менялись.

Следующее authorized action — fresh `bmad-prd` update из section 5.6, а не
Architecture edit или implementation bootstrap.

# Adversarial seam review — readiness-evidence update

Дата проверки: 2026-08-09  
Объект: `ARCHITECTURE-SPINE.md` после добавления AD-20  
Линза: adversarial seams + data-integrity boundary  
Статус: review, не verdict implementation readiness

## Вердикт

Spine теперь явно защищает local-first ownership, exact topology authority и
неподмену device/participant evidence. Однако перед handoff нужны четыре
согласования: `solution-design.md` ещё описывает более слабые или старые
варианты AD-4, AD-10/AD-13, AD-17 и AD-20, а для V1/V2 и нового topology corpus
не указан полный source-owner/adoption exit. Ни corpus, ни Playwright, ни
browser/POC evidence не являются здесь доказательством device, participant,
legal или independent-review результата.

## Проверка расхождения двух нижележащих единиц

Ниже рассмотрены две независимо реализованные единицы, которые должны
сходиться только через архитектурные seams.

| Единица | Ответственность | Потенциально опасная самостоятельная трактовка |
| --- | --- | --- |
| A — Local-authoring runtime | `PlanGraphKernel`, `RevisionCoordinator`, `ProjectRepositoryPort`, `AssetBlobStorePort`, recovery/GC | Считать смену local pointer единственным publish-моментом и интерпретировать старый companion как физически атомарный cross-store commit. |
| B — Projection/catalog perimeter | renderer candidate, renderer diagnostics, `CatalogGatewayPort` adapter и catalog-only endpoint/cache/audit path | Считать общий JSON snapshot или отсутствие Project-table достаточным corpus proof, а cached/downloaded bytes — достаточным основанием для следующего шага. |

Обе единицы могут формально следовать своим узким контрактам, но расходиться на
crash/takeover, повторной потере WebGL context, corpus comparability, legacy
fixtures и boundary logs. Именно эти расхождения ниже должны быть устранены
либо routed к владельцу источника.

## Высокий приоритет

### H-1 — Новый fenced logical publication AD-4 не отражён в persistence companion

**Наблюдение.** AD-4 требует единого logical publish для candidate Revision,
pointer, History roots и pin/staging root, а при разнесённых физических stores
— startup journal/reconciliation ровно к `published` либо `no-publish` до GC
или следующей записи. В `solution-design.md` §7 по-прежнему описывает только
`recoveryJournal → pending transaction marker` и «атомарно сменить
`currentRevisionId`»; §9 говорит об атомарном создании pin root, но не связывает
его с cross-store reconciliation. Это позволяет A реализовать pointer-first
cleanup, а отдельному recovery/GC unit — ожидать root-first recovery, хотя оба
будут ссылаться на companion.

**Риск.** При crash или stale takeover можно ошибочно освободить pinned bytes
или History root, либо оставить их навсегда достижимыми. Это прямо затрагивает
AD-4/AD-19, безотносительно выбранного IndexedDB Blob, OPFS или hybrid.

**Автофикс.** Согласовать `solution-design.md` §7, §9, §11, §12 и S-3 с
AD-4: зафиксировать *logical*, а не предполагаемо физическую атомарность,
`published|no-publish` recovery before GC и corpus для crash/takeover. Не
выбирать substrate и не изобретать journal schema в Spine; exact persistence
grammar/migration остаются у Project/Backup через `bmad-spec`.

### H-2 — Renderer companion не даёт один сопоставимый AD-10/AD-13 corpus

**Наблюдение.** AD-10 теперь задаёт forced-loss → recreate, repeated-loss
low-quality/2D fallback, diagnostic allow-list и отсутствие потери
Project/Draft/PendingDurability/History/fence/recovery; AD-13 требует один
versioned corpus, camera-sector/cutaway, lazy boundary, interaction parity и
independent review. `solution-design.md` §4 всё ещё ограничен общим списком
«context loss и dispose» и фразой «Решение оформляется ADR»; §11 даёт только
строку про recreate/low quality/2D. Поэтому B может сравнить два engines с
разными forced-loss sequence, memory proxy, fallback threshold или cutaway
fixture и всё равно назвать набор RS-1/RS-2.

**Риск.** Выбор renderer станет несопоставимым, а browser/emulation evidence
может быть ошибочно выдано за physical или participant evidence.

**Автофикс.** Согласовать `solution-design.md` §4, §6, §11–§13 с AD-10/AD-13:
один versioned internal corpus и его outcome fields, без выбора renderer. Exact
one/two-finger, numeric/list, accessibility, safe-area, keyboard,
reduced-motion и видимая cutaway semantics принадлежат UX; physical NFR-15 и
observed participant results — PRD/evidence owners, не этому architecture
review.

### H-3 — AD-20 оставляет V1/V2 и oracle boundary без companion owner/corpus exit

**Наблюдение.** AD-20 правильно делает domain-owned kernel единственным
authority и запрещает external engine в Command/publication/reason-code path.
Но `solution-design.md` §5 всё ещё допускает float-library adapter, который
«нормализует вход/выход», без явного immutable test-only oracle boundary,
запрета reason-code authority и статуса V1/V2 только как characterization
fixtures. §12 owner/corpus register не содержит строки AD-20. В результате A
может отклонять V1/V2 с source-owned recovery outcome, а B — делать их
read-only fixture/preview; оба не будут «молча» migration/promotion, но их
публичный outcome и corpus окажутся разными.

**Риск.** Legacy characterization может быть случайно превращён в migration
policy или наоборот потерян как fixture; библиотека станет де-факто источником
reason outcomes.

**Автофикс / routing.** Согласовать `solution-design.md` §5, §12 и S-2 с
AD-20, указав test-only oracle и corpus route. Не определять здесь
offset/join, raw grammar, stable reason union или V1/V2 migration/recovery
outcome: ими владеют Geometry и Project/Backup companions через `bmad-spec`.
До их canonical adoption это source-owner blocker, а не повод вручную менять
SPEC.

### H-4 — Negative Catalog boundary corpus не landed в architecture companion

**Наблюдение.** AD-17 уточняет `CatalogGatewayPort` allow-list и требует
negative corpus, доказывающий отсутствие Project/Revision/History/Backup,
account и user-pinned blobs не только в endpoint и PostgreSQL, но и в migration,
audit log и delivery cache. `solution-design.md` §8–§9 хорошо удерживают
local-first boundary, но §12/§13 не дают этому negative corpus отдельного
acceptance route. B может не завести Project table и всё же записывать
project-derived request data в audit/cache, не имея теста, который это ловит.

**Риск.** Remote perimeter расширится фактически, хотя domain model формально
останется local-first.

**Автофикс.** Согласовать `solution-design.md` §8, §9, §12 и §13 с AD-17:
catalog-only negative corpus и отдельный `G-CP-ADR` route без service/build/API
implementation. Назначение Legal Rights Authority, Asset Steward,
Security/Operations или independent reviewer требует фактического основания;
Роман как accountable decision owner не получает эти роли автоматически.

## Средний приоритет

### M-1 — Capability map не отражает AD-20 для CAP-8

AD-20 в `Binds` включает CAP-8, поскольку kernel владеет allocation
intent/inverse, но строка CAP-8 в Capability → Architecture Map перечисляет
только AD-3 и AD-12. Это не меняет правило, но ослабляет traceability для
History/inverse corpus.

**Автофикс.** При следующем re-distill добавить существующую ссылку AD-20 в
эту строку; не создавать новую capability или requirement.

### M-2 — Старые формулировки companion могут обесценить evidence disclaimer

`solution-design.md` §4 называет WebGL2 compatibility «на floor devices», а
§12 — real-device sessions, но не повторяет явно AD-13: один internal corpus,
Playwright/simulation не заменяют physical NFR-15 или participant evidence,
а выбор требует independently attributed review. Это не противоречит Spine,
но создаёт риск вырванного из контекста чтения companion.

**Автофикс.** Внести disclaimer при reconciliation H-2, не объявляя никакой
device, legal, participant или readiness outcome.

## Подтверждённые сильные границы

- AD-4 привязывает pointer, Revision, fence, root/lease и recovery к
  `ProjectId`, исключая `pointers[0]` и аналогичные shortcuts.
- AD-10 сохраняет canonical state вне renderer lifecycle; AD-13 явно отделяет
  internal corpus от physical/participant evidence.
- AD-17 и diagram сохраняют единственное local ownership Project data;
  Catalog Control Plane остаётся catalog/provenance perimeter.
- AD-20 не переносит `BigInt`/rational intermediates в durable state и
  возвращает semantic geometry/source reason ownership SPEC companions.
- `domain-model.md` остаётся согласованным на своей высоте: он не должен
  получать renderer objects, browser-storage topology, remote catalog data или
  новую legal/evidence семантику.

## Границы review

Это только adversarial architecture review. Он не запускает corpus, не
атрибутирует independent review, не назначает Legal/Asset/Security/Operations
owners и не подтверждает реальные device/participant/legal результаты. Он не
даёт implementation-readiness verdict.

---
title: "Telegram Mini App S0 — результат SPEC update"
date: 2026-11-04
workflow: bmad-spec
intent: update
headless_status: partial
implementation_readiness: s1_ready_epic10_needs_work_recheck_pending
---

# Результат

SPEC re-derived из append-only decision log и актуальных источников. Это
документный результат с открытыми source/evidence границами, не Telegram READY,
не разрешение на реализацию и не человеческое утверждение. Historical READY
30 августа относится к Web/PWA Alpha. В S0–S7 сохраняются полные Web/PWA,
данные и проверки; retirement возможен только после owner check и отдельного
решения при соблюдении условий доступа к данным, backup и rollback.

## Изменённые файлы

- `_bmad-output/specs/spec-interiors-editor-alpha/.memlog.md` — только append через `_bmad/scripts/memlog.py`.
- `_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md` — kernel, applicability, CAP-13, assumptions/open questions и ссылки на companions.
- `_bmad-output/specs/spec-interiors-editor-alpha/telegram-platform-and-compatibility-contract.md` — новый spec-owned platform/strict-compatibility companion.
- `_bmad-output/specs/spec-interiors-editor-alpha/editor-interaction-and-grid-contract.md` — согласование устаревших dock-delete и Door adjacency с REL/FUP и retired Walk.
- `_bmad-output/specs/spec-interiors-editor-alpha/project-and-backup-contract.md` — S2 cross-context safety и conservative retention.
- `_bmad-output/specs/spec-interiors-editor-alpha/geometry-contract.md`, `topology-corpus-contract.md`, `glossary.md` и `asset-import-contract.md` — согласование V1 exact transfer с PPJ geometry, quarantine fixtures и format-specific backup.
- `_bmad-output/specs/spec-interiors-editor-alpha/portable-backup-ingress-registry.md` — source-owned PPJ/V1-wire/V1-legacy registry и format-specific dispatch.
- `_bmad-output/specs/spec-interiors-editor-alpha/ppj-a1-envelope-and-handoff.md` — установленные PPJ envelope facts, отсутствующие bindings и граница непринятого handoff.
- Этот результат.

Принятые PRD/addendum, UX DESIGN/EXPERIENCE, Architecture Spine и REL/FUP
подключены как adopted companions, не изменялись. Root `project-context.md`,
указанный customization persistent-facts, отсутствует; использован canonical
`_bmad-output/project-context.md`, уже included в companions. Исполняемых
activation hooks и on_complete нет. Локального user-scoped bmad-spec нет;
использован установленный проектный skill и resolved customization.

## Capability и trace

CAP-1–CAP-12 сохранены без перенумерации. **CAP-13** добавлен для Telegram:
локальный scoped host, безопасный lifecycle и подготовленная offline continuity.
Принятый доменный scope CAP-1–8/10–11 применяется к обеим поверхностям;
CAP-7 сохраняет существующий item color/variant, не independent Project variants.
CAP-9 и FR-41 остаются активны для browser/PWA; cold-offline PWA не переносится
на Telegram. CAP-12 остаётся Alpha+; FBX/ZIP, PNG, Focus, Walk и finishes не
повышены в scope. FR-55–58, NFR-28, UXF-8 и AD-25–29 прослеживаются через
новый companion и принятые документы. Downstream workflow обновил Epic 10
(Stories 10.1–10.15), roadmap и traceability для TMA-01–16/TMA-AC-01–13;
его плановое покрытие не является доказательством реализации.

## Диспозиция формата до S3

- Нормативный PPJ-A1 допускает единственный зарегистрированный selector, закрытый
  raw-byte/geometry registry, bounded AST и staging. V1/V2 без зарегистрированной
  грамматики и migration не имеют нормативного automatic import.
- Baseline export ставит `interiors.project/alpha-1` / `1` в manifest, но
  сериализатор не пишет root `projectSchemaId`; текущие Room и плоские asset
  records расходятся с PPJ-A1. Production import применяет raw AST guard и
  V1 structural/canonical reserialization checks, не подключая отдельный PPJ
  staged member ingress. Совпавший label не доказывает совместимость.
- Source serializer/export и synthetic real-ZIP legacy-door test дают ограниченное
  свидетельство определённых baseline code paths; тесты в этом workflow не
  запускались и не доказывают PPJ compliance, реальный пользовательский файл,
  cross-platform support или physical handoff. Ни одна реальная build/schema
  пара Web/PWA ↔ Telegram пока не подтверждена.
- До зависимого S3 source owner должен разрешить collision идентификатора и
  зафиксировать точные зарегистрированные форматы и compatibility/migration
  disposition, supported builds/schema и доказательства на реальных файлах;
  source-owned/human policy choice остаётся открытым, если потребуется. Raw
  registry, reason precedence и целая геометрия не ослабляются; молчаливая
  promotion/migration запрещена. Независимый S1 не блокируется этой конкретной
  зависимостью после действующего planning/readiness gate.

## Self-validation: оба прохода

**Coherence — PASS WITH OPEN SOURCE CONFLICT.** Проверены 13 уникальных
последовательных CAP definitions, в каждом есть intent и success; ограничения,
non-goals, измеримый success signal и assumption/open-question границы имеются.
CAP-9 сохранён, CAP-12 не повышен. Back/Close не называет draft сохранённым;
AD-26/28/29 остаются assumptions. Противоречие AssetUsageGrant и физические
свидетельства не разрешены в этом проходе.

**Preservation — PASS WITH OPEN SOURCE CONFLICT.** Проход по load-bearing
утверждениям S0 и принятым owner-документам:

| Источник / группа утверждений | Где сохранено |
|---|---|
| TMA-01–04: shared core, независимые входы/worker/output, schema guards и rollback | CAP-9/13, platform companion «Host» и «Доставка»; AD-25/28 |
| TMA-05–09: функциональный паритет, доступность, Back/Close, draft/lifecycle и подготовленная offline continuity | CAP-1–8/11/13, platform companion «Host»; FR-55, UXF-8, AD-27 |
| TMA-10–11: account scope, late operations, quota/recovery/history/fence | CAP-1/8/13, platform companion «Host»; FR-56, AD-26, существующие Project/Backup companions |
| TMA-12–13: двусторонний перенос, точный формат и честный физический handoff | CAP-10/13, platform companion «Строгий перенос»; FR-57, AD-29 и действующий PPJ registry |
| TMA-14–16: identity/privacy, catalog-only и release/diagnostics | platform companion «Host», «Доставка», «Открытые границы»; NFR-21–28, AD-17/24–29 |
| S0–S7, принятие и deferred retirement | platform companion «Доставка»; FR-58/AD-25, применимые критерии NFR-28 |
| Прежний доменный контракт и Alpha+ границы | CAP-1–12 и существующие companions сохранены; governance и ранние superseded statements читаются по их текущим решениям |
| Последние UX поведения и поздние исключения | adopted REL/FUP, UX DESIGN/EXPERIENCE, исправленный editor interaction companion |
| PRD FR-55–58/NFR-28, UXF-8, AD-25–29 и их детали | каждый upstream документ включён в companions, platform companion задаёт applicability и связанные gates |

Wrapper-only content: порядок создания чатов, имена исполнителей и исторические
команды прогонов — процессная provenance, не требования продукта; они остаются
в preflight/result, но не продублированы в SPEC. Исторические baseline и
readiness отчёты не переименованы в новое evidence. Конфликт source owners
явно выведен как вопрос, а не скрыт выбором одного документа.

В первоначальном проходе проверены 19 существующих путей companions, отсутствие memlog в frontmatter,
уникальные CAP-1–13 с intent/success, обязательные поля kernel, локальные
Markdown-ссылки трёх изменённых spec-файлов и наличие anchors platform claims.
Это структурная проверка документов. Application, build, test и config не
изменялись; application tests и physical Telegram tests не запускались. Commit
и публикация не выполнялись.

## Открытые вопросы для владельцев и readiness

1. AGENTS требует human-approved AssetUsageGrant, PRD/SPEC/AD-14 исключают
   Alpha grant admission. Владельцы источников и readiness определяют
   применимость и разрешение до зависимого admission/release; policy не менялась.
2. Source-owner disposition selector collision/совместимости и подтверждение
   реальными файлами обязательны до зависимого S3. Legacy не становится
   поддерживаемым по наблюдению кода.
3. Реальные bot/HTTPS origins, signed identity/Ed25519 и безопасное разделение
   аккаунтов, lifecycle/storage и rollback — pending release evidence.
4. NFR-28 и реальный внешне сохранённый/reselected файл в обоих направлениях на
   iOS/Android остаются pending. Если локальная передача невозможна, альтернативу
   и её privacy/retention отдельно решает владелец; upload не разрешён.
5. Официальный readiness дал `READY` ограниченному S1 / Story 10.1 и признал
   существующее поручение владельца достаточным для этого scope; S1 выполнен.
   Отдельные локальные planning verdicts для других срезов не являются полным
   S2 PASS или S3 READY. Epic 10 остаётся `NEEDS_WORK`; актуальный S2/S3 delta
   ожидает применимого recheck. Baseline tests не заменяют Telegram acceptance.

## Фактическая синхронизация после downstream

Статус verification map приведён в соответствие с завершённым
[Epics result](telegram-mini-app-s0-epics-result-2026-11-04.md). Оценка
implementation readiness оценивался в отдельном чате; эта синхронизация не
объявляет READY или approval и не меняет capability/contract scope.

## Reconciliation FR-9 / FR-16 после readiness finding

PRD owner согласовал FR-9/FR-16 с принятыми REL-08/REL-05. CAP-3 и spec-owned
editor interaction companion теперь отражают: пользователь меняет Room type и
height; существующее `Room.name` не переписывается и сохраняется при reopen,
UI не предлагает менять имя и не показывает историческое имя на плане. Поля,
schema и сохранённые данные не удаляются; canvas Room selection не вводится.

CAP-2 и editor interaction сохраняют перемещение Vertex, автоматическую
нормализацию контактов и необходимое разделение сегментов; отдельные жестовый
и числовой UI-маршруты split не добавляются. Доменная логика и уже разделённые
стены остаются совместимыми. FR-9/FR-16, CAP IDs и adopted PRD/UX/Spine не
редактировались этим workflow.

Проверен готовый downstream delta: все обязательные AD-26 guards и controlled
commit/journal/GC races теперь относятся к первой writable Story 10.2; 10.3
расширяет проверки. Это изменение плана, не доказательство реализации. Readiness
отдельно назначил `READY` узкому S1 и подтвердил применимость исходного owner
поручения к нему; Epic 10 в целом остаётся `NEEDS_WORK` до независимой повторной
оценки. Физическое принятие, совместимость формата и licensing не заявлены.

Оба Spec Law прохода выполнены для этого delta: coherence — PASS для FR-9/FR-16
и стабильных CAP; preservation — PASS с сохранением модели, данных, строгой
геометрии и действующих открытых format/licensing/physical границ. PRD и UX
включены по ссылке; wrapper-only content для этого узкого delta отсутствует.
Проверки документные; application tests и physical acceptance не выполнялись.

## AD-26 / AD-30: предыдущий source-owner снимок (до обновлённой grammar)

**Состояние предыдущего снимка:** последующие решения зафиксированы в разделе ниже.

**S2 contract reconciled.** SPEC принимает архитектурный S2 fencing disposition
как обязательный companion; Project/Backup и platform companions фиксируют
scope Web Lock, atomic fenced stage/pointer/receipt, monotonic counter и no-ABA,
no-publish/conditional cleanup, точный atomic protect/pin и безопасное
последующее takeover/recovery. Каждый пункт disposition и его тесты должны быть
выполнены до первой writable операции 10.2. Общего scope-wide GC в baseline нет,
в S2 он не добавляется; консервативное сохранение bytes и всех roots не заменяет
SessionRetentionPolicy. Потеря fence или неясный исход не разрешают очистку.
Это contract derivation, не свидетельство выполнения гонок. Standalone identity
validator и session barrier ещё не являются Telegram runtime/storage либо S2
PASS. Ed25519 protocol/keys — Telegram, signed positive fixture — независимая
tma.js документация, не официальный Telegram SDK; fixed test clock для старого
fixture не отменяет production freshness.

**AD-30 / S3 — source registration blocked, а не completed.** Архитектура
предложила отдельный `interiors.project/runtime-v1-wire@1` и синтаксическую
legacy ветвь для `alpha-1@1` с отсутствующим root selector. Они не добавлены в
активный SPEC registry. PPJ-A1, его raw registry, bounds и error precedence
остаются прежними; приложение исходные IDB/revisions/checksums не переписывает.
Source hashes трёх архитектурных snapshot файлов совпали с указанными в S3
disposition при документной сверке. Это идентификация источников, не результат
совместимости или настоящего file corpus.

Граница блокировки конкретна:

1. **Пересекающийся empty legacy V1.** После диагностического добавления одного
   root selector отдельные пустые исторические V1 могут также соответствовать
   PPJ. AD-30 требует отклонить неоднозначное без публикации и сохранить bytes и
   старую поверхность. Это не гарантирует автоматический импорт всех старых
   файлов. Если такое покрытие требуется, Product/source owners выбирают точное
   разрешение до зависимой S3 acceptance; provenance по форме не угадывается.
2. **Negative zero и FR-44.** Исходное `yawRadians = -0` может потерять знак при
   JSON.stringify. Нужны source-owner решение точного представления и доказательство,
   что новый wire экспортирует каждый non-corrupt Durable Project по действующей
   policy; иначе нельзя заменить старый browser export/recovery. Уже записанное
   `0` не доказывает прежний знак. Реальные данные и supported-file matrix не
   исследованы этим workflow; `0.5`, optional presence и приоритет `yawStep` не
   округляются и не теряются.
3. **Незавершённая спецификация wire.** Architecture перечисляет keys и часть
   discriminators, а точные прочие ranges, string/enum и cross-field relationships
   передаёт в замороженные source snapshots. Они ещё не перенесены в полные closed
   versioned tables SPEC с raw numeric rules, exact nested serialization/order,
   limits, host/resources, routing всех import/repair callers и reason mapping.
   Пример необходимых snapshot-правил: vertex x/z −100000..100000, wall thickness
   20..1000, room height 500..10000, floor elevation только 0; `colorVariantId`
   должен соответствовать color и недоступен с `assetDefinitionId`; catalog
   quartet присутствует только вместе. Это примеры, не законченная grammar.
   Наряду с ними необходимы domain/backup limits: например SPEC допускает не более
   100 уникальных AssetDefinition, хотя structural V1 validator имеет cap 250.
   Нельзя считать 250 полномочием ослабить меньший действующий предел.
4. **Доказательства.** Требуются corpus для raw path/AST/selector/checksum
   precedence, ambiguous и отрицательных случаев, exact fields/finite yaw и
   no-overwrite, а также идентифицированные реальные файлы/builds и физический
   двусторонний iOS/Android handoff. Unknown selector с oversized member или
   checksum fault сохраняет более ранний зарегистрированный reason. Synthetic
   tests или наличие файлов кода не доказывают эти требования.

S1 имеет отдельный verified browser-only результат; его READY и ранее выданные
локальные planning verdicts не являются одобрением S3 или полной приёмкой S2.
Изменённые архитектурой safety/format границы ожидают независимый readiness
recheck. AssetUsageGrant conflict, настоящая signed identity/account isolation,
physical NFR-28, bot/origin и внешняя передача по-прежнему требуют отдельного
разрешения или evidence по их собственным границам. В этом workflow нет нового
READY, policy approval, application/build/test/config changes, test run, commit
или публикации.

**Self-validation этого delta:** coherence — PASS WITH OPEN BLOCKERS: 13
стабильных CAP с intent/success, S2 safety и S3 ограничения отражены без нового
readiness claim. Preservation — PASS WITH OPEN BLOCKERS: S2 disposition принят
целиком по ссылке, PPJ registry и порядок ошибок сохранены, AD-30 зафиксирован
как proposal с точным source-owner handoff; несовместимые/неполные варианты не
зарегистрированы. Проверены 21 companion path, локальные ссылки и наличие
ключевых S2/S3 границ. Первые два машинных поиска строк завершились ошибкой из-за
неточного поискового текста (`empty V1`, затем `negative zero`); после
исправления критериев документная проверка прошла. Тесты приложения не запускались.
Wrapper-only content: имена reviewers и история промежуточных review остаются в
architecture result; в normative companions не дублируются.

## Итоговое обновление AD-26 / AD-30

Зарегистрированы три маршрута Portable Backup: прежний PPJ-A1, exact
`interiors.project/runtime-v1-wire@1` и V1-legacy с historical byte equality
и зарегистрированным PPJ-disjoint witness. Полная закрытая grammar, bounded
V1 parser, manifest/resources, размеры и порядок ошибок приняты по ссылке на
source-owned architecture disposition. Это нормативная регистрация, не codec
implementation, подтверждение совместимости пользовательских файлов или S3
READY. Сохранены PPJ raw/Unicode/AST/reason rules, current ProjectLimitsPolicy
(100 definitions, несмотря на structural V1 ceiling 250), старый serializer,
IDB, revision bytes и checksums. Geometry нормализует ноль для команд и PPJ;
V1-wire отдельно сохраняет source `-0`, UTF-16, own-undefined и допустимые
VariantValue без изменения вычислений геометрии.

S2 использует одну scoped IDB v2; atomic v1 upgrade сохраняет identity и counter,
а первой writable операции предшествует полный cross-context fencing protocol.
Undo/Redo адресует exact owned Revision с новым attempt/receipt, без overwrite и
без новой semantic Revision. Существуют metadata cases и работа над core
publication по сообщённому состоянию; этот SPEC workflow их не запускал, не
проверял и не объявляет полным S2 PASS.

Открытые границы:

1. Пустой или иной legacy file без disjoint witness отклоняется с сохранением
   исходника. Old-build→same-context upgrade→new-wire — только кандидат recovery,
   пока не подтверждён на конкретном файле; если путь для sole-copy невозможен,
   Product Owner определяет условия FR-57. Читаемые sole-copy вне closed V1
   grammar, включая нестандартные non-index array properties, не объявляются
   corrupt: source owner должен доказать их точный recovery либо отдельно
   разрешить соответствующую границу.
2. Для сохранения FR-44/NFR-13 до замены browser exporter нужны исполняемый
   worst-case proof для заявленных bounds и доказательство, что все non-corrupt
   Durable Projects действующей policy переносимы без потерь. Иначе старый
   export/recovery сохраняется. Нормативный V1-wire сохраняет имеющийся `-0`;
   старый сериализованный `0` не позволяет восстановить утраченный знак.
3. PPJ full mapper, реальные build/file pairs и physical iOS/Android roundtrip,
   host/account isolation и release/rollback остаются pending. AssetUsageGrant
   source conflict не решён. Никакой human approval, S2/S3 READY, реализация,
   commit или публикация этим derivation не заявляются.

Self-validation последнего derivation: coherence — PASS WITH OPEN EVIDENCE;
CAP-1–13 и условия сохранения данных согласованы, более строгие Project limits
не изменены. Preservation — PASS WITH OPEN EVIDENCE: PPJ grammar/AST/reasons
сохранены, V1 и S2 полные source-owned tables включены по adopted links,
исторические неотносящиеся TCC fixtures не получают production handoff.
Проверены 21 companion path и локальные ссылки, структура CAP и ключевые
format/safety границы; первичная проверка строк ошибочно ожидала пробел через
перенос строки, после исправления поиска документная проверка прошла. Кодовые
и физические тесты в этом workflow не выполнялись. Wrapper-only content:
промежуточные reviewer snapshots остаются в architecture result.

## PPJ envelope audit и независимый V1 handoff

Закрытая PPJ Project DTO/AST grammar существует, но source-owned полный
manifest/checksum-ledger key registry и точная связка `resourceRefs`,
`contentHash`, `proofRef` с catalog/custom entries не найдены. Предыдущий
browser V1 manifest не устанавливает эти правила для PPJ. Единственные прямо
подтверждённые selector/path/source и integrity факты и точные пропуски
перечислены в новом [PPJ companion](../_bmad-output/specs/spec-interiors-editor-alpha/ppj-a1-envelope-and-handoff.md).
Он **не объявляет PPJ envelope закрытым** и не меняет legal/content policy.
`proofRef` и формулировка proof route противоречат отказу от Alpha grant admission
в PRD/SPEC/AD-14; отдельно остаётся требование AGENTS на AssetUsageGrant. Без
согласования владельцев нельзя выдумать назначение `proofRef` или новый gate.

Независимый V1 envelope codec может передать PPJ candidate полному PPJ validator
как immutable bounded raw handoff без принятия Project и без V1 fallback.
Завершённый strict single-dispatch и checksum verification допустимы лишь после
фактической проверки всех предшествующих PPJ manifest/size/checksum/AST/root
boundaries по их исходному precedence. Если отсутствует необходимая PPJ schema
или validator, раннее lookahead остаётся tentative, передаётся исходный archive,
а вызывающий путь честно сообщает недоступность проверки; Project не
публикуется, источник сохраняется. Один digest или member AST не является
валидированным PPJ. Эта граница не требует менять внутренний V1 serializer.

Open source-owner correction до полного PPJ acceptance: закрытые поля и связи
manifest/ledger/descriptor, exact resource ID→hash/path/media/cardinality,
shared/dangling/duplicate правила и error precedence; отдельно применимость и
семантика `proofRef`/AssetUsageGrant. Эта correction не запрещает независимо
реализовывать V1 envelope в рамках уже применимого scope и не присваивает S3
READY. Пользователь сообщил о 199 новых V1 codec tests и 2274 PASS snapshot;
данный документный workflow их не запускал и не выдаёт за PPJ или release proof.

Self-validation PPJ handoff delta: coherence — PASS WITH OPEN SOURCE CONFLICT;
CAP-1–13 и применимый strict ingress не ослаблены, непроверенный PPJ не может
стать Project. Preservation — PASS WITH OPEN SOURCE CONFLICT: ранее утверждённые
PPJ selector/path/size/checksum/AST и V1 single-dispatch сохранены, отсутствие
закрытого envelope и конфликт proof admission выведены явно; полная PPJ grammar
не выдана за завершённую. Проверены 22 companion paths и локальные ссылки;
первая текстовая проверка ошибочно ожидала слово `tentative` внутри companion,
после замены на фактическое `lookahead` проверка прошла. Application tests не
запускались; wrapper-only content не переносился из документации кода в SPEC.

## Уточнение PPJ control handoff

Исправлен фактический счёт: текущий browser V1 `PortableManifest` содержит
**11**, а не 12 root keys. По Project/Backup contract общие import guards
включают manifest ≤1 MiB, container ≤200 MiB, unpacked ≤300 MiB, ≤1000 entries,
entry ≤100 MiB и compression ratio ≤50:1, а также raw path/container/duplicate
checks; `checksums.json` не имеет отдельно установленного ledger-specific byte
cap. Эти границы не ослабляют последующие более строгие resource/admission limits.
PPJ AST-R1 применяется к `project/project.json`, не автоматически к manifest
или ledger. Source-owned PPJ control JSON depth/member/array/string/node caps
не обнаружены; V1 scanner caps не становятся общими PPJ пределами.

Если V1 scanner достиг собственного control-file cap до доказанной PPJ
classification, а ранний generic fault независимо не установлен, вызывающий
путь может выдать только непринятый `requires-ppj-validation` candidate с
immutable bounded archive/control bytes, optional unverified selector metadata
и перечнем невыполненных checks. Это не invalid Project, не checksum PASS и не
завершённый single-dispatch; полный PPJ validator выполняет недоказанные ранние
проверки в установленном порядке. Действительно доказанные ранние generic faults
и их precedence сохраняются. Полные V1-wire/strict legacy routes не меняют свою
закрытую grammar, пределы и reason codes. PPJ→V1 fallback запрещён.

Закрытая PPJ manifest/ledger/resource grammar и конфликт `proofRef`/licensing
по-прежнему открыты; эта правка не присваивает PPJ acceptance, новый READY или
human approval и не меняет код/config/test.\nEOF
Self-validation этого уточнения: coherence — PASS WITH OPEN SOURCE CONFLICT;
PPJ candidate не считается принятым, проверенным checksum или окончательно
направленным до соответствующих boundary checks. Preservation — PASS WITH OPEN
SOURCE CONFLICT; source-owned общие byte/container limits и установленные ранние
ошибки сохранены, V1 caps не превращены в PPJ policy, неизвестная PPJ control
structure не классифицируется только из-за V1 scanner capacity. Документно
проверены 11 фактических keys, 22 companion paths и локальные ссылки; app tests
не запускались. Wrapper-only content отсутствует.

## Manifest-size reason и граница GLB — narrow correction

До этого обновления источники устанавливали manifest hard 1 MiB и существующий
`BACKUP_MANIFEST_INVALID`, но прямо не присваивали reason превышению размера.
Source-owned registry теперь назначает **`BACKUP_MANIFEST_INVALID`** declared
или streamed uncompressed `manifest.json` больше 1 MiB после более ранних
container/path/entry faults и до полного control parse, Project size/checksum
или PPJ handoff. Ровно 1 MiB не превышает лимит. Это не Project AST-R1 и не
новый код. `checksums.json` больше 1 MiB не отклоняется по manifest- или V1-only
control cap для tentative PPJ; общие entry/container limits действуют.

Отдельный technical Telegram V1 portable GLB seam ≤50 MiB не меняет default
25 MiB hard для custom/catalog и не разрешает новую reference. Новый custom
Project/reference из недоверенного backup проходит применимый 25 MiB до parse;
если применимость не установлена, используется более строгий предел. Exact-byte
repair уже существующего ожидаемого hash — не новая admission: hash-only restore
не доказывает допустимость parse/decode/render. При разборе действует default
25 MiB, пока asset-policy owner не определил применимость к конкретному пути
25–50 MiB; 50-MiB smoke недостаточен для publication/reopen. Такой вопрос не
решается изменением grant/licensing policy. Исходник и recovery state сохраняются.

Self-validation: coherence — PASS WITH OPEN POLICY QUESTION: reason привязан к
manifest, не PPJ Project AST; 25-MiB default не подменяется technical 50-MiB
seam. Preservation — PASS WITH OPEN POLICY QUESTION: ранняя precedence и ledger
candidate сохранены; exact repair не переименован в новую admission, owner
решение о безопасном parse/decode/reopen существующих 25–50 MiB остаётся открытым.
Проверены документные границы, порядок строк reason, 22 companion paths и
локальные ссылки. Application tests и physical evidence не запускались.

## Format-specific feasibility и выбранный browser transfer ingress

Принят source handoff AD-30 для trusted Telegram V1 feasibility: один выбранный
adapter во всех active путях, включая direct custom caller, использует тот же
scoped `repository.resources` и exclusively owned candidate, что writer и
publication. Проверяются exact V1 wire, existing domain/resource policy и полные
256 bits каждого исходного key; измеряется STORE envelope либо применяется
dоказанный bound `4096 + 1024 × original references`. Существующие limits,
25 MiB custom admission, SessionRetention и fenced revalidation не ослаблены;
PPJ AST внутренней V1 Revision не подменяет проверку V1 wire. Browser default
policy и прежние проверки не меняются. Это source контракт, не заявление о
выполненном тесте или новом gate.

**Применимость:** FR-45 и FR-57 допускают явно выбранный пользователем отдельный
registered-transfer ingress в Web/PWA для TMA→Web/PWA через общий ImportUseCase
и strict зарегистрированный codec, при неизменных прежних import/export действиях.
Файл не выбирает permissive fallback; import создаёт новый Project только после
полного validation и atomic publication. PPJ без полного validator/mapper не
принимается, происхождение файла не выводится из его selector или checksum.

Browser default feasibility остаётся прежним: snapshot, который он не может
проверить, нельзя объявить поддержанным или допустить в обход policy.
Распространение Telegram-only format-specific policy на browser потребует
отдельного source-owner решения, если окажется необходимым. Единый видимый
transfer entry и явный выбор route сохраняются; UI-композиция, нарушающая
прежние действия или требующая отдельной Backup-поверхности, передаётся UX owner.
Старый decoder не читает новый wire. Этот независимый import path не выполняет
FR-44 gate замены exporter: доказать exact backup всех non-corrupt Durable
Projects действующей policy, включая sole-copy/non-index properties, ещё нужно.
Physical cross-platform roundtrip, S3 READY и human approval не заявляются.

Self-validation: coherence — PASS WITH OPEN UX/COMPATIBILITY BOUNDARY: выбор
V1 policy остаётся доверенной composition, user выбирает только transfer route;
новый ingress не заменяет browser default/exporter. Preservation — PASS WITH
OPEN UX/COMPATIBILITY BOUNDARY: source limits, direct custom, history/fence,
PPJ handoff и FR-44 gate сохранены; несовместимые V1 snapshots не объявляются
принятыми. Проверены 13 CAP, 22 companion paths и локальные ссылки. Тесты
приложения и физические проверки не запускались; wrapper-only content отсутствует.

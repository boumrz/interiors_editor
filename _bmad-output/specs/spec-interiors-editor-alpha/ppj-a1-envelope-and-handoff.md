# PPJ-A1: граница envelope и передача полному validator

Статус: **source-owner audit и ограниченный handoff contract; закрытая PPJ
manifest/resource grammar не завершена**. Этот companion не вводит новую
лицензионную или content policy, не переопределяет PPJ-A1 Project DTO/AST и не
доказывает PPJ implementation. Нормативный Project registry и порядок ошибок —
[portable-backup-ingress-registry.md](portable-backup-ingress-registry.md);
пределы и полнота backup — [project-and-backup-contract.md](project-and-backup-contract.md).

## Что уже установлено источниками

| Область | Установленная граница | Чего источник не определяет |
|---|---|---|
| Project selector | Manifest `projectSchemaId=interiors.project/alpha-1`, `projectSchemaVersion=1`, `canonicalProjectPath=project/project.json`; root `projectSchemaId` и `schemaVersion` совпадают, `sourceProjectId` совпадает с root `projectId`. Неверный manifest selector — прежний `BACKUP_MANIFEST_INVALID`, неверная зарегистрированная пара/root — прежний `BACKUP_SCHEMA_UNREADABLE` после ранних стадий. | Полный набор имён/типов/кардинальностей всех обязательных и необязательных PPJ manifest keys и расширений. |
| Archive paths | Точные ASCII имена `manifest.json`, `checksums.json`, `project/project.json`, `catalog/<64 lowercase hex>.asset`, `catalog/<64 lowercase hex>.texture`, `custom/<64 lowercase hex>.glb`; raw filename grammar, duplicate/path guards и `manifest.entries` membership действуют по registry §4.1/§5. | Закрытая форма каждого `manifest.entries` record и порядок/форма всех ledger records, а также однозначное связывание descriptors с DTO IDs. |
| Integrity и размер | Exact bytes/resources, checksums, media/size/resource descriptors, completeness и лимиты обязательны. Для Project member: путь/container → manifest boundary → 10 MiB → checksum → PPJ AST-R1 → closed Project/schema → limits/domain/resources. Ранний fault побеждает поздний по registry §4–5. | Полные имена ключей manifest/ledger, byte-level schema каждого checksum/size/media и policy-envelope, алгоритм cross-record binding/uniqueness. |
| Project resource references | `/assetDefinitionRefs/*` содержит `assetDefinitionId`, `source`, `semanticSnapshot`, `contentHash`, `resourceRefs`, `proofRef`; `resourceRefs` — distinct sorted opaque IDs, `proofRef` — opaque ID, `contentHash` — lowercase SHA-256, который должен разрешаться в referenced manifest/resource hash. | Точная таблица `resourceRefs` → descriptor → archive path/hash/media, role главного `contentHash`, допустимые shared/deduplicated IDs и политика dangling/unreferenced entries, а также назначение и target `proofRef`. |
| Alpha source ownership | Владелец 2026-11-04 согласовал AGENTS с PRD/SPEC/AD-14: formal AssetUsageGrant/licensing/provenance/declaration/attribution/notice admission не является Alpha gate; владелец отбирает бесплатные или свои модели вне приложения. | Техническая семантика и binding обязательного PPJ wire-поля `proofRef` ещё не определены; нельзя выдумывать его назначение или вводить legal gate. |

Одиннадцать keys текущего browser `PortableManifest` и его `resources` описывают
наблюдаемый V1 envelope; они не являются утверждённой полной PPJ grammar.
Нельзя выдавать V1 shape или синтетические тесты за доказанный PPJ manifest.
Имеющийся `ppj-a1-canonical-project-member-ingress` принимает уже выбранную
entry/length/checksum от внешней границы и возвращает lossless AST; он сам не
парсит manifest, не связывает ресурсы и не создаёт accepted Project.

## Общие control bounds и граница V1 scanner

Общие source-owned импортные архивные limits из Project/Backup contract: для
`manifest.json` warning 512 KiB и hard 1 MiB; весь container — 200 MiB hard,
суммарный unpacked payload — 300 MiB hard, не более 1000 entries, один entry —
100 MiB hard и compression ratio — 50:1. Контейнер, safe raw ASCII path,
allowlist, duplicate entries, поддерживаемые compression methods и другие
ранее установленные guards действуют до acceptance для всех форматов. Для
`project/project.json` отдельно установлен hard 10 MiB до checksum. Превышение declared или streamed uncompressed `manifest.json` hard 1 MiB даёт
существующий `BACKUP_MANIFEST_INVALID` после более ранних container/path/entry
faults и до полного control parse, Project size/checksum или PPJ handoff; ровно
1 MiB этот guard допускает. Это не Project AST-R1. Для `checksums.json`
источники задают общие entry/container/unpacked пределы, но
**не** отдельный ledger-specific byte limit. Это import guards, не разрешение
ослаблять более строгие Project/resource/admission limits, применяемые позднее.
Проверка `manifest.entries` membership остаётся невыполненной, если control
boundary не удалось разобрать с допустимой для данного формата грамматикой.

В manifest и checksum ledger обязательны bounded raw UTF-8/JSON и duplicate-key
checks по AD-30; если такой fault действительно установлен и является первым
по действующей очереди, он не отменяется из-за handoff. Однако PPJ control-file
JSON не имеет source-owned structural depth/member/array/string/node caps:
`AST-R1` с его пределами относится только к **Project member**. V1 scanner
(depth 8, ≤32 members/object, ≤1024 elements/array и ≤4 KiB decoded string
charge) и закрытые V1 manifest/ledger grammar обязательны для конкретных V1-wire
и строго выбранных legacy paths, но не становятся PPJ control schema.

Если V1 scanner исчерпал собственную capacity при обработке неоднозначных или
предположительно PPJ control bytes и нет независимо доказанного общего fault,
это не `BACKUP_MANIFEST_INVALID`, не invalid Project и не доказанная ошибка PPJ.
Нельзя автоматически продолжить parsing с тем же произвольным V1 limit, назвать
его общим PPJ AST или обходить более ранние уже установленные ошибки. Точный
PPJ control-parser structural envelope требует отдельного source-owned решения.

## Разрешённая передача без принятия Project

Независимый V1 envelope codec может передать PPJ route отдельному полному PPJ
validator как **непринятый handoff**. Существуют две разные стадии:

1. До завершения всех предшествующих PPJ boundary checks non-accepting lookahead
   вправе только выбрать *кандидат* для PPJ validator и передать исходный
   immutable bounded archive/handle вместе с точными manifest, ledger и
   Project bytes/entries, необходимыми validator. Это не завершённый dispatch и
   не утверждение о верном checksum, binding, ресурсе или валидности Project.
   Если недостаточно утверждённых PPJ structural bounds для проверки control
   boundary, допустим внутренний `requires-ppj-validation` candidate: он хранит
   immutable bounded исходный archive/handle и исходные control bytes, может
   нести selector-only metadata только как optional/unverified и перечисляет
   все невыполненные проверки. Устойчивость snapshot не превращает computed
   digest в сверенный checksum. Это не публичное `accepted` и не новый stable
   `BACKUP_*` reason.
2. Завершённый strict single-dispatch к PPJ может быть объявлен только когда
   соответствующие source-owned проверки container/raw paths, manifest и его
   bindings, размер, checksum, PPJ AST-R1, root selector и source-ID уже
   действительно пройдены в требуемом порядке. Промежуточный результат может
   сообщить только фактически проверенные границы; вычисленный digest без
   проверенного expected checksum не является checksum verification.

Передача сохраняет точные bytes и integrity защищённого неизменяемого snapshot;
не допускаются исправление JSON, потеря raw numeric lexemes, сортировка или
повторная сериализация. Нельзя интерпретировать PPJ как V1 при любом отказе,
неизвестности или отсутствии PPJ validator. Handoff не создаёт `accepted Project`,
не запускает resource pin, allocation Project/Revision ID, domain mutation или
publication. Временное bounded staging с cancel/cleanup подчиняется действующим
fence/root safety и не удаляет чужие данные.

Полный PPJ validator обязан выполнить оставшиеся и, если boundary ещё не
удостоверена, все ранние проверки, включая пропущенные manifest/ledger guards,
в source-owned порядке, затем closed Project
shape, все raw-geometry/AST limits, domain/host и resource integrity. Только
после этого и **полного lossless** mapper к текущей модели возможна обычная
fenced atomic publication нового Project ID. Ни один raw handoff или member AST
не является доказательством выполнения последующих стадий.

Если полный validator/mapper или необходимый closed PPJ envelope contract
отсутствует, вызывающий путь сообщает **недоступность проверки/импорта** и
сохраняет исходный файл; он не заявляет successful import или потерю данных и
не классифицирует корректный PPJ как schema-invalid только из-за отсутствующей
реализации. Уже доказанные ранние ошибки сохраняют исходные reason и precedence;
этот документ не назначает новый stable `BACKUP_*` код. Одинаковый raw archive
может быть передан только выбранному маршруту; ошибки PPJ не запускают V1.

## Открытая source-owner correction до полного PPJ acceptance

Должен появиться versioned закрытый контракт, в котором явно перечислены
manifest/ledger object keys, типы и cardinalities, порядок и нормализация,
различие malformed manifest и checksum/limit/domain/resource errors,
policy/technical descriptors, exact SHA-256/length/media bindings и таблица
`resourceRefs`/`contentHash` к `.asset`/`.texture`/`.glb` entries, включая
shared resources, duplicates, orphan и отсутствующие bytes. Corpus должен
проверить полный цикл для catalog/custom resources, подмену и cancellation,
все ранние reason precedence и отсутствие публикации на любой ошибке.

Прежний конфликт AssetUsageGrant разрешён владельцем: formal licensing/grant
admission не требуется для Alpha. Отдельно source owner должен определить
техническое назначение и binding обязательного PPJ wire-поля `proofRef` в полном
envelope, не создавая legal/provenance gate и не меняя wire shape без явного
source-owned обновления. Это не блокирует самостоятельную работу V1, если PPJ не
проталкивается в V1 и не заявляется принятым. Наличие PPJ Project grammar не
заменяет решение об envelope или независимый полный PPJ validator/mapper.

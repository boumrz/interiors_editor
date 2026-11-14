# Post-fix adversarial review — G-V01-S3

Дата проверки: 2026-08-09  
Объект: текущий `ARCHITECTURE-SPINE.md`, AD-4, AD-11, AD-14, AD-17  
Статус: reviewer gate input; не implementation-readiness/release verdict

## Вердикт

**PASS для проверенных H-1, H-2, H-3 и M-1.** В текущем Spine не осталось
critical/high finding в границах storage/recovery-PWA writer fencing и Catalog
Control Plane, которые проверялись этим adversarial lens. Это означает только,
что четыре ранее указанных архитектурных расхождения теперь конвергируют; не
означает выбора substrate, прохождения corpus, device evidence, Security/
Operations/Legal review, `READY` или release.

## Проверка прежних findings

| Finding | Результат | Почему две independently-built единицы теперь сходятся |
| --- | --- | --- |
| H-1 — scope fence | Закрыт | AD-4 вводит единый `Project-scoped fenced transition` для Command publication, takeover, COW migration, recovery, `DiscardSessionHistory`, Trash/restore/permanent delete и journal completion; transition проверяет current Project state и fence, stale work не может publish/resurrect/rewind/release root. |
| H-2 — cross-store predicate | Закрыт | AD-4 требует journal record с `ProjectId`, expected base/current generation, candidate checksum, acquired fence generation и target root manifest; reconciliation idempotent только по этому predicate и не меняет newer generation. |
| H-3 — PWA writable compatibility | Закрыт | AD-11 детерминированно выбирает `writable`, `read-only/exportable` либо `migration-in-progress`; publication/migration допускается только manifest-authorized writable client, source удерживается AD-4 recovery root. |
| M-1 — catalog bundle | Закрыт | AD-14 определяет immutable versioned `CatalogVersion` descriptor bundle, связывающий identifier, resource/subresource hashes, provenance, grant и notices до local pin; silent assembly раздельных ответов запрещён. |

## Проверка остатков критического/высокого уровня

Не найдено. AD-17 сохраняет negative perimeter: remote availability не
участвует в publication/fence/root/migration/recovery choice, а запрещённые
Project данные исключены также из endpoint, migration, PostgreSQL, audit log и
delivery cache. AD-4 сохраняет exact root inventory и release только после
proven `no-publish`/unreachability; AD-11 больше не трактует readability как
writability.

## Границы проверки

Не проверялись и не закрывались: IndexedDB Blob/OPFS/hybrid selection, lease
timeout, journal/storage schema, service-worker cache/retention, API/transport,
Kotlin build/framework, deployment/DB operations, authentication, security,
privacy, Legal/Asset grants и фактические physical lifecycle/quota/update
traces. Они остаются deferred либо требуют `G-CP-ADR` и versioned external
evidence.

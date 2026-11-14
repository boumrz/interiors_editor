# Verification addendum — reconciliation after adversarial seam review

Дата: 2026-08-09  
Проверены: updated `ARCHITECTURE-SPINE.md` и `solution-design.md`  
Не проверялись и не изменялись: `domain-model.md`, SPEC, PRD, UX и их memlog

## Вердикт

Ранее отмеченные high-priority расхождения companion/source-owner **сняты на
архитектурной высоте**. Для этой reconciliation не требуется изменение
`domain-model.md` или ручное/побочное изменение SPEC, PRD либо UX: новые
формулировки явно сохраняют их source ownership и route дальнейшей работы к
соответствующим workflow. Это не является verdict о готовности, device,
participant, Legal или independent-review evidence.

## Подтверждённые согласования

- **AD-4 ↔ solution §7, §9, §11, §13/S-3.** Companion теперь связывает
  `projectId`, fenced logical publication, `published|no-publish` startup
  reconciliation до GC/new write и physical lifecycle/quota corpus. Substrate
  по-прежнему не выбран.
- **AD-10/AD-13 ↔ solution §4, §11, §13/S-1.** Зафиксированы lifecycle
  context-loss/recreate/fallback, diagnostic allow-list, versioned comparator
  corpus, independent-review record и явное ограничение browser/simulation
  evidence. Renderer не выбран.
- **AD-20 ↔ solution §5, §13/S-2 и Spine Deferred.** Domain-owned kernel,
  ephemeral exact intermediates, immutable test-only oracle и V1/V2
  characterization status согласованы. Exact migration/reason mapping
  направлены Geometry и Project/Backup companions через `bmad-spec`, без
  создания альтернативного архитектурного контракта.
- **AD-17 ↔ solution §8–§9.** `CatalogGatewayPort` allow-list, local-only
  pin/publish и negative corpus для endpoint/migration/PostgreSQL/audit/cache
  теперь выражены в companion. API/operations/owner appointments остаются
  отдельным `G-CP-ADR`.
- **Traceability.** Capability map теперь включает AD-20 для CAP-8.

## Остаточные gates, не являющиеся новым finding

Нужны фактические versioned corpora, physical lifecycle/quota/device traces,
independently attributed review и назначенные Legal/Asset/Security/Operations
owners там, где этого требует source owner. Их отсутствие не исправляется
изменением domain model или architecture companion и не может быть заменено
POC, Playwright, emulation либо self-review.

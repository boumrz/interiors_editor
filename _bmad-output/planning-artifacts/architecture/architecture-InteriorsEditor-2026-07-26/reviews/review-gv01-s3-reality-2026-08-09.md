---
title: "Reality review: G-V01-S3 storage/recovery и control-plane"
date: 2026-08-09
reviewer_lens: "technology/reality и boundary integrity"
scope: "Только проверка AD-4, AD-11 и их согласования с AD-17 против входов 2026-08-09; без изменения решений"
verdict: "PASS (ограниченный scope)"
---

# Независимая reality-проверка G-V01-S3

## Вердикт

**PASS для ограниченного архитектурного обновления.** В текущем Spine не
обнаружено, что G-V01-S3 ошибочно выбрал физический browser resource substrate,
control-plane operation или выдал требуемые внешние evidence за полученные.
Детерминированный `lint_spine.py` для workspace вернул `0` findings.

Этот вердикт не означает `READY`, прохождение release/physical-device gate,
подтверждение квоты/eviction или независимую валидацию реального backend и
лицензионного evidence.

## Проверенные материалы

- `plans/storage-recovery-decision-input-2026-08-09.md`;
- `plans/catalog-control-plane-decision-input-2026-08-09.md`;
- `ARCHITECTURE-SPINE.md`, прежде всего AD-4, AD-11, AD-17, Stack и Deferred;
- `project-and-backup-contract.md`, `catalog-control-plane-contract.md` и
  `project-context.md` как уже заданные границы источников истины;
- `.memlog.md` только для проверки происхождения нового scoped amendment.

## Результаты по архитектурным границам

### AD-4 — writer fencing, roots и substrate

AD-4 соответствует storage/recovery input.

- Writer lease и fencing token привязаны к `ProjectId`; то же правило явно
  распространяется на pointer, Revision, root/lease и recovery record. Поэтому
  сохранён запрет на `pointers[0]`/«первую staging-запись» как на
  мультипроектный shortcut.
- Для substrate с общей транзакцией проверка `ProjectId` и актуального fencing
  token находится в той же transaction, что staging Revision, root inventory и
  current-pointer swap. Stale/lost fence не создаёт publish-visible Revision,
  pointer, переход History/root или ресурс.
- Для физически разделённых stores правило требует только recoverable
  journal/reconciliation с исходом `published` либо `no-publish` до GC или
  новой записи. Оно не выдаёт этот механизм за реализованный или доказанный.
- Root inventory включает current Revision, обе session-History ветки,
  recovery, staging/pin lease, Trash и custom definitions. Следовательно,
  GC разрешён лишь после доказанной недостижимости, а не по cache/age policy.
- Выбор `IndexedDB Blob`, `OPFS` или bounded hybrid остался в `Deferred` и в
  memlog поставлен за physical lifecycle/quota corpus. Упоминание существующего
  IndexedDB seam во входе корректно остаётся characterization, не adoption
  multi-Project design.

### AD-11 — update/migration boundary

AD-11 фиксирует только platform-independent correctness seam: versioned
`ReleaseManifest`, copy-on-write migration, readable/exportable path при
ошибке и user-mediated reload после Durable Revision. Это закрывает требуемую
границу update/recovery, не выбирая service-worker package, PWA integration,
browser-output target или фактическое поведение конкретного устройства.

В частности, Spine не утверждает, что waiting service worker можно удержать,
и не считает безопасную активацию или physical update trace уже доказанными.
Внешние Safari/Home Screen/Android update, migration, hard-close и handoff
traces остаются требуемым будущим corpus.

### AD-17 — узкий удалённый perimeter

AD-17 согласован с catalog-control-plane input и не ослаблен изменениями AD-4
или AD-11.

- `CatalogGatewayPort` пропускает только catalog identifiers/descriptors/bytes,
  hashes, provenance, `AssetUsageGrant`/notices и typed availability/cancel/
  failure outcomes. Project, Revision, session History, Portable Backup,
  account и user-pinned blobs исключены.
- Outage остаётся только non-blocking catalog state; healthy locally pinned
  Project продолжает local open/edit/publish/undo-redo/export. Remote
  availability не участвует в local publication, fencing, roots, migration или
  выборе recovery state.
- Kotlin/PostgreSQL здесь являются уже закреплённым language/data-store
  baseline, а не доказательством работающего сервиса. API/transport,
  byte-delivery, Kotlin build/test system, PostgreSQL schema/operations/backup,
  identity/IAM, hosting, CORS, privacy/retention, RPO/RTO и SLA явно отложены
  для `G-CP-ADR`.
- Legal Rights Authority, Asset Steward и Security/Operations owners не
  назначены этой архитектурной правкой. Реальные grant dossiers, negative
  boundary corpus, authorization, restore/log/privacy/cache evidence остались
  внешними обязательствами.

## Проверка недопустимых claims

| Риск ложного adoption | Состояние в Spine |
| --- | --- |
| IndexedDB Blob / OPFS / hybrid выбран и доказан | Не обнаружен: выбор и physical corpus явно deferred. |
| Existing IndexedDB seam доказал fencing/root/recovery | Не обнаружен: он назван только characterization input. |
| Service-worker/PWA package или физическая update safety выбраны | Не обнаружен: AD-11 задаёт семантику, packaging и traces deferred. |
| Control plane стал Project-sync/backup/account service | Не обнаружен: AD-17 и port allow-list это запрещают. |
| `G-CP-ADR`, Legal/Security/Operations или device evidence закрыты | Не обнаружен: все перечислены как external/future gates. |
| G-V01-S3 означает `READY`/release/PASS evidence | Не обнаружен: Deferred и memlog сохраняют `G-READY: NOT_READY`. |

## Открытые блокеры (не дефекты текущего scoped update)

1. Физический выбор substrate требует Safari tab/Home Screen и Android
   tab/standalone lifecycle, quota/eviction, hard-close, stale/in-flight
   takeover и browser↔Home Screen handoff corpus.
2. До backend implementation закрыты `G-CP-ADR` и его отдельные
   catalog-only/negative-boundary, Security/Operations, legal/provenance и
   operational evidence.
3. Ни один из этих блокеров не может быть закрыт текстом Architecture Spine
   или accountable-owner delegation; нужны фактические versioned evidence и
   независимая проверка по соответствующему gate.

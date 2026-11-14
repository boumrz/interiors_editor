# Независимый reviewer gate — G-V01-S3

Дата: 2026-08-09  
Объект: `ARCHITECTURE-SPINE.md` (bounded update storage/recovery/PWA writer
fencing и Control Plane)  
Метод: BMAD Architecture good-spine rubric; самостоятельная проверка без
изменения Spine, SPEC или memlog.

## Вердикт

**PASS для ограниченного архитектурного обновления G-V01-S3.** Критических и
high findings нет. AD-4, AD-11 и AD-17 вместе фиксируют существенные точки
расхождения между будущими units: fenced local publication и recovery roots,
safe PWA/schema update и каталоговый remote perimeter. Это не является
заявлением `READY`, выпускной готовности либо наличия physical/device evidence.

Механический gate выполнен первым:

```text
lint_spine.py --workspace architecture-InteriorsEditor-2026-07-26
ok: true; total_findings: 0
```

## Рубрика

| Проверка | Результат | Основание |
| --- | --- | --- |
| Реальные divergence points закрыты | PASS | AD-4 запрещает publication stale writer и неучтённый GC; AD-11 не даёт update-маршруту заменить читаемый источник; AD-17 запрещает удалённому каталогу стать Project/sync/recovery service. |
| Rule соответствует Prevents и проверяем | PASS | AD-4 требует `ProjectId` + current fencing token в той же publication transaction либо recoverable journal/reconciliation; AD-11 задаёт versioned handshake и copy-on-write; AD-17 ограничивает `CatalogGatewayPort` allow-list и требует negative corpus. |
| Storage/recovery input покрыт | PASS | Вход `storage-recovery-decision-input-2026-08-09.md` отражён: substrate остаётся Deferred, а логические fence/root/publication, COW migration, recovery/history-discard и backup limits закреплены в AD-4/AD-11. |
| Control-plane input покрыт | PASS | Вход `catalog-control-plane-decision-input-2026-08-09.md` отражён AD-17: catalog-only data, local pinning before durable placement, outage semantics и явный список ADR-вопросов/владельцев в Deferred. |
| Source ownership сохранено | PASS | Spine не переопределяет raw-backup ingress, policy limits, legal grant или API/operations: они остались за соответствующими SPEC companions и будущим `G-CP-ADR`. |
| Deferred не оставляет тихой альтернативы | PASS с условием ниже | Выбор IndexedDB Blob/OPFS/hybrid и API/operations ясно deferred и не ослабляет уже обязательные fenced logical publication и local-first boundary. |
| Версии и external evidence | PASS по границе архитектуры | Kotlin/PostgreSQL в AD-17 — planned stack facts, не доказательство работающего сервиса. Никакая internal input не считается evidence физических lifecycle/quota, migration, security/ops или legal/grant claims. |

## Findings

### Low — дальнейший substrate ADR должен назвать observable takeover protocol

**Disposition: defer, не блокирует этот update.** AD-4 достаточно фиксирует
свойство (один writer, explicit takeover, token проверяется в publication
boundary, stale fence не публикует). Когда будет выбран physical substrate,
нужен один port-level protocol для acquire/renew/reclaim/takeover и его
наблюдаемых outcome/reason codes. Иначе разные adapters могут одинаково
соблюдать общий принцип, но расходиться в liveness UX и обработке paused/closed
context. Это именно поздняя concrete-реализация выбранного substrate, не новая
архитектурная альтернатива; сохранить как обязательный пункт corpus/ADR вместе с
stale/in-flight takeover и hard-close vectors из storage input.

### Low — доказательства остаются внешними и обязательными

**Disposition: сохранить Deferred/evidence gate.** Текст AD-4/AD-11/AD-17
правильно не превращает characterization или internal input в подтверждение.
До следующего решения остаются обязательны physical Safari/Home Screen и
Android lifecycle/quota/update traces, fault/candidate corpus и independent
review; для Control Plane — contract/negative boundary corpus, named
Security/Operations и Legal/Asset Steward evidence. Нельзя читать этот PASS
как закрытие `G-READY`, `G-CP-ADR`, S-3/S-6 или NFR-15.

## Проверенные связи

- AD-4 согласуется с `project-and-backup-contract.md`: PinStagingLease/root
  accounting, current+undo+redo retention, `ResourceRecoveryRequired`, один
  atomic `RecoveryChangeSet` и explicit `DiscardSessionHistory` не подменены
  вторым authority.
- AD-11 сохраняет CAP-1/CAP-9/CAP-10: update может менять shell, но не вправе
  silently lose/read-write incompatible Project source.
- AD-17 согласуется с `catalog-control-plane-contract.md`: outage не есть
  resource corruption; fully pinned Project остаётся local-first, а remote
  endpoint не получает Project-bearing payloads.
- В `Deferred` явно остаются physical blob substrate, control-plane transport,
  resource delivery, auth, operations, hosting, retention и service evidence;
  ни один из них не создаёт неявный remote Project path.

## Итог для владельца update

Архитектурный reviewer gate для ограниченной области проходит. Единственное
follow-up уточнение — назвать observable takeover protocol при отдельном
physical-substrate ADR/corpus; сейчас оно корректно остаётся за Deferred и не
требует изменения Spine в этом reviewer pass.

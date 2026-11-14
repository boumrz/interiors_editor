---
title: "InteriorsEditor — disposition независимых architecture review"
status: active
created: 2026-07-26
updated: 2026-07-26
architecture_status: draft
implementation_ready: false
---

# Disposition независимых architecture review

Документ не переписывает исходные вердикты
[rubric review](review-rubric.md), [adversarial review](review-adversarial.md)
и [current-tech review](review-current-tech.md). Они остаются audit trail
состояния до исправлений. Здесь зафиксировано, какие противоречия устранены в
planning-контрактах и какие evidence ещё нужны.

Статусы:

- `CONTRACT RESOLVED` — документы теперь задают один вариант поведения;
  реализация и device evidence всё ещё отсутствуют;
- `DEFERRED TO GATE` — решение нельзя честно закрыть без указанного spike,
  устройства или owner approval;
- `OPEN` — текстовый конфликт ещё не устранён;
- `VERIFIED` — повторный независимый review подтвердил закрытие. На текущем
  срезе этот статус не присвоен ни одному runtime finding.

## Rubric review

| Finding | Disposition | Нормативное изменение | Остаточный gate |
| --- | --- | --- | --- |
| `RR-01` Durable commit boundary | `CONTRACT RESOLVED` | `AD-3`, domain model, PRD и UX задают `Validated → PendingDurability → Durable`; History публикуется только после atomic pointer swap | S-3 fault matrix |
| `RR-02` Release envelope | `CONTRACT RESOLVED` | `AD-11` и solution design задают `ReleaseManifest`, version ranges, immutable artifacts и promotion `development → device-lab → alpha` | S-3 compatibility/rollback evidence |
| `RR-03` Backup self-containment | `CONTRACT RESOLVED` | Referenced bytes pin-ятся до Durable mutation; Project limits строже backup envelope; AssetUsageGrant охватывает runtime/backup/PNG/notices; complete `.interiors` восстанавливается в clean offline profile | V-17 boundary/PNG roundtrip, S-6 pin/license traces |
| `RR-04` Dependency direction | `CONTRACT RESOLVED` | `AD-2`, corrected sequence, domain tsconfig без DOM и `dependency-cruiser@18.1.0` делают boundary проверяемой | scaffold architecture test после READY |
| `RR-05` History retention | `CONTRACT RESOLVED` | History явно session-only, обе ветки — Revision/blob GC roots под SessionRetentionPolicy; history-only corruption требует exact repair или explicit DiscardSessionHistory при healthy current | V-01/V-02/V-10/V-16 fault/state tests |
| `RR-06` Stale/worker ordering | `CONTRACT RESOLVED` | Alpha отклоняет все stale results; job envelope содержит `jobId`, `baseRevisionId`, cancellation; scheduler — port | race/property tests |
| `RR-07` Accessible semantic projection | `CONTRACT RESOLVED` | `EditorQueryModel` обслуживает canvas и DOM inspector одними IDs/actions/reasons | V-19 browser/accessibility evidence |
| `RR-08` Decision status | `CONTRACT RESOLVED` | Каждый `AD-*` и stack entry имеет явный Adopted/Proposed/Spike status | S-1 меняет `AD-13` только через ADR |
| `RR-09` Blob reachability/GC | `CONTRACT RESOLVED` | `AD-4` защищает current, recovery, Trash, staging, custom definitions и undo/redo active History; redo branch освобождается после replacement Durable publication | S-3/V-10/P-03 fault tests |
| `RR-10` Worker memory sandbox | `CONTRACT RESOLVED` | `AD-9` и import contract прямо запрещают считать Worker hard sandbox; byte preflight и deny-all идут до loader | S-5 hostile-device corpus |
| `RR-11` Broad Binds | `DEFERRED TO GATE` | Capability map и traceability дают точное operational coverage; broad cross-cutting `Binds` сохранены для читаемости | уточнить при ADR/story reconciliation |

## Adversarial review

| Finding | Disposition | Нормативное изменение | Остаточный gate |
| --- | --- | --- | --- |
| `AR-01` Wall/Room reference geometry | `CONTRACT RESOLVED` | WallSegment — centerline; usable Room — deterministic inward offset | S-2 offset/join corpus |
| `AR-02` Two height truths | `CONTRACT RESOLVED` | `Room.heightMm` — единственный editable source; shared Wall = max соседних высот, Opening fit = min | S-2 fixtures |
| `AR-03` Wall/ceiling placement | `CONTRACT RESOLVED` | `FloorPlacement`, `WallPlacement`, `CeilingPlacement` и stable host address | S-2/V-09 topology-impact tests |
| `AR-04` Impossible exact diagonal | `CONTRACT RESOLVED` | Авторитетны integer endpoints; `n = round(L/√2)`, UI показывает фактическую длину | owner approval D-012/D-013 + S-2 |
| `AR-05` Committed vs durable | `CONTRACT RESOLVED` | Термин `saved` закреплён только за `Durable Revision` | S-3 fault matrix |
| `AR-06` Project hard limits | `CONTRACT RESOLVED` | Versioned warning/hard policy находится в `project-and-backup-contract.md` | S-1/S-2/S-3 profiling |
| `AR-07` Backup portability | `CONTRACT RESOLVED` | Любой Healthy non-corrupt Durable Project ограничен BackupFeasibilityPolicy и экспортируется self-contained; incomplete export не называется backup; damaged resource включает явный read-only recovery | V-16 recovery corpus + V-17 boundary/clean-profile roundtrip |
| `AR-08` Multi-context concurrency | `CONTRACT RESOLVED` | Один writer lease/fencing token; другой context read-only до takeover | S-3 iOS/tab races |
| `AR-09` Wall-side finish identity | `CONTRACT RESOLVED` | `SurfaceAddress` использует stable wall-side/adjacent-room semantics и rehost policy | S-2/V-12 split/reverse tests |
| `AR-10` Mixed UJ-5 scope | `CONTRACT RESOLVED` | Alpha `UJ-5` использует Parametric Placeholder; GLB вынесен в `UJ-A1` Alpha+ | owner approval G-0 |
| `AR-11` Passage measurement | `CONTRACT RESOLVED` | `FR-13` и UX требуют width/distance measurement, но не кодовую проверку норм | usability validation |
| `AR-12` Overpromised data safety | `CONTRACT RESOLVED` | Brief/PRD различают app-controlled deletion и external browser eviction | user-copy review + S-3 |
| `AR-13` Backup resource contract | `CONTRACT RESOLVED` | Companion задаёт archive limits/allowlist/staging; import публикуется только как новый Project ID и не перезаписывает existing | V-17 fuzz/roundtrip |
| `AR-14` Catalog starts too early | `CONTRACT RESOLVED` | `V-09` зависит от `V-08 / G-5 PASS`, а также S-1/S-4/S-6 | roadmap owner approval |
| `AR-15` Movement vs teleport | `CONTRACT RESOLVED` | `FR-24` и Walk означают inspect + door-mediated transition; free roam исключён | S-4/V-08 observation |
| `AR-16` Offline-ready asset state | `CONTRACT RESOLVED` | `AD-14` задаёт metadata preview и обязательный `offline-ready/backup-ready` pin до Durable placement | S-6 cache/pin traces |
| `AR-17` Reopen history boundary | `CONTRACT RESOLVED` | Undo/redo session-only; reopen не обещает portable history | owner approval D-044 |
| `AR-18` Free contour scope | `CONTRACT RESOLVED` | UX использует constrained wall authoring, произвольный контур удалён | usability validation |
| `AR-19` NFR-22 applicability | `CONTRACT RESOLVED` | PRD, roadmap, quality и readiness маркируют `NFR-22 = N/A by scope` для Alpha | Alpha+ gate S-5 |
| `AR-20` Delete policy fork | `CONTRACT RESOLVED` | `FR-4` и V-14 требуют Trash/restore и отдельный permanent delete | owner approval D-045 |
| `AR-21` AD status inconsistency | `CONTRACT RESOLVED` | `AD-9` = Adopted for Alpha+, `AD-13` = Proposed S-1, `AD-14` = Adopted/profile S-6; stack status separated | repeat review |

## Current-tech review

| Finding | Disposition | Нормативное изменение | Остаточный gate |
| --- | --- | --- | --- |
| `CT-H1` iOS browser/Home Screen continuity | `CONTRACT RESOLVED` | Это разные local contexts; поддерживаемый handoff — self-contained backup | S-3 real iPhone matrix |
| `CT-H2` Service-worker activation | `CONTRACT RESOLVED` | Correctness не зависит от waiting; startup использует ReleaseManifest, version-tolerant read и copy-on-write migration | S-3 kill/update matrix |
| `CT-H3` Browser eviction | `CONTRACT RESOLVED` | Приложение не обещает управлять OS/browser eviction; origin storage не backup | product-copy review + S-3 |
| `CT-H4` GLB trust boundary | `CONTRACT RESOLVED` | Byte-level header/JSON preflight, deny-all resolver, pinned decoders; Worker не memory sandbox | S-5 before CAP-12 promotion |
| `CT-M1` Build/runtime envelope | `DEFERRED TO GATE` | Exact package candidates записаны; Node/package-manager/build target намеренно не выбираются до device/renderer decisions | S-1 + device matrix, до scaffold |
| `CT-M2` Import limit drift | `CONTRACT RESOLVED` | Единственный нормативный владелец provisional limits — `asset-import-contract.md`; research ссылается на него | S-5 measured replacement |
| `CT-M3` Reproducible device floor | `DEFERRED TO GATE` | Measurement protocol и budgets есть, конкретные devices остаются `TBD` честно | Product Owner + S-1/S-3 |
| `CT-M4` iOS install prompt | `CONTRACT RESOLVED` | Browser result не зависит от install; UX описывает Add to Home Screen и data-context consequence | S-4 real-device test |
| `CT-L1` WebGPU wording | `CONTRACT RESOLVED` | Research и `AD-5` ограничивают утверждение capability-detected mobile context; WebGL2 остаётся baseline | нет Alpha blocker |

## Текущий итог

- Открытых известных **текстовых противоречий Critical/High** после
  remediation не осталось.
- Повторный независимый consistency-аудит после контрактов History GC,
  resource recovery и AssetUsageGrant завершён `PASS` по Critical/High.
- Это не переводит Architecture Spine в final: `RR-11`, `CT-M1`, `CT-M3`,
  Product Owner decisions и результаты S-1–S-4/S-6 остаются gates.
- До повторного независимого review, lint после финальных ADR и официального
  BMAD implementation-readiness вердикт остаётся `CONCERNS`, а
  `implementation_ready = false`.

---
work_package: W-SPK-2026-08-04
spike: S-3
title: "S-3 — durability, local contexts, recovery и PWA lifecycle"
status: PAUSED
entered_at: 2026-08-04
terminal_at: 2026-08-05
terminal_status: PAUSED
terminal_review: S-3-terminal-independent-review-2026-08-05.md
cleanup_state: completed-moved-to-trash
cleanup_completed_at: 2026-08-05
cleanup_target: /Users/romanzheltov/.Trash/InteriorsEditor-W-SPK-2026-08-04-S-3-2026-08-05
waiver: _bmad-output/planning-artifacts/spike-only-waiver-2026-08-04.md
implementation_owner: "Codex /root/spike_s3_storage"
independent_reviewer: "Codex /root"
---

# Work package S-3

## Назначение и разрешённая граница

Проверить на **синтетических** данных, что изолированный browser prototype
может не объявлять candidate сохранённым до цепочки `staging write → checksum →
atomic pointer swap`, переживать инъецированные faults, сохранять fencing
writer, не терять redo roots при reject/cancel и требовать явного подтверждения
для `DiscardSessionHistory`.

Prototype root: `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-3/`.
Evidence root: `_bmad-output/planning-artifacts/evidence/spikes/S-3/`.

Это одноразовый experimental artifact. Он не является production application,
product scaffold, shared module, PWA release, V-slice или закрытием продуктовых
acceptance criteria. Реальные Project, catalog assets, сеть, telemetry и
публикация запрещены. Любой code/config/test находится только в prototype root.

## Gate и назначение

| Gate | State at entry | Effect |
| --- | --- | --- |
| `G-1` user research | `PENDING` | Не пройден; S-3 выполняется параллельно и не разблокирует product work. |
| `G-READY` | `NOT READY` | Не меняется этим experiment. |
| Waiver `W-SPK-2026-08-04` | active experimental-only | Разрешает только указанную изолированную работу до terminal status / срока waiver. |

## Проверяемые границы

### Возможные partial findings

- Browser-local persistence может безопасно сохранить **synthetic** immutable
  revision через staging/checksum/pointer swap.
- Fault на каждой границе оставляет pointer на последней durable revision.
- Новый fencing token вытесняет старого writer; старый writer не может
  опубликовать mutation.
- `SessionRetentionPolicy` до mutation/revision publication отклоняет команду,
  сохраняя current, undo и redo roots.
- History-only issue не изменяется при cancel `DiscardSessionHistory` и
  очищается только при explicit confirm без новой Project Revision.
- Persistent browser profile может показать create → mutation → restart,
  recovery и offline UI state.
- Локальный controlled service-worker/update observation, если выполним в
  disposable environment.

### Pause / non-pass boundary

S-3 **не может получить PASS** без всех отдельных evidence: physical iOS
Safari + Home Screen, physical Android Chrome tab + standalone, kill/relaunch,
quota/eviction, update lifecycle и device traces. Отсутствующий либо
desktop-only результат фиксируется как `PAUSED / partial`, а не заменяется
эмуляцией или Playwright.

## Method and independent review

1. RED: Playwright и pure behavior tests сначала должны падать на отсутствующем
   implementation.
2. GREEN: минимальная disposable implementation внутри разрешённого root.
3. Проверить fault boundaries, persistent profile и offline state; сохранить
   commands/results/traces below evidence root.
4. Owner готовит report с отрицательными результатами и cleanup list.
5. Independent reviewer `Codex /root` проверяет scope, command output,
   conclusions и terminal status. Только reviewer может подтвердить evidence,
   но не может изменить waiver boundary.

## Terminal decision — 2026-08-05

Независимая терминальная проверка
[`S-3-terminal-independent-review-2026-08-05.md`](S-3-terminal-independent-review-2026-08-05.md)
приняла evidence-integrity closeout и зафиксировала terminal status
**`PAUSED`**. Cleanup prototype root авторизован waiver §5 отдельным действием
implementation owner; raw/derived evidence остаётся в Evidence root.

Owner выполнил этот cleanup отдельным действием: ровно prototype root был
перемещён в recoverable Trash path
`/Users/romanzheltov/.Trash/InteriorsEditor-W-SPK-2026-08-04-S-3-2026-08-05`.
Ни один файл не переносился в product work.

Это решение **не `PASS`** и не product acceptance. Непокрыты обязательные
physical NFR-15 contexts, включая Safari/Home Screen на iPhone, Chrome/tab и
installed PWA на Android, а также реальные kill/relaunch, storage eviction,
quota pressure, update lifecycle, migration/rollback, перенос backup,
WebGL/touch/performance/thermal traces. Никакой код из prototype root не может
быть перенесён в product work.

---
title: "D-022 R5 — план исполнимого evidence и mobile acceptance"
date: 2026-08-05
status: draft
noncanonical: true
canonical: false
implementation_ready: false
readiness: NOT_READY
scope: "Будущая матрица проверки для draft D-022 R5; не является тестовой реализацией"
r5_input:
  artifact: ../d-022-geometry-policy-decision-draft-r5-2026-08-05.md
  sha256: c8739ddfdbd5173e25c10a206e42e35ad1119ef426c07f3cba8687424ad0fa9c
sources:
  - ../d-022-geometry-policy-decision-draft-r5-2026-08-05.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/performance-budgets.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../ARCHITECTURE-SPINE.md
---

# Назначение и граница

Это план будущего исполнимого evidence для **непринятого** D-022 R5. Он не
канонизирует R5, не меняет `AD-*`, SPEC, PRD, UX или `.memlog.md`, не создаёт
production/test code и не утверждает, что хотя бы один из перечисленных тестов
уже существует или проходил. До source-owner reconciliation, независимой
проверки exact SHA и нового verdict `READY` он не авторизует scaffold,
manifest, Rstest/Playwright bootstrap, Kotlin service, CI или выпуск.

Назначение документа — заранее разделить доказательства, которые нельзя
подменять друг другом:

| Слой будущего evidence | Что доказывает | Что не доказывает |
| --- | --- | --- |
| Детерминированные unit/property/golden fixtures (`@rstest/core`) | Точную геометрию, topology, ChangeSet, persistence/history и UI-state seams без DOM/GPU. | Реальный touch, PWA, safe-area или производительность телефона. |
| Mobile browser E2E (`@playwright/test`) | Связь доступного React/AppShell UI с теми же reason code и query state, жестовыми/числовыми сценариями, offline/PWA/Focus regression. | Реальный Safari/Home Screen/Android PWA, native fullscreen compatibility, frame-time или thermal evidence. |
| Физические NFR-15 traces | Поведение production-like build на восьми именованных телефонах и контекстах, включая performance и manual Focus row. | Корректность всех доменных веток без corpus. |

Эта граница следует AD-12, AD-15, AD-16, FR-7–FR-15, FR-19, FR-38,
FR-40, NFR-15, NFR-26 и NFR-27. После принятия политики каждая доработка
должна оставлять применимые automated suites green, но это всё равно не
заменит physical release gate.

## Принцип fixture

Для каждого будущего golden case должны быть сохранены:

1. exact canonical input bytes, версия policy и immutable `PolicyBundleRef`;
2. base Project/Revision/state digest, writer/context fence и ожидаемый
   result/reason code;
3. полный forward и inverse результат, если candidate принят, либо byte- и
   semantic-идентичность prior Durable Revision, если он отклонён;
4. нормализованный порядок всех unordered collections и, для R5, required
   `CanonicalBytesV2`/SHA-256 vectors;
5. отдельный UI-observation fixture только там, где DOM должен показать те же
   ID, value и reason code через `EditorQueryModel`.

Ни screen coordinates, ни visual snapshots, ни renderer objects не становятся
каноническим ожидаемым результатом geometry fixture.

# Матрица уровней проверки

## A. Deterministic domain: будущие Rstest/unit/golden cases

Это будущие тесты TypeScript domain/application seams с fake ports. Они не
поднимают React, browser, WebGL, IndexedDB или сеть. Property/fuzz probes
дополняют named goldens, но не заменяют их.

| ID / золотой ввод | Обязательный детерминированный результат | Трассировка |
| --- | --- | --- |
| `SEL-CSSU-1px-per-mm-100px` — identity canvas, `scale=1 CSS px/mm`, origin `(0,0)`, pointer на `+100 CSS px` по X | `CameraDeltaV2.dx=100 mm`, а не `25 600 mm`; при отсутствии C1/C2 C4 строит `+100 mm` в выбранном C8 направлении. | R5 §3.1; FR-7/8; NFR-1/4 |
| `SEL-C1-dense-junction-key` — два eligible Vertex `(101,-100)` и `(100,-101)` при pointer `(100,100)` CSS px, с одинаковым `ScreenDistanceSqV2` | C1 выбирает `(100,-101)` по полному key `(class, distance, worldX, worldZ, idBytes)`, а не по insertion/DOM order. | R5 §3.2; FR-7; NFR-4 |
| `SEL-C4-zero-and-49mm` — exact deltas `0` и `49 mm` | До ранжирования directions оба возвращают `CANDIDATE_UNDETERMINED/C4_DELTA_BELOW_MINIMUM`; Command/History/preview projection не публикуются. | R5 §§1, 3.4; FR-7/12/40 |
| `SEL-C4-50mm-and-150mm-ties` — `mNumerator=50*q` и `150*q` | At `50*q` выбирается `k=1`; at exact 150-mm half tie также нижний positive `k=1`. Проверить fixed direction ordinal при равном score. | R5 §3.4; FR-7/8 |
| `SEL-stale-origin` и non-finite/cap/transform cases | Отсутствующий/stale origin даёт только `ACTIVE_ORIGIN_STALE_OR_MISSING`; invalid snapshot даёт `SNAPSHOT_OUT_OF_RANGE`; nearest-vertex fallback отсутствует. | R5 §§1, 3.1; FR-7/40 |
| `RAY-all-directions-and-blockers` — 8 C8 rays, integral, non-integral, singleton parallel и positive collinear contact | Проверить ordered probe set, C1 pre-emption, blocker precedence и `8*n` cap. Non-integral/collinear winner не даёт C2/C4 fallback. | R5 §3.3; Geometry Contract §4 |
| `TOPO-T-exact` — existing `(0,0)→(1000,0)`, candidate `(500,0)→(500,500)` | Ровно одна shared Vertex `(500,0)`, две non-zero pieces existing Wall и один candidate Wall в одном accepted ChangeSet; full inverse возвращает base. | R5 §§4, 8; FR-9/12 |
| `TOPO-X-exact` — existing `(0,0)→(1000,0)`, candidate `(500,-500)→(500,500)` | Ровно одна shared Vertex и **четыре** canonical non-zero WallSegment pieces; нет частичной Revision на любом reject. | R5 §§4, 8; FR-9/12 |
| `FACE-open-tail` — closed square с bridge/tail от одной вершины | Square даёт одну bounded face; bridge/open-tail относится к exterior, не создаёт Room и не уничтожает valid face. Dart successor, reduced orbit и side table пинятся golden-байтами. | R5 §§4.1, 4.3; FR-14 |
| `FACE-inner-loop`, `FACE-nested-loop`, `FACE-touching-vertex`, `FACE-touching-edge` | Входные exact rings классифицируются соответственно как `HAS_INNER_RING`, `NESTED_RING` или `TOUCHING_RINGS` и candidate отклоняется до Room/host/allocation. Две независимые depth-0 outer rings остаются допустимыми разными faces. | R5 §§1, 4.2; Geometry Contract §7 |
| `USABLE-odd-cardinal-diagonal`, `USABLE-run-collapse`, `USABLE-thickness-step`, `USABLE-backtrack`, `USABLE-miter-cap-equal/above` | Q2 offsets/miter пинятся byte-for-byte; equality на cap принимается, strict excess получает `Q2_MITER_CAP_EXCEEDED`; no bevel/default float route. | R5 §5.1; FR-10/13/14 |
| `ROOM-unchanged-fingerprint` | Единственный byte-identical `FaceKeyV3` автоматически удерживает исходный `roomId`; никаких changed-face score/overlay rules. | R5 §6.3; FR-15 |
| `ROOM-changed-map-or-seed` — same semantic room with changed face digest | Без valid map требуется новый allocated ID + complete `NewRoomSeedV3` (`ROOM_SEED_REQUIRED` при отсутствии); valid complete side-aware relation + partial-injective map удерживает ID; partial/ambiguous relation даёт `ROOM_SURVIVOR_MAP_INVALID`. | R5 §§6.1–6.4; FR-15/16 |
| `ROOM-loss-eight-classes` | Removed/split/merge source Room имеет closed field/loss rows и complete forward/inverse slot coverage; name, finish или height не распределяются молча. | R5 §6.4; FR-15/38 |
| `HOST-split-contained-child` — root child `[0,1/2]`, source span `[1/10,2/5]` | `TransferContainedChild` создаёт child-local span `[1/5,4/5]` exactly; proof сохраняет root physical side and inverse. | R5 §7.3; FR-19/35 |
| `HOST-split-crossing` — source span `[2/5,3/5]` crosses child boundary `1/2` | Entire candidate rejects `PARTITION_ATTACHMENT_CROSSES_CHILD_BOUNDARY`; opening/placement не split-ится и base remains Durable. | R5 §7.3; FR-19/12 |
| `HOST-same-id-changed-wall` и `HOST-two-exterior-sides` | Moved/shortened/thickened same-ID wall требует explicit move/delete; no relative/absolute rebase. Wall host/material on two exterior sides получает `TWO_EXTERIOR_SIDES_HOST_UNSUPPORTED`. | R5 §§7.1–7.3; FR-19/35/40 |
| `CEILING-preinventory-actions` — Keep/Move/Delete/Create/placement-kind cases | Pre-resolution inventory contains exact base and declared post IDs; exactly one reversible action per slot. Missing/stale/duplicate action yields `CEILING_RESOLUTION_REQUIRED`/`INVALID`, never nearest-room transfer. | R5 §7.4; CAP-6/7 |
| `METRIC-edge-vs-whole` — point `(500,10)` and CCW square asset `[0,0]-[1000,0]-[1000,1000]-[0,1000]` | Selected top `MetricEdge` returns `990 mm`; `MetricWholeBoundary` returns `10 mm`. Target tag/source key must make results distinct. | R5 §§3.5, 5.2–5.3; FR-13 |
| `METRIC-half-even` — `DirectQ2` exactly `201/200 mm` and `203/200 mm` at two decimal places, plus below/above and `RootQ2(2)` | `1.005` formats `1.00` (even 100); `1.015` formats `1.02` (even 102); direct boundary comparison, not float approximation. `RootQ2(2)` proves `exactAtPrintedPrecision=false`. | R5 §5.4; FR-13; NFR-1/4 |
| `HISTORY-policy-missing-no-silent-loss` | Missing/corrupt retained immutable policy produces `HISTORY_POLICY_UNAVAILABLE`; current Project, undo/redo entry and resource roots remain unchanged. Exact repair restores replay; `SessionRetentionPolicy` may reject a new command but may not cut a valid redo entry. | R5 §8.3; FR-38; Project/Backup §1/6 |
| `IMPACT-context-and-inverse` | Stale Project/revision/writer/policy, allocation mismatch or altered forward/inverse/resource/notice patch returns the named reject before durability; accepted entry has two directional fences and exact retained policy bytes. | R5 §§6.1, 8.1–8.3; NFR-3/4 |

Minimum property suites after the named vectors exist: deterministic serialize/parse
round-trip; `inverse(forward(base)) = base`; rejection preserves prior Durable
bytes; no generated valid Plan violates topology/usable invariants; and all
unordered fixture collections yield identical digest after permutation. Fuzzing
must never redefine a product semantic that the named golden has not fixed.

## B. Future mobile Playwright E2E

Playwright uses phone viewport emulation only as regression automation. The
application test harness may fake platform events/ports, but it must label them
as controlled simulation and never expose a simulated native result as a device
claim. UI assertions inspect labelled DOM controls and `EditorQueryModel`; they
must not infer state solely from canvas pixels.

| E2E scenario | Required observable mobile result | Domain golden it consumes |
| --- | --- | --- |
| Draw constrained wall and numeric alternative | A tap/draft shows origin, candidate class and endpoint/`Δx/Δz` in DOM. Valid off-grid signed integer input takes the same validation path; invalid direction/contact presents reason, affected input and safe correction while prior Durable state remains. | `SEL-*`, `TOPO-T/X-*` |
| Exact contact preview and durable boundary | T/X preview names affected pieces; confirm leads to one durable command only after persistence success. A rejected contact shows no saved status, no History entry, no autosave/canonical 2D/3D replacement. | `TOPO-*`, `IMPACT-*` |
| Room change confirmation | A changed face never silently reuses metadata: the UI must expose map-or-seed/loss confirmation before confirm. Invalid/partial relation remains actionable error; valid result exposes expected Room identity. | `ROOM-*` |
| Opening / host / ceiling consequences | Wall change with contained host exposes exact target; crossing host, changed same-ID host or unresolved ceiling blocks confirm with stable reason and does not orphan hidden content. | `HOST-*`, `CEILING-*` |
| Measurement UI parity | Numeric/list metric target distinguishes one edge from whole boundary. Preview, Plan, 3D and export inspection expose the same formatted token; rounding never returns as geometry input. | `METRIC-*` |
| History under resource/policy pressure | Undo/redo control remains available or explicitly blocked by a truthful reason. Missing historic policy never makes redo silently disappear; explicit discard remains a separate confirmation path. | `HISTORY-*` |
| Focus native-success simulation | A direct labelled `Войти в Фокус` first enters usable in-app Focus; controlled `fullscreenchange` with actual element yields Native active. Exit/status/mode/tool/cancel/undo/redo remain visible and accessible. | Focus UI-state fixture; AD-15 |
| Focus rejected/unsupported and user-agent exit | Controlled rejection, `fullscreenerror`, unsupported probe or external `fullscreenchange` retains in-app Focus, Project, selection, Active Gesture, pending/durable state and collapsed panel. No destructive dialog or false native state appears. | Focus UI-state fixture; NFR-27 |
| Focus viewport/keyboard/accessibility | With simulated visual viewport, safe-area, orientation, keyboard and 200% text scale, exit/status/mode/tool/applicable cancel-undo-redo remain reachable; each critical DOM target is at least 44×44 CSS px; numeric field retains focus and has a DOM alternative. Blocking recovery/confirm/error stays above canvas. | Focus UI-state fixture; DESIGN/EXPERIENCE UXF-7 |
| Offline/PWA browser regression | A healthy fully pinned local Project remains open/editable/saveable/undoable/exportable in controlled offline state; catalog outage is distinguishable from recovery. Browser and standalone behaviour are regression flows, not physical evidence. | Project/Backup fixtures; CAP-9 |

For every Playwright scenario, an optional visual screenshot may be retained as
a human checkpoint after a material UI change. The screenshot is an aid for
layout regression and stakeholder review; it cannot replace DOM assertions,
domain golden results, native API evidence, frame-time distribution, thermal
run or any NFR-15 physical trace.

## C. Future physical-device acceptance rows

After a production-like build exists, each row below needs a separate manual
trace under the protocol in NFR-15 / `performance-budgets.md` §10. The same
build/version, RS-1/RS-2 version, actual OS/browser, WebGL2 probe, battery,
thermal and network details must be recorded. These rows are release evidence,
not test cases that current documents can mark PASS.

| Physical phone | Required context | Additional D-022 / Focus observation |
| --- | --- | --- |
| iPhone 13 mini (2021) | Safari tab | Geometry authoring smoke, focused numeric field, actual fullscreen probe/result, in-app fallback, safe controls and editor-state preservation. |
| iPhone 13 mini (2021) | Installed Home Screen PWA | Same checks in distinct local context; backup handoff boundary observed. |
| iPhone 17 | Safari tab | Same NFR-15 performance protocol and manual Focus row. |
| iPhone 17 | Installed Home Screen PWA | Same protocol in standalone context, without claiming browser/system chrome control. |
| Galaxy A53 5G `SM-A536B/DS` | Chrome Android tab | Same protocol, WebGL2/context-recovery and direct-action fullscreen observation. |
| Galaxy A53 5G `SM-A536B/DS` | Installed standalone PWA | Same protocol in standalone context, including keyboard/safe-area controls. |
| Galaxy S26 `SM-S942B/DS` | Chrome Android tab | Same protocol, actual browser/OS patch captured. |
| Galaxy S26 `SM-S942B/DS` | Installed standalone PWA | Same protocol and explicit exit/state preservation check. |

Every row must include 20 cold-online starts, 20 warm-offline starts, at least
five scripted RS-2 sessions, a 15-minute thermal run, WebGL context-loss
recovery, and the manual Focus checks stated by NFR-15. A screenshot, emulator,
desktop browser or Playwright trace may accompany the row but cannot supply its
PASS result.

# Release-gate gaps and admission order

The highest current blockers, in order, are:

1. R5 itself is noncanonical and still needs fresh independent exact,
   current-source and topology/data-integrity review for the pinned SHA.
2. Named source owners must reconcile every R5 delta (no-holes state,
   CanonicalBytesV2, map-or-seed/loss, host/ceiling transfer, metric policy,
   retained historic policy) into the sources that own those requirements.
3. The corpus described above must be implemented and pass under the authorised
   Rstest/Playwright toolchain; it does not exist merely because this plan
   names it.
4. Current implementation-readiness remains `NOT_READY`; no production
   scaffold or test bootstrap is permitted until a new official `READY` result
   or a narrowly written waiver changes that condition.
5. Even after automated suites are green, all eight NFR-15 physical rows,
   including performance, thermal, context recovery and manual Focus evidence,
   remain mandatory before an Alpha performance/compatibility claim.

The intended execution order is therefore: review the exact R5 draft →
source-owner reconciliation → approved corpus implementation with one slice
owner → deterministic/unit green → mobile Playwright green after each change →
physical device traces → a new readiness/release decision.

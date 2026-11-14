---
spike: S-1
work_package: W-SPK-2026-08-04
waiver: W-SPK-2026-08-04
review_kind: amended-independent-renderer-evidence-review
reviewer: "Codex /root/spike_s2_topology"
date: 2026-08-05
reviewed_report: S-1-renderer-evidence-report-2026-08-05.md
supersedes_review: S-1-independent-review-2026-08-05.md
remediation_scope: S1-R1,S1-R2,S1-R3
remediation_disposition: ACCEPTED
verdict: PAUSED
terminal_status: NOT_RECORDED
data_provenance: synthetic-only
---

# S-1 — amended independent review after owner remediation

## Итог

**Все три исправимых evidence-gap из предыдущего independent review закрыты в
границах S-1.** Новый verdict остаётся **`PAUSED`**, а не `PASS`: физический
NFR-15 evidence по-прежнему отсутствует. Это не renderer decision, не ADR и не
разрешение переносить prototype в продукт. Terminal status намеренно остаётся
`NOT_RECORDED`; данный record не authorizes waiver cleanup.

| Предыдущее finding | Amended disposition | Независимое подтверждение |
| --- | --- | --- |
| S1-R1: Babylon screenshot до canvas | **Resolved** | Test ждёт labelled Babylon canvas + `Lifecycle: ready` + `WebGL2: available` до capture; retained PNG и trace показывают реальную сцену. |
| S1-R2: cleanup flag был ручным | **Resolved** | Ручной flag удалён. Только callback увеличивает test-only counter; replay и retained trace подтверждают независимые deltas ready → Dispose и context-loss. |
| S1-R3: broad unpinned Fallow claim | **Resolved** | Непроверяемая строка и replay command удалены из active report; static-health conclusion больше не заявляется. |

## Что было проверено

Я проверил только exact S-1 prototype/evidence roots и replay выполнил в
свежей временной копии после `npm ci`, не меняя source, tests или manifests.
Environment: Node `v22.8.0`, npm `10.8.2`, host Google Chrome Chromium с
`--use-angle=swiftshader`.

| Проверка | Результат |
| --- | --- |
| `npm ci` | PASS в clean temporary copy. |
| `npm run typecheck` | PASS. |
| `npm run test:coverage` | PASS: 5/5; 100% только `src/lifecycle.ts`. |
| `npm run build` | PASS; Vite warning для chunks >500 kB сохранён и не является performance verdict. |
| `npm run test:e2e` | PASS: 1/1 amended mobile browser flow. |
| `npm run mutation` | PASS: 36/36 killed в declared scope `src/lifecycle.ts`. |
| `npm audit --omit=dev --json` | PASS: 0 production vulnerabilities. |

Повторный Playwright run породил **те же три PNG SHA-256**, что и retained
evidence. Его trace имеет иной hash из-за runtime timestamps, но проходит ту
же sequence: Babylon ready canvas → explicit Dispose/callback delta/canvas 0 →
recreate generation 2 → `WEBGL_lose_context`/listener/callback delta/canvas 0
→ recreate generation 3/new canvas.

## S1-R1 — canvas-before-screenshot

Текущий E2E сначала ждёт
`getByLabel("Babylon.js synthetic RS-1 scene")`, `Lifecycle: ready` и
`WebGL2: available`, и только затем сохраняет Babylon screenshot. Retained
trace содержит actual `CANVAS` с этим `aria-label` до screenshot step, а PNG
визуально содержит Babylon RS-1 room, а не loading fallback. Следовательно,
предыдущее неверное визуальное checkpoint-утверждение исправлено.

## S1-R2 — callback-only cleanup, explicit и loss routes

`src/App.tsx` больше не имеет `disposeObserved`/ручной записи cleanup state.
`cleanupCallbackCount` инкрементируется исключительно через `onDisposed`.
Amended E2E берёт baseline, затем проверяет `+1` и отсутствие Babylon canvas
для каждого из следующих маршрутов:

- ready Babylon → explicit **Dispose renderer**;
- recreated Babylon → `WEBGL_lose_context` → actual
  `webglcontextlost` listener.

Retained trace фиксирует callback values `1`, `2`, `3`, `Context-loss listener:
observed`, generation `2` и generation `3`, включая visible Babylon canvas
после обоих recreate. Это подтверждает именно callback-based evidence для
заявленного narrow lifecycle path. Оно всё ещё не доказывает GPU-memory
release, отсутствие leaks или browser-managed context restoration.

## S1-R3 — Fallow claim

В active S-1 report больше нет broad `Fallow` zero-findings verdict или
команды `npx --yes fallow …`; он явно отмечает, что этот claim удалён. Поэтому
не существует ни ложного static-health pass, ни незафиксированного tool
requirement для replay. Historical mention в предыдущем review остаётся как
аудит следа, а не как активное evidence assertion.

## Integrity и границы

Все retained hashes пересчитаны и совпали с active report:

| Artifact | SHA-256 |
| --- | --- |
| `S-1-iphone13-chromium-r3f.png` | `8b64d40e2975e7a8d293af3fbec94421341368c9dbe7d2df7b240e94642e8f21` |
| `S-1-iphone13-chromium-babylon.png` | `14a18060ad399617ec0fda5dbadad272c26a053556a41f53163d3587c62d66c6` |
| `S-1-iphone13-chromium-context-lost.png` | `704e398edc9fe33b85505c599462c8952fabc33960e20545dbe5c8cdfad638a2` |
| `raw/S-1-iphone13-chromium-playwright-trace.zip` | `400e073ac9b0def6ab3d8c3203bac1b5ae52fbba70f40c9d9aae5f652c876efb` |
| `raw/S-1-mutation.json` | `aa0801c0bb01162647cedc04c26d53f3742e22cfc445f32264c328b14b4904f1` |
| `raw/S-1-coverage-summary.json` | `5935c9e2d792bf9e4fc8e7f2054d8b59e24f79417401c9cb91f35f1a19ffad82` |
| `package-lock.json` | `a67904c4b071f153fc1f979e86a0bef950dc96b1f494c16c50c77552383b630e` |

Static scan S-1 source/tests/config finds no fetch/XHR/source-level WebSocket
API, browser storage, external URL, GLB/GLTF, texture loader, telemetry or
product/catalog input; only the loopback Playwright base URL exists. Retained
trace has 75 `http://127.0.0.1:41731` requests and one
`ws://127.0.0.1:41731` Vite-HMR connection. Boundary wording in the active
report is now accurate: local development-server traffic exists, but there is
no remote endpoint, product data or network publication.

RS-1 remains literal synthetic geometry shared through `RS1_ROOM` and
`RS1_BOXES` by both R3F and Babylon. This is common semantic input, not a claim
of pixel-identical engine output.

## Что по-прежнему блокирует PASS

Ни один amended result не заменяет physical NFR-15 evidence: нужны реальные
современные iPhone Safari tab + Home Screen и Samsung/Android Chrome tab +
installed PWA contexts, с измерениями performance, thermal, memory/context
restoration и длительной сессии. Текущий `390 × 664`, DPR 3 iPhone-13 descriptor
в Chromium/SwiftShader — лишь browser emulation.

В ходе этого amended review создан только данный Markdown record в разрешённом
S-1 evidence root. Prototype/source/tests/manifests и product files не
изменялись; commit не выполнен.

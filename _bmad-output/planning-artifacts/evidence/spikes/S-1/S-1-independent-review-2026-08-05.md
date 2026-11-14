---
spike: S-1
work_package: W-SPK-2026-08-04
waiver: W-SPK-2026-08-04
review_kind: independent-renderer-evidence-review
reviewer: "Codex /root/spike_s2_topology"
date: 2026-08-05
status: PAUSED
verdict: PAUSED
terminal_status: NOT_RECORDED
reviewed_report: S-1-renderer-evidence-report-2026-08-05.md
prototype_root: _bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-1/
evidence_root: _bmad-output/planning-artifacts/evidence/spikes/S-1/
data_provenance: synthetic-only
---

# S-1 — независимый review renderer evidence

## Verdict

**`PAUSED`**. Узкое наблюдение S-1 воспроизводится, поэтому эксперимент не
следует считать `KILLED`: оба renderer-кандидата используют один набор
синтетических RS-1 входов, а retained trace подтверждает Babylon canvas,
`WEBGL_lose_context` → реальный `webglcontextlost` listener, исчезновение
canvas и generation `2` после recreate.

Но это не `PASS` и не основание выбирать renderer, создавать ADR, открывать
`V-*` slice или переносить код в продукт. Помимо отсутствующего physical NFR-15
evidence, review нашёл два исправимых пробела в доказательствах: retained
«Babylon» screenshot снят до готовности Babylon canvas, а проверка cleanup
после context loss не отделяет фактический cleanup callback от ручной установки
UI-флага. Пока они не исправлены, нельзя использовать текущие artifacts для
сильной формулировки «оба видимых checkpoint-а отрисовали сцену» или «явный
Dispose после loss доказан отдельно».

Это независимый review, а не новый terminal record. Cleanup по waiver §5 не
авторизован этим документом.

## Scope и границы

Проверены waiver `W-SPK-2026-08-04`, `CONSTRAINTS.md`, исходный S-1 prototype,
retained report и все retained raw artifacts. Отдельного S-1 work-package file
в `_bmad-output` не найдено; scope и назначенные owner/reviewer записаны в
waiver и frontmatter исходного report. Хронологию их назначения до начала работ
по одним этим файлам подтвердить нельзя.

Статический source scan по `src/`, `test/` и конфигурации не нашёл `fetch`,
XHR, WebSocket API, external HTTP URL, browser storage, GLB/GLTF, texture
loader, telemetry или product/catalog input. Единственный literal HTTP URL в
source/config — loopback `http://127.0.0.1:41731` Playwright/Vite server.

Retained trace содержит **76** resource requests только к
`http://127.0.0.1:41731` и один Vite-HMR WebSocket к
`ws://127.0.0.1:41731/?token=…`. Следовательно, корректная формулировка —
«нет удалённых endpoint-ов, product data или network publication»; это **не**
означает «вообще нет сетевого трафика»: есть loopback traffic development
server-а. Этот трафик остаётся внутри разрешённого evidence experiment и не
является продуктовой интеграцией.

`src/scene-model.ts` задаёт только literal RS-1 room `4.8 × 3.6 × 2.7 m` и
четыре primitive boxes. И R3F (`src/R3fScene.tsx:4,52-73`), и Babylon
(`src/BabylonScene.tsx:12,70-121`) импортируют те же `RS1_ROOM` и `RS1_BOXES`.
Это подтверждает одинаковые **семантические входы**, но не pixel-identical
rendering между разными engine/camera/material pipelines.

## Независимый replay

Replay выполнен в свежей временной копии S-1 после `npm ci`, не изменяя
prototype source, tests или manifests. Environment совпал с report: Node
`v22.8.0`, npm `10.8.2`, Google Chrome Chromium host binary с
`--use-angle=swiftshader`.

| Проверка | Результат review |
| --- | --- |
| `npm ci` | PASS: lockfile установился в чистую временную копию. |
| `npm run typecheck` | PASS. |
| `npm run test:coverage` | PASS: 5/5; `src/lifecycle.ts` 100% statements/branches/functions/lines. |
| `npm run build` | PASS; те же split chunks и warning Vite для chunks >500 kB. Это не performance verdict. |
| `npm run test:e2e` | PASS: 1/1 `iphone-13-synthetic`. |
| `npm run mutation` | PASS: 36/36 killed, 0 survived/timeout/no-coverage/errors; scope только pure reducer `src/lifecycle.ts`. |
| `npm audit --omit=dev --json` | PASS: 0 production vulnerabilities. |

В дополнение проверены JSON artifacts: coverage содержит 34/34 строки и
18/18 branches `lifecycle.ts`; mutation JSON содержит 36 killed мутантов
этого же файла. Эти результаты не распространяются на renderer components,
WebGL engine internals или physical-device behaviour.

## Проверенные lifecycle факты

- В R3F listener регистрируется на реальном `gl.domElement`, вызывает
  `preventDefault`, а cleanup удаляет listener и вызывает `gl.dispose()`
  (`src/R3fScene.tsx:19-34`).
- В Babylon listener регистрируется на `canvas`; cleanup останавливает loop и
  вызывает `scene.dispose()` и `engine.dispose()`
  (`src/BabylonScene.tsx:123-137`).
- App получает `WEBGL_lose_context` из real WebGL2 context
  (`src/App.tsx:74-90`). Retained trace показывает `webgl-extension`, затем
  `Context-loss listener: observed` и fallback `Lifecycle: context-lost`.
- До loss trace содержит видимый canvas с
  `aria-label="Babylon.js synthetic RS-1 scene"`; после loss — fallback без
  canvas. После recreate trace фиксирует Babylon canvas и `Generation: 2`.

Таким образом, listener/event/fallback/recreate path доказан в Chromium
iPhone-13 emulation. Он не доказывает automatic browser context restoration,
absence of leaks, release of GPU memory или resilience на реальном устройстве.

## Integrity retained evidence

Все следующие SHA-256 пересчитаны и совпали с исходным S-1 report.

| Artifact | SHA-256 | Review |
| --- | --- | --- |
| `S-1-iphone13-chromium-r3f.png` | `01be0a8dc67aa8131ae948684e1f29934ea7a4981290941b2a74800462469319` | R3F RS-1 canvas виден. |
| `S-1-iphone13-chromium-babylon.png` | `6314b172b54138d001970d11de04019d6c130b5e48d0e61581c52d5f85464fa5` | Hash корректен, но screenshot показывает loading fallback; см. S1-R1. |
| `S-1-iphone13-chromium-context-lost.png` | `2d712dc98321224ae10ae3e95330a8f34f1123ed4766756ba419659aef6e3bc2` | Показывает `webgl-extension` и observed listener. |
| `raw/S-1-iphone13-chromium-playwright-trace.zip` | `3caf3701f16759996208bedabc95a2977c3c689bdece6013409079210b19656f` | Согласуется с E2E и boundary review. |
| `raw/S-1-mutation.json` | `aa0801c0bb01162647cedc04c26d53f3742e22cfc445f32264c328b14b4904f1` | 36/36 killed в declared scope. |
| `raw/S-1-coverage-summary.json` | `5935c9e2d792bf9e4fc8e7f2054d8b59e24f79417401c9cb91f35f1a19ffad82` | 100% только `lifecycle.ts`. |
| `package-lock.json` | `a67904c4b071f153fc1f979e86a0bef950dc96b1f494c16c50c77552383b630e` | Совпадает; чистый `npm ci` прошёл. |

Trace context также совпадает с report: `390 × 664` CSS px, DPR `3`, touch/mobile
descriptor iPhone 13, но host Google Chrome Chromium/SwiftShader. Это не
iPhone Safari, не Samsung/Android Chrome, не PWA Home Screen и не physical GPU.

## Triage findings

### S1-R1 — medium / remediation: Babylon visual checkpoint снят до готовности canvas

`test/renderer-bench.mobile.e2e.spec.ts:22-30` делает screenshot сразу после
смены текста renderer и status. Ожидание реального `canvas` происходит только
на строке 38. Retained trace подтверждает порядок: на момент screenshot в
DOM ещё R3F canvas с `display: none` и `Loading renderer candidate…`; это же
видно в PNG. Поэтому file/hash подлинные, но название
`S-1-iphone13-chromium-babylon.png` не является визуальным доказательством
отрисованной Babylon RS-1 сцены.

**Минимальное corrective condition:** owner должен дождаться
`canvas[aria-label="Babylon.js synthetic RS-1 scene"]` (и готового WebGL2
status) **до** screenshot, сохранить replacement PNG с новым hash и новый
trace. Один повторный Playwright replay достаточен; product code не нужен.

### S1-R2 — medium / remediation: explicit Dispose после loss не наблюдается независимо

`src/App.tsx:58-62` выставляет `disposeObserved` только из `onDisposed`, когда
`explicitDisposeRef` уже true. Но `disposeRenderer` на context-lost branch
вручную выставляет тот же UI-флаг до callback (`src/App.tsx:92-99`). Поскольку
`renderedScene` убирает canvas уже при `context-lost`
(`src/App.tsx:115-123`), E2E нажимает Dispose после того, как trace уже
показывает fallback без canvas. Поэтому lines 62-69 теста доказывают state/UI,
но не отделяют новый cleanup от прежде случившегося unmount.

**Минимальное corrective condition:** в prototype добавить test-only observable
фактического cleanup callback (например, counter/event), затем отдельно
assert: (1) ready → explicit Dispose вызывает callback и удаляет canvas;
(2) `WEBGL_lose_context` route вызывает cleanup и удаляет canvas; (3) recreate
создаёт новый canvas/generation. Retain новый trace и result. Не следует
объявлять отсутствие leaks/memory release даже после этого теста.

### S1-R3 — low / remediation: broad Fallow claim не воспроизводим без pin/scope

Report заявляет `0 issues` для незафиксированной команды `npx --yes fallow …`.
В текущем replay `fallow@3.14.0` с той же broad командой выдаёт 56 findings,
все в generated `artifacts/playwright-report/trace` (11 unused files,
43 exports, 1 unresolved import, 1 cycle), а не в S-1 source. Явно ограниченная
проверка шести `src/*.ts(x)` files на той же версии даёт 0 issues.

**Минимальное corrective condition:** зафиксировать версию Fallow и source-only
scope/exclude generated Playwright report, сохранить JSON и версию в report —
либо убрать строку `Static health` как несущественную для S-1. Это
воспроизводимость evidence, не source defect.

## Что всё ещё блокирует PASS

Даже если S1-R1..R3 будут закрыты, waiver не отменяет NFR-15. Нужны отдельные
recordings и measurements на реальных актуальных iPhone Safari (tab + Home
Screen) и Samsung/Android Chrome (tab + installed PWA), включая performance,
thermal, memory/context restoration и длительную сессию. Таких artifacts здесь
нет, и данное Chrome/SwiftShader emulation нельзя использовать в качестве их
замены.

Ни source/tests/manifests S-1, ни product files в ходе review не изменялись;
создан только этот independent-review record. Commit не выполнен.

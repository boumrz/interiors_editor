---
title: "InteriorsEditor: независимый current-tech review"
review_type: current-tech
review_date: 2026-07-26
status: complete
verdict: CONCERNS
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../solution-design.md
  - ../../../research/technical-feasibility-2026-07-26.md
  - ../../../../specs/spec-interiors-editor-alpha/performance-budgets.md
  - ../../../../specs/spec-interiors-editor-alpha/asset-import-contract.md
---

# InteriorsEditor: независимый current-tech review

## 1. Вердикт

**CONCERNS.**

Ядро Alpha технически реализуемо как phone-first local-first PWA. Выбор
WebGL 2 как обязательного baseline, отделение доменной модели от renderer,
versioned persistence, portable backup и обязательные device-spikes образуют
правильное направление. Все 16 версий из seed-таблицы Architecture Spine
совпадают с `latest` в npm registry на 2026-07-26; заявленная связка
React/Three/R3F/Drei и связка Vite/Vitest/vite-plugin-pwa совместимы по
опубликованным peer constraints.

До заморозки архитектуры необходимо закрыть три платформенных разрыва:

1. локальное хранилище Safari и установленной Home Screen Web App на iOS не
   образует один непрерывный store;
2. жизненный цикл service worker не позволяет гарантировать, что новая версия
   активируется **только** после проверки приложения;
3. browser storage остаётся best-effort и может быть удалён целиком на уровне
   origin, поэтому гарантия «никогда не потерять проект» требует уточнения.

Пользовательский GLB остаётся технически достижимым как Alpha+ capability, но
его нельзя переводить в Alpha до доказанного deny-network preflight и
реального memory-pressure gate. Web Worker сохраняет отзывчивость UI и даёт
`terminate()`, но не является hard-memory sandbox.

## 2. Метод и шкала

Проверены:

- фактические версии и peer/engine metadata через live npm registry;
- браузерные утверждения по спецификациям WHATWG/W3C/Khronos и официальным
  материалам WebKit, Apple, Chrome, Vite и Three.js;
- согласованность технических гипотез между Architecture Spine, Solution
  Design, technical-feasibility research и двумя companion-контрактами SPEC.

Severity:

- **HIGH** — риск потери данных, обхода trust boundary или невыполнимый
  архитектурный инвариант; закрывается до соответствующего implementation
  gate;
- **MEDIUM** — недостающий platform/tool constraint способен дать ложный spike
  или существенную переделку;
- **LOW** — неточность формулировки или сопровождаемости без блокировки Alpha.

## 3. Проверка seed-версий

### 3.1 Результат

| Architecture label | Точный npm package | Seed | npm `latest` 2026-07-26 | Результат |
|---|---|---:|---:|---|
| TypeScript | [`typescript`](https://www.npmjs.com/package/typescript/v/7.0.2) | 7.0.2 | 7.0.2 | exact |
| React | [`react`](https://www.npmjs.com/package/react/v/19.2.8) | 19.2.8 | 19.2.8 | exact |
| Vite | [`vite`](https://www.npmjs.com/package/vite/v/8.1.5) | 8.1.5 | 8.1.5 | exact |
| Three.js | [`three`](https://www.npmjs.com/package/three/v/0.185.1) | 0.185.1 | 0.185.1 | exact |
| React Three Fiber | [`@react-three/fiber`](https://www.npmjs.com/package/@react-three/fiber/v/9.6.1) | 9.6.1 | 9.6.1 | exact |
| Drei | [`@react-three/drei`](https://www.npmjs.com/package/@react-three/drei/v/10.7.7) | 10.7.7 | 10.7.7 | exact |
| Zustand | [`zustand`](https://www.npmjs.com/package/zustand/v/5.0.14) | 5.0.14 | 5.0.14 | exact |
| Dexie | [`dexie`](https://www.npmjs.com/package/dexie/v/4.4.4) | 4.4.4 | 4.4.4 | exact |
| vite-plugin-pwa | [`vite-plugin-pwa`](https://www.npmjs.com/package/vite-plugin-pwa/v/1.3.0) | 1.3.0 | 1.3.0 | exact |
| Zod | [`zod`](https://www.npmjs.com/package/zod/v/4.4.3) | 4.4.3 | 4.4.3 | exact |
| glTF Transform | [`@gltf-transform/core`](https://www.npmjs.com/package/@gltf-transform/core/v/4.4.2) | 4.4.2 | 4.4.2 | exact |
| three-mesh-bvh | [`three-mesh-bvh`](https://www.npmjs.com/package/three-mesh-bvh/v/0.9.13) | 0.9.13 | 0.9.13 | exact |
| Vitest | [`vitest`](https://www.npmjs.com/package/vitest/v/4.1.10) | 4.1.10 | 4.1.10 | exact |
| Playwright | [`@playwright/test`](https://www.npmjs.com/package/@playwright/test/v/1.62.0) | 1.62.0 | 1.62.0 | exact |
| fast-check | [`fast-check`](https://www.npmjs.com/package/fast-check/v/4.9.0) | 4.9.0 | 4.9.0 | exact |
| Babylon.js candidate | [`@babylonjs/core`](https://www.npmjs.com/package/@babylonjs/core/v/9.18.0) | 9.18.0 | 9.18.0 | exact |

Это подтверждает корректность **снимка**, но не означает, что следует
устанавливать все пакеты: renderer, storage и acceleration-кандидаты по-прежнему
должны быть выбраны соответствующими spikes.

### 3.2 Совместимость

- `@react-three/fiber@9.6.1` объявляет React `>=19 <19.3` и Three
  `>=0.156`; `@react-three/drei@10.7.7` — React `^19`, R3F `^9` и Three
  `>=0.159`. Seed React `19.2.8`, R3F `9.6.1` и Three `0.185.1` входит в эти
  диапазоны.
- `vite-plugin-pwa@1.3.0` объявляет поддержку Vite `3–8`, а
  `vitest@4.1.10` — Vite `6–8`; Vite `8.1.5` входит в оба диапазона.
- Vite 8 требует Node.js `20.19+` или `22.12+`; это подтверждено
  [официальным анонсом Vite 8](https://vite.dev/blog/announcing-vite8).
  Playwright 1.62 требует Node.js `>=20`, Vitest 4.1 — Node.js `20`, `22`
  или `24+`.

## 4. Findings

### CT-H1 — Browser → installed PWA не сохраняет непрерывность local data на iOS

**Severity:** HIGH  
**Gate:** PWA/offline Alpha acceptance

**Evidence.** WebKit документирует, что при Add to Home Screen на iOS/iPadOS
копируются cookies, но не другие типы local storage; после установки website
data между браузером и web app не разделяются:
[WebKit, Safari 17.2](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/).
В Safari 26 пользователь вручную добавляет сайт на Home Screen и сам выбирает
`Open as Web App`; технических installability-требований у Safari больше нет:
[WebKit, Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/),
[Apple Support — Add to Home Screen](https://support.apple.com/en-ca/guide/iphone/iphea86e5236/ios).

**Почему это важно.** Проект, созданный в Safari до установки, может выглядеть
«пропавшим» при первом запуске Home Screen Web App. Это особенно опасно для
local-only продукта: серверной синхронизации, которая могла бы свести два
контекста, в Alpha нет. Текущие документы описывают browser storage и
установленную PWA как один логический путь, но не фиксируют этот переход.

**Proposed fix.**

1. Добавить явную platform invariant: browser tab и standalone web app на iOS
   рассматриваются как разные local-data contexts.
2. Выбрать и описать один поддерживаемый onboarding:
   - рекомендовать установку **до** создания первого проекта; либо
   - дать portable export/import handoff из браузера в установленную PWA.
3. Не использовать формулировку «проект автоматически появится после
   установки».
4. Включить в real-device matrix сценарии:
   `Safari create → Add to Home Screen → standalone open`,
   `standalone export → Safari import` и повторную установку.
5. Показывать пользователю, в каком контексте открыт проект, и где находится
   его переносимая резервная копия.

**Closure evidence:** успешный handoff без backend на минимальном iPhone и
документированный UX для случая, когда browser project отсутствует в
standalone context.

### CT-H2 — AD-11 переоценивает управляемость service-worker activation

**Severity:** HIGH  
**Gate:** architecture freeze / CAP-9

**Evidence.** AD-11 утверждает, что новая worker-версия активируется только
после commit Revision и проверки migration path. Однако Service Worker
specification:

- автоматически повторяет activation, когда последний controlled client
  выгружен;
- переводит waiting worker в active при shutdown user agent;
- предупреждает, что activation handler может не завершиться при остановке
  браузера.

Источник:
[W3C Service Workers — lifecycle algorithms](https://w3c.github.io/ServiceWorker/).

**Почему это важно.** UX может отложить reload активной страницы, но приложение
не может превратить waiting state в транзакционную блокировку новой версии
между закрытиями браузера. Следовательно, безопасность schema нельзя доказывать
условием «worker ещё не активировался».

**Proposed fix.**

1. Переформулировать AD-11: user-mediated activation используется как UX в
   активной сессии, но корректность данных не зависит от возможности удерживать
   waiting worker.
2. На каждом startup/open Project выполнять version handshake:
   `shell version ↔ project schema ↔ catalog/asset schema`.
3. Делать migration idempotent, forward-only и copy-on-write **до** публикации
   новой current revision.
4. Поддерживать как минимум совместимость shell `N` с project schema `N-1`
   либо показывать recoverable migration screen до открытия проекта.
5. Не очищать cache предыдущего deploy в `activate`, пока не доказано
   отсутствие старых clients и не выполнена политика совместимости.
6. Не использовать unconditional `skipWaiting()`; все сценарии должны быть
   корректны и при автоматической activation после закрытия всех clients.

**Closure evidence:** тесты `active edit + waiting update`, `close all clients`,
`browser kill during activate`, `offline reopen after update` и recovery
последней валидной revision.

### CT-H3 — Browser eviction ограничивает обещание «проект никогда не удаляется»

**Severity:** HIGH  
**Gate:** NFR-10–NFR-15 / Alpha data-safety claim

**Evidence.** В WebKit Cache API, IndexedDB, Service Worker и File System входят
в одну storage-policy область. Best-effort origin может быть evicted при quota
pressure, системном storage pressure или неактивности; WebKit обычно удаляет
данные origin целиком, а не только catalog cache:
[WebKit — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
Стандарт позволяет запросить persistent storage через
`navigator.storage.persist()`, но это запрос, а не безусловная гарантия:
[WHATWG Storage Standard](https://storage.spec.whatwg.org/).

**Почему это важно.** Фраза «Project metadata — никогда не очищать
автоматически» выполнима только как правило самого приложения. Она не запрещает
browser/OS удалить IndexedDB вместе с Cache Storage. App-level LRU каталога
снижает давление, но не управляет browser-level eviction.

**Proposed fix.**

1. Уточнить гарантию: приложение никогда само не удаляет пользовательский
   Project без подтверждения; browser/OS storage не считается backup.
2. После осмысленного engagement запрашивать persistent mode и показывать его
   фактический статус, не обещая, что запрос будет удовлетворён.
3. Использовать `estimate()` только как ориентир; обрабатывать
   `QuotaExceededError` на каждой write boundary.
4. Ввести watermarks и proactive LRU только для повторно скачиваемого каталога,
   до того как storage приблизится к quota.
5. Portable export должен быть обязательной проверяемой capability Alpha;
   нужен UX напоминания о backup для проектов без внешней копии.
6. В device-spike проверить pressure, site-data clearing, denied persistence,
   full-origin recovery и импорт backup в чистый context.

**Closure evidence:** текст гарантии согласован с реальным browser contract,
backup round-trip проходит после полной очистки origin data.

### CT-H4 — GLB trust boundary корректен по намерению, но пока не доказан

**Severity:** HIGH для CAP-12; не блокирует core Alpha, пока CAP-12 остаётся Alpha+  
**Gate:** CAP-12 promotion

**Evidence.**

- Binary glTF может ссылаться на внешние ресурсы; расширение `.glb` само по себе
  не означает self-contained asset:
  [Khronos glTF 2.0, Binary glTF](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
- `GLTFLoader.parse()` принимает base path, а Draco, KTX2 и Meshopt требуют
  отдельно настроенных decoder paths/objects:
  [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
- Worker запускает отдельный global environment и может быть завершён через
  `terminate()`, но worker API также участвует в fetch processing и не
  предоставляет приложению hard memory quota:
  [WHATWG HTML — Web Workers](https://html.spec.whatwg.org/multipage/workers.html).
  Последний вывод — архитектурная интерпретация опубликованного API, а не
  обещание конкретной реализации браузера.

**Почему это важно.** Проверка после `GLTFLoader` уже опоздает, если loader или
decoder успел запросить URI либо выделить чрезмерную decoded memory. Worker
защищает main-thread responsiveness, но OOM может завершить весь renderer/tab
process, а не только аккуратно вернуть `MEMORY_BUDGET_RISK`.

**Proposed fix.**

1. До любого Three.js loader разобрать GLB header и JSON chunk ограниченным
   byte-level preflight.
2. До decode отклонить external/data URI, неизвестные required extensions,
   запрещённые scene features и заведомо чрезмерные declared dimensions/counts.
3. Передать loader deny-all resource resolver; тест должен падать при любой
   попытке `fetch`, XHR или неожиданного URL resolution.
4. Bundled decoder JS/WASM/workers хранить локально, version/hash pin и
   precache; runtime CDN decoder path запрещён.
5. Разделить лимиты на:
   file/container bytes, declared counts, decoded CPU bytes, texture pixels и
   приблизительный GPU footprint.
6. Timeout/cancel реализовать через `terminate()` и discard staging data, но не
   называть это hard memory containment.
7. Проверять hostile corpus на реальных floor devices, включая повторный
   import/cancel/delete и process restart после memory pressure.
8. `gltf-validator@2.0.0-dev.3.10`, который research справедливо помечает как
   dev-release, не использовать как единственную security boundary. Нужны
   точный audited artifact и собственная resource policy.

**Closure evidence:** network log остаётся пустым для hostile corpus, превышение
каждого лимита отклоняется до Project commit, а после abort/restart открывается
последняя валидная revision.

### CT-M1 — Не зафиксирован воспроизводимый build/runtime envelope

**Severity:** MEDIUM  
**Gate:** до scaffold после READY/waiver

**Evidence.** Vite 8 требует Node.js `20.19+` или `22.12+`:
[Vite 8 release](https://vite.dev/blog/announcing-vite8). Его default
`build.target` на текущем релизе соответствует Chrome 111, Edge 111,
Firefox 114 и Safari 16.4:
[Vite 8 migration guide](https://vite.dev/guide/migration.html).
Это build default, а не продуктовая device matrix.

На review-host в workspace обнаружен Node.js `23.6.1`. Он удовлетворяет
диапазону Vite 8, но **не** входит в engines Vitest 4.1 (`^20`, `^22`,
`>=24`). Без project-level pin один и тот же seed уже даёт неподдерживаемую
комбинацию инструментов.

**Gap.**

- нет Node.js major/minor policy;
- нет package-manager/version policy;
- нет явного browser build target;
- нет exact package IDs в нескольких строках Architecture Spine;
- отсутствуют load-bearing `@vitejs/plugin-react` и Workbox packages, хотя
  technical research уже содержит их версии.

**Proposed fix.**

1. До реализации зафиксировать Node.js line, package manager и lockfile policy.
2. Вывести `build.target` из утверждённой floor-device matrix, а не принимать
   меняющийся Vite default.
3. Записать точные identifiers:
   `@react-three/fiber`, `@react-three/drei`,
   `@gltf-transform/core`, `@playwright/test`, `@babylonjs/core`.
4. Добавить в seed только реально выбранные:
   [`@vitejs/plugin-react@6.0.4`](https://www.npmjs.com/package/@vitejs/plugin-react/v/6.0.4)
   и Workbox runtime, который фактически генерирует/управляет service worker
   (`vite-plugin-pwa@1.3.0` сейчас ожидает Workbox `7.4.1`).
5. Подтвердить production build, offline precache и source maps минимальным
   compatibility spike после снятия запрета на implementation artifacts.

### CT-M2 — Provisional import limits расходятся между research и SPEC

**Severity:** MEDIUM  
**Gate:** S-5 / CAP-12

Technical research и `asset-import-contract.md` оба честно помечают значения
как provisional, но таблицы не совпадают:

| Ресурс | Technical research | Asset import contract |
|---|---:|---:|
| Vertices | 500k | 300k hard |
| Nodes | 128 | 256 hard |
| Primitives | 32 | 128 hard |
| Materials | 16 | 32 hard |
| Textures | 8 | 16 hard |
| Texture dimension | 2048 | 2048 preferred / 4096 hard |
| Decoded texture pixels | 8 MP | 48 MP hard |

Размер файла и triangle hard limit совпадают, но остальные различия создадут
разные fixtures и ложные результаты spike.

**Proposed fix.**

1. Назначить `asset-import-contract.md` единственным владельцем provisional
   import policy; research должен ссылаться на него, не дублировать числа.
2. После S-5 заменить значения измеренными и записать дату/device/browser
   evidence.
3. В дальнейшем хранить policy в одном versioned declarative source, из
   которого строятся validator fixtures и пользовательские сообщения.

### CT-M3 — Performance gate ещё нельзя воспроизвести на конкретных устройствах

**Severity:** MEDIUM  
**Gate:** S-1/S-4 и Alpha performance acceptance

`performance-budgets.md` правильно маркирует бюджеты как provisional и требует
real-device evidence. Однако `Floor Android` и reference iPhone ещё `TBD`, а
режим запуска browser tab/standalone не разделён. Это особенно важно после
CT-H1: на iOS это разные процессы и storage contexts.

Дополнительно `128 MiB GPU envelope` нельзя трактовать как непосредственно
наблюдаемую браузером VRAM. Three.js публикует counts textures/geometries,
programs, draw calls и triangles, но не portable byte-accurate VRAM:
[Three.js WebGLRenderer.info](https://threejs.org/docs/pages/WebGLRenderer.html).

**Proposed fix.**

1. Указать точные floor/reference device models, RAM class, OS build, browser
   version и browser/standalone mode.
2. Для GPU envelope зафиксировать proxy model: decoded texture bytes с
   mipmaps, geometry/index bytes, render targets и safety multiplier; отдельно
   собирать `renderer.info`.
3. Определить cold/warm startup, cache state, battery state, orientation,
   viewport/DPR, session duration и cooldown между повторами.
4. Зафиксировать внешний метод thermal observation и критерий деградации;
   не выдавать отсутствие browser signal за отсутствие throttling.
5. Playwright/Vitest использовать для функциональной повторяемости, но hard
   performance gate принимать только по реальным устройствам.

### CT-M4 — iOS install UX нельзя строить вокруг автоматического prompt

**Severity:** MEDIUM  
**Gate:** CAP-9 UX acceptance

Apple описывает пользовательский путь через Share/Add to Home Screen, а Safari
26 позволяет пользователю выключить `Open as Web App`:
[Apple Support](https://support.apple.com/en-ca/guide/iphone/iphea86e5236/ios),
[WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

**Proposed fix.**

- Alpha должна оставаться функциональной в browser tab и не зависеть от
  install prompt;
- install-help делается platform-specific и объясняет data-context consequence
  из CT-H1 **до** первого проекта;
- manifest, icons и service worker нужны для качественного experience/offline,
  но наличие manifest не доказывает, что пользователь запустил standalone app;
- acceptance проверяет browser, standalone и случай `Open as Web App = off`.

### CT-L1 — Утверждение о WebGPU следует сузить до mobile product context

**Severity:** LOW  
**Gate:** documentation cleanup; WebGPU не блокирует Alpha

Research пишет, что WebGPU поставляется в Chrome, Firefox и Safari. Это верно
на уровне семейств браузеров, но может читаться как универсальная мобильная
поддержка. Официальная матрица Chrome указывает первоначальный Android path:
Android 12+ и Qualcomm/ARM GPUs; Firefox 141 в приведённом источнике относится
к Windows. Safari 26 поставляет WebGPU на iOS/iPadOS/macOS/visionOS:
[Chrome WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview),
[WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

**Proposed fix.** Формулировать так: «WebGPU доступен на выбранных комбинациях
browser/OS/GPU; mobile path всегда capability-detected и enhancement-only».
AD-5 уже следует этому принципу, поэтому архитектурное решение менять не нужно.

## 5. Подтверждённые решения без finding

1. **WebGL 2 baseline корректен.** Текущий Three.js `WebGLRenderer` использует
   WebGL 2 и не поддерживает WebGL 1 с r163:
   [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).
   Device capability/context-loss tests всё равно обязательны.
2. **WebGPU как progressive enhancement корректен.** Он не должен входить в
   Alpha gate; capability detection и отдельный adapter сохраняют один
   обязательный renderer path.
3. **Domain/renderer separation реализуема и уместна.** Disposable 3D
   projections защищают canonical geometry и recovery при context loss.
4. **IndexedDB metadata + blob-port + OPFS/IDB spike — правильная постановка.**
   File System Standard подтверждает bucket file system и worker-only
   `createSyncAccessHandle()`:
   [WHATWG File System Standard](https://fs.spec.whatwg.org/).
   Конкретный storage adapter должен остаться результатом spike, не скрытым
   vendor lock-in.
5. **GLB-only и отказ от внешних URI — правильное сужение scope.** Finding
   CT-H4 требует доказать enforcement, а не расширить форматы.
6. **Performance и import numbers честно помечены provisional.** Это не
   продуктовые обещания; проблема только в несинхронной import-таблице и пока
   не выбранной device matrix.
7. **Seed — корректный snapshot, а не install list.** Renderer alternatives,
   BVH и polygon libraries не следует добавлять до evidence.

## 6. Приоритет исправлений

### P0 — до architecture freeze

- закрыть CT-H1: browser/standalone data-context policy и handoff;
- исправить AD-11 по CT-H2;
- уточнить data durability promise и backup gate по CT-H3.

### P0 для CAP-12

- специфицировать byte-level deny-network preflight;
- доказать staged decoded limits и recovery после worker/process abort;
- принять audited decoder/validator artifacts.

### P1 — до первого scaffold после READY/waiver

- зафиксировать Node/package manager/browser target и точные package IDs;
- определить floor-device matrix;
- централизовать provisional import limits.

### P2 — после spikes

- заменить provisional performance/import numbers измеренными;
- уточнить WebGPU wording и принимать enhancement только по evidence.

## 7. Условия перехода к PASS

Current-tech review может стать `PASS`, когда:

- невозможный activation-инвариант AD-11 заменён version-tolerant startup и
  migration protocol;
- iOS browser/standalone transition имеет проверяемый UX и backup handoff;
- гарантия сохранности явно отделяет поведение приложения от browser eviction;
- toolchain envelope воспроизводим и связан с утверждённой device matrix;
- import policy имеет одного владельца;
- CAP-12 остаётся Alpha+ либо проходит отдельный no-network/memory-pressure
  gate.

До этого `CONCERNS` не означает, что выбранный продукт или Web/PWA-платформа
неподходящи. Это означает, что три platform contracts нельзя заменить
намерениями приложения и что их нужно сделать явной частью спецификации до
реализации.

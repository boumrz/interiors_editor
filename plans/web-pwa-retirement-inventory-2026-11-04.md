---
title: "Подготовка Web/PWA retirement после проверки Telegram"
date: 2026-11-04
status: inventory-only-removal-not-authorized
anchors: [CAP-9, CAP-13, FR-58, NFR-24, NFR-26, NFR-28, AD-25, AD-28]
---

# Граница будущего удаления

Владелец хочет в итоге оставить Telegram Mini App, предварительно проверив его.
Этот inventory делает будущую границу удаления конкретной. **Сейчас ни один
файл не удаляется.** S0–S7 сохраняют полные Web/PWA и их проверки; удаление
требует отдельного retirement допуска после owner verification и условий
[раздела 15 задания](telegram-mini-app-extension-spec-2026-11-04.md).

S1 выделил browser wrapper из общего редактора. На 5 ноября добавлены отдельные
`src/telegram-main.tsx`, `app/telegram-editor-app.tsx`, Telegram runtime/host adapters,
`rspack.telegram.config.mjs` и отдельный `dist-telegram` с собственным manifest и
retained release delivery. Проверки продолжаются; физическая Telegram-приёмка
и сам retirement ещё не пройдены. Папка `apps/web` содержит общее ядро и оба target,
целиком её удалять нельзя. Перед retirement inventory сверяется с финальным diff.

## Browser-owned кандидаты после gate

| Область | Конкретные файлы | Условие |
| --- | --- | --- |
| Browser bootstrap/composition | `apps/web/src/main.tsx`, `apps/web/src/app/browser-editor-app.tsx` | Независимый Telegram entry и проверенный runtime; общий `global.css` сохраняется |
| Очистка dev-контекста Web | `apps/web/src/app/development-startup.ts`, `development-startup.test.ts` и dev-only wiring в `main.tsx` | Убирается вместе с Web bootstrap после retirement gate. Telegram entry этот модуль не импортирует; технический reload marker не является Project/data migration |
| Browser startup proof | `apps/web/src/app/browser-host-startup.test.ts`, `apps/web/stryker.browser-host.config.mjs`, `apps/web/tests/browser/browser-host-boundary-e2e.spec.ts` | Сначала применимые проверки перенести в Telegram regression; историческое evidence сохранить |
| Install UX capability | `apps/web/src/ui/pwa-install-capabilities.ts`, `apps/web/src/ui/pwa-install-capabilities.test.tsx`, `apps/web/stryker.story-8-3-pwa-capabilities.config.mjs` | Удалять только после снятия install capability отдельным решением |
| Worker/install artifacts | `apps/web/public/manifest.webmanifest`, `apps/web/public/sw.template.js` | Решён доступ прежних клиентов к своим данным; удаление артефакта не означает remote unregister/wipe |
| PWA-specific suite | `apps/web/playwright.pwa.config.mjs`, `apps/web/tests/browser/pwa-e2e.spec.ts` | Удаляется последним после последней browser regression и утверждённого retirement |
| Old→new browser upgrade fixture | `apps/web/playwright.host-upgrade.config.mjs`, `apps/web/tests/upgrade/browser-host-upgrade.spec.mjs` | Только после доказанной независимой Telegram release/rollback rehearsal и решения поддержки старых clients |

## Сначала разделить обязанности

| Файлы | Что можно будет убрать | Что обязательно сохранить |
| --- | --- | --- |
| `apps/web/rspack.config.mjs` | Browser target, worker/precache generation | Telegram target, ReleaseManifest/build identity, loaders, budgets, lazy Three.js chunks, catalog packaging; разделить нынешний `InteriorsServiceWorkerPlugin` |
| `apps/web/public/index.html`, `apps/web/public/icon.svg` | Только browser install/manifest metadata | Telegram HTML и нужная иконка; icon не становится ненужным автоматически |
| `apps/web/src/ui/AppShell.tsx`, `AppShell.module.css`, `AppShell.test.tsx` | `PwaInstallGuide`, `PwaUpdateNotice`, browser install/update/browse-cache wiring и соответствующий CSS | Общий редактор, Projects, Plan/3D, recovery, commands, catalog, accessibility и их tests |
| `apps/web/src/ui/PlanProjection.tsx`, `RoomScene3d.tsx` | Только отключённый browser update consumer | `onPwaUpdateSafetyChange` выражает transient edit/draft safety: переименовать/переподключить к Telegram Back/Close/lifecycle, не удалять сигнал |
| `apps/web/src/app/browser-ports.ts` | Только browser-specific session writer/takeover defaults после их выделения | WebCrypto/checksums, UUID, clock, StorageManager и безопасные scoped equivalents |
| `apps/web/scripts/serve-pwa-e2e.mjs`, `pwa-preview-server.test.mjs`, `apps/web/stryker.preview-server.config.mjs` | Browser-only routing/worker checks после разделения | Static delivery, catalog route, Range/hash/HTTP behavior и применимые delivery tests |
| `apps/web/playwright.config.mjs`, `apps/web/tests/browser/browser-host-fixture.ts` | Только явно retired browser/PWA cases | Общие editor/data/fencing/recovery/geometry/catalog checks; fixture старых данных может оставаться нужным |
| `apps/web/rspack.telegram-storage-test.config.mjs` | Убрать зависимость от browser-only части base config после её разделения | Native Telegram storage harness, его Playwright/mutation configs и runners остаются; base loaders не требуют сохранения worker template |
| `apps/web/package.json`, `package.json`, `.github/workflows/verify.yml`, `docs/operations/PHONE-AND-RELEASE-RUNBOOK.md` | Retired target commands/jobs/instructions после переноса checks | Workspace, lockfile, pinned runtime, Telegram build/tests и действующие общие gates |

## Общее ядро остаётся

- `apps/web/src/app/editor-app.tsx`, `editor-host-boundary.test.ts`,
  `production-app.ts`, `project-controller.ts`, `release-startup.ts` и его tests;
- Telegram adapters и runtime session; общие UI/CSS и их tests;
- `apps/web/src/domain/**`, `src/application/**`, adapters persistence,
  portable-backup, catalog и renderer;
- `apps/web/public/catalog/**`, `scripts/catalog-package.test.mjs`,
  `scripts/check-runtime.mjs` и общие mutation scopes;
- root `scripts/check-boundaries.mjs`, его tests, действующие `contracts/**`;
- `apps/catalog-control-plane/**`: это общий каталог, не хранилище проектов.

Названия с `browser`/`pwa` не являются достаточным основанием удаления.
Domain/durability/codec/recovery/history/resource checks остаются нужными
Telegram. Исторические planning/evidence и стабильные retired IDs сохраняются.

## Последовательность после отдельного допуска

1. Владелец проверяет настоящий Telegram workflow. Закрываются применимые
   TMA-AC/NFR-28: iOS/Android, identity/account isolation, lifecycle, ресурсы,
   сохранение/reopen и внешний file reselect/roundtrip в обе стороны.
2. Устранён V1/PPJ source conflict и доказан перенос существующих данных с
   сохранением оригиналов. Решён доступ к старым browser/Home Screen contexts,
   включая единственную копию/backup. Смена origin сама по себе IDB не переносит.
3. Проверены отдельные Telegram entry/output/manifest/catalog routing,
   совместимость выпуска, old lazy clients и rollback. Retained immutable URLs
   не удаляются автоматически; уже открытые клиенты и их данные учтены.
4. Canonical owners явно меняют platform applicability. Отдельный readiness/
   retirement review оценивает конкретный diff и regression; owner даёт допуск.
5. Только тогда убираются browser-owned wiring/artifacts и в последнюю очередь
   retired tests/jobs. Проверки общего ядра продолжают проходить. Коммит всё
   равно требует явного разрешения владельца.

Удаление оболочки никогда не запускает автоматический `indexedDB.deleteDatabase`,
wipe пользовательских blobs, массовую очистку caches или remote unregister
старого worker. Архивирование deployment и доступ к прежним данным решаются
явно; отказ сервера выдавать старую оболочку не должен уничтожить единственный
путь к исходной копии. Сервис пользовательских файлов/sync для retirement не
добавляется без отдельного согласования.


## Уточнения по фактическому второму target — 5 ноября

| Связь в текущем коде | Подготовка перед будущим удалением |
| --- | --- |
| Telegram config импортирует общие настройки из `rspack.config.mjs`; чтение `public/sw.template.js` перенесено в `InteriorsServiceWorkerPlugin.apply` | Проверена реальная Telegram-сборка без browser entry/HTML/install manifest/worker template. Web до/после даёт побайтно те же54 артефакта. Сам общий config с loaders/budgets сохраняется до выделения окончательного Telegram-only target; worker остаётся нужен действующей PWA |
| Общий `editor-app.tsx` импортирует тип `ProductionAppRuntime` из browser composition `production-app.ts` | Вынести общий interface перед удалением browser composition; общий controller/editor не удалять |
| `browser-ports.ts` содержит общий checksum, secure IDs, clock и storage estimate для WebView | Имя файла не означает browser-only. Сохранить или перенести общие ports с сохранением проверок |
| Дополнительные browser registered import/export и legacy representability helpers | Поддерживать как перенос из старых контекстов до доказанной миграции; explicit ingress P1/no-overwrite/reselection review пока открыт |
| `telegram-release-build.mjs`, `telegram-preview-server.mjs`, release-set inventory и retained URLs | Сохранить независимый Telegram выпуск, catalog proxy и rollback. Старые release directories не очищать автоматически |
| Общие `global.css`, domain/application, renderer, recovery/history, resource policies и shared UI | Сохраняются вместе с их проверками. Host-параметры имеют прежние browser defaults до отдельного retirement |

Это подготовка границы удаления, а не разрешение на удаление, перенос пользовательских
баз, изменение origin или отключение доступа старых клиентов. Существующий preview
на 4175 и его 60 файлов выпуска остаются сохранёнными. Новые проверки используют
отдельные временные сборки и профили; факт их прохождения не заменяет проверку владельцем.

Подтверждение независимости сборки от browser-owned файлов:
[RED/GREEN, реальные сборки и сравнение байтов](../docs/progress/telegram-extension-2026-11-04/S7/target-build-independence/build-audit.json).
Файлы отсутствовали только во временной копии и затем были восстановлены.
Общий код и нынешний Web/PWA не удалены; независимый Telegram runtime по-прежнему
использует общие ports, codecs и renderer.

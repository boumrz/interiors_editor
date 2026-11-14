# S1 — browser host boundary, 4 ноября 2026

**Проверенный результат:** существующая Web/PWA-оболочка создаёт один browser
runtime и передаёт его общему редактору. Импорт общего редактора больше не
выбирает writer identity, не создаёт runtime и не публикует browser test control.
Telegram entry ещё не добавлен. Этот срез реализует Story 10.1 / TMA-01–04 в
границах отдельного [S1 READY](../../../../_bmad-output/planning-artifacts/implementation-readiness-report-2026-11-04.md).
Общий Epic 10 этим результатом не принят.

## Изменение

- `src/app/browser-editor-app.tsx` владеет прежними browser runtime, catalog
  gateway и чтением shell/worker manifest. Runtime остаётся module-scoped,
  включая React StrictMode.
- `src/app/editor-app.tsx` получает эти зависимости; существующие startup
  coordinator, recovery UI и editor продолжают работать.
- `src/main.tsx` загружает browser wrapper в прежнем lazy `editor-app` chunk.

Domain, persistence, DB names/stores/versions, Project codecs, worker, asset
admission, UI и lockfile не изменены. Browser и domain TypeScript-конфигурации
сохранены. `apps/web` содержит общее ядро и целиком удалению не подлежит.
Выделенный wrapper обозначает одну из будущих browser-owned границ retirement;
сам retirement требует проверки владельцем и отдельного допуска.

## Свежие проверки

| Проверка | Результат / evidence |
| --- | --- |
| RED общего editor import | [boundary-red.log](boundary-red.log): старый модуль записывал browser writer при импорте |
| Unit suite | [unit-final.log](unit-final.log): 2044 / 2044, 145 файлов, без skipped |
| Обе существующие TypeScript-конфигурации | [typecheck-verified.log](typecheck-verified.log): PASS |
| Lint | [lint-verified.log](lint-verified.log): 350 файлов, PASS |
| Architecture | [boundaries-final.log](boundaries-final.log): 15 / 15 + production graph PASS |
| Изолированный production build | [build.log](build.log): PASS, прежние budgets |
| Выборочный dev browser regression | [browser-regression.log](browser-regression.log): 6 / 6 |
| Существующий production PWA suite | [pwa.log](pwa.log): 10 / 10 |
| Реальный old shell/worker → candidate | [upgrade-final.log](upgrade-final.log): 1 / 1 |
| Mutation browser composition | [mutation-verified.log](mutation-verified.log), [JSON](mutation-verified.json): 97.67%, 43 mutants: 40 killed, 2 timeout, 1 equivalent survivor |
| Отдельный runtime lifetime mutant | [lifetime-mutant-red.log](lifetime-mutant-red.log): создание runtime при каждом render даёт 3 writer writes вместо 1, RED; исходник восстановлен |

6 dev browser cases: новый `HOST-S1-01`, прежние `EDITOR-E2E-00`,
`EDITOR-E2E-00A`, `PLAN-E2E-02`, `PROJECT-E2E-01/02`. Они проверяют отсутствие
Telegram SDK dependency, один writer при StrictMode, точное сохранение raw
Project/Revision records при reload, edit/reopen, browser cleanup без потери
данных и явный writer takeover. Это 17 разных browser cases вместе с PWA и
upgrade, а не полный повтор всего browser suite.

`HOST-S1-02` запускает отдельный preview с сохранёнными **старыми** артефактами
`ccdd13662cdca379`. Создаёт Project, публикует candidate с retained old chunks,
проверяет прежние lazy URL и впервые открываемый 3D в старом клиенте, выполняет
реальный service-worker update с явным reload, сравнивает exact records,
редактирует и повторно открывает offline. После теста старый fixture symlink
восстановлен. Это сильнее повторной регистрации того же worker с другим query.

Mutation scope — весь новый production `browser-editor-app.tsx`, а не диапазон
строк. Единственный survivor заменяет `catch { return undefined; }` на пустой
`catch` в завершающей ветке async-функции: оба пути возвращают `undefined`.
Два timeout удаляют тело Promise либо его `onmessage`, прекращая resolution;
они обнаружены runner. [Триаж](mutation-triage.json) сохраняет locations и
operators. Отдельный lifetime probe не входит в score 43 mutants.

## Сохранность текущего preview

Действующий телефонный preview `127.0.0.1:4175`, его `apps/web/dist`, tunnel и
catalog service не менялись. SHA-256 всех 60 файлов live output совпадает с
сохранённой до S1 копией. Проверки использовали `/tmp/interiors-tma-s1-oerid5v0`
и собственные loopback ports 49173 / 49175 / 49176. Временный layout не является
публикацией и может не сохраниться после очистки ОС.

[Сравнение сборок](build-comparison.json): candidate `d38550c8f379120a`,
Project schema readable/writable `[1]` у обеих сборок. Startup JS/CSS 197933 →
197940 bytes (+7); current release JS/CSS 1737498 → 1737745 bytes (+247),
28 файлов у обеих. Retained chunks не прибавляются повторно к current budgets.

## Повторение проверок

Из корня: `npm test`, `npm run typecheck`, `npm run lint`,
`npm run check:architecture` используют закреплённые Node 24.19.0 / pnpm
11.20.0. Для scope mutation из `apps/web`:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm exec stryker run stryker.browser-host.config.mjs
```

Production build выполняется с явным отдельным `--output-path`; обычные
`build`, `verify:web` и PWA config без external base URL способны перезаписать
live `dist`. Browser/PWA config допускают внешний base URL. Upgrade fixture:

```sh
INTERIORS_S1_VERIFY_ROOT=/tmp/interiors-tma-s1-oerid5v0 PLAYWRIGHT_S1_UPGRADE_BASE_URL=http://127.0.0.1:49176 npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm exec playwright test --config playwright.host-upgrade.config.mjs
```

Перед повторением upgrade нужно восстановить отдельный immutable old/candidate
layout и запустить его preview; тест требует его явно и не создаёт production
release. Failed промежуточные логи сохранены как история; окончательные
результаты перечислены в таблице. В частности, upgrade fixture переведён в
`.mjs`, как существующие Node delivery tests: browser tsconfig не расширялся
Node globals. Обе исходные TS-проверки после этого проходят.

## Границы результата

Нет нового Telegram запуска, bot/domain, physical iOS/Android evidence,
переноса `.interiors` или изменения licensing. Resource-free Project в upgrade
не доказывает соответствие PPJ-A1. Backend и неизменённая domain mutation suite
повторно не запускались; новый browser composition проверен своим scope.
S2 требует отдельного применимого READY и всех AD-26 guards до первой записи.
При будущей смене scope нужен полный teardown/remount редактора, а не замена
runtime prop у уже mounted writable EditorApp. Коммитов и публикации нет.

---
title: "Phone editor POC"
status: active-poc-only
waiver: W-POC-2026-08-04
updated: 2026-08-04
---

# Phone editor POC

Это локальный, телефонный proof of concept редактора: он показывает, как
человек выбирает инструмент, добавляет демонстрационную перегородку и
переходит в InApp Focus, чтобы редактор занял всё доступное пространство
экрана приложения. Полные условия и границы авторизации —
[`W-POC-2026-08-04`](../../_bmad-output/planning-artifacts/root-phone-poc-waiver-2026-08-04.md).

## Запуск

Из корня репозитория:

```bash
npm run poc:dev
```

Откройте `http://127.0.0.1:4173` в локальном браузере. В текущем POC сервер
намеренно привязан к loopback, чтобы не создавать сетевую поверхность; для
просмотра на физическом телефоне нужен последующий, отдельно авторизованный
local-network launch mode.

Команда-обёртка загружает ровно Node `24.19.0` и pnpm `11.20.0` через
зафиксированные `npx --package` версии, поэтому она работает и в shell, где
системный Node отличается от версии POC. При первом запуске нужен доступ к npm
registry. В подготовленном checkout зависимости устанавливаются так:

```bash
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm install --frozen-lockfile
```

## Что попробовать

1. Нажмите «Перегородка».
2. Нажмите «Добавить перегородку»: счётчик изменится с 8 на 9, а план покажет
   дополнительный сегмент. После этого кнопка заблокирована: в POC намеренно
   существует ровно одна демонстрационная перегородка.
3. Нажмите кнопку разворота в правом верхнем углу. Это InApp Focus — не
   браузерный Fullscreen API — с явной кнопкой выхода и видимым статусом
   `POC · demo data · not saved`; рядом всегда показан текущий инструмент.
4. Выйдите из Focus: выбранный инструмент и результат остаются только в
   текущем React-сеансе. Перезагрузка возвращает исходный демонстрационный
   план.

![Обычный экран POC](screenshots/phone-poc-initial.png)

![InApp Focus после добавления перегородки](screenshots/phone-poc-focus.png)

## Проверки

```bash
npm run poc:test
npm run poc:typecheck
npm run poc:build
npm run poc:test:e2e
npm run poc:test:mutation
```

Или одним полным прогоном: `npm run poc:verify`.

Playwright использует Chrome c профилем iPhone 13 и проверяет успешное и
защищённое добавление перегородки, Focus с видимыми критическими элементами и
текущим инструментом, touch-target не менее 44×44 CSS px, отсутствие
вертикального переполнения в viewport 390×664, явный возврат и полный reset
состояния после reload. Это browser-emulation evidence, а не сертификация
физического iPhone или Samsung.

Mutation-check использует Stryker command runner поверх Rstest (для Rstest
нет отдельного Stryker runner) и намеренно мутирует только
`src/poc/editor-state.ts`. Последний полный прогон: 34/34 killed, 100%. Он работает
in-place с временным backup, поэтому не запускайте его одновременно с ручным
редактированием этого файла.

## Честные ограничения

- Данные строго синтетические, контролируемые исходным кодом и живут только в
  памяти React. Нет `localStorage`, `sessionStorage`, IndexedDB, OPFS,
  service worker или PWA cache.
- Нет сетевого API, backend, Kotlin/PostgreSQL, аутентификации, каталога,
  импорта, durable revision, backup/recovery или 3D/WebGL-renderer.
- Нет нативного Fullscreen API, PWA-install claim либо утверждения о
  production/offline готовности.
- `apps/catalog-control-plane` остаётся закрытым до решения `G-CP-ADR`.

Это POC не закрывает `G-READY` и не меняет действующий verdict `NOT_READY`.
Он не может быть silently promoted в production delivery.

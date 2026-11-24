# InteriorsEditor

Редактор планировки квартиры для Telegram Mini App на iOS и Android. Проекты
хранятся локально, поддерживают точные размеры в миллиметрах, связанные комнаты,
мебель, 2D/3D и переносимые резервные копии.

## Запуск редактора

Telegram Mini App открывается через [InteriorsEditorBot](https://t.me/InteriorsEditorBot?startapp)
и обслуживается на [domiknote.ru](https://domiknote.ru/). Решение о переходе
на единственную версию описано в [плане закрытия Web/PWA](plans/telegram-only-retirement-and-encrypted-backup-2026-11-24.md).
Владелец выбрал
нидерландский VPS `147.45.133.75` основным. Прежний российский VPS, его IP и
четыре устаревшие DNS-записи удалены по указанию владельца; резервные копии
сохранены. S3 не подключён. Доступ и результаты проверки описаны в
[hosting runbook](docs/operations/HOSTING.md).
После перемежающихся таймаутов доступ с Mac восстановился без изменений;
повторные запросы и запуск Mini App проходят, причина прежнего сбоя пока
не установлена и исправление не подтверждено. Подробности — в
[последующей диагностике сети](docs/progress/telegram-extension-2026-11-04/S7/resume-2026-11-06/network-stability-20261108/README.md).
Текущие рамки приёмки и ограничения Telegram находятся в
[актуальном статусе](docs/progress/telegram-extension-2026-11-04/current-status.md).

## GitHub и автопубликация — 14 ноября 2026

Репозиторий: [boumrz/interiors_editor](https://github.com/boumrz/interiors_editor).
Владелец разрешил коммит, push и настройку deployment. Push в `main` запускает
[workflow](.github/workflows/deploy.yml) с проверками и публикацией Telegram
Mini App на основной VPS. Старые неизменяемые ресурсы поддерживают откат
редактора. Каталог Kotlin/PostgreSQL имеет отдельные проверки и поставку.

Receiver и два secrets environment `production` установлены. Настройка и
rollback описаны в [инструкции](docs/operations/GITHUB-DEPLOYMENT.md).
Фактический результат каждого выпуска доступен в
[Actions](https://github.com/boumrz/interiors_editor/actions/workflows/deploy.yml)
и серверном `frontend/last-deployment.json`. Схема БД и существующая публикация
каталога сохраняются; изменения migrations/seed требуют отдельного обновления
данных и останавливают обычный rollout до его подготовки.

Из Git исключены тяжёлые сырые отчёты, архивы и копии проверки под
`docs/progress`: они сохранены локально. Markdown с решениями и статусами,
канонические `_bmad-output`, исходники, fixtures и зависимости сборки входят
в репозиторий. Исторические ссылки на исключённые raw evidence не означают,
что эти файлы доступны в GitHub clone.

## Состояние на 24 октября 2026

В [трекере](_bmad-output/implementation-artifacts/sprint-status.yaml)
закрыты **35 из 35 активных историй Alpha**, Epics 1–8 — `done`.
Итоговый BMAD implementation-readiness —
[**READY от 30 августа**](_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-30.md#final-verdict--2026-08-30).
Внутри отчета сохранены прежние отрицательные заключения; актуален финальный
verdict. READY разрешает реализацию и не означает готовность публичного
сервиса или прохождение пользовательского исследования.

Реализованы проекты и атомарное сохранение, один пишущий контекст, стены
0°/45°/90°, комнаты и проемы, Three.js/WebGL2, каталог и floor/wall размещение,
история текущей сессии, offline/PWA, recovery и `.interiors` export/import.
Сентябрьский редизайн добавил Projects-first вход, явную подготовку каталогов,
именованные измерения и доступные панели сохранения, комнат и подтверждений.

В продолжении 24 октября реализованы оставшиеся native mobile dialogs,
динамический отступ под шапкой, read-only recovery проекция, exact repair из
backup и отдельный экспорт/восстановление неопубликованной правки как нового
проекта. Исправлены cross-context pin cleanup, подготовлены CI и runbooks;
PlanProjection и общие renderer helpers выделены из больших модулей.
Итоговая общая регрессия этого продолжения выполняется; результаты фиксируются
в рабочем плане и отчете, отдельно от исторического READY.

Custom GLB остается отдельным Epic 9 Alpha+: трекер пока содержит две истории
`in-progress` и одну `backlog`; новые lifecycle и floor/wall срезы не заменяют
формальную приемку. FBX/ZIP преобразование остается экспериментом вне принятого
GLB-only контракта. Постоянное размещение и исследование с участниками требуют
реального домена/доступа и людей.

Focus/fullscreen, Walk, покрытия поверхностей, независимые варианты проекта
и PNG export/share исключены из Alpha. Аккаунты, синхронизация и серверное
хранение пользовательских проектов в текущий продукт не входят.

## С чего начать

- [Отчет возвращения к проекту](docs/progress/PROJECT-RESUME-2026-10-24.md).
- [Текущий план исполнения](plans/project-continuation-2026-10-24.md).
- [Оставшийся интерфейсный срез](plans/calm-spatial-redesign-p0-2026-08-31.md#remaining-work--reconciled-2026-09-05).
- [Запуск на телефоне и выпуск](docs/operations/PHONE-AND-RELEASE-RUNBOOK.md).
- [Проверка полезности с новыми пользователями](docs/validation/ALPHA-USABILITY-PROTOCOL.md).
- [Индекс документации](docs/index.md): PRD, SPEC с companions, архитектура и evidence.

## Структура

- `apps/web` — React 19.2.8, TypeScript 7.0.2, Rspack 2.1.8,
  CSS Modules, Rstest, Playwright; domain/application/adapters/composition.
- `apps/catalog-control-plane` — Kotlin/Ktor/PostgreSQL, versioned catalog
  metadata и exact resources. Пользовательские Project/Revision/History/Backup
  никогда не становятся данными этого сервиса.
- `contracts` — граница каталога и общие fixtures.
- `docs` — документация для человека; `_bmad-output` — канонические источники
  и сохраненная история решений. Переносить их без authority mapping нельзя.

## Запуск и проверки

Используйте закрепленный launcher: установленный на компьютере `pnpm`
может принадлежать другой версии Corepack.

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm install --frozen-lockfile
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm run dev
```

`dev` собирает TMA и открывает локальный сервер предпросмотра. Для проверки
обычного входа требуется подписанный запуск из Telegram. [Запуск и проверки TMA](docs/TELEGRAM-RUNBOOK.md).

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm run verify:telegram
```

`verify:telegram` запускает lint, проверки архитектуры и типов, модульные тесты,
сборку, проверки поставки и сценарии TMA. Полный `verify` дополнительно
запускает проверки каталога и мутационные проверки общего кода. Для каталога нужны JDK 17 и Docker
для Testcontainers PostgreSQL 18.4:

```sh
cd apps/catalog-control-plane
./gradlew --no-daemon test pitest
```

[CI](.github/workflows/verify.yml) проверяет Telegram и каталог в отдельных
задачах. PR и `codex/**` проверяются без публикации. Мутационные проверки
полного общего кода и Kotlin PIT можно запустить вручную.

Проект опубликован в GitHub. Разрешение владельца от 12 ноября и текущий
запрос охватывают commit, push и deployment существующего продукта.
Один владелец редактирует один срез; действуют TDD и [AGENTS.md](AGENTS.md).
Архивный POC и spike-код не переносятся в приложение.

Отчет о доработках 24 октября: [DELIVERY-2026-10-24](docs/progress/DELIVERY-2026-10-24.md), с текущим телефонным запуском и проверенным остатком roadmap.

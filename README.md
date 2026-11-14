# InteriorsEditor

Редактор планировки квартиры на телефоне: точные размеры в миллиметрах,
связанные комнаты, мебель и общий 2D/3D проект. Устанавливается как PWA,
хранит проекты локально и поддерживает offline и переносимые резервные копии.

## Основное размещение на 8 ноября 2026

Telegram Mini App опубликован через [InteriorsEditorBot](https://t.me/InteriorsEditorBot)
на [domiknote.ru](https://domiknote.ru/); Web/PWA сохранён на
[www.domiknote.ru](https://www.domiknote.ru/). Владелец подтвердил запуск и выбрал
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

## GitHub и автопубликация — подготовка 12 ноября 2026

Целевой репозиторий: [boumrz/interiors_editor](https://github.com/boumrz/interiors_editor).
Владелец разрешил коммит, push и настройку deployment. Подготовлен
[workflow](.github/workflows/deploy.yml): push в `main` запускает Web/PWA,
Telegram и Kotlin regression, проверяет содержимое репозитория и deployment
контракты, после успешных проверок публикует оба frontend на основной VPS.
Точные ресурсы старых выпусков сохраняются; неудачная серверная проверка
возвращает предыдущий активный выпуск.

Установка receiver и двух GitHub environment secrets описана в
[инструкции](docs/operations/GITHUB-DEPLOYMENT.md). Backend этим процессом
проверяется, но автоматически не заменяется; изменение его исходников или
контрактов блокирует публикацию до отдельно проверенного backend rollout.
На этапе подготовки текущая сессия запрещает запись в `.git`, SSH и открытие
локальных портов. Поэтому commit, push, реальный CI и deployment пока **не
выполнены**. Результаты и оставшиеся действия фиксируются в инструкции.

Повторная проверка 12 ноября в новой сессии подтвердила административный
доступ подключённого GitHub к пустому целевому репозиторию. Ограничения
исполнительной среды сохранились: `git add --dry-run` не может создать
`.git/index.lock`, SSH запрещён до соединения, DNS и локальный loopback
недоступны; Docker daemon не работает, `gh` не установлен. Lint, TypeScript,
135 отдельных repository/architecture/release/delivery/deployment тестов и обе
production сборки повторно прошли. Полный Rstest останавливается до запуска
тестов на `listen EPERM ::1:3000`. Коммит, push, настройка secrets и реальный
deployment по-прежнему не выполнены; разрешение владельца на них уже получено.

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

Development режим отключает worker/cache. Для offline PWA нужны production
build и HTTPS; порядок приведен в [runbook](docs/operations/PHONE-AND-RELEASE-RUNBOOK.md).

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm run verify:web
```

`verify:web` проверяет web: lint, границы слоев, обе TypeScript конфигурации,
unit, build, delivery и browser/PWA. Полный `verify` дополнительно выполняет
backend test и полную web mutation matrix. Для backend нужны JDK 17 и Docker
для Testcontainers PostgreSQL 18.4:

```sh
cd apps/catalog-control-plane
./gradlew --no-daemon test pitest
```

[CI](.github/workflows/verify.yml) повторяет web и backend проверки в независимых
jobs. Публикация `main` вызывает этот workflow и Telegram проверки как
переиспользуемые workflows; PR и `codex/**` проверяются без публикации.
Полные web mutation и Kotlin PIT выполняются при ручном запуске Verify
InteriorsEditor; обычные push/PR сохраняют regression и delivery проверки.
Workflow начнет выполняться после загрузки репозитория на GitHub;
файл не является успешным CI-прогоном.

Git пока не содержит коммитов. Разрешение владельца от 12 ноября охватывает
первый коммит и push в указанный выше репозиторий.
Один владелец редактирует один срез; действуют TDD и [AGENTS.md](AGENTS.md).
Архивный POC и spike-код не переносятся в приложение.

Отчет о доработках 24 октября: [DELIVERY-2026-10-24](docs/progress/DELIVERY-2026-10-24.md), с текущим телефонным запуском и проверенным остатком roadmap.

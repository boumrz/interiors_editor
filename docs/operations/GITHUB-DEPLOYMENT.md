# GitHub Actions и публикация Telegram Mini App

Push в `main` запускает `.github/workflows/deploy.yml`. GitHub Actions
проверяет Telegram Mini App, собирает его с точным поворотом и публикует
на `https://domiknote.ru/`. Артефакт содержит только TMA и inventory с SHA-256,
размерами файлов и полным SHA исходного коммита. При активации сервер
сохраняет байты уже опубликованного Web/PWA на `https://www.domiknote.ru/`,
текущую публикацию каталога и действующий backend.

Каждый выпуск проверяет ввод дробного угла и его сохранение при восстановлении
резервной копии. Проверки перед публикацией также охватывают подписанный запуск
и доставку модулей для уже открытого клиента. Полный набор сценариев интерфейса
остаётся в отдельном workflow `.github/workflows/telegram-quality.yml`.
Production-сборка использует `INTERIORS_EXACT_FLOOR_YAW=1`
по AD-35. Она выполняется на GitHub runner с закреплёнными Node `24.19.0`
и pnpm `11.20.0`. Переменные `INTERIORS_TELEGRAM_BOT_ID`,
`INTERIORS_TELEGRAM_ENVIRONMENT`, `INTERIORS_TELEGRAM_LINK` и
`INTERIORS_WEB_URL` задают публичную конфигурацию. Для проверки Telegram
подписей используется публичный Ed25519 ключ.

## Настройка и обновление receiver

Для первоначальной настройки нужны доверенный административный SSH ключ,
запись сервера в `known_hosts` и авторизованный GitHub CLI `gh`.
Из корня проекта выполнить `python3 scripts/deploy/configure_github.py`.
Команда устанавливает receiver и передаёт отдельный restricted key и доверенный
host key через stdin в секреты environment `production`.

| Environment secret | Назначение |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | Ключ для restricted receiver |
| `DEPLOY_SSH_KNOWN_HOSTS` | Доверенная запись сервера |

Для обновления кода на уже настроенном сервере достаточно команды
`python3 scripts/deploy/configure_github.py --install-receiver-only`.
Она переключает ссылку receiver на проверенную версию модулей. Ключи SSH
и секреты GitHub остаются прежними. Первый bootstrap создаёт новую пару
ключей. Ротацию и отзыв прежних ключей выполняют отдельно.

На основном сервере `147.45.133.75` команда forced key указывает на
`/usr/bin/python3 /opt/interiors-editor/deploy/receiver.py`. Она принимает
только `deploy-telegram <commitSHA40> <archiveSHA256> <byteLength>` с
Telegram-архивом в stdin. Архив имеет ограничение по размеру. Receiver
проверяет длину, SHA-256 и commit перед активацией. В каталоге
`/opt/interiors-editor/deploy/` коду receiver и staging доступны только
доверенные административные операции. Ключ Actions права обновлять receiver
не получает.

## Публикация и проверка

1. Workflow собирает архив командой `frontend.py package-telegram` и
   проверяет текущий `main` перед отправкой. Production environment и общий
   concurrency group ограничивают серверную публикацию.
2. Receiver проверяет Telegram-архив и активный Web/PWA под общим lock
   публикации. Telegram получает новые ресурсы. Старые immutable URL
   продолжают работать, включая URL клиентов со старым shell.
3. Указатель `/opt/interiors-editor/frontend/current` атомарно меняется
   после проверки доступности новых Telegram-ресурсов. Telegram smoke
   проверяет HTTPS, байты и заголовки в текущем выпуске. При ошибке серверной
   проверки восстанавливается предыдущий указатель.
4. Workflow сверяет receipt с исходным коммитом и повторяет TMA smoke
   через публичный HTTPS. Проверять итоговый запуск в
   [GitHub Actions](https://github.com/boumrz/interiors_editor/actions/workflows/deploy.yml),
   серверный receipt в `/opt/interiors-editor/frontend/last-deployment.json`.

Архив и receipt можно повторно проверить командой
`python3 scripts/deploy/frontend.py smoke-telegram --archive /tmp/telegram.tar.gz --receipt /tmp/deployment-receipt.json`.

Если публикация прошла, а внешний smoke завершился ошибкой, сверить
`current`, receipt и публичный manifest перед повторным запуском. При
необходимости возврата оператор восстанавливает проверенный предыдущий
`current` из receipt под lock публикации. Nginx allowlist сохранённых
Telegram-ресурсов оставляют на месте для клиентов с уже загруженным shell.
Ручная поставка полного выпуска использует отдельный административный путь
через `project_release.py`.

## История подготовки полного выпуска

Сведения ниже относятся к исходной поставке ноября 2026 года. Тогда GitHub
Actions публиковал полный выпуск Web/PWA, Telegram и каталога. Действующий
путь автоматической публикации описан выше.

## Результат локальной подготовки 12 ноября 2026

| Проверка | Результат |
| --- | --- |
| Состав Git, секреты и размер | PASS: около 115 МиБ вместо 33 ГБ; исходные архивы сохранены локально |
| Repository guard | 10/10 PASS |
| Architecture boundaries | 15/15 PASS и проверка production graph PASS |
| TypeScript web/domain/Telegram | PASS |
| Lint | PASS, 34 информационных замечания без исправлений |
| Telegram release/target/audit contracts | 44/44 PASS |
| Exact catalog package, SDK и recovery scopes | 27/27 PASS |
| Deployment/receiver/bootstrap/catalog-boundary | 29/29 PASS, синтетические тесты без настоящего SSH |
| Web и configured Telegram production build | Обе PASS в отдельных `/tmp` output; существующий `apps/web/dist` сохранён |
| Упаковка двух настоящих build output | PASS, 110 файлов, архив около 124 МиБ; commit из нулей используется только в локальной репетиции |
| YAML и Python syntax | PASS; пять action SHAs проверены по официальным GitHub repositories |
| Полный Rstest | Не выполнен: runner остановился на `listen EPERM ::1:3000` |
| Browser/PWA/Telegram native и mutation suites | Не выполнены в этой сессии: loopback запрещён; обязательные CI regression gates сохранены |
| Kotlin/PostgreSQL | Не выполнены: Docker daemon недоступен, загрузка Gradle блокируется DNS/network restriction |
| Remote/commit/push | Не выполнены: `.git/config` read-only, `Operation not permitted` |
| Receiver/environment secrets/Actions/live deploy | Не выполнены: SSH блокируется до соединения; `gh` отсутствует |

Указанные PASS не заменяют полный regression, соответствие live backend
локальному baseline или физическую Telegram приёмку. Работающий сервер и
репозиторий GitHub этой подготовкой не изменялись.

## Повторная проверка в новой сессии 12 ноября 2026

Подключённый GitHub вернул для `boumrz/interiors_editor` права
`admin`, `maintain`, `push`, `pull` и `triage`; репозиторий публичный,
пустой (`size: 0`, список branches пуст, запусков Actions — 0), default branch
— `main`. Таким образом, права аккаунта
подтверждены, но ограничения терминала текущей задачи сохранились.
Нового согласования владельца на commit/push/deployment не требуется.

| Повторная проверка | Наблюдаемый результат |
| --- | --- |
| Repository guard и состав файлов | 10/10 PASS; 2549 файлов, 115,0 МиБ до обновления этой записи; секреты и запрещённые файлы не обнаружены |
| Architecture boundaries и production graph | 15/15 PASS; graph PASS |
| Deployment/receiver/bootstrap/catalog boundary | 29/29 PASS; локальный catalog baseline совпадает, live equivalence остаётся неподтверждённой |
| Telegram release/target/audit contracts | 44/44 PASS |
| Catalog packaging, recovery scopes, SDK и SDK build contracts | 37/37 PASS |
| Lint и TypeScript web/domain/Telegram | PASS; lint сохраняет 34 информационных замечания |
| Production Web/PWA и configured Telegram | Обе PASS в отдельном `/tmp/interiors-github-recheck-20261112`; существующие workspace build outputs сохранены |
| Упаковка и обратная проверка новых сборок | PASS: 110 файлов, архив 129571368 байт; распаковка сверила inventory и SHA-256; commit из нулей — только локальная репетиция, не Git commit или deployment |
| Полный Rstest | Runner остановился до выполнения тестов: `listen EPERM: operation not permitted ::1:3000` |
| Локальный HTTP/браузерные/native/mutation прогоны | Loopback bind подтверждённо запрещён (`PermissionError: Operation not permitted`); успешными не считаются |
| Git mutation | Даже `git add --dry-run -- .gitignore` не может создать `.git/index.lock`: `Operation not permitted`; коммитов и remote по-прежнему нет |
| SSH к основному NL VPS | Существующий admin key найден; подключение к `147.45.133.75:22` отклонено средой с `Operation not permitted` до authentication |
| GitHub и публичный сайт из терминала | `git ls-remote` и HTTPS запрос остановились на `Could not resolve host`; это не свидетельство отказа внешних сервисов |
| Backend prerequisites | JDK 17 есть; Docker daemon недоступен, поэтому PostgreSQL/Testcontainers regression не подтверждён |
| GitHub CLI | `gh` отсутствует; подключение GitHub не предоставляет команды управления environment secrets |
| Commit/push, receiver/secrets, Actions, live deployment | Не выполнены; сервер и GitHub не изменялись |

Всего повторно прошли 135 отдельных тестов указанных пяти групп. Использованы
уже установленные Node `24.19.0` и pnpm `11.20.0` без замены закреплённого
runtime или lockfile. Команды запускаются через `pnpm --filter @interiors/web`
и `pnpm exec`, чтобы не зависеть от повторной сетевой проверки `npx`.

Для завершения нужна исполнительная среда с записью в Git metadata,
исходящими SSH/HTTPS/DNS и loopback, работающий Docker и авторизованный `gh`.
Далее остаются полный regression, проверка фактического backend на VPS,
установка restricted receiver/secrets, commit/push и подтверждённый Actions
run с receipt и публичным smoke. На 12 ноября полный backend rollout ещё
оставался незавершённым. 14 ноября Git push, доверенный SSH и запуск полного выпуска были подтверждены.

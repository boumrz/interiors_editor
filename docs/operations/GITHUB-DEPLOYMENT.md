# GitHub Actions и публикация проекта

Push в `main` запускает `.github/workflows/deploy.yml`: проверки репозитория,
Web/PWA, Telegram и Kotlin/PostgreSQL, затем публикацию полного выпуска на
основной NL VPS. Telegram обслуживается на `https://domiknote.ru/`, Web/PWA —
на `https://www.domiknote.ru/`. Оба frontend и Kotlin distribution берутся
из одного проверенного source commit. Сборки выполняются на GitHub runners.

`project_release.py` координирует замену Kotlin runtime и обоих frontend.
`catalog_activate.py` сверяет systemd unit, фактический JVM classpath,
непривилегированного пользователя и runtime-only credentials. Перед рестартом
`catalog_package.py` сравнивает migrations и seed/resources с установленным
distribution. Изменения кода backend публикуются автоматически; изменение
схемы БД или seed-публикации останавливает выпуск до отдельно подготовленного
обновления данных. CI не запускает `migrate`/`publish` с привилегированными
credentials. Legacy `catalog_boundary.py` не является gate текущего workflow.

PostgreSQL, текущая публикация каталога и пользовательские данные сохраняются.
Пользовательские проекты и backup остаются на устройстве. Старые immutable
frontend URL не удаляются. При серверном сбое возвращаются прежние frontend
и Kotlin runtime. Ошибка дополнительной внешней проверки на GitHub отмечает
job как failed и требует проверки оператора, даже если серверная активация
прошла успешно.

Владельцем разрешены подготовка GitHub, коммит, push и deployment существующего
продукта 12 ноября 2026 года. Это разрешение инфраструктурного среза не
объявляет Telegram Epic 10 `READY`, не закрывает физическую приёмку или внешний
файловый roundtrip и не включает новый browser registered-transfer ingress.

14 ноября 2026 года подтверждены Git push и SSH к основному VPS, оба HTTPS
origin, действующий TLS/Certbot timer и фактическая конфигурация каталога.
Restricted receiver установлен; environment `production` содержит
`DEPLOY_SSH_PRIVATE_KEY` и `DEPLOY_SSH_KNOWN_HOSTS`. Первый push запустил
реальный Actions run. Актуальный результат публикации проверять в
[Actions](https://github.com/boumrz/interiors_editor/actions/workflows/deploy.yml)
и `/opt/interiors-editor/frontend/last-deployment.json`; успешный push сам по
себе не означает успешный deployment. Таблицы 12 ноября ниже — история
подготовки, их ограничения среды не описывают текущий доступ.

## Первый запуск

Нужны среда с записью в `.git`, доступом к GitHub/SSH и локальным loopback,
Docker и Java 17 для backend проверок. Для настройки секретов дополнительно
нужен установленный и авторизованный GitHub CLI `gh` с доступом к
`boumrz/interiors_editor`. В подготовительной сессии `gh` отсутствовал.

После проверки Python скриптов и актуальной серверной основы запустить из
корня проекта:

```sh
python3 scripts/deploy/configure_github.py
```

Команда использует существующий доверенный admin SSH ключ только локально,
создаёт временный отдельный deploy key, устанавливает fixed receiver/generator
на сервер, проверяет отказ произвольной shell-команды и передаёт через stdin
два секрета в GitHub environment `production`:

| Environment secret | Назначение |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | Новый ключ только для restricted receiver |
| `DEPLOY_SSH_KNOWN_HOSTS` | Уже доверенная запись сервера из локального known_hosts |

Значения секретов не печатаются и не записываются в репозиторий. Существующий
admin key в GitHub не передаётся. Повторный setup создаёт новый restricted key;
старые такие ключи автоматически не удаляются. После успешной ротации их нужно
сверить и отозвать в отдельной административной сессии.

Для уже настроенного репозитория после проверок достаточно commit и push в
`main`; повторный bootstrap и ротация ключа для каждого push не нужны.
Первичная настройка Git при отсутствии remote/commit:

```sh
node scripts/check-repository.mjs
git remote add origin https://github.com/boumrz/interiors_editor.git
git add --all
node scripts/check-repository.mjs --staged
git commit -m "Prepare InteriorsEditor CI and retained frontend deployment"
git push -u origin main
```

`remote add` нужен только при отсутствии `origin`. Push `main` запускает
`Deploy InteriorsEditor`: repository/deployment проверки, переиспользуемые
Web+Kotlin и Telegram workflows, затем публикацию. Все три ветви проверок
обязательны; PR и `codex/**` публиковать ничего не могут. Устаревший относительно
текущего `main` commit отклоняется до SSH. Одновременные публикации запрещены.

В GitHub Actions дождаться итогового успешного статуса и production deployment.
В нём отдельно проверяются HTTPS с сервера и с GitHub runner. Успешный push
сам по себе не подтверждает ни CI, ни доступность приложения.

## Серверная основа

Основной сервер — NL `147.45.133.75`. Перед настройкой сверить через доверенную
административную сессию, что актуальная конфигурация соответствует следующим
путям и контрактам:

| Назначение | Существующий путь или служба |
| --- | --- |
| Frontend | `/opt/interiors-editor/frontend` |
| Активный выпуск | `current -> releases/<webBuildId>--<telegramBuildId>` |
| Старые ресурсы | `retained/web`, `retained/telegram` |
| Nginx site | `/etc/nginx/sites-available/interiors-editor.conf` |
| Проверка canonical URL | `/etc/nginx/conf.d/interiors-frontend-path-map.conf`, переменная `$invalid_frontend_path` |
| Read-only catalog proxy | `/etc/nginx/snippets/interiors-catalog-readonly.conf` |
| Сертификаты | `/etc/letsencrypt/live/interiors-domiknote/` |
| ACME webroot | `/var/lib/letsencrypt` |
| Каталог | `interiors-catalog`, loopback `127.0.0.1:4174` |
| PostgreSQL | существующий Docker 18.4, loopback `127.0.0.1:55432` |

Нужны Python 3.9+, Nginx, systemd, действительный TLS и возможность HTTPS
запросов с самого сервера к обоим доменам. Скрипт генерирует принятую
конфигурацию именно этих доменов, сертификата и ACME пути; при изменении
топологии сначала обновить и проверить генератор. Старый one-shot migration
bootstrap на работающем сервере повторно не запускать.

Receiver не принимает команды оболочки и не обновляет собственные файлы из
приходящего архива. В доверенной административной сессии установить проверенные
копии `scripts/deploy/frontend.py` и `scripts/deploy/receiver.py` в
`/opt/interiors-editor/deploy/` с владельцем root и без права записи другим
пользователям. Каталог incoming должен быть доступен только root.

Для CI создать отдельную Ed25519 пару вне репозитория. Публичный ключ добавить
в root `authorized_keys` с ограничениями:

```text
restrict,command="/usr/bin/python3 /opt/interiors-editor/deploy/receiver.py" ssh-ed25519 <PUBLIC_KEY> interiors-editor-github-deploy
```

Этот ключ может отправлять только ограниченный протокол
`deploy <commitSHA40> <archiveSHA256> <byteLength>`. SSH forwarding, PTY, SFTP,
произвольные команды и изменение receiver им не разрешаются. Admin SSH ключ
не переносить в GitHub. Проверенный fingerprint и known_hosts взять из
доверенной сессии; результаты непроверенного `ssh-keyscan` не являются
подтверждением личности сервера.

## Воспроизводимая подготовка артефакта

Node `24.19.0` и pnpm `11.20.0` закреплены проектом. Проверки web, Telegram и
backend должны пройти до отправки. Отдельная unit проверка deployment:

```sh
python3 -m unittest discover -s scripts/deploy -p 'test_*.py'
```

Обычную Web/PWA production сборку создавать установленной командой `pnpm run
build`. Telegram собирать в отдельную свежую `apps/web/dist-telegram`:

```sh
pnpm --filter @interiors/web exec rspack build --mode production --config rspack.telegram.config.mjs
```

Публичная Telegram конфигурация поступает только из этих переменных:

| Переменная | Значение |
| --- | --- |
| `INTERIORS_TELEGRAM_BOT_ID` | decimal ID действующего бота, без token |
| `INTERIORS_TELEGRAM_ENVIRONMENT` | `production` |
| `INTERIORS_TELEGRAM_LINK` | действующий `https://t.me/...` URL |
| `INTERIORS_WEB_URL` | `https://www.domiknote.ru/` |

Production-сборка Telegram также использует `INTERIORS_EXACT_FLOOR_YAW=1`
по AD-35. Этот параметр активирует точное вращение и запись точных углов.

Не использовать Telegram bot token: клиент проверяет подписи по официальному
публичному Ed25519 ключу. Перед новой сборкой очищать только созданный CI
output; не трогать пользовательский preview и его retained chunks.

Упаковка выполняется из корня репозитория после сборки:

```sh
python3 scripts/deploy/frontend.py package --web apps/web/dist --telegram apps/web/dist-telegram --output /tmp/frontend.tar.gz --commit <FULL_GIT_COMMIT_SHA>
```

Архив содержит только два output и `inventory.json` с точными SHA-256,
размерами и source commit. Упаковщик отклоняет links/special files, отсутствие
PWA worker/manifest, появление их в Telegram и расхождение sealed Telegram
inventory. Отдельный SSH receiver проверяет длину, SHA-256 всего архива и
соответствие source commit. В архив не добавляются исходный workspace,
`.env`, приватные ключи, дампы, пользовательские Project/Backup/GLB или
настоящие signed Telegram launch данные.

Kotlin distribution собирается `./gradlew --no-daemon
--dependency-verification=strict installDist` и упаковывается
`scripts/deploy/catalog_package.py` с тем же commit. SSH receiver принимает
ограниченный USTAR с ровно `frontend.tar.gz` и `catalog.tar.gz`; исходники,
серверные env и пользовательские файлы в него не входят.

## Публикация и восстановление

Внешний project lock охватывает всю активацию. Сначала проверяется текущий
catalog unit/JVM и совпадение data contract, сохраняется digest публикации,
затем при необходимости переключается Kotlin distribution через systemd
drop-in. После рестарта обязательны прежний digest, готовность сервиса и
проверка фактического нового JVM. Публикация frontend выполняется внутри
этого rollback context; при её ошибке возвращается также предыдущий backend.

1. `flock` последовательно допускает одного publisher. Архив проверяется в
   закрытом staging; tar traversal, hardlinks/symlinks, duplicates,
   незаявленные файлы и неверные hashes/размеры отклоняются до переключения.
2. Новый полный выпуск помещается в `releases`. Изменённые bytes по старому
   immutable URL вызывают отказ. Старые ресурсы никогда не удаляются.
3. Nginx получает union точных старых и новых static URL. `nginx -t` и reload
   выполняются до публикации нового HTML; неизвестные JS/API/manifest пути
   продолжают отдавать 404. Каталог сохраняет прежний read-only snippet.
   После reload до switch обязательный HEAD-probe всех новых immutable URL
   на обоих доменах сверяет размер, MIME и cache headers с общим deadline
   60 секунд. Это проверка доступности URLs, а не доказательство завершения
   работы каждого старого Nginx worker.
4. Одним `os.replace` меняется `current`, поэтому HTML, release manifest,
   PWA worker и PWA manifest выбираются из одного полного выпуска.
5. HTTPS smoke сверяет каждый файл и его SHA/длину, GET/HEAD, cache/security
   headers, root, range, неизвестные пути, отказ POST, исходный digest и ETag
   каталога на обоих origin и отсутствие
   PWA worker/manifest на Telegram origin. Общий smoke budget — 180 секунд.
6. При неудаче health-check возвращается прежний `current`. Union static URL
   сохраняется: уже загруженный новый shell продолжает получать lazy chunks.
   При ошибке Nginx до switch восстанавливается прежний конфиг. SIGTERM/SIGINT
   прерывают работу через тот же rollback; аварийное выключение/kill -9
   требует операторской проверки состояния.

Успешный receipt записывается в
`/opt/interiors-editor/frontend/last-deployment.json`; он содержит commit,
release, предыдущий указатель и catalog receipt без credentials. GitHub runner
сохраняет SSH stdout как `deployment-receipt.json`, сверяет его commit/release
с архивом и повторяет публичный smoke с catalog digest. Для независимой проверки
того же сохранённого артефакта:

```sh
python3 scripts/deploy/frontend.py smoke --archive /tmp/frontend.tar.gz --receipt /tmp/deployment-receipt.json
```

Для ручного возврата выбрать предыдущий проверенный архив и его полный commit
SHA и отправить тем же restricted протоколом. Не удалять новый выпуск или
retained файлы после возврата. Если требуется восстановление до первого CI
выпуска, оператор может атомарно вернуть предыдущий указатель из receipt,
сохранив union Nginx allowlist, затем выполнить `nginx -t`, reload и проверку
обоих доменов. Пользовательские проекты остаются в прежних browser origins.

Обновление Python receiver/generator производится отдельно доверенным
администратором после review и проверок. GitHub Actions ключ не получает права
самостоятельно заменять привилегированный deployment код.

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
оставался незавершённым. Текущая схема полной поставки и подтверждённый
14 ноября доступ описаны в начале документа.

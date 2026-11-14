# Каталог: воспроизводимая проверка

Этот Kotlin/Ktor сервис публикует только каталог и точные ресурсы. Он не хранит
пользовательские проекты, ревизии или резервные копии.

## Проверка backend

Нужны JDK 17 и работающий Docker. Используйте включённый Gradle Wrapper; версия
Gradle, dependency locks и SHA-256 verification metadata закреплены в проекте.

На macOS с установленной Colima сначала запустите её:

```sh
colima start
docker info
```

Из этого каталога выполните:

```sh
./gradlew --no-daemon test --rerun-tasks
```

`jvmToolchain(17)` выбирает Java для компиляции. Если в системе несколько JDK,
на macOS можно явно выбрать установленную Java 17:

```sh
JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew --no-daemon test --rerun-tasks
```

Семь интеграционных тестов сами поднимают изолированные контейнеры
`postgres:18.4` и удаляют их после теста. Чужая локальная PostgreSQL для них не
используется. Docker обязателен: эти проверки не заменяются автоматическим
`skip`. Отчёт — `build/reports/tests/test/index.html`, машинные результаты —
`build/test-results/test/TEST-*.xml`.

Нехватка checksum в `gradle/verification-metadata.xml` останавливает сборку.
Проверяйте точные байты артефакта по Maven Central и его опубликованной
контрольной сумме до добавления checksum; не выключайте dependency verification.

## Локальная PWA и каталог для демонстрации

Из `apps/web`:

Web-команды ниже требуют закреплённых Node `24.19.0` и pnpm `11.20.0`.
Версионный launcher приведён в корневом `README.md`.

```sh
pnpm run build
node scripts/serve-pwa-e2e.mjs
```

Предпросмотр слушает `127.0.0.1:4175`. Другой порт можно задать переменной
`INTERIORS_PWA_SERVER_PORT`. По умолчанию сервер использует неизменяемую fixture
публикацию из `src/main/resources/catalog`, а её GLB/PNG берёт из web-сборки.
Чистая сборка включает все 20 ресурсов: восемь моделей мебели с миниатюрами и
четыре демонстрационные модели остальных разделов. Это режим демонстрации,
проверяющий web-клиент и PWA; он не доказывает работу Kotlin/PostgreSQL.

Чтобы использовать уже подготовленный работающий Kotlin backend вместо
fixture, задайте его loopback origin:

```sh
INTERIORS_PWA_CATALOG_ORIGIN=http://127.0.0.1:4174 node scripts/serve-pwa-e2e.mjs
```

HTTP-проверки preview и проверка упаковки запускаются из `apps/web`:

```sh
node --test scripts/pwa-preview-server.test.mjs scripts/catalog-package.test.mjs
```

Проверка упаковки собирает production bundle в отдельный временный каталог,
проверяет размер и SHA-256 каждого опубликованного ресурса и удаляет временные
файлы. Запущенный пользователем preview не останавливается. HTTP-проверки
используют собственные loopback-порты и проверяют в том числе запрос первого
MiB для маленького GLB, обрезку диапазона по EOF, `HEAD`, неверные диапазоны и
запрещённые методы.

Для mutation-проверки HTTP-границ после окончания параллельных правок:

```sh
pnpm exec stryker run stryker.preview-server.config.mjs
```

Она временно инструментирует только preview-server; отчёт сохраняется в
`apps/web/reports/mutation/preview-server-mutation.json`.

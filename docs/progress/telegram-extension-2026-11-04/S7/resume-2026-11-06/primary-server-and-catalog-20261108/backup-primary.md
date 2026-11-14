# Проверенная резервная копия основного NL-сервера

**Статус: VERIFIED_ENCRYPTED_BACKUP.** Копия создана 2026-11-08T17:49:35.084427+00:00, без остановки Nginx, приложения или PostgreSQL. Это backup основного сервера147.45.133.75; он не заменяет отдельный backup данных, оставшихся только на российском VPS.

| Что | Результат |
|---|---|
| Архив | `/Users/romanzheltov/Backups/InteriorsEditor/2026-11-08-primary/primary-147.45.133.75-20261108T174533Z-ca9ffc62.tar.gz.cms` |
| Размер | 385,812,256 B / 367.94МиБ |
| SHA-256 зашифрованного архива | `c90ac8beee7133532a6ca89b0802739582a247b9b25f407abe04b13dae717b5c` |
| Шифрование | OpenSSL CMS AES-256-GCM; RSA-OAEP SHA-256 |
| Проверка криптографической целостности | Успешное потоковое расшифрование до EOF и проверка GCM authentication |
| Сверенный инвентарь | 484 записи, все размеры/SHA/права/UID/GID |
| Hardlink / symlink | 188 hardlink, 6 symlink с точными targets |
| PostgreSQL dump | 72,614,522 B; custom format, pg_restore --list успешен |
| Совпадение dump после расшифрования | Тот же SHA-256, что у проверенного pg_restore исходного dump |
| Полное восстановление базы | Не выполнялось; рабочая база не затрагивалась |
| Plaintext backup на Mac | Не записывался |
| Временный plaintext на сервере | Собственная закрытая staging-папка удалена после успешной проверки |

## Что сохранено

- Весь frontend: текущие/сохранённые Web и Telegram релизы, hardlink-пулы и current symlink.
- Backend jars, зависимости и catalog-assets.
- Согласованный pg_dump-Fc базы interiors_catalog и pg_dumpall--globals-only с ролями/их password hashes. Копирование работающего PostgreSQL volume не выполнялось.
- `/etc/interiors-editor` с env, `/etc/nginx`, `/etc/letsencrypt` с сертификатами, приватными ключами и правилами renewal; systemd unit каталога.
- Решение о primary-сервере `/opt/interiors-editor/operations/primary-server.json`.
- Закреплённый образ PostgreSQL `mirror.gcr.io/library/postgres@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636` через docker image save, 168,407,040 B.
- Метаданные версий пакетов/ядра/образа/службы, runtime system account, catalog before/after, проверенный TOC dump и полный файловый SHA-манифест.

Установочные incoming-архивы не дублировались. Это копия application stack, не полный образ виртуального диска/ОС: для восстановления ОС/Java/Nginx/Docker нужны совместимые пакеты; их версии записаны, а Docker-образ PostgreSQL включён. Пользовательских проектов и их portable backup на этом сервере нет, они не выгружались.

## Ключ восстановления

Приватный ключ: `/Users/romanzheltov/Backups/InteriorsEditor/2026-11-08-primary/keys/restore-key.pem`. Сертификат получателя: `/Users/romanzheltov/Backups/InteriorsEditor/2026-11-08-primary/keys/recipient.pem`. Ключ не включён в архив и не записан в репозиторий; файл имеет0600, приватная папка backup0700, архив0600.

Архив и ключ — разные файлы, но пока на одном Mac: при потере этого Mac можно потерять одновременно локальный backup и средство его расшифрования. Рабочий основной сервер при этом остаётся отдельной копией данных. Дополнительная защищённая копия комплекта на другом носителе — полезная необязательная рекомендация, не условие текущей подготовки удаления российского VPS. Потеря приватного ключа делает этот зашифрованный архив невосстановимым. Ключ и расшифрованные env/SQL не публиковать и не отправлять в чат.

## Безопасный порядок восстановления

1. Работать на отдельной тестовой/восстановительной машине без активного InteriorsEditor. Сначала сверить SHA-256 зашифрованного файла с таблицей. Не восстанавливать поверх рабочего root filesystem или действующего Docker volume.
2. Создать закрытый каталог0700 на защищённом носителе. Расшифровать стандартным OpenSSL3, проверив его exit code; при ненулевом exit code не использовать частичный plaintext:

   ```sh
   umask 077
   /opt/homebrew/bin/openssl cms -decrypt -binary -inform DER \
     -in '/path/to/primary-backup.tar.gz.cms' \
     -recip '/path/to/recipient.pem' \
     -inkey '/path/to/restore-key.pem' \
     -out '/secure/nonlive/restore/snapshot.tar.gz'
   ```

   Путь OpenSSL приведён для текущего Mac; на восстановительной Linux-машине использовать её установленный OpenSSL3. Все пути в примере заменить на проверенные.
3. Сначала просмотреть список tar members и `backup-manifest.json`, сверить его SHA `68d878f24151b39a05dabd5875d30d2ffb8559d712ee7c56fb0d8c7dc7ce6cd3`, затем SHA/размеры файлов и targets ссылок. Извлекать в отдельный recovery tree, не слепо `tar -x -C /`. Не следовать абсолютным symlink к действующей `/etc`: преобразовать ожидаемые внутриснимковые ссылки в относительные или воссоздать их уже на изолированной машине. Внешние package-owned ссылки требуют установки соответствующих пакетов.
4. По metadata установить совместимые Java17, Docker, Nginx и Certbot, создать отдельный system user interiors-catalog. Восстановить и проверить Certbot timer, webroot и deploy hook для продления TLS. Загрузить сохранённый PostgreSQL image в Docker и проверить image identity. Сохранённый образ предназначен для linux/amd64: нужна совместимая машина либо отдельно проверенная эмуляция на другой архитектуре. Для first restore использовать свежий отдельный volume. На пустой изолированной машине можно оставить loopback127.0.0.1:55432, как в сохранённых env; при выборе другого порта согласованно обновить JDBC URL во всех трёх файлах runtime.env, migration.env и publish.env. Не использовать порт или volume действующей БД.
5. Инициализировать PostgreSQL с временным bootstrap admin, имя которого отличается от ролей dump. Восстановить globals/roles, затем базу через PostgreSQL18 pg_restore (`--create` в отдельный cluster). Сохранённые env и роли должны соответствовать друг другу; не смешивать произвольно старые password hashes и новые env. Первый запуск backend получает только runtime.env, не migration/publish credentials.
6. Восстановить выбранные release paths, точные owners/modes, current link и проверенные Nginx/TLS/systemd файлы на этой изолированной машине. Проверить nginx -t и авторитеты БД; затем catalog envelope SHA `f25189ad2126866c6f44e851a4bfa458d4501a3e25f8b28e9c43c1e2b958648a`, все resource hashes/GET/HEAD/Range и оба frontend origin. Проверить TLS renewal/webroot на конечном домене после планового DNS-переключения.
7. Только после проверки восстановления планировать переключение production. Нынешняя проверка подтверждает целостность и TOC dump, не заявляет успешный полный recovery rehearsal.

Подробные технические результаты находятся в backup-primary.json и приватном receipt рядом с архивом. После backup публичный frontend и catalog envelope снова совпали с ожидаемыми SHA, службы остались активны, моя remote staging-папка отсутствует.

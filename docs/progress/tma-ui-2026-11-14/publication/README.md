# Публикация TMA, 14.11.2026

По отдельному прямому запросу владельца опубликована проверенная рабочая версия
без создания коммита. Публикация завершена **14.11.2026 в 23:42 МСК**.

- Запуск: [InteriorsEditor в Telegram](https://t.me/InteriorsEditorBot?startapp).
- Адрес приложения: https://domiknote.ru/.
- Новый TMA build: `03e10870d9d143a5`; предыдущий: `2a3669563b7b3de9`.
- Парная версия: `8baf6f31bbac1a44--03e10870d9d143a5`.
- Существующий Web/PWA build `8baf6f31bbac1a44` и все его 56 файлов сохранены
  без изменений. Публичный каталог также сохранён: SHA-256
  `f25189ad2126866c6f44e851a4bfa458d4501a3e25f8b28e9c43c1e2b958648a`.
- Переданы 11 новых файлов / 629962 байта; 43 неизменных ресурса TMA взяты
  из проверенного retained pool. Старые immutable ресурсы обеих версий сохранены.
- Публичные bot/environment/origin значения не менялись. Пользовательские
  проекты, файлы и резервные копии не передавались на сервер.

## Проверка

Перед активацией проверены 36 хешей исходников из предыдущего локального
прогона, sealed inventory всех 54 файлов TMA, состав и SHA архива, точное
совпадение исходного Nginx и отсутствие immutable URL collisions.
Независимое read-only ревью подтвердило только восемь добавленных Telegram
asset locations в конфигурации; Web/TLS/catalog/path map сохранены.

На сервере сначала опубликованы новые immutable URL, затем атомарно переключён
`current`. Nginx syntax/reload и все **246** проверок GET/HEAD/bytes/MIME/cache/
range/catalog прошли. Проверены неизменность старых retained ресурсов и Web.
После активации с Mac прошли ещё **18** внешних HTTPS проверок точных файлов,
обоих каталоговых маршрутов и предыдущего Telegram entry.

Отдельный чистый браузер получил новый build. Обычный неподписанный запуск
ожидаемо показывает защищённый отказ; IndexedDB databases — 0,
service worker controller отсутствует. Это не физическая Telegram-приёмка.
Проверку обновлённого UI на телефоне выполняет владелец; прежний общий release
verdict этим развёртыванием не заменяется.

## Provenance и откат

Основа дерева: `c5534d67e8dc0888257f3b2171fb0e86f7342a3d`.
Рабочий source snapshot SHA-256:
`11af9efcdfc9e4fd442dcc3c32b58e2dcf04d71b7738f2769ef9957ee7fec872`.
Незакоммиченные изменения явно отмечены в отдельной manual inventory/receipt;
им не присваивался фиктивный CI commit.

Предыдущая версия сохранена:
`releases/8baf6f31bbac1a44--2a3669563b7b3de9`.
При откате возвращается этот `current`, при этом новые immutable URL остаются
доступны для уже загруженных клиентов. DNS, bot settings, backend, TLS и
Web/PWA retirement не менялись.

Raw evidence, не включаемые в Git по правилам проекта:
[receipt](manual-receipt.json), [публичные проверки](public-after.json),
[source/file inventory](manual-inventory.json), [transfer](transfer.json),
[Nginx](nginx-commands.log), [rollback state](rollback-state.json).

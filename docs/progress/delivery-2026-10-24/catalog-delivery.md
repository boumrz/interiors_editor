# Каталог, PWA и публикация изменений — 24 октября 2026

В 14:58 МСК проверен [действующий HTTPS-предпросмотр](https://dry-jeff-mere-settle.trycloudflare.com).
`release-manifest.json` сообщает build `4c03722bebae66f3`; manifest возвращает
`standalone`, `start_url: /` и `scope: /`. Service worker содержит тот же build ID.
Публичный каталог совпадает по SHA-256 с работающим Kotlin backend на
`127.0.0.1:4174`: версия `alpha-2026-08-30.1`, 12 предметов и 20 ресурсов.

Все 20 ресурсов получены через публичный HTTPS-адрес: HTTP 200, правильные
media type, размер, SHA-256, strong ETag и `Accept-Ranges: bytes`.
Проверено 68 699 401 байт. Запрос `Range: bytes=0-1048575` с
`Accept: model/gltf-binary` к настенному GLB вернул HTTP 206,
`Content-Range: bytes 0-971/972` и все 972 точных байта.
Подробности: [network evidence](catalog-public-network.json).

Последний backend-прогон завершился сегодня в 14:20 МСК: **39/39 tests**,
включая **7/7** интеграционных проверок с изолированными PostgreSQL 18.4
контейнерами, без пропусков. Backend-код с тех пор не менялся; при финальном
network audit прогон не повторялся. Сохранены
[фактический лог](catalog-backend-39-green.log),
[сводка](catalog-backend-tests-summary.json) и XML в `catalog-backend-xml/`.
Проверка точного диапазона `parseRange` через PIT: **12 killed / 13 mutants**,
без timeout; один boundary survivor эквивалентен благодаря `start >= length`.
[PIT evidence](catalog-pit-summary.json).

Сегодняшний live browser scenario через web proxy, Kotlin и PostgreSQL прошёл
**1/1**, включая загрузку tiny GLB и подготовку модели кровати. Это Chromium с
телефонным viewport; лог сохранён [отдельно](catalog-live-browser-green.log).
Проверка на физическом телефоне в ходе этого аудита не выполнялась.

Все Stryker-прогоны выполнены в отдельных временных копиях. Оригинальные
production-файлы не инструментировались; SHA оригиналов и восстановленных
копий совпадают.

| Проверяемая часть | Killed | Timeout | Survived |
| --- | ---: | ---: | ---: |
| Preview HTTP | 48 | 0 | 0 |
| Общая публикация изменений | 16 | 0 | 0 |
| GLB transport | 132 | 4 | 21 |
| Постановка GLB на стену | 19 | 0 | 0 |

Полезные survivors закрыты тестами с RED-проверками на воссозданных мутантах.
Оставшиеся 21 GLB survivor имеют
[проверенные доказательства эквивалентности](catalog-glb-mutation-equivalence.json).
Итог GLB — 86,62%; остальные три scope — 100%.
[Общая сводка с SHA и ссылками на полные JSON](catalog-mutation-summary.json).

Исходный preview теперь упаковывает все 20 ресурсов; Range обрезается по EOF
и в fixture, и в Kotlin. GLB-загрузчик передаёт обязательный media type.
Восемь обычных команд используют общий протокол публикации; Rename сохраняет
явный exact-base CAS. Scoped tests: publication **36/36**, controller **90/90**,
GLB transport **20/20**, wall-domain/application **31/31**, preview HTTP **22/22**.
Коммиты не создавались. Private runtime env, пароли и дампы баз в evidence не
копировались.

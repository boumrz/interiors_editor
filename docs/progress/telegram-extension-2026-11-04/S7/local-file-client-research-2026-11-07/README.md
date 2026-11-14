# Локальный экспорт файла в физических клиентах Telegram

Проверено 2026-11-06 UTC через GitHub connector и официальную документацию Telegram. Это исследование исходников и текущего контракта, не приёмка телефона. Код приложения, текущий Factory415 и его замороженные проверки не менялись. Новые способы передачи не предлагаются.

## Подтверждённые ограничения

Официальный `Telegram.WebApp.downloadFile` принимает **HTTPS URL**, а callback подтверждает согласие пользователя на запрос, не сохранность файла. `blob:`/локальный `File` не соответствует этому контракту. `shareMessage` принимает идентификатор сообщения, заранее подготовленного ботом, поэтому также не является локальной выдачей `File`. [Mini Apps: DownloadFileParams, downloadFile и shareMessage](https://core.telegram.org/bots/webapps#downloadfileparams).

Протокол native download требует `bots.checkDownloadFileParams` с URL, именем файла и ID бота, затем подтверждение пользователя и загрузку по URL. Это не подтверждение локального пути без сети. [Официальный web event](https://core.telegram.org/api/web-events#web-app-request-file-download).

## Android

Проверен официальный HEAD `3de37c8cfb039452be7398909461da6288babf15` от 2026-10-25, сообщение версии 13.1.1 (7237). `BotWebViewSheet` создаёт контейнер с `isBot=true` (503). В `BotWebViewContainer.java` вызовы инъекции `webview_share` находятся в ветках `if (!bot)` (4188–4195 и 4392–4399); Mini App получает `webview_app_ext`, в котором нет реализации share. Поэтому наличие работающего File sharing в обычном встроенном браузере нельзя переносить на Mini App. [Mini App constructor](https://github.com/DrKLO/Telegram/blob/3de37c8cfb039452be7398909461da6288babf15/TMessagesProj/src/main/java/org/telegram/ui/bots/BotWebViewSheet.java#L503), [Android client](https://github.com/DrKLO/Telegram/blob/3de37c8cfb039452be7398909461da6288babf15/TMessagesProj/src/main/java/org/telegram/ui/web/BotWebViewContainer.java#L4188), [Mini App script](https://github.com/DrKLO/Telegram/blob/3de37c8cfb039452be7398909461da6288babf15/TMessagesProj/src/main/res/raw/webview_app_ext.js).

Отдельный share polyfill читает только первый файл и передаёт его байты native bridge лишь при размере меньше 3 MiB; native handler создаёт локальный cache-файл и системный ACTION_SEND. Это конкретный локальный путь **для ветки обычного браузера**, а не гарантия Mini App. [Share script](https://github.com/DrKLO/Telegram/blob/3de37c8cfb039452be7398909461da6288babf15/TMessagesProj/src/main/res/raw/webview_share.js), [Native handler](https://github.com/DrKLO/Telegram/blob/3de37c8cfb039452be7398909461da6288babf15/TMessagesProj/src/main/java/org/telegram/ui/web/BotWebViewContainer.java#L3582).

DownloadListener также установлен только для `!bot`; он сразу возвращается для `blob:` (4963–4985). Native Mini App download отдельно вызывает серверную проверку URL (2814–2857). Здесь не найден подтверждённый путь локального blob-download в Mini App. [Android download branches](https://github.com/DrKLO/Telegram/blob/3de37c8cfb039452be7398909461da6288babf15/TMessagesProj/src/main/java/org/telegram/ui/web/BotWebViewContainer.java#L4963).

## iOS

Проверен официальный HEAD `24638bc69bd083981b178dd1e7f921eebbf7fc46` от 2026-11-02. Mini App `WebAppController` реализует WKDownloadDelegate, но явная смена navigation response в `.download` ограничена `.pkpass` (701–705); завершение download обрабатывает добавление такого пропуска (729–752). Это не доказательство выдачи произвольного backup-файла через blob/anchor. В исследованных `WebAppController.swift` и `WebAppWebView.swift` не найден специальный мост `navigator.share(File)`; фактические WebKit capabilities остаются проверкой телефона. [iOS Mini App controller](https://github.com/TelegramMessenger/Telegram-iOS/blob/24638bc69bd083981b178dd1e7f921eebbf7fc46/submodules/WebUI/Sources/WebAppController.swift#L701), [Web view](https://github.com/TelegramMessenger/Telegram-iOS/blob/24638bc69bd083981b178dd1e7f921eebbf7fc46/submodules/WebUI/Sources/WebAppWebView.swift).

Native download вызывает `checkBotDownload` и использует URLSession download task. Это отдельный URL-based путь, не решение для локального File. [Request](https://github.com/TelegramMessenger/Telegram-iOS/blob/24638bc69bd083981b178dd1e7f921eebbf7fc46/submodules/WebUI/Sources/WebAppController.swift#L3048), [FileDownload](https://github.com/TelegramMessenger/Telegram-iOS/blob/24638bc69bd083981b178dd1e7f921eebbf7fc46/submodules/WebUI/Sources/FileDownload.swift).

## Проверка существующего двухшагового экспорта на телефоне

Существующий `host-file-bridge.ts` уже выбирает `navigator.canShare({files:[file]})` + `navigator.share`, иначе пробует локальный blob/anchor download. UI делает подготовку отдельно от нового нажатия «Передать файл» и называет результат попыткой передачи. Это соответствует обнаруженным ограничениям: capability check и успешное системное действие не доказывают внешний roundtrip.

На **каждом** целевом Android/iOS клиенте остаётся пройти существующий сценарий: реальная подготовка → отдельное нажатие → выбранная поддерживаемая локальная системная выдача → наличие и точное содержимое файла вне приложения → выбор этого файла в другом контексте и успешная проверка импорта. Записать версию Telegram/OS, метод share/download, имя/размер/hash, отмену и повтор. Проверить оба направления PWA↔Telegram; storage контекстов не считать общим. Если оба локальных способа фактически недоступны, зафиксировать отказ клиента как незакрытую physical acceptance, без автоматического перехода к upload/server/bot delivery.

Исходники HEAD не гарантируют, что именно эти байты присутствуют в установленной версии Telegram. Ни одна физическая проверка этим исследованием не закрыта. Индекс семи прочитанных файлов исходников и точные SHA256 находятся в `source-index.json`.

# Независимый adversarial review: Telegram S0

Дата: 2026-11-04. Проверяемый артефакт: `ARCHITECTURE-SPINE.md`, AD-25–AD-29. Это снимок на момент review до возможных последующих исправлений основным владельцем.

## Вердикт: CONCERNS, два medium замечания

Отдельный origin, запрет PWA cleanup, конкретный scope, недоверие к SDK object и ограничения локальной Ed25519 identity определены. Ранее обнаруженная high-гонка между проверкой generation и IDB commit закрыта добавленным serialized admission/drain barrier: допущенная операция завершается до нового runtime, а поздняя работа больше не допускается. AD-4 сохраняет межконтекстный fence/journal; не следует требовать project-specific base для scope-wide GC library.

Неопределённость identity после background теперь не скрыта: [официальные events Telegram](https://core.telegram.org/bots/webapps#events-available-for-mini-apps) `activated`/`deactivated` не передают identity, старый `initData` не доказывает текущий аккаунт. AD-26 прямо признаёт, что незаметная смена в живом runtime не выявляется, и требует physical evidence об изоляции host lifecycle до release. Пока такой гарантии или доказательства нет, не заявлять безусловное выполнение account isolation; если контекст неоднозначен, writable bootstrap закрыт. Это открытый release/evidence риск, а не доказанная защита либо разрешение использовать общий fallback.

### Medium 1 — Порядок публикации immutable assets

Реализация A переключает shell/manifest одновременно, но не загрузила новый lazy chunk; реализация B предварительно публикует и проверяет все адресуемые immutable файлы. AD-28 фиксирует атомарное переключение и сохранение старых файлов, но прямо не требует pre-publication closure для нового выпуска. Зафиксировать publish-and-verify полного множества новых immutable файлов до переключения shell/manifest, rollback только на целостный retained набор и проверку lazy 3D после release/rollback.

### Medium 2 — Однозначность подписанных данных

AD-26 отсылает к Telegram алгоритму и запрещает duplicate query keys, но не уточняет, как обрабатываются malformed percent/UTF-8, повтор ключей после decode и дублирующиеся `user.id` внутри JSON. Парсеры могут дать разный ID одному raw входу. Зафиксировать однократную строгую decode и fail-closed при перечисленных формах, определённую интерпретацию целого ID, а также положительные/отрицательные known-answer vectors; ошибочный вход отклонять до DB/GC. Нельзя переходить на `initDataUnsafe`.

## Граница оценки

Review не утверждает, что физические WebView, bot/domain, file roundtrip, readiness или licensing/source conflict закрыты. Локальная подпись не защищает от владельца устройства, чужого скрипта в origin или свежего replay. Никаких изменений Spine reviewer не вносил.

## Повторная проверка после исправлений

**Итог: PASS WITH OPEN EVIDENCE.** Оба medium замечания устранены: AD-26 требует однократное строгое декодирование, отказ на malformed percent/UTF-8, duplicate keys и CR/LF; AD-28 требует предварительно опубликовать и проверить полный комплект immutable файлов и использовать для rollback только целостный набор. Serialized barrier в AD-26 сохраняет порядок teardown и commit/GC. Для будущей реализации нужны positive/negative known-answer vectors и controlled race tests — это проверочные обязательства, а не выполненные тесты.

Остаётся явно ограниченный риск account continuity: документ не утверждает обнаружение незаметной смены аккаунта в живом runtime; physical evidence об изоляции host lifecycle остаётся условием release. Этот review не является новым implementation-ready verdict.

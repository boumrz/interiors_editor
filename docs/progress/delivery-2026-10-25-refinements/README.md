# Проверенная поставка редактора — 25 октября 2026

Сборка **e5ef64fa94bd6154** опубликована по [прежнему HTTPS-адресу](https://stick-reverse-medieval-twelve.trycloudflare.com). [Основной отчёт](../EDITOR-REFINEMENTS-2026-10-25.md) описывает поведение и ограничения; [результаты в JSON](final-results.json) — фактические проверки.

## Итоговые проверки

| Проверка | Результат | Лог |
| --- | --- | --- |
| Unit | 1968/1968; 139 файлов; 0 пропусков | [Rstest](final-checks/verified-unit.log) |
| TypeScript | web и domain PASS | [лог](final-checks/verified-types.log) |
| Lint | PASS, 331 файл | [лог](final-checks/verified-lint.log) |
| Полный browser-регресс | 273/273; 0 failures/skipped; живой каталог включён; 12,6 мин | [лог](final-checks/verified-full-browser.log) |
| Затронутые сценарии на production bundle | 46/46 в двух отдельных запусках 21+25 | [21](final-checks/verified-new-features.log), [25](final-checks/verified-production-browser.log) |
| PWA production | 9/9: offline, update, draft safety, storage cleanup | [лог](final-checks/verified-pwa.log) |
| Backend | 39/39, включая PostgreSQL integration | [лог](final-checks/backend-regression.log), [JUnit summary](final-checks/backend-junit-summary.json) |
| Архитектура | 15/15; границы PASS | [лог](final-checks/architecture.log) |
| Delivery | 48/48 | [лог](final-checks/delivery.log) |
| Публичная версия | HTTP, точные SHA, реальное обновление, сохранность Project/Revision | [UI](public/public-release-check.json), [HTTP](public/public-http-check.json), [публикация](public/promotion-receipt.json) |

46 production-сценариев повторяют затронутую часть общего browser-набора в собранном приложении; их нельзя складывать с 273 как уникальные случаи. PWA выполнялся отдельно. Это Chromium/Chrome с мобильной эмуляцией, не физический телефон.

## Идентичность проверенной сборки

[Source verification](source-verification.json) подтверждает совпадение 364 файлов src/tests/public/scripts между рабочим каталогом и неизменяемым кандидатом после завершения тестов. [Web source manifest](web-source-manifest.json) содержит SHA-256 каждого файла; canonical SHA отсортированного JSON — `fa05a7e8f776f3b207fafba441566265f6295876356169196cd87ed8270ae9d5`. [Девять конфигураций](web-config-manifest.json) также сравнены. Это идентичность web-среза, не Git commit и не хэш всех файлов репозитория.

В публичный dist перенесены точные байты проверенного production bundle: [53 файла и SHA](bundle-manifest.json), [release manifest](release-manifest.json). Папки обменены атомарно без перезапуска сервера/туннеля. Через внешний HTTPS сверены SHA index.html, основного JS и sw.js. Предыдущая сборка сохранена во временной резервной папке; пользовательское хранилище не очищалось.

[Проверка настоящего обновления](public/public-release-check.mjs) подготовила отдельный профиль Chrome на прежней версии e8776a8126b2d4f7, сохранила тестовый проект, затем установила новый worker через две пользовательские кнопки. Полные records проектов и ревизий до открытия проекта после обновления совпали. Профиль и его содержимое не являются хранилищем пользователя. В архив не включены browser profile и точные данные проекта.

## Скриншоты опубликованной версии

- [План с двумя внутренними размерами](public/plan-default.png).
- [Пять групп фильтра](public/dimension-filters.png).
- [Чистый 3D](public/room-3d.png).

## Мутации и RED/GREEN

[Отдельный архив](mutation-and-red-green/README.md) содержит узкие scopes, исходные JSON, source SHA, RED/GREEN и ручные inverse-проверки. Он сохраняет как успешные scoped gates, так и неуспешные диагностические gates (старый layout 68,93%, leader+SVG 79,17%). Общий полный mutation gate всего финального приложения не заявляется. [Доказательства 3D](../evidence/2026-10-25/3d-refinements/verification.md) сохранены отдельно.

[artifact-manifest.json](artifact-manifest.json) фиксирует SHA всех остальных файлов этого архива; он сам исключён из собственного списка. Коммитов и отправки в репозиторий нет.

---
title: Фильтр размеров и чистый 2D/3D-план
created: 2026-10-25
status: implemented-and-verified-with-documented-limits
owner: root
authorization: Прямой запрос владельца; продолжать разработку без дополнительных вопросов, без commit/push.
baselineBuild: e8776a8126b2d4f7
---

# Решение до реализации

Новый запрос отменяет обязательную легенду S6 из spec-phone-editor-fixes-2026-10-25.md и прежние подсказки обзора. Canonical SPEC.md/CAP/FR/AD не перегенерируются. Трассировка: CAP-2/3/4/5/8; существующие FR размеров/мобильного редактора и NFR читаемости/сохранности; AD-1/2/3/4/16/22. Project, геометрия, Rev/history/resources/Portable Backup не изменяются.

## S1 — выбор размеров

Actor: пользователь телефона. Trigger: кнопка «Размеры» рядом с переключателем План/3D, только в 2D. Result: компактная прокручиваемая панель с пятью независимыми checkbox: «Внутренние размеры» (room-clear), «Внешние габариты» (overall), «Стены по осям» (wall), «Ширина проёмов» (opening), «Простенки по осям» (pier). Есть «Показать всё», «Скрыть всё», «Готово»; состояния checkbox и кнопки доступны screen reader/keyboard.

- Первый запуск: только room-clear. All-off допустим; ни одна группа не возвращается самопроизвольно.
- Filter применяется до screen layout; скрытые категории не занимают полосы и не раздвигают подписи. Числа и reference types остаются исходными.
- Выбор хранится отдельно в origin-scoped UI preference v1, не в Project/Revision/backup/writer lease. Reload, выход к проектам, новый Project, 2D↔3D, Undo не сбрасывают выбор.
- Неизвестная версия, неполная/повреждённая/слишком длинная строка или запрет localStorage дают безопасный internal-only default. Получение storage/get/set исключений не ломает приложение; текущий выбор работает в памяти. Запись только после действий пользователя, не поверх сохранённого значения до чтения.
- SSR не обращается к window/storage на уровне модуля. Настройки доступны в read-only; нет мутации geometry/history/resource ownership.
- Панель: 44+ px, viewport 320/360×480 и 393×852, landscape и text200%; focus trap, Escape/backdrop/Готово закрывают и возвращают фокус. Во время незавершённого жеста/формы кнопку нельзя использовать для сброса правки.
- Смена filter не сбрасывает camera pan/zoom или activeTool. Fit не зависит от checkbox; удаление прежней легенды освобождает зарезервированное ею место.

## S2 — чистые поверхности

Удалить постоянную размерную легенду и её ResizeObserver/space reservation; не переносить её другим блоком над планом. На 2D убрать scale/+Z подсказочные маркеры, инструкции placement/rotation, success toast размещения. Названия/checkbox/единицы находятся в настройках и формах.

На 3D убрать текстовые инструкции обзора/«Только для обзора», постоянные технические подписи/счётчики/успешные GLB-карточки, scale/+Z подписи и положительные prompts размещения («Коснитесь пола», «Можно поставить»). Сохранить скрытые diagnostic outputs для тестов/доступности, имя выбранного предмета, реальные органы камеры/полусферу/±45/отмену/Поставить.

Ошибки размещения/ресурсов/WebGL, retry/2D fallback, storage pressure, save failure, fenced writer, PWA update и подтверждения разрушительных действий сохраняются: это состояния операции, а не советы. При обычном покое плана поясняющих карточек нет.

## Проверка и поставка

До app code — storyboard и RED. Unit: defaults/5 kinds/all-off/immutability/roundtrip/corrupt/future/throwing storage/SSR. Browser: каждый checkbox, persistence через reload/projects/3D/Undo, 0 новых Revision, настоящие gestures при скрытых размерах, modal mobile/focus, отсутствие visual hints в обычном/selected/placement 2D и 3D. Сохранить invalid/recovery сценарии. Старые tests «всегда все размеры/легенда/подсказка» мигрируют через настоящий UI выбора, не skip и не возврат снятого интерфейса.

Затем Rstest, оба TypeScript, lint, boundaries, production build, PWA/offline/update, затронутый browser regression и scoped mutation pure preferences. Мутации только в отдельной source copy. Собранное приложение переключить на существующем HTTPS-мосту после проверок; старые данные/кэш проектов не очищать. Коммитов нет.

Ownership: root — preferences/filter/Plan/AppShell/integration; roadmap_audit — RoomScene3d cleanup и собственные тесты; code_health — read-heavy review и intentional regression-test migration. Один writer на файл.

[Storyboard](../../plans/dimension-filters-2026-10-25/storyboard.html)

## Итог реализации

Сборка `e5ef64fa94bd6154` опубликована и проверена. Итоговый unit 1968/1968, browser 273/273, production affected 46/46, PWA 9/9. [Отчёт и фактические ограничения](../../docs/progress/EDITOR-REFINEMENTS-2026-10-25.md), [логи и SHA](../../docs/progress/delivery-2026-10-25-refinements/README.md). Экранный профиль не объявляется нормативным печатным экспортом; ограниченный алгоритм раскладки не гарантирует глобальный оптимум или показ каждого размера в тесном виде.

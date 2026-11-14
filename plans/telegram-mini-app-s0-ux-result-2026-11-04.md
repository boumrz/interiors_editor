---
title: "Telegram Mini App S0 — результат UX update"
date: 2026-11-04
workflow: bmad-ux
intent: update
headless_status: partial
implementation_readiness: not_assessed_for_telegram_extension
---

# Результат

Обновлён UX-контракт дополнительной Telegram Mini App на общем редакторе с сохранением Web/PWA на S0–S7. Новый UXF-8 покрывает UJ-7; исторический UXF-7 относится к исключённому Focus и не переиспользуется. Существующая визуальная система и tokens сохранены; Telegram host states описаны существующими поверхностями и таблицами. Ноябрьские REL/FUP согласованы с устаревшими строками spine и имеют приоритет над ранними PNG.

Добавлены правила host entry и scoped identity, A→B→A и поздних результатов, таблица TMA-07 Back/Close с безопасностью draft/pending/failure/recovery, lifecycle и доступности, offline readiness по модулям и ресурсам, а также честные состояния local file handoff и отдельно recovery export. Browser/PWA сохраняют свои существующие запуск, данные, install, offline, обновление и проверки. Cloud sync и скрытый upload не добавлены; дальнейший retirement возможен только после проверки владельцем и отдельного допуска.

## Изменённые и созданные файлы

- [DESIGN.md](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md) — применимость платформ и согласование существующих визуальных компонентов с REL/FUP.
- [EXPERIENCE.md](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md) — Telegram состояния, поведение и UXF-8; UXF-7 сохранён за retired Focus.
- [.memlog.md](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/.memlog.md) — записи добавлены через `memlog.py`, включая заключительную сверку FR-9/FR-16.
- [reconcile-telegram-s0-2026-11-04.md](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/reconcile-telegram-s0-2026-11-04.md) — сверка с источниками и открытые вопросы.
- [review-telegram-s0-2026-11-04.md](../_bmad-output/planning-artifacts/ux-designs/ux-InteriorsEditor-2026-07-26/review-telegram-s0-2026-11-04.md) — независимые замечания и исправления, структурный и прозовый проходы.
- Этот отчёт.

## Проверка и ограничения

Состоялись read-only независимые review и reconciliation; обнаруженные противоречия исправлены. YAML frontmatter обоих spine разбирается, ссылки на локальные источники и Markdown-ссылки разрешаются, корни ссылок на tokens существуют, порядок основных разделов проверен. Новые mocks не создавались: headless mode и проектная Markdown-only policy предусматривают текстовые контракты. HTML validation report не создавался по policy для update; исторические отчёты не перезаписаны.

Это документная проверка, не запуск application tests, не физический Telegram тест и не оценка implementation readiness. Прежние результаты 1–2 ноября не выдаются за новый прогон. PRD, SPEC, Architecture, installer-owned файлы, application/build/test/config и пользовательские данные этим workflow не изменялись. Коммит и публикация не выполнялись.

## Открыто

1. **Конфликт владельцев источников:** AGENTS требует human-approved `AssetUsageGrant`; PRD/SPEC/AD-14 описывают Alpha без grant admission. UX не меняет policy; владельцы источников и readiness должны определить применимость и разрешение.
2. **Условное решение владельца:** если физические проверки покажут невозможность локального внешнего handoff на целевом клиенте, альтернативный способ, privacy и retention требуют отдельного решения. До него зависимая приёмка переноса остаётся открытой; upload не разрешён.
3. До writable Telegram runtime нужны identity/trust design и реальные bot/origin/Web-ссылка. Совместимость текущего формата требует проверки реальных файлов, а NFR-28 — отдельных физических iOS/Android проверок, включая внешний roundtrip. Эти доказательства не созданы данным workflow.

Статус `partial` отражает открытый конфликт источников и условное продуктовое решение, а не запрет документировать UX. Следующие BMAD workflows в этом чате не запускались.


## Заключительная сверка FR-9 и FR-16

После уточнения PRD повторно сопоставлены DESIGN и EXPERIENCE с REL-05/08 и
FUP-01. EXPERIENCE уточнён: тип и высота доступны через Room directory; UI
определяет комнату по типу, не редактирует и не показывает историческое имя
на плане, а сохранённое `Room.name` остаётся неизменным при смене типа/высоты
и после reopen. Отдельных жестового и числового split UI-маршрутов нет;
перемещение Vertex, добавление Wall и автоматическая нормализация допустимых
T/X и других контактов с необходимым разбиением сохраняются. DESIGN не
содержит противоречащего маршрута и не изменялся.

Локальный review проверил эти формулировки и связи с PRD/REL; application tests
не запускались. SPEC и PRD этим уточнением не изменялись; обозначенное PRD-owner
расхождение CAP-3 остаётся для отдельного SPEC workflow. Статус `partial` и
ранее перечисленные открытые вопросы не изменились.


## S3: additive UX-диспозиция импорта

В EXPERIENCE добавлен условный отдельный пользовательский маршрут `Импорт
файла для переноса` в Web/PWA для зарегистрированного transfer-формата,
включая файл из Telegram. Прежние импорт, browser exporter и принятые проверки
остаются. Маршрут использует общий ImportUseCase, создаёт новый Project ID
без перезаписи и не подменяет ошибку попыткой другого decoder. Для непроверенного
PPJ указана недоступность проверки, для неоднозначного legacy — явный отказ;
исходный файл сохраняется. Integrity не заявляется доказательством источника.

Допустимость ingress определяет SPEC-owner; действие не объявляется выпущенным
до соответствующего решения и применимого gate. Новый wire не объявляется
читаемым старым browser decoder. Это UX decision, не код, FR-44 proof,
подтверждение roundtrip, новый READY или разрешение upload. Запись внесена
через `memlog.py`; DESIGN, PRD, SPEC, приложение и проверки не менялись.

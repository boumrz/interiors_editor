---
title: "S0 Telegram Mini App — результат PRD update"
date: 2026-11-04
workflow: bmad-prd
intent: update
status: partial
implementation_readiness: not_assessed_for_telegram_extension
---

# Результат

PRD обновлён и финализирован в рамках headless workflow. `partial` означает,
что конфликт источников и условное решение владельца остаются открытыми, а не
то, что получено новое разрешение на реализацию. Исторический READY и baseline
preflight не являются readiness Telegram-расширения. Физические Telegram
проверки, фактическая выдача backup и TMA-AC не объявлены выполненными.

Добавлены **FR-55–FR-58** и **NFR-28**: общий принятый editor и host lifecycle,
immutable local account scope, двусторонний строгий backup, сосуществование и
совместимость выпусков, отдельное physical evidence. Уточнена применимость
FR-1, FR-42, FR-47 и SM-4; добавлены UJ-7 и матрица browser/PWA/Telegram.
Действующие FR/NFR сохранены; FR-53 и NFR-27 остаются retired. Alpha+ custom GLB
не повышен в Alpha entry; PNG, Focus/fullscreen, Walk, finishes и независимые
варианты не возвращены. Delivery/transport переданы в addendum; Web/PWA и их
данные сохраняются в S0–S7, retirement требует отдельного gate.

## Изменённые и созданные файлы

- [PRD](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md)
- [Addendum](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/addendum.md)
- [Memlog](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/.memlog.md) — дополнен только штатным скриптом.
- [Сверка задания](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/reconcile-telegram-extension-2026-11-04.md)
- [Сверка preflight](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/reconcile-telegram-preflight-2026-11-04.md)
- [Rubric review](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/review-telegram-rubric-2026-11-04.md)
- [Editorial review](../_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/review-telegram-editorial-2026-11-04.md)
- Этот результат.

Сверки и review — снимки до исправлений: два high замечания о FR-1 и FR-47,
а также замечания об unsupported host, offline metric, draft/swipe, scope
ресурсов и формулировке UJ исправлены в итоговом PRD. Существующие исторические
записи memlog сохранены; устаревшие решения читаются вместе с последующими
superseding записями. Structural review выполнен до prose review; уточнение
исторического каталога не принимает новую content policy. Прежняя неполная
inline-разметка assumptions отложена для общего редакционного прохода.
Проверены наличие новых/retired ID, отсутствие повторных определений FR/NFR и
локальные ссылки PRD/addendum. Тесты приложения в документном workflow не
запускались.

## Открыто и передано дальше

1. **Конфликт источников:** AGENTS требует human-approved AssetUsageGrant,
   тогда как действующие PRD/SPEC/AD-14 исключают Alpha grant admission.
   Владелец источников и readiness определяют разрешение и применимость к
   зависимому admission/release; эта работа не меняет licensing policy.
2. **Условное решение Product Owner:** если реальные iOS/Android проверки
   покажут, что локальный внешний backup невозможен, выбрать допустимую
   альтернативу и её privacy/retention. Только зависимая приёмка переноса ждёт
   решения; скрытый server upload не разрешён.
3. До writable Telegram runtime требуется identity/trust design; до обещания
   совместимости — сверка фактических current-format файлов и PPJ-A1. Реальные
   bot, стабильные origins, устройства и physical evidence остаются внешними
   зависимостями соответствующих шагов.
4. Отдельные workflow владельцев должны обновить UX, Architecture, SPEC и
   downstream stories и выполнить новую оценку implementation readiness;
   этот PRD update не менял их документы. Историческое описание состава
   каталога и lighting остаётся для content-owner reconciliation.

Application code, build/test/config, SPEC, Architecture, UX и installer-owned
файлы не менялись; коммит и публикация не выполнялись.

## Delta после readiness finding: FR-9 и FR-16

В этом же PRD workflow уточнены существующие `FR-9` и `FR-16`, без новых или
retired IDs. Источник — принятые [REL-05 и REL-08](../contracts/alpha-release-ux-2026-11-01.md),
с учётом [FUP-01](../contracts/alpha-release-ux-followup-2026-11-01.md).

- `FR-16`: пользователь изменяет тип и высоту помещения; UI определяет комнату
  по типу, не предлагает редактирование имени и не показывает историческое
  имя на плане. Сохранённое `Room.name` не переписывается при смене типа/высоты
  и сохраняется при reopen. Модель и schema не меняются.
- `FR-9`: перемещение вершины и добавление стены к существующей вершине
  сохраняются; T/X и иные допустимые контакты автоматически нормализуются,
  включая необходимые разбиения и полную проверку. Удалённый жест split не
  возвращается, отдельный split UI не обещается. Доменные операции,
  совместимость прежних разделённых стен и существующие проверки сохраняются.
  Возможный будущий самостоятельный маршрут требует отдельного решения только
  если он будет предложен; это не блокирует нормализацию контактов.
- Read-only сверка текущих тестов нашла сценарии отсутствия split action и
  numeric split, перемещения вершины, а также изменения type/height с
  сохранением name после reopen. Это чтение тестов, не новый запуск и не
  подтверждение Telegram parity.

Передача владельцам: `CAP-3` в текущем SPEC всё ещё обещает задать имя и
должен быть согласован workflow `bmad-spec`; `project-context.md` также требует
сверки слишком общего запрета metadata flow с доступным non-canvas type/height
маршрутом. Доменные `SplitWallSegment` и требования T/X не удаляются: они не
равнозначны UI-жесту. UX и downstream stories должны сверить этот PRD delta;
никакие чужие документы в этом проходе не изменялись. Дельта не меняет
исторический verdict и не устанавливает новый общий READY для Epic 10.

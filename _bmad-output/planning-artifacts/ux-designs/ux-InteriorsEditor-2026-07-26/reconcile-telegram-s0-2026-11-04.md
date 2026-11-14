# Сверка UX с Telegram S0 — 4 ноября 2026

Источники: [задание](../../../../plans/telegram-mini-app-extension-spec-2026-11-04.md), [preflight](../../../../plans/telegram-mini-app-s0-preflight-2026-11-04.md), [результат PRD](../../../../plans/telegram-mini-app-s0-prd-result-2026-11-04.md), PRD FR-55–58/NFR-28, контракты REL/FUP и отчёты 1–2 ноября. Это документная сверка, не приёмка реализации.

| Источник / тема | Куда сведено | Результат |
|---|---|---|
| Web/PWA + Telegram, отложенный retirement | EXPERIENCE Foundation и Telegram-раздел; DESIGN Brand & Style | Web/PWA и их данные/проверки сохранены, retirement требует отдельного gate. |
| TMA-02/04/10/14; FR-56/58 | Вход и scope | Invalid/unsupported host, identity, SDK timeout, version guard, A→B→A и поздние операции; scope выбирается до runtime, DB и cleanup. |
| TMA-06–08; FR-55 | Back/Close; lifecycle/layout | Приоритет несохранённой работы, focus, один handler, swipes, stale transform, второй pointer, fence, 360px/200%, safe areas, theme и accessibility. |
| TMA-09/11–13; FR-55/57 | Сеть, подготовка и файлы; UXF-8 | Lazy modes/resources до/после подготовки; отдельные preparation, handoff, cancel, unsupported, externally verified и recovery-export; импорт создаёт новый Project. |
| REL/FUP 1 ноября | Оба spine, раздел ноябрьских уточнений | Исправлены устаревшие tooltip, Wall selection/delete, Back и подтверждения; старые PNG подчинены новым контрактам. |
| Catalog recheck 2 ноября | EXPERIENCE network/catalog states | Недоступность каталога не объявляет healthy Project повреждённым; старый отчёт не выдаётся за новую Telegram-проверку. |
| UJ-7 | UXF-8 | Перенос, edit, предмет, 3D, Durable reopen и обратный перенос; UXF-7 не переиспользован после retired Focus. |

Нового визуального направления и mockups нет: host states используют существующие AppShell, StatusBanner и sheets, а таблицы фиксируют поведение. Historical PNG остаются композиционными справками и не являются доказательством текущего UI. Ни одно качественное требование из переданных Telegram-источников, относящееся к этому UX-срезу, намеренно не отброшено; архитектурные и release-подробности остаются во владельческих источниках.

Открытое противоречие: AGENTS требует human-approved AssetUsageGrant, тогда как PRD/SPEC/AD-14 исключают Alpha grant admission. UX не принимает новую licensing policy; разрешение принадлежит владельцам источников и readiness. Условный выбор владельца нужен, если физически проверенный локальный file handoff окажется невозможным; upload не разрешён. Конкретные bot/URLs, identity trust design, схемы реальных файлов и физические iOS/Android evidence ещё не установлены этим workflow.

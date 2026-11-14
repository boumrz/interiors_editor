# Reconciliation: Telegram S0 preflight и актуальные UX-контракты

Дата: 2026-11-04. Источники: полный `plans/telegram-mini-app-s0-preflight-2026-11-04.md`; `contracts/alpha-release-ux-2026-11-01.md`, `contracts/alpha-release-ux-followup-2026-11-01.md`; `docs/progress/delivery-2026-11-01-followup/README.md`, `docs/progress/catalog-recheck-2026-11-02/README.md`; обновлённые `prd.md` и `addendum.md`. Для уточнения TMA-07 сверена `plans/telegram-mini-app-extension-spec-2026-11-04.md`.

## Findings

1. **High — SM-4 не учитывает границу cold launch.** «100% reference-device runs выполняют open/edit/save in airplane mode после initial setup» в глобальной секции успеха теперь можно прочитать как Telegram cold offline, что противоречит FR-42/FR-55 и матрице применимости. Разделить browser/installed-PWA cold offline reopen и Telegram online cold launch с offline edit/save после подготовки. Не ослаблять действующий PWA сценарий.
2. **Medium — неоднозначность отмены в FR-55.** «Отмена сохраняет draft и selection» не различает отмену диалога Back/Close (продолжить с теми же draft/selection) и явную отмену самой незавершённой правки (не публикует её). TMA-07 различает оба действия; FUP-06/08/09 требуют реальной отмены и отсутствия ghost draft. Уточнить без заранее навязанной конкретной UX-механики.
3. **Low — состав scoped data и identity.** FR-56 перечисляет resources, но явно не называет локальную библиотеку ресурсов и исключение bot ID из переносимой модели, которые названы в TMA-10. Addendum запрещает token/initData/PII в Project/backup, но бот ID как platform ownership лучше назвать прямо; не выдавать scope за безопасность или серверную авторизацию.

## Покрытие и пределы

- FR-55–58, NFR-28 и addendum охватывают общий доменный результат, сохранение November REL/FUP UX, scoped runtime до DB, A→B→A и late results, offline различия, безопасный lifecycle и no-worker совместимость, строгий двусторонний внешний backup, отдельную physical evidence, сохранение Web/PWA до отдельного retirement gate.
- Два output и отдельный стабильный origin, worker isolation, catalog-only доставка и schema handshake находятся в addendum как delivery handoff. Незакрытая Export V1/PPJ-A1 совместимость не объявлена доказанной; server transfer и automatic bot upload требуют отдельного согласования.
- Исторический READY и проверки 1–2 ноября не закрывают Telegram readiness или physical iOS/Android evidence. Alpha+ GLB/FBX/ZIP и retired функции не повышены; licensing source conflict выделен без изменения policy.
- Разбор REL/FUP показывает, что обратная совместимость существующих проектов, подтверждения и атомарные recovery/lease semantics сохраняются ссылкой на действующие контракты; подробные host-переходы принадлежат следующему UX workflow. Доказательства ноября относятся к указанным browser/PWA условиям и не расширяются на Telegram.

# Reconciliation: Telegram extension specification → PRD/addendum

Дата: 2026-11-04. Источник: `plans/telegram-mini-app-extension-spec-2026-11-04.md`, разделы 1–15. Объекты сравнения: `prd.md`, `addendum.md`. Это проверка переноса требований, не implementation-readiness и не подтверждение evidence.

## Результат

Основной продуктовый сигнал перенесён: FR-55–58 и NFR-28 охватывают совместное существование S0–S7, общий доменный результат, Telegram online cold launch и локальную работу после подготовки, изолированный account scope, двухсторонний файловый backup и отдельное physical evidence. FR-58 сохраняет PWA и откладывает Telegram-only до проверки владельцем и отдельного допуска. Addendum передаёт delivery и transport, включая no-worker ReleaseManifest, раздельные output/origin, catalog boundary и schema-risk. Права на контент не изменены; source conflict зафиксирован. Историческая проверка NFR-15 не выдана за Telegram evidence.

## Находки

1. **Средняя — TMA-07 / TMA-AC-04, host swipes.** FR-55 покрывает Back, Close, viewport и stale projection, но не закрепляет, что конфликтующие жесты Telegram не должны случайно закрывать редактор или подтверждать draft/создавать Revision; управление конфликтующими host swipes должно быть ограничено нужным состоянием редактора и восстанавливаться при выходе. Добавить пользовательский outcome в FR-55, детали управления оставить UX/architecture.
2. **Средняя — TMA-02, неподдерживаемый запуск.** FR-55 обещает честный retry/выход/fallback и отсутствие записи, но явно не сохраняет доступные переходы в Telegram и действующий Web/PWA при открытии Telegram entry вне поддержанного host. Зафиксировать маршруты, когда они доступны, не выдумывая адреса бота или origin.
3. **Низкая — TMA-15, физическая проверка каталога.** Требования сохраняют catalog parity и NFR-28 проверяет catalog placement, однако источник конкретизирует реальную floor- и wall-модель, их загрузку и reopen в обеих поверхностях. Добавить эти примеры в evidence handoff, чтобы общий placement не сочли достаточным proof для обоих anchor классов.
4. **Низкая — TMA-09, readiness.** FR-55 перечисляет modules и exact resources, но не называет явным образом 2D, 3D и codecs, а TMA-09 требует не объявлять соответствующую offline-возможность до их доступности. Уточнить границу в addendum либо FR-55 без обещания полного offline при доступности только первого экрана.

## Учёт источника по группам

- Разделы 1–4: изменение направления, область и инварианты отражены в PRD и FR-55–58; исходное состояние и ограничения доказательств — в addendum. Уже работающий код не становится новым readiness.
- TMA-01–04: общие outcomes в FR-55/58; adapter, outputs, worker isolation, handshake, immutable rollback resources в addendum; см. находку 2.
- TMA-05–09: parity, back, durability, lifecycle, accessibility и offline в FR-55; см. находки 1 и 4. Узкие взаимодействия оставлены последующему UX.
- TMA-10–14: FR-56/57 и addendum сохраняют immutable scope до runtime, no silent write, локальный transfer, восстановление и privacy/trust. Выбор server transfer остаётся условным решением владельца, блокирует соответствующую приёмку, а не весь независимый scope.
- TMA-15–16: catalog-only boundary и диагностический/release handoff отражены в addendum, NFR-21/25 и NFR-28; см. находку 3.
- Разделы 9–15: traceability, стадии, physical evidence, runbook, отложенный retirement и оговорка о readiness переданы как границы workflow и следующие шаги, а не ложные результаты. Конкретная TMA→story/acceptance mapping остаётся последующим S0 handoff.

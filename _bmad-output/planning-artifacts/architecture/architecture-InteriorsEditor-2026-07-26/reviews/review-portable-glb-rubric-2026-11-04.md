# Rubric / source-policy review: portable GLB

Дата: 2026-11-04. Независимая проверка source-policy раздела `telegram-portable-v1-disposition-2026-11-04.md`.

**Вердикт: PASS WITH OPEN SOURCE-POLICY APPLICABILITY.** 50 MiB определён как предел общего portable envelope/технического preflight, не как право на новую custom admission; 25 MiB hard и меньший применимый лимит из `asset-import-contract.md` сохранены. Новый backup не подтверждает прошлое происхождение, exact repair не объявляется освобождением от безопасности, а применимость 25 MiB к backup import/repair передана владельцу SPEC/asset-policy. Existing catalog/custom public calls и их причины отказа не расширяются. Лицензионная policy и Alpha+ scope не меняются.

Hash aliases проверяются по всем 256 битам для каждого case-sensitive исходного ключа с сохранением ключей, размера и exact bytes; scope охватывает не только smoke, но и pin/reopen/hydration/export/repair. Текущий smoke правильно ограничен как структурный/геометрический, без утверждения реального GLB decode или GPU evidence. План evidence не выдаётся за выполненный.

**Уточнение порядка:** для недоверенного custom GLB, к которому до source-owner решения применяется действующий 25-MiB hard, этот меньший byte guard должен срабатывать **до любого JSON/GLB parse**, а не после вызова технической 50-MiB seam. Более широкий технический вызов применим только там, где предварительно установлен допустимый маршрут/правило; он не доказывает безопасность render/decoder. Граница 50 MiB не является подтверждением, что в текущем supported контуре существуют admitted GLB такого размера.

Sources: `asset-import-contract.md` §1–3 (25 MiB hard, более строгий из пересекающихся лимитов); `project-and-backup-contract.md` §1 (50 MiB один pinned resource, 180 MiB total); текущие `static-glb-import.ts`, `catalog-media-validator.ts` и `portable-backup-read-render-smoke.ts`. Тесты и физические устройства этим review не запускались.

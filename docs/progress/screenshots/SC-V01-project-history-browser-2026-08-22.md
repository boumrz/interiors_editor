# SC-V01 — первая история Project, browser-emulation checkpoint

- **Build marker:** `ALPHA · V01` (Story 1.4)
- **Scenario:** на новом локальном Project отменить черновик переименования,
  подтвердить переименование, выполнить durable undo. На capture снова видно
  исходное имя `План для истории`, активную кнопку redo и статус
  `Сохранено локально`.
- **Viewport/device emulation:** Chrome via Playwright CLI, 390×664 CSS px,
  light scheme. Это viewport emulation, а не заявление о конкретной модели
  телефона.
- **Capture:**
  [`SC-V01-project-history-browser-2026-08-22.png`](../../../output/playwright/SC-V01-project-history-browser-2026-08-22.png)
  — SHA-256 `cc9567899b75c8ffa25160662ab5f00a94a9fd8e30617cdd3e419338338525d9`.

Во время того же интерактивного прогона `Черновик без публикации` был отменён
через DOM-кнопку `Отмена`, затем `План с историей` опубликован и отменён. Сам
capture сделан после undo, поэтому включённый redo — наблюдаемый признак
границы активной session history. Полный браузерный сценарий cancel → rename →
undo → redo дополнительно покрыт `PROJECT-E2E-02`.

Это browser-emulation feedback only. Он не доказывает physical iPhone/Samsung
support, installed-PWA/offline behaviour, storage quota, accessibility,
performance, thermal stability или release readiness; соответствующие
NFR-15 device traces остаются отдельной проверкой.

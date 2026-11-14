# SC-V04 — touch-кандидат Wall, browser-emulation checkpoint

- **Build marker:** `ALPHA · V04` (Story 2.2, touch review-candidate slice)
- **Scenario:** в Plan Mode провести стену одним пальцем. После отпускания
  пальца на canvas остаётся пунктирный кандидат, а приложение показывает
  фактическую длину, направление и DOM-кнопки `Подтвердить стену` /
  `Отменить стену`; до confirm нет Durable Revision.
- **Viewport/device emulation:** Chrome via Playwright CLI, 390×664 CSS px,
  light scheme.
- **Capture:**
  [`SC-V04-touch-wall-candidate-browser-2026-08-22.png`](../../../output/playwright/SC-V04-touch-wall-candidate-browser-2026-08-22.png)
  — SHA-256 `ed84585301a1b97a77eb47ea4ee4367239386436b5307cf97f3a34e6666bff02`.

На capture кандидат — `3500 мм`, `вертикально`; счётчик по-прежнему показывает
`1 комната · 4 стены`. Это наблюдаемый preview, а не сохранённая геометрия.
Автоматизированный `EDITOR-E2E-02Q` отдельно проверяет отсутствие Revision до
explicit cancel и отсутствие mutation после cancel.

Это browser-emulation feedback only. Он не доказывает physical iPhone/Samsung
support, installed-PWA/offline behaviour, quota pressure, accessibility,
performance, thermal stability или release readiness; NFR-15 traces остаются
отдельной physical-device проверкой.

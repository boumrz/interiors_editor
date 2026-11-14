# SC-V02 — exact 2D rectangular room, browser-emulation checkpoint

- **Build marker:** `ALPHA · V02`; production `apps/web/dist` build after the
  Story 2.1 remediation
- **Scenario:** in a fresh browser profile create `Гостиная`, create its
  `4000 × 3000 × 2600 мм` starter rectangle, then open the exact-dimensions
  inspector
- **Viewport/device emulation:** Chrome via Playwright, `iPhone 13`,
  390×844 CSS px, `ru-RU`, light scheme
- **Visible state:** exact 2D plan on the visual grid; three raw-mm input
  controls; explicit `Применить размеры`; derived `12,00 м²` area,
  `14 000 мм` perimeter and `2600 мм` height
- **Capture:**
  [`SC-V02-editable-2d-mobile-browser-2026-08-22.png`](SC-V02-editable-2d-mobile-browser-2026-08-22.png)
  — SHA-256 `d5740f0e7f853d8fc63b346943cf0dc1295bbbe9d828fb9156ea747ef38d2770`

This is browser-emulation feedback only. It is not proof of a physical device,
installed-PWA/offline behaviour, accessibility, performance, thermal stability,
full topology handling or Alpha release readiness.

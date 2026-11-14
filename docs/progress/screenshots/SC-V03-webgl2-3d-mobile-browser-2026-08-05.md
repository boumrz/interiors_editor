# SC-V03 — одна Durable Revision в Plan и 3D, browser-emulation checkpoint

- **Build marker:** `ALPHA · V02` — маркер виден в захваченном работающем V-03 browser build.
- **Scenario/trace:** текущая каноническая повторная проверка пути — `PLAN-E2E-02`: в чистом профиле создаётся комната `Гостиная` с размерами `4000 × 3000 × 2600` мм, открывается вкладка `3D`, подтверждаются те же внутренние размеры, затем выполняется возврат в `Plan` и проверяется восстановление после потери WebGL-контекста. Скриншот фиксирует участок этого пути с активной вкладкой `3D`; он не утверждает, что был создан текущим прогоном теста.
- **Viewport/device emulation:** Chromium/Chrome через Playwright `devices["iPhone 13"]`, `390 × 844` CSS px, `ru-RU`, светлая тема. Связанный PNG — full-page растровый снимок `390 × 1514` px.
- **Capture:** [SC-V03-webgl2-3d-mobile-browser-2026-08-05.png](SC-V03-webgl2-3d-mobile-browser-2026-08-05.png), SHA-256 `1ee8ccb0da064d11cc702d2b8240decadb191e61b855fe60f7e5c22d0d7fa38a`.

Это только обратная связь из browser emulation. Она **не** является доказательством физического устройства или выполнения NFR-15, производительности либо термального поведения, выбора renderer framework/renderer corpus, прохождения `G-S1-renderer` или готовности Alpha к релизу.

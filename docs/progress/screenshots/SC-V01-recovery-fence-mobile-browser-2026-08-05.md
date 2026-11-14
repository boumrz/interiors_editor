# SC-V01 — Recovery fence, browser-emulation checkpoint

- **Build marker:** `ALPHA · V01` (Story 1.1 post-review remediation)
- **Scenario:** create a local Project, deliberately remove the current
  Revision from IndexedDB, reload, and observe a visible recovery fence instead
  of an empty first run or false saved state.
- **Viewport/device emulation:** Chrome via Playwright, `iPhone 13`, 390×664
  CSS px, `ru-RU`, light scheme.
- **Visible state:** `Нужно восстановление — публикация новых изменений
  остановлена`, disabled project creation and an explicit recovery action.
- **Capture:**
  [`SC-V01-recovery-fence-mobile-browser-2026-08-05.png`](SC-V01-recovery-fence-mobile-browser-2026-08-05.png)
  — SHA-256 `dea1d08406ad611e0f781e980848ee2dfb5d1c4532aed73a892b765fe60421ce`.

This is a controlled browser-emulation regression capture. It is not physical
iPhone/Samsung, PWA/offline, full crash-consistency, accessibility, performance
or release certification.

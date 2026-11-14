# Catalog UI recheck — 2026-11-02

URL: https://gym-departmental-classical-trustee.trycloudflare.com

All 12 published models reached the real browser UI state «Готово для размещения». Every «Показать на плане» button was visible, enabled, and passed an actual center hit-test. This was a fresh Chrome browser context with iPhone 13 emulation; observed viewport 390×664. There were no request failures, page errors, or console errors during any model preparation. No routes/fakes were installed; no app or shared test source was edited. Only a temporary scratch project was created in the isolated browser context. Placement publication/reload is separately tested by the catalog agent.

For each model the UI selected-card SHA/byte count matched the published catalog. Observed 206 responses cover contiguous ranges from byte 0 through the declared final byte for every model. Eight published thumbnail images decoded at 318×191; the four demonstration models have no thumbnail field in the publication and correctly use the symbol fallback. This is browser preparation/preflight evidence, not a claim of 3D scene rendering for all 12.

| Model | Bytes | UI ready (s) | Range responses | Result |
| --- | ---: | ---: | ---: | --- |
| Обеденное кресло | 21404360 | 9.91 | 21 | PASS |
| Антикварный кожаный диван | 13768416 | 4.84 | 14 | PASS |
| Шкаф в скандинавском стиле | 12914628 | 6.37 | 13 | PASS |
| Фактурное кресло | 10323824 | 4.34 | 10 | PASS |
| Винтажный стул Zen | 3543584 | 1.31 | 4 | PASS |
| Кровать | 3157360 | 2.33 | 4 | PASS |
| Деревянный комод | 2333896 | 1.83 | 3 | PASS |
| Кресло Kursi | 1152384 | 0.82 | 2 | PASS |
| Демонстрационный кухонный прибор | 1056 | 0.32 | 1 | PASS |
| Демонстрационная раковина | 1052 | 0.31 | 1 | PASS |
| Демонстрационное настенное бра | 972 | 0.32 | 1 | PASS |
| Демонстрационная ваза | 964 | 0.30 | 1 | PASS |

Evidence: `summary.json` is the compact result; `results.json` preserves network metadata and UI details; each asset ID has a PNG and CLI log; `final-state.log` confirms all 12 cards after publication loads. `run-all-models.py` and per-model JS preserve the ad-hoc read-only harness.

Excluded setup attempt: `excluded-harness-attempt/` preserves an incorrect first harness assertion that waited for a thumbnail in the intentionally hidden catalog list after selection. The model itself had already reached ready in 7.9s. The harness was corrected to inspect the focused placement preview, reset between cards using Escape/reopen, and the accepted full run used a newly opened browser context. This setup error is not counted as an application failure.

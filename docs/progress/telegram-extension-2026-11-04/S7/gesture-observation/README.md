# Matched local gesture observation

Completed against preserved Web `ccdd13662cdca379` and isolated current Web `b108e21f1a77803b`. Both use the same actual 4100×3200×2700 mm geometry, 390×700 mobile-emulated viewport, six movement frames, unavailable catalog, separate fresh persistent Chromium profiles and loopback servers. Plan pan, Plan pinch and Scene orbit change their visible projections and preserve every recorded durable Project/Revision row on both builds. No page errors or external requests occurred in the completed comparison. See `observation.json` and `observed-summary.json`.

The real Service Worker API is allowed consistently in the completed first-navigation observation. The earlier blocked-worker attempts are retained under `attempt1` and `attempt2-blocked-sw`: Playwright blocking makes `register()` resolve without a registration, breaking the same existing PWA update listener in both builds. Those attempts are rejected setup observations, not a production regression or a passing gate. No product code was changed for them.

| Observation | Preserved Web | Current Web |
| --- | ---: | ---: |
| Plan pan event/frame samples | 8 | 8 |
| Plan pinch event/frame samples | 16 | 16 |
| Scene orbit event/frame samples | 8 | 8 |
| Distinct JS/CSS bytes actually delivered in this flow | 1,728,046 | 1,832,568 |
| Durable rows changed by gestures | 0 | 0 |

Loaded code in this particular flow increases by 104,522 bytes (about 6.0%). Whole-directory totals in `../build-comparison-v3/comparison.json` include retained old files and are a different measurement; they must not be used to claim a smaller active application. Raw per-event animation callback delays, resource/navigation timing and exact response paths are retained. This is a local observation under concurrent machine load, with no new latency budget, FPS, physical display, Telegram/WebView or installed-PWA acceptance claim.

Run from the repository root with the pinned runtime and one reserved native slot:

```sh
INTERIORS_GESTURE_NATIVE_SLOT=reserved node docs/progress/telegram-extension-2026-11-04/S7/gesture-observation/observe.mjs \
 /absolute/path/to/preserved-old-dist \
 /absolute/path/to/final-isolated-new-web-dist \
 /absolute/path/to/separate-observation-output
```

The script verifies both complete gesture sets and fails on any page error, external request, unchanged projection or changed durable rows. It does not touch an owner's profile, delivery output or database.

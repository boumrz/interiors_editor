---
title: "S-4 Focus — test automation summary"
date: 2026-08-04
scope: "W-SPK-2026-08-04 / S-4 synthetic prototype only"
status: complete-with-limitations
automation:
  runner: Playwright WebKit
  device_descriptor: iPhone 13
  viewport_css_px: "390x844"
  browser_e2e: 7
  mutation_score_percent: 62.42
  mutation_total: 306
  mutation_killed: 190
  mutation_survived: 115
  mutation_timeout: 1
---

# S-4 Focus — test automation summary

This summary is retained in the waiver evidence root rather than a production
test directory because implementation readiness is not `READY`. It records
only the synthetic S-4 prototype; it does not claim coverage for the future
React/Rspack/Kotlin application.

## Executed automated checks

| ID | Browser-observable scenario | Result |
| --- | --- | --- |
| S4-E2E-01 | Visible named controls, touch-size and no hover prerequisite | PASS |
| S4-E2E-02 | One-touch preview/confirm; two touches move to camera without wall commit | PASS |
| S4-E2E-03 | One-finger camera mode never edits the wall | PASS |
| S4-E2E-04 | Numeric millimetre alternative and invalid-value preservation | PASS |
| S4-E2E-05 | Cancel only discards preview; undo affects a confirmed command | PASS |
| S4-E2E-06 | Reduced motion preserves numeric/status route | PASS |
| S4-E2E-07 | In-app Focus preserves synthetic state, critical rails and numeric return; no history/numeric overlap | PASS |

`npm test` completed **7/7** in **3.4 s** after the mutation run. The browser
context is Playwright WebKit with the iPhone 13 descriptor (`390×844` CSS px,
DPR 3, touch enabled). It is not a physical iPhone, Safari, Home Screen PWA,
Android/Samsung, native Fullscreen API, keyboard/safe-area, or performance
trace.

## Mutation check

Full-file Stryker mutation testing targeted only `app.js`: **306 total**,
**190 killed**, **115 survived**, **1 timeout**, score **62.42%**. Surviving
mutants remain evidence that this disposable prototype is not ready for
promotion. Raw reports and hashes are recorded in
`S-4-evidence-report-2026-08-04.md`.

## Non-applicable and deferred coverage

- No production API or Kotlin/PostgreSQL contract exists within this waiver;
  backend/integration tests are therefore not applicable to S-4.
- No physical device, participant, `G-1`, native fullscreen or NFR-15 evidence
  is supplied by this automation.
- The approved future application plan requires Rstest for TypeScript seams and
  Playwright browser/mobile/PWA/offline/Focus regression after each code
  change; `CATALOG-E2E-01…05`, `WALK-E2E-01`, `PROJECT-E2E-01` and
  `FOCUS-E2E-01…07` remain planned, not implemented tests.

## Gate result

`PAUSED`. The automation proves the bounded browser-emulated prototype paths
only. It neither changes the readiness gate nor authorizes cleanup, source
promotion, native/fullscreen compatibility claims, or production implementation.

---
title: Physical Device Trace Record
status: template-only
requires: current-prd-nfr-15-product-owner-acceptance
---

# Physical Device Trace Record

One file records exactly one named physical device/context row. Emulator,
desktop and Playwright mobile profiles are invalid values for this template.

## Permitted rows

| Physical device | Context |
| --- | --- |
| iPhone 15 Pro Max | Safari/browser tab / Home Screen PWA |
| Samsung S24 Ultra | Chrome/browser tab / installed PWA |

## Attribution and preconditions

| Field | Value |
| --- | --- |
| Device inventory ID / model | `TBD` |
| Actual OS, browser and WebKit/Chrome version | `TBD` |
| Build, commit, schema and fixture hashes | `TBD` |
| Context | `TBD` |
| WebGL2 probe result | `TBD` |
| Battery 60–80%, saver off, unplugged, thermally settled | `TBD` |
| Network profile / cache state | `TBD` |
| Operator / independent reviewer | `TBD` |
| Raw trace locations and SHA-256 | `TBD` |

## Required sequence and observed result

| Operation | Required count | Threshold / outcome | Observed result | Raw reference |
| --- | ---: | --- | --- | --- |
| Create, reopen and locally save a Project | 1 | success in available browser and installed-PWA contexts | `TBD` | `TBD` |
| 2D and 3D navigation | 1 | controlled navigation is usable | `TBD` | `TBD` |
| Place, move and discrete-rotate a floor AssetInstance | 1 | durable save succeeds | `TBD` | `TBD` |
| Safe PWA update | 1 | active editor is not silently interrupted | `TBD` | `TBD` |

## Verdict

`PASS` / `FAIL` / `PAUSED`: `TBD`.

This template follows current PRD NFR-15. Exact OS/browser build, raw
recordings and independent performance diagnostics remain useful optional
engineering evidence; they are not Alpha prerequisites. The Product Owner
records the result and reason in the approved evidence system: `TBD`.

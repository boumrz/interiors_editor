---
title: NFR-15 Physical Device Lab Runbook
date: 2026-08-09
status: template-only
requires: device-lab-owner-independent-reviewer-production-like-build
---

# NFR-15 Physical Device Lab Runbook

## Boundary

This runbook prepares collection only. A completed form, emulator, desktop
browser, mobile emulation, screenshot or synthetic timing is not a physical
trace. No row becomes `PASS` until an accountable Device-lab Owner and an
independent Reviewer attach immutable raw material from the named physical
device/context. Missing material is `PAUSED`; failed thresholds or recovery
are `FAIL`.

## Required owners and evidence identity

| Field | Required value |
| --- | --- |
| Device-lab Owner | `TBD` |
| Independent Reviewer | `TBD` |
| Product/Architecture decision owner | Roman Zheltov |
| Production-like build / commit / schema | `TBD` |
| RS-1, RS-2 and RS-3 fixture IDs + SHA-256 | `TBD` |
| Trace storage and retention authority | `TBD` |
| Calibration / collection tool version | `TBD` |

Roman’s decision ownership does not establish device operation or independent
review. Do not use a development server or a local browser profile as the
production-like build without a recorded compatibility decision.

## Required physical rows

Run and record each row separately; iOS Safari and Home Screen storage are
separate contexts.

| Row | Model | Context | Status |
| --- | --- | --- | --- |
| D-01 | iPhone 13 mini | Safari tab | `PAUSED` |
| D-02 | iPhone 13 mini | Home Screen PWA | `PAUSED` |
| D-03 | iPhone 17 | Safari tab | `PAUSED` |
| D-04 | iPhone 17 | Home Screen PWA | `PAUSED` |
| D-05 | Galaxy A53 5G `SM-A536B/DS` | Chrome Android tab | `PAUSED` |
| D-06 | Galaxy A53 5G `SM-A536B/DS` | installed standalone PWA | `PAUSED` |
| D-07 | Galaxy S26 `SM-S942B/DS` | Chrome Android tab | `PAUSED` |
| D-08 | Galaxy S26 `SM-S942B/DS` | installed standalone PWA | `PAUSED` |

Any OS/browser patch or substituted physical model requires a renewed trace.
Samsung Internet, another phone and browser-device emulation may be a smoke
aid but never substitute for a row.

## Preflight for one row

1. Record model/SKU or inventory ID, actual OS, browser/WebKit/Chrome version,
   screen state, browser/PWA context, build/schema/fixture hashes and a
   successful WebGL2 capability probe.
2. Use comparable settled Wi-Fi for online runs. Record network profile and
   cache state.
3. Set battery to 60–80%, power saver off, unplugged and thermally settled;
   record the actual state. Do not infer it from a screenshot.
4. Verify the prerequisite browser regression suite and record its immutable
   result reference. This is a prerequisite, not the physical result.
5. Create one `physical-device-trace.md` record and reserve raw artifact paths
   before beginning. Do not place participant or Project content in this repo.

## Required execution sequence

For every row, perform the full sequence against the same recorded build and
fixtures. Record every restart/reset method and each individual measurement.

1. **Cold online start ×20.** Use the approved independent-start procedure;
   measure from launch/navigation until the first editable empty Room. Each
   result must be ≤3.0 seconds.
2. **Warm offline start ×20.** After the approved initial online shell setup,
   disable network and measure from launch/navigation to editable state. Each
   result must be ≤1.5 seconds.
3. **RS-2 editing session ×5 minimum.** Run the exact scripted gesture/edit
   fixture while collecting p50/p75/p95 frame time, main-thread blocks,
   frames over 50ms, scene/quality tier, memory proxy and disposal events.
   During gestures, no main-thread block may exceed 50ms, p95 frame time must
   be ≤33.3ms, and frames over 50ms must be ≤5% of the session.
4. **Forced WebGL context loss.** Trigger the approved path, record the
   context-loss/recreate/disposal events and prove the same Durable Revision
   is recoverable without reload.
5. **Thermal editing run.** Run the approved 15-minute editing fixture. Record
   thermal condition, adaptive tier changes, crash, unexpected context loss,
   input loss and Durable Revision outcome.
6. **Focus row.** From an actual user action record native fullscreen probe and
   direct request result (`success`, `rejected` or `unsupported`); if success,
   external exit; always verify in-app enter/exit, preserved editor state,
   keyboard/safe-area behavior, labelled 44×44 controls and non-colour critical
   status. A rejection/unsupported result validates only the in-app fallback.

## Result determination and review

For each row, attach raw trace locations and SHA-256 values, then calculate
thresholds from raw measurements. Explain any regression above 10%; do not
average away a missed threshold. The independent Reviewer checks build/fixture
identity, row isolation, raw hashes, the calculation and the recovery proof.

| Result | Meaning |
| --- | --- |
| `PASS` | All required traces, budgets, no crash/input/Durable Revision loss and complete Focus row are independently reviewed. |
| `FAIL` | Any required threshold, recovery or integrity condition fails. |
| `PAUSED` | A trace, accountable role, raw link or review is missing. |

Copy only the final status and immutable references to
`physical-device-trace.md` and the evidence register. Keep raw performance
artifacts in the approved restricted evidence system.


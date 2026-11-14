---
title: "S-4 Amendment B — independent terminal review"
spike: S-4
work_package: W-SPK-2026-08-04
waiver: W-SPK-2026-08-04
review_type: post-amendment-b-independent-read-only
reviewer: "Codex /root/ownership_readiness_review"
reviewed: 2026-08-05
scope: "Amendment B synthetic Focus-history and active-preview evidence; waiver prototype and evidence roots only"
verdict: PAUSED
terminal: true
promotion_authorized: false
cleanup_authority: "waiver §5; required after terminal disposition, not executed by this reviewer"
cleanup_executed: false
readiness_claimed: false
device_claimed: false
native_fullscreen_claimed: false
source_mutations: none
---

# S-4 Amendment B — independent terminal review

## Terminal disposition

**`PAUSED` (terminal for S-4 under `W-SPK-2026-08-04`).**

The bounded Amendment B browser evidence is adequate for its actual question:
the synthetic in-app Focus flow preserves non-empty confirmed undo/redo state
and an active preview/cancel path across enter and exit.  It closes the bounded
synthetic gap `S4-FOCUS-POST-01` from the Amendment A review.

It is **not** a `PASS`.  The work package makes `PAUSED` mandatory without
participant recordings, physical-device task evidence and an independent
`G-1 PASS`; browser emulation cannot substitute for them.  This disposition
does not authorize product promotion, `READY`, a PWA/mobile performance claim,
physical iPhone/Samsung support, safe-area/keyboard evidence or native
fullscreen behavior.

## Independent checks

| Check | Result | Evidence |
| --- | --- | --- |
| Ordinary browser regression | **PASS** | I ran `npm test` in the waiver-approved S-4 prototype root: **9/9 Playwright tests passed in 4.4 s** using the configured WebKit/iPhone-13 descriptor. |
| Confirmed-history Focus proof | **PASS within synthetic scope** | `tests/s4-touch.spec.mjs:234` creates `3050 мм`, enters/exits Focus, performs undo to `2400 мм`, re-enters/exits with redo non-empty, then redoes to `3050 мм`. The relevant enabled undo/redo controls are asserted on both sides of Focus. |
| Active-preview Focus proof | **PASS within synthetic scope** | `tests/s4-touch.spec.mjs:265` creates `3200 мм` preview while confirmed value remains `2400 мм`, enters/exits Focus, keeps preview text and enabled Cancel, then cancels to `2400 мм` with no undo entry. |
| Focus implementation boundary | **PASS** | `app.js:230–238` changes `focusLayout`, `numericPanelOpen` and status message only; it does not write confirmed wall length, history, redo, preview, gesture or pointer state. The browser tests above, not static inspection alone, prove the intended observable outcomes. |
| Captured trace and screenshot | **PASS as synthetic browser evidence** | The retained trace records the active-preview sequence: pointer down/move → `3200 мм` preview → enter Focus → screenshot → exit Focus → Cancel → `2400 мм` confirmation. Visual inspection of the screenshot shows in-app Focus, confirmed `2400 мм`, visible `3200 мм` preview and available Cancel. |
| Reported raw hashes | **PASS** | SHA-256 matches all five listed Amendment B artifacts: Playwright last-run JSON, screenshot, trace, mutation JSON and mutation HTML. The copied mutation JSON/HTML match the current S-4 raw reports byte-for-byte. |
| Full-file mutation accounting | **PASS as accounting; not quality promotion** | Parsed raw Stryker JSON has one target, `app.js`, and exactly `306 = 188 Killed + 110 Survived + 8 Timeout`; no NoCoverage, RuntimeError or CompileError records. `(188 + 8) / 306 = 64.052…%`, correctly reported as **64.05%**. |
| Scope / non-goal boundary | **PASS** | The executable inventory remains inside the waiver root. `app.js`, HTML and CSS match the retained mutation/trace snapshots; current suite has the former seven cases plus exactly the two Amendment B scenarios. No native Fullscreen API, service worker, storage API, external request or non-loopback runtime path was found. |

The browser context is still Playwright WebKit with the `iPhone 13` descriptor,
`390×844` CSS px, DPR 3, `isMobile: true` and `hasTouch: true`.  It is an
emulated browser context—not iPhone hardware, iOS Safari, Home Screen PWA,
Samsung/Android, real safe-area/keyboard behavior, actual touch hardware or a
native Fullscreen result.

## Evidence integrity and limits

The mutation result is correctly reported but remains **negative quality
evidence**: 110 survivors and 8 timeouts mean it cannot be treated as strong
mutation confidence or as a basis for promotion.  This does not negate the
two direct functional scenarios; it limits what may be inferred beyond them.

The evidence chain is strong enough for this terminal `PAUSED` disposition:

- the mutation report's embedded `app.js` source equals the current
  waiver-root `app.js`;
- trace snapshots equal the current test, HTML and CSS files; and
- `app.js`, HTML and CSS have pre-Amendment-B timestamps while the test file
  contains the two new final scenarios at lines 234 and 265.

There are two provenance limits, neither of which changes the terminal result:

1. the retained Playwright last-run JSON records only `status: passed` and no
   failures; it is not a standalone transcript proving the owner's precise
   “9/9 before and after mutation” timing.  My independent replay establishes
   the current ordinary **9/9** result;
2. both waiver roots are untracked and retain no pre-Amendment-B baseline
   diff.  The claim that only the two scenarios changed is corroborated by
   snapshots, timestamps and current source inspection, but cannot be proven
   historically beyond that retained evidence.

The older Amendment-A-only rows in the owner report's `Limits blocking PASS`
table and the seven-test automation summary are historical evidence.  They do
not describe the two new Amendment B scenarios and are superseded for this
terminal review by the checks above; no owner report was edited here.

## Residual blockers — exact boundary

`PAUSED` is required because the following **PASS/readiness** evidence is still
absent:

1. assigned-participant task recordings on physical iPhone and Samsung
   contexts;
2. the separate independent `G-1` participant-research `PASS`;
3. physical browser/PWA/context evidence needed for any phone-support or
   NFR-15 claim, including real touch, safe-area, virtual-keyboard and
   browser/system-chrome observations; and
4. any separately scoped native Fullscreen capability/request/exit evidence.

Item 4 is deliberately outside this S-4 amendment; it is listed to prevent an
in-app Focus result from being misread as native fullscreen support.  The
64.05% mutation result is a further residual quality limitation, not a
substitute for any of the evidence above.

## Cleanup authority and restrictions

Because this is a **terminal `PAUSED`** disposition, waiver §5 now authorizes
and requires the S-4 cleanup path.  This reviewer performed **no deletion**.
An appointed cleanup owner must retain only the waiver-allowed evidence
(applicable ADR if one exists, versioned corpus, raw/derived traces without
personal Project content, and the evidence reports), delete the S-4 prototype
root's source, manifests/lockfiles, dependencies, generated output, caches and
other implementation artifacts, and record that cleanup in the terminal
evidence record.

Cleanup authority is limited to the exact S-4 waiver roots.  It does not
authorize a commit, product promotion, copying the prototype into a product
root, editing another spike, or treating the retained browser evidence as a
future application test suite.  Any future S-4 implementation or experiment
requires a new written authorization and its own independent review.

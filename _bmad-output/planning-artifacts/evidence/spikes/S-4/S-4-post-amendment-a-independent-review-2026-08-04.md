---
spike: S-4
work_package: W-SPK-2026-08-04
waiver: W-SPK-2026-08-04
review_type: post-amendment-a-independent-read-only
reviewer: "Codex /root/architecture_door_semantics"
reviewed: 2026-08-04
scope: "S-4 waiver prototype and evidence only"
verdict: PAUSED_NEEDS_FURTHER_S4_EVIDENCE
promotion_authorized: false
readiness_claimed: false
device_claimed: false
native_fullscreen_claimed: false
---

# S-4 post-Amendment A independent review

## Disposition

**`PAUSED — needs further S-4 evidence`.** The Amendment A prototype remains
inside the waiver boundary and its reported ordinary regression, raw mutation
counts and hashes are reproducible. It does **not** authorize `READY`, cleanup,
promotion, production implementation, a device/performance claim or a native
Fullscreen claim.

The reason for `needs further S-4 evidence`, rather than a post-amendment
`PAUSED confirmed`, is one bounded test-evidence gap below. It does not change
the mandatory terminal status: participant recordings, physical iPhone/Samsung
contexts and `G-1 PASS` remain absent.

## Independent checks

| Check | Result | Evidence |
| --- | --- | --- |
| Ordinary regression | PASS | Reviewer ran `npm test` in the S-4 prototype root: **7/7** Playwright WebKit tests passed in **3.5 s**. |
| Configured browser context | Confirmed | `iphone-like-touch`: iPhone 13 descriptor, `390×844` CSS px, DPR 3, `isMobile: true`, `hasTouch: true`. This is emulation only. |
| Focus implementation | Confirmed | `app.js` changes only `focusLayout` and `numericPanelOpen` in the Focus handler; it does not call the native Fullscreen API and does not directly mutate the synthetic wall value, history, mode or gesture. |
| Focus browser assertions | Confirmed within their stated scope | The seventh test checks direct in-app entry/exit, `data-focus-layout="in-app"`, critical visible controls, enlarged canvas, numeric return path and rectangle non-overlap with `.history-bar`. |
| Mutation raw JSON | PASS | `mutation.json` contains exactly **306** mutants: **190 Killed**, **115 Survived**, **1 Timeout**, zero NoCoverage/runtime/compile errors. Stryker reports 191 detected / 306 valid = **62.41830065359477%**, correctly rounded to **62.42%**. It mutates only `app.js`. |
| Reported SHA-256 | PASS | Raw JSON, HTML and Focus screenshot hashes below exactly match the evidence report. |
| Screenshot semantics | Confirmed | Visual inspection shows an in-app Focus layout with explicit exit, status, modes, canvas, numeric return control and history rail. It is an emulated viewport capture, not a physical iPhone/Safari/PWA/native-fullscreen trace. |
| Waiver boundary | PASS | Executable/configuration files are contained in the S-4 prototype root; no production-source implementation file exists outside `_bmad-output`. The work remains synthetic and local. |

### Verified hashes

| Artifact | SHA-256 |
| --- | --- |
| `artifacts/stryker-report/mutation.json` | `6b7294aacd5cbb95cabe3105b9b717b72a7533b808a044f3cac9a2fe90a777b1` |
| `artifacts/stryker-report/mutation.html` | `773f08ceee1af03614ae924644f0de933378c15a8cbac975bb824a5513495781` |
| `screenshots/s4-focus-in-app-iphone-like-2026-08-04.png` | `b743a79091da2c7f6c6799c280adc9e7b8de128278fa79aded937ac2b86a89e5` |

## Finding

### S4-FOCUS-POST-01 — Focus test does not exercise preserved non-empty history or active preview

**Severity:** Medium — bounded synthetic evidence gap; no production finding.

**Evidence.** The seventh Playwright test starts with wall value `2400`, empty
history and an idle gesture. It enters/exits Focus and submits the same `2400`
numeric value, which is intentionally a no-op. It therefore proves the visible
layout and no-op wall value, but does not browser-observe that a non-empty
undo/redo history or active preview survives entry and exit. The current
`app.js` handler does not mutate those state fields, but static inspection is
not the stated behavioral proof in Amendment A acceptance check 2.

**Bounded follow-up, only if separately authorized within S-4:** add a
test-first scenario that (a) creates a confirmed non-default length, enters and
exits Focus, then proves undo/redo still restores the expected values; and (b)
holds a synthetic preview while invoking the named Focus control, then proves
the preview/cancel path is retained. Rerun the ordinary 7+ regression and the
full `app.js` mutation command, retain raw artifacts and keep `PAUSED`.

## Truthfulness and remaining gates

- The evidence report and automation summary correctly state that WebKit/iPhone
  descriptor evidence is not physical iPhone hardware, iOS Safari, Home Screen
  PWA, Android/Samsung, safe-area/keyboard, performance or user-research
  evidence.
- No `requestFullscreen`, `exitFullscreen`, `fullscreenchange` or
  `fullscreenerror` use exists in the executable S-4 files. The claim is
  correctly limited to **in-app Focus**, never control over browser/system
  chrome.
- `115` surviving mutants and one timeout remain negative quality evidence;
  no score threshold or quality promotion claim is made.
- `G-1`, participant task recordings and all required physical-device evidence
  remain pending. They cannot be substituted by this review or by Playwright.

## Reviewer conclusion

Retain every S-4 artifact in its waiver roots. Do not promote, clean up, merge
into a product root, claim native fullscreen/device support or change the
implementation-readiness state. The only action suggested by this review is
the bounded additional synthetic assertion above, contingent on separate owner
authorization; otherwise S-4 remains paused with this gap recorded.

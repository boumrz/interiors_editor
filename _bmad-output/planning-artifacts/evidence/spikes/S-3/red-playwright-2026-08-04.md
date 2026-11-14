# S-3 RED evidence — Playwright offline shell

Date: 2026-08-04. Owner: `Codex /root/spike_s3_storage`.

> **Historical-record availability correction — Follow-up C–H.** This document
> preserves the first-run RED description. In the current audit, neither raw
> file named below exists at its recorded path, so the screenshot and
> error-context are **not retained or replayable**. The old 3-passed/1-failed
> result is historical provenance only, not a current-source result. The
> current-source test and mutation record is documented in
> `S-3-evidence-report-2026-08-04.md` and
> `trace-manifest-2026-08-04.md`.

Command (from the isolated S-3 prototype root):

```sh
PLAYWRIGHT_BROWSERS_PATH=0 S3_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test
```

Result before the network-probe correction: **3 passed, 1 failed**.

The failed test was `a previously loaded app shell remains visibly usable when
browser context goes offline`. The cached shell reloaded, but the visible
network label remained `online` after `context.setOffline(true)`. The failure
was intentional RED evidence for the existing assertion; the underlying cause
was that the experimental UI relied on `navigator.onLine`, which did not
reflect this controlled offline state after service-worker reload. The failure
trace and screenshot remain inside the isolated prototype root:

- `test-results/durability-a-previously-lo-d68b7-rowser-context-goes-offline/test-failed-1.png`
- `test-results/durability-a-previously-lo-d68b7-rowser-context-goes-offline/error-context.md`

The same run also reported a non-behavioural Playwright reporter-directory
configuration warning; the HTML report output was subsequently moved outside
the test result directory. Neither issue affects product code: this is an
experimental, synthetic-only evidence harness.

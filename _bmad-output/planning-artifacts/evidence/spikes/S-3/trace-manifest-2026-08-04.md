# S-3 trace manifest — 2026-08-04

Owner: `Codex /root/spike_s3_storage`. Status: `review-pending`.

> **Historical first-run manifest.** The table immediately below is retained
> unchanged for provenance. Its test counts, mutation hash, screenshot hash,
> and statement about RED raw files do not describe the current source. See
> **Follow-up C–H — current-source manifest** below for the authoritative
> current-run record.

| Artifact | Location | SHA-256 / result |
| --- | --- | --- |
| Work package | `work-package.md` | Assignment and waiver boundary recorded before prototype code. |
| RED analysis | `red-playwright-2026-08-04.md` | Initial offline-label test: 3 passed, 1 failed; original failure files remain in allowed prototype `test-results/`. |
| Green screenshot | `screenshots/s3-durability-green-demo.png` | `9f2b947f53fec22161bf8c66e8a925940371d7dd49ffc4e7821e7bd0c5d323b5` |
| Final behavior suite | prototype `npm test` | 23 Vitest + 4 Playwright passed. |
| Final Stryker JSON | prototype `artifacts/mutation/mutation.json` | `87c32772cbce07f0b5b44204e5d61cf2c37acf3e1d0f5a488645e4b0ba64aff2`; 346 killed / 74 survived / 17 no coverage. |
| Final Stryker HTML | prototype `artifacts/mutation/index.html` | Same report run as JSON. |
| Prototype lockfile | prototype `package-lock.json` | `4a1a29b511b33153c07cb2e26cf0c4c586ae3c5ddd626c74114a2923afd15d79` |

All paths called “prototype” are beneath the sole waiver-approved root
`_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-3/`.
They are deliberately not product artifacts and must be deleted only after
independent-review confirmation of the `PAUSED` terminal result.

## Follow-up C–H — current-source manifest — 2026-08-04

**Current status: `needs-further-evidence`.** The waiver remains active, and
this synthetic prototype may not be cleaned up, promoted, or copied into
product source. This section records the source after the C–H follow-up work;
it replaces the first-run numbers above for current-source verification only.

### Verification boundary

- Environment: desktop Google Chrome `150.0.7871.187`, Node `v22.8.0`, npm
  `10.8.2`.
- The root reviewer independently replayed `npm test` in the exact S-3 root:
  **63/63 Vitest** and **10/10 Playwright** tests passed.
- `npm run mutation` is configured to mutate **only** `src/durability.mjs`.
  The implementation owner reported no errors or timeouts. The root review
  regenerated and inspected the JSON result, but did not retain a direct
  mutation-process exit status in its command wrapper.
- The scope is a controlled desktop synthetic durability harness. It supplies
  no product, physical-device, or mobile-performance conclusion.

| Current artifact | Location | SHA-256 / result |
| --- | --- | --- |
| Durability source | prototype `src/durability.mjs` | `a6575440c81c22e65c92e79ce704b6a642e3af00ee4295c43d108eb9a28de93c` |
| Synthetic UI source | prototype `src/app.mjs` | `393b2cd59a73f34f1f5d9b32ac51394d5edac91ede9775ed48228468b50bf02c` |
| Unit tests | prototype `tests/unit/durability.test.mjs` | `1e061891d1f472119630fb5dfc3d2d871f2d5bcc80facf70777c9bb71ffd1c1a` |
| Playwright tests | prototype `tests/e2e/durability.spec.mjs` | `e768b0e884ca4947ddecbfca4a3b6c2739730874d43c0f07b9b7850dcf14b362` |
| Behaviour suite | prototype `npm test` | 63 Vitest + 10 Playwright passed in root replay. |
| Mutation JSON | prototype `artifacts/mutation/mutation.json` | `c46aebf9925cc62d4a01470a541a296685539b03fbb591f1f194d7a3c3775d47`; 915 total / 761 killed / 129 survived / 25 no coverage; 83.17% total, 85.51% covered-code. |
| Lockfile | prototype `package-lock.json` | `4a1a29b511b33153c07cb2e26cf0c4c586ae3c5ddd626c74114a2923afd15d79` |
| Current planning-evidence screenshot | `screenshots/s3-durability-green-demo.png` | `803b3bf1b9aaa3e333778ee92a295fa9c3ccc985d44f3399c790d3a3bff5150d` |
| Mobile-sized desktop checkpoints | prototype `artifacts/visual-checkpoints/followup-{e,f,g}-*.png` | `956c06d67a8d6ed2249960c29425694404c640df1acb8a0a6606575fe1ca7ad1`; `133d6134fc3c3d62000d31690df0f7c36fdd3d736c4f2dd4f5562c4d81f68562`; `df2b6668e025e009613687af1d9c7224aa8a3f9b012c664f3a305055ad5a577c`; `ca39e03d626f2a62bbe8cf94c90f2c5ac648703262bb4884a1064bff8e24534e` |

The first-run **23 + 4** test result and **346 / 74 / 17** mutation result
are stale historical records. The RED screenshot and error-context paths named
in the first-run table are absent in the current audit, so they are not
available for replay. See the amended RED record for the retained historical
description and availability correction.

### Remaining evidence boundary

The current record leaves open all physical NFR-15 contexts (iPhone 13 mini
Safari tab and Home Screen; iPhone 17 Safari tab and Home Screen; Galaxy A53
Chrome tab and installed PWA; Galaxy S26 Chrome tab and installed PWA), real
mobile kill/relaunch and operating-system/origin eviction, quota pressure,
migrations and rollback, safe update activation/reload, browser-to-Home-Screen
portable backup transfer, and WebGL/performance/thermal traces.

## Evidence-integrity closeout replay — 2026-08-05

**Authoritative closeout replay status:
`awaiting-amended-independent-terminal-review`.** This new record preserves
the C–H current source and adds raw command outputs, captured exit status,
first-green-run Playwright traces, and mutation report copies. It does not
replace the `PAUSED` recommendation or authorize cleanup.

| Closeout artifact | Location | SHA-256 / result |
| --- | --- | --- |
| Source integrity before replay | `replay-2026-08-05/raw/source-hashes-before.txt` | `8f434b2d353a44e4ba9dd8a5994a2d6e207bc33118871d6265d1491b6192765d` |
| Source integrity after replay | `replay-2026-08-05/raw/source-hashes-after.txt` | `8f434b2d353a44e4ba9dd8a5994a2d6e207bc33118871d6265d1491b6192765d`; byte-identical to before |
| Unit terminal output | `replay-2026-08-05/raw/unit.raw.txt` | `f4d8e805490ce5f0d862d2fed5a8e8e6fab317bad3c7322c92d959ea5be62bbe`; `npm run test:unit`, exit 0, 63/63 passed |
| Playwright terminal output | `replay-2026-08-05/raw/e2e.raw.txt` | `ff6db73cc03d49edd83cfa92a5cf97d478ad8ba0da42d741584fd20360d06184`; explicit `--trace on`, exit 0, 10/10 passed |
| First-green-run trace set | `replay-2026-08-05/playwright-results/` | 10 `trace.zip` files; individual checksums in `raw/playwright-trace-sha256.txt` (`5f1c6661a0fdb20130fc841235f34cb2c136c607594dafa6f39a0a7b17f9d94e`) |
| Mutation terminal output | `replay-2026-08-05/raw/mutation.raw.txt` | `c56728379f9e380205c2d0072115c6dcf8fa0c6ee8c80e17669807a4928a31af`; `npm run mutation`, exit 0, 915 / 761 / 129 / 25 |
| Mutation JSON copy | `replay-2026-08-05/mutation.json` | `3e33860bcbc6afa261b24736c7ca67b1f77530a57fafa8bbd6e0b210d3fe4dc0` |
| Mutation HTML copy | `replay-2026-08-05/mutation.html` | `632153aafe5610bafebf3ceaea7514888a7c13801f0c1005de107e35a6679ac6` |

The replay found no source defect and made no source/test change. It is
desktop Chrome synthetic evidence only, leaving every physical-device and PWA
lifecycle gap listed above open. An independent reviewer must now amend the
terminal review decision; until then the waiver and no-cleanup rule remain in
force.

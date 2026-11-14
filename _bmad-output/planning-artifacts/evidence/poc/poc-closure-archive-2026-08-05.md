---
title: "W-POC closure and archive manifest"
date: 2026-08-05
waiver: W-POC-2026-08-04
status: retired-from-runtime
superseded_by: "Story 1.1 production composition root"
---

# W-POC closure/archive — 2026-08-05

## Disposition

The Product Owner's production waiver dated 2026-08-05 authorizes Story 1.1
to replace the bounded POC runtime surface. `W-POC-2026-08-04` is therefore
**retired from runtime**, not promoted to product code and not accepted as a
release. Its original handoff remains immutable evidence at
[`phone-editor-poc-handoff-2026-08-04.md`](phone-editor-poc-handoff-2026-08-04.md).

The former POC delivery surface has a byte-for-byte non-runtime source,
configuration, test and lockfile snapshot at
[`archive-2026-08-05/snapshot/`](archive-2026-08-05/snapshot/); its independent
verification manifest is
[`ARCHIVE-MANIFEST.md`](archive-2026-08-05/ARCHIVE-MANIFEST.md). Original
screenshots remain non-runtime documentation and their hashes are retained
below. Production source, tests and configuration are required to have no
production dependency on `src/poc`, `tests/poc`, `S-*`, POC labels,
synthetic demo state or this record. No `node_modules`, build output, reports,
caches or generated bundles are archived here.

## Archive manifest

The following is the exact pre-replacement hash inventory captured before the
production entry/configuration changes. Source hashes agree with the 2026-08-04
handoff. `docs/poc/README.md` and the two original captures were subsequently
refreshed during the POC checkpoint, so this closure preserves their observed
current hashes rather than silently claiming the earlier values.

| Evidence path | SHA-256 |
| --- | --- |
| `apps/web/src/main.tsx` | `7adfb379aecfceb89440af39cd0aa1994129d367651527a7065eb3b3b03af663` |
| `apps/web/src/poc/PocApp.tsx` | `c071399c655f6e1cf14304479bc1edfecbaf894da1157c23e6896723cda285c2` |
| `apps/web/src/poc/PocApp.module.css` | `001456f07f1c6baef9411f987021e880de2654750083b1e2de577673b212d737` |
| `apps/web/src/poc/editor-state.ts` | `dd5aaef6eadf26de944d639ab74b04f47f3ab645dbe8fea88c819733fd185caa` |
| `apps/web/src/poc/editor-state.test.ts` | `30a77b9c084e20b01907c7e271535badef435478525d2fbf13a69a975fff7c00` |
| `apps/web/src/poc/styles.d.ts` | `c4387a8b3a19464901ad321d481b8a0d4ee5f963411e68273f98d180f2fe4641` |
| `apps/web/tests/poc/e2e/phone-flow.spec.ts` | `28dda3bc17d65b934217ab35faed2505aaed78559fb769d6e6bc3e1e17aa6856` |
| `docs/poc/README.md` | `cc24b38b6d0ac244d4e603b75f9af3a98a9d41a9658794e890cc14a8c52f6446` |
| `docs/poc/screenshots/phone-poc-initial.png` | `4765b6c4c94c1d60156f12b592f9c08447bb4db42a1c3e6f68799d18af04d4fc` |
| `docs/poc/screenshots/phone-poc-focus.png` | `4ffebb565be85d31228374be6c21464f160ea96f3c745bf1a328a55b0c9246f2` |

The previous handoff already preserves the complete POC delivery manifest,
versions, checks, capture provenance and known-gap list. This closure records
the boundary transition only; it does not renew POC verification or convert any
POC evidence, readiness gate, physical-device result or release claim to PASS.

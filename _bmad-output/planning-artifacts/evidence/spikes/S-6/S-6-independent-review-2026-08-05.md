---
title: "S-6 — independent review"
date: 2026-08-05
spike: S-6
reviewer: "Codex /root/gcp_decision_research"
owner: "Codex /root"
waiver: W-SPK-2026-08-04
verdict: PAUSED
---

# S-6 — independent review

## Verdict

**PAUSED.** The isolated harness is reproducible and correctly remains marked
`BLOCKED_SYNTHETIC_FIXTURE`, but it has three policy-bypass findings and cannot
become `PASS` under the active waiver. No real human `AssetUsageGrant`, real
catalog corpus, or physical NFR-15 device evidence exists. This review does
not make any product, Kotlin/PostgreSQL, PWA, device, or legal claim.

## Scope and method

- Read: `W-SPK-2026-08-04`, the S-6 work package, and owner evidence report.
- Inspected only the exact S-6 prototype root and S-6 evidence root.
- Replayed commands with CWD
  `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/`.
- Performed a separate read-only edge-case pass over the policy seam.
- Did not manually edit owner source, tests, manifests, lockfile, or owner
  report. The requested coverage/mutation commands regenerate their configured
  transient output beneath the permitted prototype root.

## Independent replay

| Command | Result |
| --- | --- |
| `npm test` | PASS: Vitest **17/17**; mobile-sized local Playwright **2/2** |
| `npm run test:coverage` | PASS: `catalog-policy-core.mjs` — statements **39/39**, branches **33/33**, functions **9/9**, lines **35/35** |
| `npm run mutation` | PASS: **118/118 killed**, 0 survived, 0 errors, mutation score **100%** |
| `npm audit` | PASS: `found 0 vulnerabilities` |

The browser flow uses the declared 390×844 touch-enabled Chromium context and
the local `127.0.0.1` static server. It is browser regression observation,
not physical iPhone/Samsung, PWA-install, WebGL2, thermal, or performance
evidence.

## Boundary inspection

The application/test source has no `fetch`, XHR, WebSocket, EventSource,
external HTTP client, DNS, or network request. The only HTTP URLs found in
source/configuration are the declared local `127.0.0.1` server and Playwright
navigation. `package-lock.json` naturally contains npm registry resolution
URLs, and the separately requested `npm audit` is a developer diagnostic; its
green result is not evidence that the audit command itself made no advisory
network request. No non-synthetic 3D/texture asset was found in the reviewed
source surface.

## Findings

### H-1 — Project-shaped data can bypass the synthetic control-plane boundary

`hasProhibitedField` checks only six exact *top-level* keys
(`project`, `projectId`, `revision`, `revisionId`, `history`,
`portableBackup`) at
[`catalog-policy-core.mjs`](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/src/catalog-policy-core.mjs#L2-L23).
It neither uses an allow-list nor walks nested data. The following independent
direct-core replay returned `EXPERIMENTAL_READY`:

- `{ projectData: { id: 'not-listed' } }`;
- `{ provenance: { ..., projectId: 'nested-not-checked' } }`.

That conflicts with work-package condition 5 and the owner report's broad
statement that Project-shaped data is rejected. The existing unit test proves
only the six named top-level fields
([test lines 190–200](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/tests/unit/catalog-policy.test.mjs#L190-L200)).

**Required resolution before any future PASS claim:** use a strict schema or
allow-list for the experimental descriptor and add nested/unlisted forbidden
payload tests. This is a policy-harness finding, not permission to implement
product code.

### H-2 — “Exact hash and byte length” are not structurally validated

The resource guard requires only a truthy `sha256`, truthy `mediaType`, and an
integer `byteLength`; it neither requires a 64-hex SHA-256 digest nor a
non-negative/positive size
([lines 50–57](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/src/catalog-policy-core.mjs#L50-L57)).
Because the exported core function accepts omitted `resourceDigest` and
`resourceByteLength`, a descriptor and `pinnedResource` that both contain
`sha256: 'a'` and `byteLength: -1` returned `EXPERIMENTAL_READY` in the
independent replay. The wrapper computes a digest only for a primitive string,
so a `Buffer`/`Uint8Array` resource also reaches the core without verifier
values.

This contradicts the work package's claim that exact hash and byte length are
required before experimental pin readiness. The green wrapper tests calculate
a SHA-256 only when a string `resourceBytes` is supplied
([`catalog-policy.mjs` lines 7–13](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/src/catalog-policy.mjs#L7-L13)); the direct-core/browser seam remains reachable.

**Required resolution before any future PASS claim:** require a validated
SHA-256 format, a valid byte range, and a verifier result for every ready
state; add boundary tests for malformed/negative values and absent verifier
inputs.

### H-3 — Grant, provenance, and notice checks are only shape-level

The harness accepts `requiredNotices: ['']`, because it checks only a nonzero
array length ([lines 47 and 55](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/src/catalog-policy-core.mjs#L47-L55)). It similarly requires only
three policy strings and truthy provenance fields
([lines 10–14 and 28–29](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/src/catalog-policy-core.mjs#L10-L29)), rather than modelling the
waiver's full seven-use-right scope and every required notice placement.

This is enough to demonstrate a tiny synthetic shape check, but not the
owner-report claim that required notices/provenance are generally enforced.
It must not be cited as proof of a complete `AssetUsageGrant` policy.

**Required resolution before any future PASS claim:** validate the full,
human-approved grant/notice schema and every placement; add empty/invalid
notice and incomplete-rights tests. The actual grant evidence remains a human
gate even after a synthetic schema passes.

### M-1 — Evidence links and mutation hash are not stable after replay

The owner report links
`screenshots/s6-catalog-synthetic-mobile.png` below the S-6 evidence root, but
that file is absent there. The existing file is still a transient prototype
artifact at `S-6/artifacts/screenshots/…`; its SHA-256 matches the value in the
owner report but the Markdown link is broken.

The lockfile hash remains
`d998924a7ab280a155019ff405b323ad2042d916aa5ed6e50870d30031bb4aa7`, but the
freshly regenerated mutation JSON hash is
`a21d61fbb79ff09704dd219fdc1746e255887ef5d3c90e8c5ac6319001b7c879`, not the
owner report's earlier `e7e7…1597`. The report therefore cannot presently be
replayed by hash as written. This is an evidence-integrity issue; it does not
invalidate the observed 118/118 result.

**Required resolution:** before terminal archival, copy any allowed synthetic
trace into the evidence root, update its stable manifest/hash, and record that
Stryker output is regenerated/non-deterministic if that is expected. Do not
retain the screenshot only in the prototype root, because waiver §5 requires
prototype cleanup after terminal status.

## Still-blocking non-code evidence

- Human `AssetUsageGrant`: **PENDING**. The synthetic string/descriptor does
  not prove licence, provenance, subresource, optimization, backup, private
  transfer, PNG, or notice rights.
- Representative permitted catalog corpus and notice/provenance ledger:
  **absent**.
- Physical NFR-15 contexts and device-budget measurements: **absent**.
- `G-CP-ADR` and any Kotlin/PostgreSQL API/schema/deployment evidence:
  **not in scope and absent**.

## Cleanup implications

The S-6 root is disposable. Once its terminal disposition is recorded, retain
only allowed evidence/corpus/ADR material under the planning evidence path;
remove the prototype source, lockfile, `node_modules`, coverage, reports,
test-results, and transient screenshots from the prototype root as required by
waiver §5. Nothing from this spike may be copied into product code.

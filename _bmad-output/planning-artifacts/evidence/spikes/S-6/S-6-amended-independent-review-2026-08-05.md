---
title: "S-6 — amended independent review"
date: 2026-08-05
spike: S-6
reviewer: "Codex /root/gcp_decision_research"
owner: "Codex /root"
waiver: W-SPK-2026-08-04
verdict: PAUSED
supersedes: S-6-independent-review-2026-08-05.md
---

# S-6 — amended independent review

## Verdict

**PAUSED.** The owner remediation fixes several ordinary JSON-shaped cases and
the requested automated replay is green, but three residual boundary gaps
still allow `EXPERIMENTAL_READY` in the exact S-6 harness. `PASS` is in any
case impossible under the active waiver: no human `AssetUsageGrant`, permitted
representative corpus, or physical NFR-15 device evidence exists.

This is a review of a disposable synthetic experiment only. It makes no
product, Kotlin/PostgreSQL, PWA-install, physical-device, performance, asset,
or legal-rights claim. The synthetic field names used in the negative replays
below are not real Project data.

## Scope and method

- Read the active waiver, the remediated S-6 work package, the owner evidence
  report, and the first independent review.
- Inspected only the authorised prototype root
  `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/` and
  evidence root `_bmad-output/planning-artifacts/evidence/spikes/S-6/`.
- Replayed the requested commands from the prototype root and performed
  separate read-only direct-core/wrapper probes.
- Did not edit owner source, tests, manifests, lockfile, or evidence report.
  Coverage, Playwright and Stryker created their configured transient output
  only under the disposable prototype root.

## Exact replay

| Command | Independent result |
| --- | --- |
| `S6_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm test` | PASS: Vitest **28/28**; local mobile-sized Playwright **2/2**. |
| `npm run test:coverage` | PASS: `catalog-policy-core.mjs` **80/80 statements**, **86/86 branches**, **19/19 functions**, **75/75 lines** (100% each). |
| `npm run mutation` | PASS at configured threshold: **295 killed**, **1 timeout**, **0 survived**, **0 no coverage**, **0 errors**, 100.00% score. The timeout is mutant 98, which removes the `WeakSet` cycle-return guard (line 54–56) and reaches its 101/100 limit. |
| `npm audit && npm audit --omit=dev` | PASS: both commands returned `found 0 vulnerabilities`. |

The browser observations use the declared 390×844 touch-enabled desktop
Chromium context and a server bound to `127.0.0.1`. They are regression
observations, not physical iPhone/Samsung, PWA-install, WebGL2, thermal, or
performance evidence.

## Confirmed remediation

- Own enumerable nested `projectId`/`projectData` and unlisted ordinary fields
  are rejected by the recursive prohibited-key check and the allow-list.
- The wrapper verifies a literal string, `Buffer`, and `Uint8Array`; an exact
  `Uint8Array` reached `EXPERIMENTAL_READY`, an altered one returned
  `RESOURCE_HASH_MISMATCH`, and unsupported `DataView` bytes returned
  `RESOURCE_VERIFIER_MISSING`.
- The ordinary malformed SHA-256, zero/negative byte length, partial verifier,
  blank notice, empty placement, malformed provenance, and incomplete policy
  fixtures are rejected by the covered unit suite.
- The original broken evidence links are now present. SHA-256 checks match the
  owner report: lock trace
  `d998924a7ab280a155019ff405b323ad2042d916aa5ed6e50870d30031bb4aa7`, mutation
  snapshot `822aa8d201bfad76f3f202c93589714240ec8edb4aafd0b7c8d18aba05e8fde9`, and
  screenshot `e2f05308231e28d6d3ecc53610593d8f9728f405240ef5a3165424f9f7134d69`.

The freshly regenerated prototype mutation JSON has a different hash
(`7d2e162810217c140f88f7c5284bb39bcb015291622a3be7ebbdfa75f143f72c`) but the
same `295 Killed` / `1 Timeout` counts. The dated evidence-root copy therefore
resolves the prior broken-link problem; the transient run output remains
non-hash-stable as the owner report says.

## Residual findings

### H-1R — Project-shaped fields still bypass inherited and non-enumerable paths

[`catalog-policy-core.mjs`](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/src/catalog-policy-core.mjs#L50-L76)
walks only `Object.entries` and validates only `Object.keys`. Both omit
inherited and non-enumerable properties. The following valid-looking synthetic
descriptors each returned `EXPERIMENTAL_READY` with an empty `reasonCodes`
array when supplied with a matching pin and metadata verifier:

```js
Object.assign(Object.create({ projectId: 'hidden-top-level' }), base())

descriptor.provenance = Object.assign(
  Object.create({ projectData: { rooms: 3 } }),
  descriptor.provenance,
)

Object.defineProperty(descriptor.provenance, 'projectId', {
  value: 'hidden-own', enumerable: false,
})
```

The first remediation protects ordinary parsed own fields, but it does not
meet the work package's untrusted-input/strict-schema statement at this direct
JavaScript seam. Before a subsequent amendment, require accepted records to
have an allowed prototype and inspect own property names (including
non-enumerable ones), then add red/green tests for all three cases.

### H-2R — The visible UI has no byte verifier despite claiming local verification

The verified wrapper is materially improved, but
[`public/app.mjs`](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/public/app.mjs#L3-L6)
contains only static hash/length metadata and imports the low-level
[`evaluateCatalogManifest`](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/public/app.mjs#L55-L60)
directly. Its `Pin exact bytes` handler only sets `state.pinned = true`
([lines 77–80](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/public/app.mjs#L77-L80)); no raw
`synthetic-chair-v1` bytes reach `createHash` in this browser flow.

Accordingly, a direct-core replay with the descriptor's static hash/length
passed as `resourceDigest`/`resourceByteLength`, but without resource bytes,
returned `EXPERIMENTAL_READY`. The mobile screenshot also displays “sha256
verified locally”, which this path has not actually demonstrated. This does
not invalidate the wrapper unit proof; it means the visible E2E flow is only a
metadata-state transition, not an end-to-end byte-verification observation.

Before a subsequent amendment, the UI must call the verified-byte seam (or be
given a separately trusted, observable pin-verifier result) and its Playwright
test must prove both the exact and altered-byte branches.

### H-3R — Sparse notice arrays satisfy `every` without a notice or placement

[`hasValidNotices`](../../../../implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/src/catalog-policy-core.mjs#L88-L95)
uses `Array.prototype.every`, which skips array holes. With one or more
`allowed-with-notice` policies, both of these probes returned
`EXPERIMENTAL_READY` with no reason code:

```js
grant.requiredNotices = Array(1)

grant.requiredNotices = [{
  text: 'Synthetic fixture only',
  placements: Array(1),
}]
```

Thus there need be no actual notice object or placement even though the
synthetic policy is notice-required. Require dense arrays (for example, by
checking each index/own key and a positive valid count) and add explicit
negative tests. This is still only synthetic schema work; even a corrected
fixture cannot prove the human notice ledger or any real grant.

## Network, Project-data, and evidence boundary

The runtime/test source contains no `fetch`, XHR, WebSocket, EventSource,
external HTTP client, DNS, or remote URL. The only source/configuration HTTP
locations are the local static server and Playwright navigation at
`127.0.0.1`. The npm registry URLs are lockfile install metadata; the required
`npm audit` diagnostic is not runtime no-network evidence and may consult an
advisory service. No real Project content, real GLB/texture bytes, or catalog
asset was found—only the literal synthetic fixture and negative-field labels.

The screenshot is now linked and visibly marked as a synthetic evidence
prototype; it must not be presented as real asset, grant, or device proof.

## Still-blocking non-code evidence

- Human-approved full `AssetUsageGrant`: **PENDING**.
- Representative permitted catalog corpus plus human provenance/notice ledger:
  **absent**.
- Physical NFR-15 device contexts and device-budget traces: **absent**.
- `G-CP-ADR` and any Kotlin/PostgreSQL API/schema/deployment evidence: out of
  scope and **absent**.

## Cleanup and next-step implication

The S-6 prototype remains disposable and may not be copied into product code.
Before any terminal archival, retain only permitted evidence/corpus/ADR
material under the planning evidence root and remove the prototype source,
manifests/lockfile, `node_modules`, `.fallow` cache, coverage, mutation and
Playwright reports, test results, and transient screenshots under waiver §5.

This `PAUSED` review is a blocking amended disposition, not authorisation for
another code change. If governance treats it as S-6's terminal status, the
waiver's cleanup/expiry rules require a new explicit written authority before
any further remediation. In all cases, a later review must re-check H-1R,
H-2R, and H-3R test-first before reconsidering the experiment's evidence
status.

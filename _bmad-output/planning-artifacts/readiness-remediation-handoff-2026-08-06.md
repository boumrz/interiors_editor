---
title: BMAD Readiness Remediation Handoff
date: 2026-08-06
status: blocked-by-external-evidence
author: Codex /root
source_verdict: implementation-readiness-report-2026-08-06.md
---

# BMAD Readiness Remediation Handoff

## Purpose and truth boundary

This is an execution handoff, not a PASS report. It converts the fresh formal
`NOT_READY` verdict into named deliverables. No row may be marked passed from
desktop, browser emulation, screenshot, agent assertion or prototype code.

The accepted editor change-control is already captured in
`sprint-change-proposal-2026-08-06-infinite-canvas-delete-dynamic-cutaway.md`:
infinite presentation canvas, bounded dotted rectangular Room draft,
reversible Wall/Item delete and camera-relative cutaway. Those interactions do
not bypass the gate sequence below.

## Pre-bootstrap gate board

| Gate / decision | Accountable external role | Required deliverable | Pass condition |
|---|---|---|---|
| Product phase blockers | Product Owner | Written decision for self-contained `.interiors`, ProjectLimitsPolicy/reminder UX and designated catalog licensing/provenance authority | PRD/source owners record decisions; no open phase blocker remains |
| `G-1` research | Research owner + independent observer | Consent-backed observed UJ-1–UJ-6 protocol, real plans, gesture/numeric and catalog task notes | Findings are recorded; no invented participant evidence |
| `G-S2-topology` | Geometry evidence owner + independent reviewer | Chosen kernel/library decision and versioned corpus: raw ingress, ProjectionPort C1–C4/ties/hysteresis, integer-mm 0°/45° rules, T/X, Room/holes, Opening, measurement, lineage/inverse, re-entry/no-mutation | Independent review marks the work package PASS |
| `G-S1-renderer` | Renderer evidence owner + independent reviewer | Renderer/projection ADR, comparable RS-1/RS-2 runs, WebGL2/context-loss/dispose/memory evidence and camera-cutaway sector fixtures | Adopted renderer decision and reviewed package PASS |
| `G-V01-S3` | Persistence/PWA owner + independent reviewer | IndexedDB Blob vs OPFS/hybrid choice, durable staging/checksum/pointer swap, fencing, migration, crash/restart/quota/GC/history roots and Safari↔Home Screen backup handoff evidence | Independent review marks S-3 PASS |
| `G-S4-touch` | Mobile interaction owner + independent reviewer | One/two-finger contract, numeric/list alternative, accessible target/error taxonomy, safe-area/keyboard/reduced-motion and real-device/participant evidence | Independent review marks S-4 PASS |
| `G-S6-catalog` | Named Legal/Asset steward + catalog evidence owner + independent reviewer | Human-approved AssetUsageGrant ledger, versioned representative catalog manifest, hashes/notices, pin/backup/PNG/device corpus | Legal authority and independent review mark S-6 PASS |
| `G-CP-ADR` | Backend, Security and Operations owners + independent reviewer | One bounded adopted Kotlin/PostgreSQL control-plane ADR: reproducible build/test, API/transport/resource delivery, publisher/operator auth, PostgreSQL schema/migration/restore, logging/CORS/cache/retention and negative boundary tests | ADR accepted; blocks only V-09-CP, not a fictitious pre-READY web bootstrap |

## AssetUsageGrant handoff

The Legal/Asset steward must approve one grant per reusable Alpha catalog asset
family (model plus every required texture/subresource) before the resource can
be offered as a Durable placement/finish. The named sign-off roles are Legal
approver (rights), Asset steward (source chain/hash/transformation),
Product/export owner (notice/PNG placement) and publisher (release only after
all signatures). Roman may sign only rights he actually holds; an AI cannot
issue a grant. Each immutable `CatalogVersion` dossier needs:

- immutable asset/version/hash and rights-holder/source/acquisition identity;
- SHA-256, media type and byte size of source model, every texture/subresource
  and every derived runtime byte; transformation lineage
  `source hash → approved tool/profile → output hash`;
- human approver, authority, date, territory/term and revocation procedure;
- explicit rights for in-app render/thumbnails, model/subresources,
  optimization/transcoding, local/private 3D transfer, Portable Backup,
  rendered PNG download/share and every required notice placement;
- `runtimeUsePolicy`, `backupPackagingPolicy` and `renderedOutputPolicy`, each
  explicitly `allowed`, `allowed-with-notice` or `forbidden`;
- allowed/forbidden variant/material/output policy and attribution text;
- manifest/provenance link, exact bytes and backup/pin feasibility evidence.

For every `allowed-with-notice` grant snapshot, attach a notice-placement
matrix: exact text/version/locale for catalog card, Portable Backup
`manifest.json`, export UI and visible PNG layer where PNG metadata is
insufficient. The versioned catalog/backup manifest includes catalog/version
IDs, resource hash/media/bytes, provenance, grant ID, notices, schema/build
and totals. This legal dossier closes only one part of `G-S6-catalog`: the
representative task matrix, actual pin/backup/PNG corpus and physical-device
evidence still require independent PASS. A new written waiver is required
before another executable S-6 iteration.

Unknown, incomplete or browse-cache-only rights are an unavailable asset state,
not a preview workaround. An agent cannot sign or infer this grant.

## Real device / PWA evidence handoff

### Required contexts

| Device | Separate required contexts |
|---|---|
| iPhone 13 mini | Safari tab; Home Screen PWA |
| iPhone 17 | Safari tab; Home Screen PWA |
| Galaxy A53 5G `SM-A536B/DS` | Chrome tab; installed standalone PWA |
| Galaxy S26 `SM-S942B/DS` | Chrome tab; installed standalone PWA |

iOS Safari and Home Screen are separate local-storage rows. Another phone,
desktop, emulator, Samsung Internet or Playwright mobile profile does not
substitute for any row.

### Trace preconditions and fields

Use one production-like build and versioned RS-1/RS-2/RS-3 fixtures. Device
battery must be 60–80%, saver off, unplugged and thermally settled; online
runs use a comparable settled Wi-Fi profile. A green browser/mobile/PWA/offline
Playwright suite is required beforehand, but is only a prerequisite.

Each trace records commit/build/schema, fixture versions, model/SKU or inventory
ID, actual OS/browser/WebKit/Chrome version, tab/standalone context, WebGL2
probe, battery/thermal/network state, quality tier, scene metadata, memory
proxy/disposal/context-recovery events, p50/p75/p95 frame times, long tasks,
main-thread blocks, frames over 50 ms and a reason for a regression above 10%.

### Required sequence for every context

1. 20 independent cold-online starts to first editable empty Room.
2. 20 independent warm-offline starts after initial online shell setup.
3. At least five scripted RS-2 editing sessions with gesture/frame traces.
4. Forced WebGL context loss and recovery without losing the Durable Revision.
5. One separate 15-minute thermal editing run.
6. One manual Focus row: actual fullscreen probe/direct request result
   (`success`, `rejected`, `unsupported`), external exit after success,
   in-app entry/exit, preserved editor state, keyboard/safe-area, 44×44
   labelled controls and non-colour critical status.

A context PASS requires all PRD performance/recovery budgets, no crash/input or
Durable Revision loss and a complete Focus row. `rejected`/`unsupported` is a
valid in-app fallback result, never a native-support claim. One missing trace
means PAUSED; a failed threshold/recovery means FAIL for that context.

## Recommended sequence

1. Product Owner appoints the named human roles and resolves the two phase
   blocker decisions; Legal/Asset steward begins the grant ledger in parallel.
2. Evidence owners execute/review S-2, S-1, S-3 and S-4 only under their
   approved work-package rules; no result is upgraded from synthetic evidence.
3. Backend/Security/Operations owners settle `G-CP-ADR`; this remains bounded
   to the catalog/control-plane perimeter and never stores user Project data.
4. Re-run `bmad-check-implementation-readiness`. Only a fresh `READY` opens
   production bootstrap and the Web AD-16 proof.
5. After bootstrap, implement gated vertical slices with TDD/Rstest/Playwright
   and real running screenshot checkpoints; then run V-18/V-19/V-20 release
   evidence on the device matrix.

## What can be prepared versus what needs external evidence

| Package | Agent/preparatory work | Non-substitutable evidence |
|---|---|---|
| S-1 renderer | Comparable R3F/Three/Babylon analysis, raw trace hashing, RendererPort ADR, WebGL context-loss/recreate/dispose tests and boundary review | Real device GPU/frame pacing/thermal/memory/context-recovery traces |
| S-2 topology | Kernel ADR, policy/corpus for tolerance, C1–C4, T/X, Room lineage, Opening relocation, metrics and inverse/no-mutation | Accountable product/architecture approval of disputed policies; independent review |
| S-3 storage/PWA | Storage ADR, fault/browser corpus, schema/migration/fencing/GC evidence plan | iOS/Android kill/relaunch, quota/eviction/update and Safari↔Home Screen handoff |
| S-4 touch | Gesture/accessibility contract, Playwright matrix, numeric alternative and reason taxonomy | Consent-backed participant tasks on real iPhone/Samsung touch, safe-area, keyboard and reduced-motion |
| CP ADR | Bounded Kotlin/PostgreSQL draft, negative no-Project-data corpus and CatalogGatewayPort contract | Named owners, provider/region/IAM, restore drill, RTO/RPO, retention/privacy decisions |
| G-1 research | Scripts, scoring, consent template and synthesis template | Observed representative user sessions with real plans and mobile tasks |

## Closure criteria

This handoff itself closes nothing. It is complete when every owner has a named
deliverable and every non-agent evidence boundary is explicit. The readiness
workflow may be re-run only after all pre-bootstrap rows above have genuine
passed evidence and independent review.

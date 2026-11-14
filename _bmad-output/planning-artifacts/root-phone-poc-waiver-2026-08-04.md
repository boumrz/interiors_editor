---
title: "InteriorsEditor — root phone POC waiver"
date: 2026-08-04
waiver_id: W-POC-2026-08-04
status: active-poc-only
product_owner: Roman
written_authorization:
  - "Продолжай работу и разработку пока не закончишь production решение, хочу получить proof of concept, чтобы понять, как оно работает на телефоне и как этим можно будет пользоваться"
effective_scope: "One local, phone-first root POC vertical slice; not release authorization"
ends_on_first_of:
  - "the POC handoff report and owner review are delivered"
  - "a later official BMAD implementation-readiness verdict = READY"
  - "owner revokes this waiver in writing"
---

# W-POC-2026-08-04 — root phone proof of concept

## Purpose and authority

The Product Owner's written request authorizes a **local, runnable phone POC**
before the standing readiness verdict changes. It is a narrow exception to the
root-bootstrap restriction so the owner can assess the editor interaction on a
modern phone. It does not convert the repository into a released production
service, satisfy `G-READY`, complete any `V-*` slice, or supersede the
separate `W-SPK-2026-08-04` evidence-waiver boundaries.

## Exact permitted delivery surface

Only the following root-delivery targets may be created or changed for this
POC:

- root JavaScript-workspace manifests/configuration required to build and test
  `apps/web`, including exactly one `pnpm-lock.yaml`, `.nvmrc`, and an
  engine/package-manager guard;
- `apps/web/src/main.tsx`, `apps/web/src/poc/**`, `apps/web/public/**`,
  `apps/web/tests/poc/**`, and the `apps/web` build/test configuration needed
  for that POC only;
- `docs/poc/**`, `docs/index.md`, README and a single POC handoff record under
  `_bmad-output/planning-artifacts/evidence/poc/`.

This scope inherits AD-16's exact JavaScript boundary: Node `24.19.0`,
pnpm `11.20.0`, one frozen `pnpm-lock.yaml`, React/TypeScript/Rspack/Rstest/
Playwright pins, and no second JavaScript lockfile. The POC must record the
actual runtime used for install, build and test.

The POC must demonstrate an actionable phone editor shell, a fixed
source-controlled synthetic plan, an in-app Focus presentation that maximises
editor space while retaining an explicit exit, and a truthful local-session
status. Its only mutable data is ephemeral React state, reset on reload:
no `localStorage`, `sessionStorage`, IndexedDB, OPFS, browser-store schema,
user-authored Project, Revision, History, backup/import/export or durable-save
claim is authorized. No telemetry, third-party catalog asset, remote font or
image, network publishing, account system, production deployment, release,
commit, tag or push is authorized.

## Non-negotiable boundaries

- The final product remains one root delivery. Nothing may be copied from
  `S-*` spike code into the POC or later product. No POC source, asset, test,
  bundle or configuration may import, re-export, symlink, `file:`-depend on,
  vendor or serve any artifact below an `S-*` root.
- `Room`/wall geometry, durable storage, asset pinning, backup, catalog grants,
  physical NFR-15 certification and native fullscreen remain governed by their
  existing contracts. The POC may illustrate them but cannot claim them done.
- `apps/catalog-control-plane` remains closed to implementation until
  `G-CP-ADR` selects its Kotlin build/test and transport boundary. When that
  later work starts, it must not store, synchronize or recover user Projects,
  Revisions, History, Backup or user-pinned resource bytes.
- Every POC code change follows TDD and leaves the configured type, unit and
  Playwright checks passing. Browser emulation/screenshots are POC evidence,
  never NFR-15 physical-device certification.
- The POC must be presented as `POC`, not as an Alpha/production release.
- Native fullscreen is prohibited in this POC. Focus is an `InAppFocus` UI
  state only: its labelled exit, local-session status and critical controls
  stay visible; entering/exiting it does not mutate the synthetic plan or
  selected tool, and its tests must prove return to the prior state.
- The POC has no `fetch`, remote API/client, local HTTP mock, OpenAPI/generator,
  proxy, Docker/compose, database, service worker or cache policy. Outbound
  network is deny-by-default; only its local dev/test origin is permitted.
  Labels must say `POC · demo data · not saved` or `local session only`, never
  `offline saved`, `durable`, `PWA ready`, or equivalent.
- No authoritative PRD/SPEC/UX/Architecture source text may be edited under
  this waiver. Architecture amendments use the owning architecture workflow;
  all other POC documentation is limited to the named factual locations above.

## Required handoff evidence

Before this waiver closes, record:

1. reproducible local start/test commands and exact runtime versions;
2. Playwright coverage for the primary phone flow and Focus enter/exit;
3. at least one mobile-sized screenshot or capture of the actual POC;
4. known gaps versus the canonical PRD/SPEC/Architecture and a clear next
   production gate.

The handoff record is the sole closure trigger. It must include the exact POC
path manifest and SHA-256 hashes, runtime/package-manager versions, commands
and outputs for type/unit/Playwright/build checks, provenance of each POC
capture, known gaps, an explicit owner disposition and `closed_at`. A later
source change invalidates that record and needs a new authorization/review.

## Post-waiver disposition

On waiver closure, root POC code becomes read-only POC evidence. It cannot be
silently re-labelled, deployed, copied into an Alpha slice, or treated as the
production scaffold. A later `READY` path must explicitly review, accept or
replace each POC module through the normal production stories and quality
gates.

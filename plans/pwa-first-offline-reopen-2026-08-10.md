---
title: PWA first-visit offline reopen
status: complete-internal
owner: Roman Zheltov
date: 2026-08-10
scope: CAP-9 shell only; no catalog, legal, backup or physical-device claim
---

# PWA first-visit offline reopen

## Goal

After one successful online visit, the browser client can reload the complete
local editor while offline. This closes the observed dynamic-import cache race:
the service worker previously precached only `main.*`, while the editor itself
was a lazy chunk fetched before the worker controlled the page.

## Acceptance criteria

1. A production build gives the two local lazy boundaries content-addressed,
   source-owned asset names and generates a service-worker app shell from the
   actual JS/CSS output. The generated cache id changes with that shell; it
   contains no catalog resources.
2. In a new persistent mobile-browser profile: visit `/` online once, wait for
   service-worker readiness, disable network without an online reload, reload,
   and observe the editor's project-name control.
3. The existing offline durable-edit flow remains green.
4. The production bundle budgets remain enforced; this change must not merge
   the WebGL renderer into the initial action-ready shell.
5. The slice follows RED → GREEN → focused mutation/review, then lint,
   typecheck, production build and complete Playwright. It is not marked
   complete until that evidence is current.

## Non-goals / truth boundary

- No claim about iOS Home Screen or Android installed-PWA behaviour.
- No ReleaseManifest/update-handshake implementation; AD-11 still requires a
  later durable-store-compatible slice.
- No catalog resource precache, backup, writer fence, or cloud/backend work.
- Passing browser emulation is not physical-device evidence and not BMAD READY.

## TDD record

1. **RED:** Removed the online reload from `PWA-E2E-01`; the former production
   shell reproduced `ChunkLoadError` for the editor lazy chunk offline. A
   second red test rejected a fixed cache version/fixed output names.
2. **GREEN:** The build gives only existing editor/3D lazy boundaries
   content-addressed names. A Rspack plugin emits `sw.js` from the actual
   JS/CSS list and derives a cache id from it; the worker's atomic install
   precaches that list.
3. **KILL:** Removing `editor-app` from the generated list makes the exact
   first-visit production browser regression fail before offline reload. The
   source was restored immediately afterwards.
4. **Current local evidence:** production PWA browser scenarios pass 2/2 in a
   fresh persistent mobile profile; unit suite 467/467, TypeScript checks and
   Biome lint pass. A production Rspack build emits the content-addressed
   shell below budget. The complete browser gate passes 24 dev/seam scenarios
   plus 2 separately served production PWA scenarios. The dev runner is
   limited to three workers because six concurrent browser profiles repeatedly
   made an unrelated 3D gesture regression exceed its 30-second timeout; the
   isolated test and the three-worker complete run pass.

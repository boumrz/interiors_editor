---
title: "Adversarial review — amended AD-18 and root phone POC waiver"
review_type: architecture-adversarial-poc
status: complete
reviewed: 2026-08-04
reviewer: "independent architecture adversarial reviewer"
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../../../root-phone-poc-waiver-2026-08-04.md
  - ../../../../../AGENTS.md
  - ../../../../../README.md
  - ../G-CP-ADR-INTAKE.md
---

# Adversarial review: amended AD-18 and root phone POC waiver

## Verdict

**CONDITIONAL — the amended documents close the two previously obvious
governance holes, but are not yet a fully executable containment contract.**
`W-POC-2026-08-04` now closes Kotlin implementation and gives a post-waiver
read-only disposition; AD-18 keeps `G-READY`, every `V-*` entry, release and
physical NFR-15 evidence closed.  Nothing in the amendment directly conflicts
with AD-16 or AD-17.  The following lower-level seams can nevertheless turn a
local phone demonstration into an accidental production scaffold, a hidden
storage experiment, a fake-fullscreen claim, or a premature remote-contract
decision unless they are bounded before implementation begins.

## Findings

1. The waiver permits root JavaScript manifests and `apps/web/**`, but does
   not normatively inherit AD-16's exact Node, pnpm, `create-rspack`, React,
   Rspack, Rstest, Playwright and single frozen `pnpm-lock.yaml` rules.  A POC
   can therefore be labelled React/Rspack while using a different package
   manager, a second lockfile, an unpinned Node, or a mismatching test/build
   configuration.  The exception should either explicitly inherit AD-16's
   JavaScript boundary or enumerate the permitted POC toolchain and reject
   every other root manifest/lockfile.

2. `apps/web/**` has no POC-only module fence.  Once the waiver closes, the
   phrase “each POC module is read-only evidence” cannot identify which source,
   test, fixture, asset and configuration modules are evidence versus future
   production code.  A later change can either silently edit evidence or claim
   that an indistinguishable module was already a production seed.  Place POC
   material under an explicitly named `poc` boundary, record a handoff manifest
   with paths and hashes, and require a new owner-authorized reconciliation to
   modify, accept or replace it.

3. “Nothing may be copied from `S-*` spike code” does not prohibit importing,
   re-exporting, symlinking, `file:`-depending on, vendoring generated output
   from, or serving an `S-*` artifact at runtime.  Those routes preserve the
   prohibited implementation while avoiding a literal copy.  The POC needs an
   import/build/runtime provenance rule: no path or generated artifact beneath
   an S-* waiver root may enter `apps/web`, its tests, fixtures, public assets
   or bundle.

4. “Synthetic and local-first” does not define a data boundary.  A developer
   can persist title, wall coordinates, undo history, screenshots or arbitrary
   input in IndexedDB/localStorage and still call the records synthetic.  That
   is a de facto User Project implementation without AD-3/AD-4 durability,
   recovery, writer fencing, backup or retention guarantees.  The waiver must
   identify permitted data precisely: for example, a fixed source-controlled
   fixture and ephemeral UI state only, with no user-authored Project,
   Revision, History, backup/import/export or durable browser-store schema.

5. The POC exception does not forbid deferred persistence/PWA choices such as
   Dexie, OPFS, Workbox, a service-worker cache policy, project migration code
   or a browser-data retention claim.  AD-16 explicitly defers PWA packaging,
   while AD-4 leaves storage implementation behind its normal gates.  A POC
   may demonstrate a static local shell, but any cache/storage feature must be
   labelled disposable POC state, have a reset/clear path, and never be called
   offline Project recovery or Durable save.

6. The required “truthful offline/local status” has no observable vocabulary.
   `navigator.onLine`, a cached page, an in-memory fixture and a successfully
   saved Project are materially different states.  Without a small state
   contract, a banner such as “offline — saved locally” can falsely imply
   NFR-10/NFR-11 behaviour.  Define the exact POC labels and negative cases:
   network unavailable, shell unavailable after reload, synthetic fixture only,
   and no durable-user-data guarantee.

7. AD-18 names an AppShell-owned in-app Focus state, but the waiver only
   requires “maximises editor space” plus an exit.  That permits a CSS class
   that hides status/controls, a focus toggle that resets selection/draft, or
   a visual state that is mistaken for native fullscreen.  The POC must retain
   the relevant AD-15/FR-53 safety subset: explicit labelled exit, truthful
   local status, no synthetic-data mutation on enter/exit, critical controls in
   the usable viewport, and a test for return to the prior UI state.

8. Native fullscreen is not explicitly prohibited in the POC implementation.
   A lower-level helper can call `requestFullscreen()` after an asynchronous
   action, set “fullscreen active” from a fulfilled promise, or emulate browser
   chrome removal with CSS.  That violates AD-15's actual-event state model and
   can make a screenshot look like a platform claim.  Either restrict this POC
   to `InAppFocus` with no native API, or require the full direct-gesture,
   probe, `fullscreenchange`/`fullscreenerror` and truthful fallback contract;
   every capture should name its browser viewport and “in-app Focus”, never
   native fullscreen or device certification.

9. The web-only path restriction still permits `apps/web` to establish a
   remote API shape through `fetch`, a local HTTP mock, generated client,
   OpenAPI artifact, proxy, Docker/compose configuration or a catalog-looking
   endpoint.  That silently decides portions of the `G-CP-ADR` transport and
   resource-delivery boundary despite the Kotlin directory being closed.  The
   POC should have no network calls except the local development/test server;
   no remote catalog, API contract, database, Kotlin source, SQL, container or
   deployment configuration may be introduced.

10. “No actual user Project” alone does not prevent a hidden remote-data leak.
    Browser analytics, error reporting, remote fonts, image/CDN assets,
    service-worker prefetch or a test recorder can transmit interaction or
    screenshot data without being called telemetry or network publishing.  The
    POC needs a deny-by-default outbound-network rule and an allowed-origin
    list limited to its local test/dev origin; fixtures must be generated or
    demonstrably owned, not third-party catalog assets.

11. The documentation allowance includes unspecified “planning/evidence
    documents”.  This can be used to edit PRD/SPEC/Architecture source-of-truth
    text in order to rationalise a POC divergence, even though ownership of
    FR/NFR/CAP/AD is fixed elsewhere.  Limit POC documentation writes to named
    handoff/review locations plus factual README/index links; changes to
    authoritative product or architecture documents must follow their owning
    workflow, not the POC waiver.

12. Handoff is described as a list of artefacts, but not as an auditable close
    event.  “Handoff report and owner review are delivered” can freeze the POC
    without a final test result, artifact hash, screenshot provenance, explicit
    owner decision or recorded close timestamp; conversely a stale report can
    be reused after later code changes.  Define a single handoff record that
    names the exact command outputs, versions, commit/worktree identity, test
    results, POC-labelled capture, known gaps, owner disposition and
    `closed_at`; only that record should trigger the read-only state.

## Boundary retained

This review does not change AD-16, AD-17, AD-18, the waiver, `G-READY`,
`G-CP-ADR`, any `V-*` gate or the current `NOT_READY` verdict.  It does not
authorize Kotlin/PostgreSQL, a remote service, user Project storage, native
fullscreen claims, deployment, release, or physical-device certification.

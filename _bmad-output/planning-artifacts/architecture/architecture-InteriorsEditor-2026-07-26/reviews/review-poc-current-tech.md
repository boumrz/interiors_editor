---
title: "InteriorsEditor — current-technology review: root phone POC"
review_type: architecture-current-tech-poc
status: complete
reviewed: 2026-08-04
reviewer: "independent current-stack reviewer"
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../../../root-phone-poc-waiver-2026-08-04.md
  - ../../../../../AGENTS.md
verdict: conditional-pass-bootstrap-required
---

# Current-technology review: root phone POC

## Verdict

**CONDITIONAL PASS — the selected web stack is currently resolvable and the
amended Kotlin boundary is correct; a pinned runtime bootstrap is required
before the first POC install or test.** The named Node, pnpm, Rspack, React,
TypeScript, Rstest and Playwright package versions all resolve from the npm
registry. `create-rspack@2.1.8` contains both a `template-react-ts` and an
Rstest React/TypeScript template. Its support dependencies also resolve.

The current shell is not the declared toolchain: it reports Node `v23.6.1` and
pnpm `9.10.0`, while AD-16 requires Node `v24.19.0` and pnpm `11.20.0`. There
is no root `package.json`, workspace/lockfile, `apps/web`, or installed root
dependency graph at this review snapshot, so no POC build or test result is
claimed. This is expected before scaffolding but it is an execution
precondition, not a version-compatibility failure.

The amended AD-18 and waiver now correctly close
`apps/catalog-control-plane` until `G-CP-ADR` selects Kotlin build/test and
transport. That removes the prior one-level-down Kotlin divergence without
asking pnpm, Rstest or Playwright to own a backend they do not own.

The current spine lint completed with zero findings.

## Evidence checked

| Check | Result | Implication |
| --- | --- | --- |
| Node release availability | Pass | The official Node release index contains `v24.19.0`, dated 2026-08-03, marked LTS (`Krypton`) and includes `osx-arm64` binaries for this Darwin/arm64 host. It is available but not installed here. |
| Package availability | Pass | npm registry resolves `pnpm@11.20.0`, `create-rspack@2.1.8`, Rspack `2.1.8`, React `19.2.8`, TypeScript `7.0.2`, Rstest `0.11.5` and Playwright `1.62.1`. |
| Engine compatibility of target stack | Pass | pnpm requires Node `>=22.13`; Rspack/Rstest require `^20.19.0 || >=22.12.0`; Playwright requires Node `>=20`. Node `24.19.0` satisfies all of them. |
| Template feasibility | Pass with lockfile caveat | The exact generator includes `template-react-ts` and `template-rstest/react-ts`; its generated support ranges (`^` and `workspace:*`) are not themselves the final frozen graph. |
| Current host readiness | Fail until bootstrap | Node `v23.6.1` and pnpm `9.10.0` violate AD-16's exact runtime pins. Root POC files and dependencies are absent, so no build can yet be replayed. |
| Kotlin scope | Pass | The amended waiver no longer authorizes `apps/catalog-control-plane/**`; it explicitly leaves that path closed until `G-CP-ADR`. |

## Required bootstrap precondition

### H-TECH-01 — Provision the declared runtime before creating the POC graph

**Severity:** High for execution; this is not a request to change AD-16.

Do not install, build or run the root POC through the present Node/pnpm pair.
Before the first root dependency install, provision Node `v24.19.0` and
pnpm `11.20.0`, then make both machine-checkable in the authorized root
JavaScript workspace (for example, a Node version file/engines declaration,
the `packageManager` field and Corepack-managed pnpm). Generate exactly one
`pnpm-lock.yaml` with that pnpm release and make the documented test/build
commands reject a mismatched runtime and use `--frozen-lockfile` after the
initial install.

This is feasible on the current Darwin/arm64 machine, but the current Node
`v23.6.1` is neither the selected LTS pin nor a substitute for it; pnpm `9.10.0`
is likewise not the selected package manager.

## Caveats to carry into the POC handoff

### M-TECH-01 — The generator is a source, not the approved dependency graph

`create-rspack@2.1.8` is a valid exact scaffold source, but its React/TS
template declares ranges such as `typescript ^6.0.3`, support packages and
`workspace:*` Rspack references. AD-16's exact React/TypeScript/Rspack/Rstest
pins win after generation. Review and freeze all remaining support dependencies
in the same `pnpm-lock.yaml`; do not describe the raw generator output as the
final reproducible stack.

### M-TECH-02 — Make the Rstest DOM environment explicit only if the POC needs it

`@rstest/core@0.11.5` accepts a `jsdom` or `happy-dom` peer. The bundled Rstest
React/TS template uses `happy-dom@^20.10.6`. Domain and DOM-independent
AppShell-state tests need not pull one in, but component tests must choose,
pin and record one before the lockfile is accepted.

### M-TECH-03 — Browser availability is not a completed E2E proof

Google Chrome `150.0.7871.187` is present locally, but no root Playwright
browser package/configuration is installed. The POC should install or explicitly
select the browser used by `@playwright/test@1.62.1`, record that choice in its
commands, and treat the later mobile-sized capture as browser POC evidence—not
as device certification.

## Named-version claim boundary

The specific version claims above were checked on 2026-08-04. Node's LTS label
is a release-status fact, not a timeless compatibility promise; the POC
handoff must record the actually provisioned runtime. No evidence here claims
that a package pin proves PWA, WebGL, fullscreen or 2021+ phone performance.

## Boundary retained

This review is read-only. It does not scaffold the POC, install packages,
select a Kotlin build system, change `NOT_READY`, or authorize a release,
physical-device certification, commit or deployment.

## Targeted remediation recheck — 2026-08-04

### Final bootstrap verdict

**CONTAINMENT PASS; BOOTSTRAP NOT YET EXECUTED.** The prior architecture and
waiver findings are now adequately closed for a **web-only** POC. They do not
yet prove an install, compiled bundle, browser test or phone interaction,
because no root POC artifact existed at this check: `.nvmrc`, `package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/web/src/main.tsx`,
`apps/web/src/poc/` and `apps/web/tests/poc/` were all absent. The next owner
may create only those waiver-named artifacts, then must run the pinned-runtime
checks before claiming bootstrap success.

| Targeted concern | Recheck result | Current binding |
| --- | --- | --- |
| Exact runtime and one lock | Pass as an enforceable requirement; unexecuted | The waiver now names Node `24.19.0`, pnpm `11.20.0`, one frozen `pnpm-lock.yaml`, `.nvmrc`, and an engine/package-manager guard. It requires recording the actual runtime used. |
| POC source fence | Pass | Only `apps/web/src/main.tsx`, `apps/web/src/poc/**`, public assets, POC tests and POC build/test configuration are writable. This prevents a broad `apps/web/src/**` exception. |
| No spike provenance | Pass | AD-18 and the waiver prohibit copying, imports, re-exports, symlinks, `file:` dependencies, vendoring and runtime serving of any `S-*` artifact. |
| Ephemeral/no storage/no network | Pass | The POC is limited to source-controlled data plus ephemeral React state; browser stores, service worker/cache, fetch/API/client, remote assets, proxy and local HTTP mock are expressly prohibited. |
| Truthful Focus presentation | Pass | Focus is in-app only, has a labelled visible exit and local-session status, cannot mutate the plan/tool, and may not claim native fullscreen, durable/offline save or PWA readiness. |
| Kotlin boundary | Pass | `apps/catalog-control-plane` is absent from the permitted surface and remains closed until `G-CP-ADR`. |
| Waiver closure | Pass | A single hashed handoff record is the sole closure trigger; later source changes invalidate it, and closed POC modules become read-only evidence pending a `READY` review. |

The refreshed spine lint returned zero findings. At implementation time, rerun
the static provenance/storage/network scan against the real POC source and
verify the actual runtime, lockfile, type, unit, build and Playwright outputs;
the present document-only recheck cannot substitute for them.

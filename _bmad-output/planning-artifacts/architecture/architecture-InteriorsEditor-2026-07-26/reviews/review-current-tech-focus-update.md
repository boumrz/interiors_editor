---
title: "InteriorsEditor — current-tech review: Focus/bootstrap update"
review_type: current-tech
reviewed: 2026-08-04
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewer: "Codex /root/spike_s2_topology"
status: complete
verdict: concerns
scope: "read-only validation of current named technology, starter, toolchain, bundle-target, and browser/device claims"
---

# Current-tech review: Focus/bootstrap update

## Verdict

**CONCERNS.** The new Focus/browser posture makes no unsupported native
fullscreen or device-compatibility promise, and every named current technology
version exists and is compatible with the selected Node line. However, AD-16's
claim of an *exact, reproducible* starter bootstrap is not yet true: the exact
`create-vite@9.1.2` generator emits semver ranges, including `vite: ^8.2.0`,
not an exact Vite 8.2.0 dependency. The adopted toolchain rule needs one clear
normalization step before the first frozen lockfile.

No architecture artifact was edited by this review.

## Method and sources

Checked against the live official Node release, Vite documentation, official npm
registry package manifests, and the published `create-vite@9.1.2` tarball:

- [Node.js 24.19.0 LTS release](https://nodejs.org/en/blog/release/v24.19.0)
- [Vite Getting Started](https://vite.dev/guide/) and [Vite build target
  reference](https://vite.dev/config/build-options#build-target)
- official registry manifests: [`pnpm@11.20.0`](https://registry.npmjs.org/pnpm/11.20.0),
  [`create-vite@9.1.2`](https://registry.npmjs.org/create-vite/9.1.2),
  [`vite@8.2.0`](https://registry.npmjs.org/vite/8.2.0), and the published
  [`create-vite@9.1.2` tarball](https://registry.npmjs.org/create-vite/-/create-vite-9.1.2.tgz).

The review also compared AD-15/AD-16 with the project-owned NFR-15 matrix; it
does not treat an emulator, compile target, or API documentation as device
evidence.

## Validation matrix

| Claim in the current Spine | Result | Evidence / consequence |
| --- | --- | --- |
| Node.js `v24.19.0 LTS` | **Pass** | Official Node release is 2026-08-03 and labelled LTS. |
| pnpm `11.20.0` | **Pass** | Exact registry manifest exists; its `node >=22.13` engine is satisfied by Node 24.19.0. |
| `create-vite@9.1.2`, `react-ts` | **Pass, with reproducibility finding below** | Exact package exists; its engine is `^20.19.0 || >=22.12.0`; Vite officially lists `react-ts` as a supported template. |
| Vite `8.2.0` | **Pass** | Exact package exists; its Node engine is `^20.19.0 || >=22.12.0`, satisfied by the selected Node. |
| Current Stack package versions | **Pass** | Exact manifests resolve for TypeScript 7.0.2, React 19.2.8, Three 0.185.1, R3F 9.6.1, Drei 10.7.7, Babylon 9.18.0, Zustand 5.0.14, Dexie 4.4.4, vite-plugin-pwa 1.3.0, Zod 4.4.3, glTF Transform 4.4.2, three-mesh-bvh 0.9.13, Vitest 4.1.10, Playwright 1.62.0, fast-check 4.9.0 and dependency-cruiser 18.1.0. |
| Key package fit | **Pass** | R3F 9.6.1 permits React `>=19 <19.3` and Three `>=0.156`; Drei 10.7.7 permits React 19, R3F 9 and Three `>=0.159`. `@vitejs/plugin-react@6.0.4` permits Vite `^8`; vite-plugin-pwa 1.3.0 and Vitest 4.1.10 permit Vite 8; their Node constraints also accept Node 24. |
| `build.target: ['chrome111', 'safari16.4', 'ios16.4']` | **Pass** | Vite 8 documents browser/version target arrays and currently uses those three values among its own default floor (plus Edge/Firefox). `build.cssTarget` defaults to `build.target`; this is a transform/minification target, not a runtime capability proof. |
| Focus / browser-device wording | **Pass** | AD-15 capability-probes native fullscreen, derives `NativeActive` from actual events, retains in-app fallback, and makes no Safari/iPhone/Samsung fullscreen promise. AD-16 explicitly preserves the eight physical NFR-15 contexts as the only acceptance claim. |

## Findings

### CT-FU-1 — HIGH: the exact generator does not yield an exact Vite graph

**Evidence.** The published `create-vite@9.1.2` `template-react-ts/package.json`
declares `vite: "^8.2.0"`, not `"8.2.0"`. It also declares React `^19.2.8`,
`@vitejs/plugin-react` `^6.0.4`, TypeScript `~6.0.2`, and `oxlint ^1.75.0`.
Thus the phrase “bootstrap resolves Vite 8.2.0” is time-dependent until a
lockfile is created; a later first install may resolve a newer compatible Vite
release. The starter's TypeScript 6.0.2 also differs from the Spine's proposed
TypeScript 7.0.2 baseline. That is not yet a direct AD conflict because the
Stack row remains proposed, but it must not become an accidental choice.

**Why it matters.** AD-16 was added specifically to prevent starter/toolchain
drift. Two conforming implementers can run the exact generator on different
dates and commit materially different first lockfiles.

**Clear fix before bootstrap.** Choose one of these explicit rules:

1. Make the bootstrap normalization step authoritative: immediately replace the
   template ranges with the approved exact versions (including an explicit
   TypeScript choice), then generate and commit the first `pnpm-lock.yaml`; or
2. Reword AD-16 to say that it pins the generator only and that the first
   reviewed lockfile, rather than `create-vite`, chooses the actual Vite graph.

The first option better satisfies the stated reproducibility intent. In either
case, record the starter-imported `@vitejs/plugin-react` version and the chosen
TypeScript version in the future bootstrap evidence rather than silently
inheriting them.

### CT-FU-2 — MEDIUM: `packageManager` is declared but CI enforcement is not bound

**Evidence.** `pnpm@11.20.0` is a valid compatible selection, but AD-16 says
only that `packageManager` is declared and CI uses a frozen lockfile. It does
not bind the actual CI/bootstrap mechanism that obtains or verifies pnpm
11.20.0. A frozen lockfile protects the dependency graph after it exists; it
does not by itself prove that every runner used the intended package-manager
binary to interpret it.

**Clear fix before bootstrap.** Bind the future CI/bootstrap recipe to an exact
pnpm acquisition path (for example Corepack or an approved setup action), check
`pnpm --version` equals `11.20.0`, then run `pnpm install --frozen-lockfile`.
This is a documentation/toolchain enforcement addition only; do not create CI
before the readiness gate permits it.

## Browser/device compatibility conclusion

No false compatibility claim was found in the update.

- Vite's target is correctly constrained to generated bundle compatibility.
  Vite documents the current default as `chrome111`, `edge111`, `firefox114`,
  `safari16.4`, and `ios16.4`; the Architecture's smaller explicit list is
  valid for its named Chrome/Safari/iOS build floor and does not imply Edge or
  Firefox certification.
- The target is deliberately lower than the project’s actual NFR-15 browser
  traces. It neither proves WebGL2, PWA install/storage behavior, safe-area,
  keyboard, touch, nor Fullscreen API results on an iPhone or Samsung device.
- The current wording correctly delegates those outcomes to the eight physical
  Safari/standalone iOS and Chrome/standalone Android contexts. It also keeps
  native fullscreen capability-first with an in-app fallback.

## Required disposition

Resolve `CT-FU-1` and `CT-FU-2` in the architecture/bootstrap plan before a
future readiness-authorized scaffold. After a clear fix, rerun this focused
current-tech check and the project architecture lint. This review does not
alter the existing `implementation_ready: false` state.

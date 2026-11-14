---
title: "InteriorsEditor — rubric review: bounded root phone POC"
review_type: architecture-rubric-poc
status: complete
reviewed: 2026-08-04
reviewer: "independent architecture rubric walker"
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../../../root-phone-poc-waiver-2026-08-04.md
  - ../../../../../AGENTS.md
  - ../../../../../README.md
verdict: conditional-pass-web-poc-only
---

# Rubric review: bounded root phone POC

## Verdict

**CONDITIONAL PASS — the web-only phone POC may proceed, but the full waiver
surface is not yet closed.** AD-18 and `W-POC-2026-08-04` create a bounded,
local exception for `apps/web`: synthetic/local data, an AppShell-owned
in-app Focus mode with an explicit exit, real web-build testing, Playwright,
and POC-labelled mobile captures. They preserve the important AD-16/AD-17
prohibitions: no `S-*` copying, no User Project at the remote perimeter, no
release or NFR-15 certification claim, and no JavaScript runner assigned to
Kotlin.

The web boundary is actionable because AD-16 fixes the Node/pnpm/Rspack/React,
Rstest and Playwright ownership and makes Rstest reuse the Rspack-facing
configuration. The waiver limits root manifests to those required for
`apps/web`, requires the actual browser build and records reproducible commands
at handoff. This is sufficient for the requested local phone interaction POC;
it is not a production-build or physical-device claim.

Two high-severity governance seams remain. They do not require delaying the
web-only POC, but they must be resolved before either (a) any Kotlin POC code
is created or (b) the waiver is allowed to close. The structural lint was run
against the current spine and returned zero findings.

## Rubric results

| Dimension | Result | Evidence |
| --- | --- | --- |
| Narrow root exception | Pass for web | AD-18 delegates authority to one named active waiver; the waiver names only root JS build/test material, `apps/web/**`, a constrained optional catalog area and POC documentation. |
| AD-16 root ownership | Pass, conditional lifecycle | The POC is in the final root layout rather than an `S-*` directory; AD-16's pinned JS workspace and single lockfile still apply. A post-waiver disposition is still missing (H-POC-01). |
| AD-17 local-first / remote boundary | Pass for web; blocked for Kotlin | Both documents retain the no-User-Project perimeter. The optional Kotlin write surface lacks the deliberately deferred build/test decision (H-POC-02). |
| One-level-down divergence | Conditional | `apps/web` has one compatible toolchain and runner split. `apps/catalog-control-plane` could independently choose Gradle/Maven, test ownership and root invocation today. |
| Viable test/build boundary | Pass for web only | AD-16 assigns Rspack/Rstest/Playwright and the waiver requires type, unit and Playwright checks through the POC's actual web build. Kotlin intentionally has no assigned runner or build system. |
| Truthful POC presentation | Follow-up | The waiver requires POC labelling, but the current README still says that only `W-SPK-2026-08-04` is an authorized exception and that no root UI may be created (M-POC-01). |

## Required follow-up findings

### H-POC-01 — Bind the state of root POC code after waiver expiry

**Severity:** High — amend the waiver before its handoff/owner-review end
condition can fire; the web POC itself may be built meanwhile.

`W-POC-2026-08-04` ends when the handoff report and owner review are delivered,
yet that event leaves `apps/web` source in the same final-production path. AD-18
only forbids copying `S-*` source; it does not say whether the root POC source
becomes immutable evidence, is removed, or may be treated as production once
the only authorizing waiver has expired. That would let a later unit silently
turn a POC into the product and weaken AD-16's readiness gate.

**Required resolution:** add an explicit post-waiver disposition: after
handoff, POC files may remain only as labelled, read-only local evidence (or
are removed), no further changes or production/release claim is allowed until
`G-READY`; then a separate production reconciliation/re-baseline is required.
The rule must state that retention is not implicit promotion and must preserve
the existing no-commit authorization.

### H-POC-02 — Do not authorize a Kotlin implementation without its test/build owner

**Severity:** High for `apps/catalog-control-plane`; not a blocker for the
web-only POC.

The waiver permits `apps/catalog-control-plane/**` "local tests/fixtures",
but AD-16 and AD-17 explicitly defer the Kotlin build system, Kotlin test
entrypoint, contract-test ownership and root cross-build invocation to
`G-CP-ADR`. Two builders could therefore make incompatible Kotlin choices while
both appearing waiver-compliant. The no-transport/no-operations sentence does
not settle this build boundary.

**Required resolution:** until `G-CP-ADR`, narrow that waiver entry to
documentation/typed fixture material that introduces no Kotlin build or test
configuration, or adopt a separate bounded non-production Kotlin build/test
contract before any Kotlin source is added. Do not ask pnpm/Rstest to absorb
that responsibility.

## Medium follow-up

### M-POC-01 — Update the repository status before the POC is shown

`README.md` currently states that only `W-SPK-2026-08-04` authorizes temporary
work and that a root application cannot be created before `READY`. That was
accurate before this waiver but conflicts with the active POC exception and
with the waiver's requirement to present the result as POC. Update it before
the first mobile capture/handoff, explicitly retaining `NOT_READY` and the
non-release boundary.

### M-POC-02 — Make “production-facing web build” unambiguous in POC docs

AD-18 should be read as “test the same compiled browser bundle the POC serves,”
not as an authorization to call it a production release build. The required
handoff commands can state this once; no architecture change is needed.

## Boundary retained

This is a read-only architecture review. It does not change the official
`NOT_READY` verdict, authorize a production release, certify a physical phone,
or expand `W-SPK-2026-08-04`. The web POC remains a local, synthetic,
POC-labelled delivery exception only.

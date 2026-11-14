# W-READY-2026-08-30 / S-2 — detached TCC-A1 execution audit

Status: `evidence audit complete; G-S2 is NOT PASS`  
Scope authority: `readiness-evidence-spike-waiver-2026-08-30.md`

This directory deliberately contains no product implementation. The executable
corpus runner, its fixture manifests and all topology code remain read-only in
`apps/web/src/domain/**`; this package records an immutable audit of what that
runner can actually execute against the source-owned TCC-A1 contract.

## Reproduction

Run these commands from the repository root. They create no Project, Revision,
catalog asset, network request or runtime output.

```sh
# Existing detached runner and its real SHA-256 fixture executions.
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/domain/tcc-a1-corpus-runner.test.ts

# Current-kernel supporting cases; these are not a replacement for a TCC-A1
# manifest because most do not declare raw bytes, expected TCC outcome or
# inverse/allocation evidence.
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/domain/tcc-a1-corpus-runner.test.ts \
  src/domain/add-wall-segment.test.ts \
  src/domain/general-wall-project.test.ts \
  src/domain/derive-plan-faces.test.ts \
  src/domain/door-opening-project.test.ts \
  src/domain/measurement-request.test.ts \
  src/domain/migrate-project-v1-to-v2.test.ts
```

The immutable audit manifest and resulting disposition are adjacent in
`_bmad-output/planning-artifacts/evidence/spikes/S-2/current-product/`.

## RED evidence

Before writing the audit, the following explicit completeness assertion was
run and failed as intended: the existing executable TCC-A1 manifests expose
only the `raw-ingress-and-directions` and `commands-and-lifecycle` execution
routes. The absent routes were `contacts-and-plan-invariants`,
`faces-and-usable-geometry`, `lineage-and-hosts`,
`measurement-and-projections`, and `legacy-and-ingress-boundary`.

This is a valid RED result for the requested gate: it proves that a green
subset test cannot be relabelled as full TCC-A1 acceptance. The exact command,
the result and the subsequent real executor runs are captured in the evidence
report. No new runner was written because `tcc-a1-corpus-runner.ts` is already
the only adopted detached runner; duplicating it in the waiver path would not
increase evidence and would risk creating a second topology authority.

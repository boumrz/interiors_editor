# WEB-BOOTSTRAP-01 — Story 1.1 production evidence

This record covers the new `apps/web` production root only. It does not reuse
POC tests/configuration or claim a remaining readiness or device gate passed.

| Check | Final command | Final result |
| --- | --- | --- |
| frozen dependency graph | `npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm install --frozen-lockfile` | passed; lockfile unchanged |
| static lint | `… pnpm run lint` | Biome `2.5.7`, 21 production source/test files checked, passed |
| TypeScript, including DOM-free domain/app | `… pnpm run typecheck` | passed |
| Rstest domain/application/adapter/controller | `… pnpm run test` | 14/14 passed |
| Rspack production build | `… pnpm run build` | passed |
| Playwright `PROJECT-E2E-01` | `… pnpm run test:e2e` | 3/3 passed: durable reopen, immediate double-submit, dangling-pointer recovery fence |
| production mutation scope | `… pnpm run test:mutation` | 46/46 killed, 100% |

The complete gate executed from the pinned launcher:

```bash
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm install --frozen-lockfile
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm run verify
```

## Review-remediation evidence

The first independent review found a P0 crash window and four P1 defects.
The production implementation was reopened and rechecked on 2026-08-05:

- Current pointer publication and removal of the matching staging record now
  happen in the same IndexedDB transaction. Recovery never deletes a revision
  referenced by the current pointer; an explicit repeated-restart regression
  covers the legacy residual-staging state.
- A current pointer without its Revision is a typed `recovery-needed` state,
  never an empty first run. Open/recover errors are mapped to the same fenced,
  accessible recovery state.
- The controller creates an immediate in-flight fence before the first async
  checksum. Browser regression proves two synchronous submit events create one
  Project and one Revision only.
- The quality gate now has a pinned Biome lint step. The initial ESLint route
  was discarded because `typescript-eslint@8.66.0` rejects the adopted
  TypeScript `7.0.2` runtime.

Stryker `9.6.1` cannot preprocess a sandbox with TypeScript 7.0.2. The scoped
production mutation command therefore uses its documented in-place backup/
restore mode and must run without concurrent source edits; after each run the
source scan confirms no instrumented code remains. This is tooling evidence,
not a claim that the remaining readiness, device or release gates have passed.

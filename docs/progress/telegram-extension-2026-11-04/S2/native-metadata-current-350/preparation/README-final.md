# Current TMA metadata full-file native mutation

Whole `telegram-scope-store.ts`, source a635b0d21bdaf33f94dc6a35f7cb2bf3874e1ce09f4f8a0dc72b5ac903888700. Pinned Node 24.19.0 / pnpm 11.20.0; original command `pnpm --config.verifyDepsBeforeRun=false exec node scripts/run-scoped-protocol-mutation.mjs metadata --concurrency 1`. One native worker; unchanged combined 130-case corpus and explicit break 80.

Raw result: 305 Killed, 0 Timeout, 45 Survived, 87.14%. All 350 IDs have one invocation; auditor recorded 27,462 actual loaded-module/source/namespace observations, zero invalid. Dry run and all survivors ran the complete 130 cases. This is the unadjusted raw result; no survivor has been removed from its denominator. No aggregate with another scope or release/readiness/physical-profile acceptance is claimed.

Restoration: the runner verified its 20 tracked source/corpus/context files; independent verification matched all 31 files from the parent frozen proof manifest. Original checkout was never instrumented or edited.

`survivors45-exact.json` inventories every raw survivor, exact replacement/location and bounded disposition. Four changes to error payload (186/339/345/348) are separate from state safety and remain genuine diagnostic-type oracle gaps; 114 retains a failure/abort timing caveat; 75/76 preserve a nullable custom-lock callback gap. These are not blanket equivalence claims or permission to ignore future source changes. No new P0/P1 data-loss defect was demonstrated by this review.

The explicit native transaction error listener is NOT an untested default-autoabort case: whole-handler mutant 347 was Killed by TMA-STORAGE-18, whose final counter request is unawaited and has native duplicate error default-abort prevented. Only payload mutants survive there.

The handoff retains raw mutation JSON and gzip, all invocation run/report/activation/log/failure files and canonical failed test screenshots/traces. Duplicate Playwright internal `.playwright-artifacts-*` caches and regenerated browser build directories are omitted from this compact packet; the complete untouched 1.9 GiB invocation tree remains at the recorded workspace path. Source/proof/corpus files and their exact ancestry manifest are included.

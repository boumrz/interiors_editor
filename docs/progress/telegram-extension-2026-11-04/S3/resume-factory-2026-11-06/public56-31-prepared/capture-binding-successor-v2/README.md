# Capture binding and single-attempt successor v2

Awaiting Root review; no Native launch. The old721e profile and launcher remain archived as unlaunched/superseded. Application Source, all1034 predecessor inputs, all25 new app code/data files, Native runner, codec, cases and budgets are unchanged. Only the external launcher changed and one external helper was added.

Current prepared directory: `/private/tmp/interiors-factory-persisted-successor-20261107-iagyzakm/producer-captures/prepared-3P6aeJ`.
Profile SHA256: `290de7d41c4789a96bfe9777610dc464abc0617c211ffb0332a5666fa79d84d6`.
Launcher SHA256: `ab704aad5593cb4bdff0fc6f77b716861f0c2c4dc83b78f9491bb7022c8a1359`.
External closure helper SHA256: `14ab51dfdd188cbf889baebea6fbf0a3424f5c07f633e60327fdf358de9317de`.

The prepared profile now binds all35 `proofInputPaths` actually read by the unchanged capture runner, both actual formatter files and all7 actual catalog fixture assets, including their44 logical/canonical/byte bindings. The external helper admits only the unchanged runner's single literal declaration, never evaluates Source, and rejects unsupported/ambiguous paths. The real catalog snapshot must exactly match the actually loaded catalog-closure report. The same entire closure is verified before child creation, after successful CLOSE before fixture extraction and unconditionally in terminal bookkeeping. The existing app/cache/Source/dependency guards are retained.

An atomic `wx` reservation (`capture-launch-reserved.json`) is acquired after exact ACK/input checks and before any child creation. A repeated or concurrent invocation refuses with EEXIST before it can create another producer. Failed attempts retain the reservation; the same prepared directory cannot be retried. Final `capture-run.json` updates occur only after successful reservation.

Two CPU REDs are preserved: old721e lacks the real closure, and ordinary reservation writes allow2 harmless concurrent Node children. Current15 controls pass, including actual changed registry/report/formatter/asset/asset-set/runner-declaration refusals, exact unchanged input admission and concurrent repeated-launch refusal with only1 actual harmless child. The16th read-only integration check verifies the real frozen1014 app inputs +35/2/7 closure +external code and no producer artifacts. The actual pinned no-ACK invocation refuses before reservation/Native.

Fresh official helper mutation qualification counts every91 mutant:78 behavioral failures,13 survivors,85.714286%; all15 declared cases loaded in every call, no compiler/setup/global/supervisor failures. Original inventory/report and all92 TAPs are in `helper91-all-raw.tar.gz`, with98 members fully read back and indexed. No old codec report/status or application mutation inventory changed. This is a separate verification-helper campaign.

Independent peer read-only oracle review found no confirmed public-oracle defect. Its wording limit is explicit: the handle probe proves native InvalidStateError/no new readonly admission after dispose; actual actor/browser/worker/CLI closure remains a separate proof. The prior seven sensitivity hypotheses remain unproven until authorized actual app qualification.

Run read-only controls from the candidate root:

```sh
/Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node --test capture-reservation.test.mjs capture-review-closure.test.mjs capture-frozen-profile.test.mjs
```

After exact Root review only, ACK remains `root-capture-ACK.json` in the current prepared directory with the above `profileSHA`, `launcherSHA` and `captureOnly:true`. The single capture command is:

```sh
PATH=/Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin:$PATH /Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node /Users/romanzheltov/.npm/_npx/90ee57dca4845993/node_modules/pnpm/bin/pnpm.cjs --config.verifyDepsBeforeRun=false exec node run-plain-producer-capture.mjs capture /private/tmp/interiors-factory-persisted-successor-20261107-iagyzakm/producer-captures/prepared-3P6aeJ
```

Source/cases are exact;10s test/2.5s Page.evaluate/120s outer budgets remain. This command grants neither a full56/31 baseline nor mutated Native nor whole415. Captured bytes still require independent Root review before installing the PENDING app fixtures.

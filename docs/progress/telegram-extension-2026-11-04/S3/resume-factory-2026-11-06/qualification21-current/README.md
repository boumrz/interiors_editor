# Factory415 current qualification, 2026-11-06

Status: **qualification only, awaiting independent Root review**. No full415 result, mutation percentage or release acceptance is claimed. The fixed gate remains all415 mutants, threshold80, 35 CPU cases followed by21 Native cases, concurrency1, retries0. Infrastructure, compiler, timeout and cleanup failures cannot be scored as kills.

Frozen owner clone: `/tmp/interiors-resume-factory-20261106-dgab_bxi`. The app is `apps/web` beneath that root. Production Source `src/app/browser-registered-runtime.ts` is restored to SHA `482810b3e62d445d5909a28a60f436b53450d4efac77ab131171c1383bdb658c`. Official pinned Instrumenter payload SHA is `4a50c7a7e808abbf7e365242590d2ef46e56325b15b5125f7063fdfbb983f07e`. All415 signatures are regenerated and compared bijectively, including the zero-based Instrumenter to one-based report line/column conversion. No inventory member is removed or reclassified.

Current profile SHA: `fc32e73c195c43194900be42eb355fe3bc881001bee8134a5e86951b3a1aab5c`, with1004 preserved inputs. This includes source, tests, proof policy, runner/helper, seed, dependency-link declaration, manifests, root contracts and assets. The app has an owned real `.cache`; package links reuse the existing installation. The frozen Rstest scheduling seed is reset and recorded on every call. No install or package-version change occurred.

## Actual qualification

`campaigns/qualify-2026-11-06T19-14-51-296Z/campaign.json` contains exactly10 calls:

| Current call | Actual outcome |
| --- | --- |
| Instrumented OFF | Full35 CPU +21 Native clean |
| Selector30 | Named CPU assertion failure; Native skipped |
| Selector70 | F415-CANCEL-01 assertion failure |
| Selector71 | F415-CANCEL-02 assertion failure |
| Selector75 | F415-CANCEL-01 assertion failure |
| Selector121 | Public legacy occupied identity assertion failure |
| Selector105 | Public unknown legacy proof assertion failure |
| Selector57 | Public exact repair assertion failure |
| Selector70 + poisoned Source declaration | Invalid infrastructure; correctly refused |
| Selector70 + actual missing build entry | Invalid infrastructure; correctly refused before Native |

The positive raw replay reads278 CPU results,1668 module observations,84 Native results,840 module observations and168 BODY markers. All10 physical groups were empty before restoring Source. A fresh physical observation during packaging also found zero remaining members of those groups and zero actors under the owned Native directory. The seven failure trace ZIPs are archived losslessly, along with raw reports, formatter rows, BODY attachments, copied immutable bundles and served-emission ledgers.

`audit-factory10.mjs` independently replays the physical event/command/cwd protocol, all1004 frozen hashes, official415 signatures and payload, Node case activation/pre/post identities, nested errors and technical cleanup frames, Native raw/formatted bijection, exact case bodies and workers, actual ten-module SHA/local-ID ownership, emitted/served bytes, and CLI/worker drain. It uses a separate recursive technical-error veto for nested `message`/`stack`, including Module-not-found and `fullStack`/`name` reporter failures. It reads inputs and raw evidence without writing the owner clone. `audit-v3.log` records a successful replay of1216 distinct files.

`factory-raw-controls.test.mjs` contains77 passing replay/CPU controls. Besides inventory and physical closure tampering, these cover zero observed workers, proof-invalid/preheld records, wrong and missing selectors, global error payloads, missing/extra/reordered BODY settlement, actual build-only substitution, nested BODY/hook deadlines, cleanup outside the entered body, and nested technical causes. Bound-error controls reformat both raw and displayed payloads with the pinned actual formatter and assert the specific rejection reason, so a mere raw-binding mismatch does not satisfy them. An added stricter negative-call binding was test-first; the missing-export RED result is retained as `raw-controls-negative-binding-RED.log`, followed by77/77 GREEN in `raw-controls-v3.log`.

## Relationship to the historical17 recipes

No historical PASS is transferred. The fresh10 calls cover instrumented OFF, the seven real sensitivity selectors, actual Source poison and actual failed build. A separate current plain35+21 run is at `apps/web/reports/resume-factory21/composite/resume-plain21/baseline/call-W307Hq`; a separate current build-only/no-Native record is at `apps/web/reports/resume-factory21/native/factory/baseline/baseline/call-Bb9JLm`. Both are archived. The current composite contract explicitly rejects the actual build-only record as a full21 stage.

The remaining historical wrong-active/missing-selector/zero-worker/cleanup protocol requirements are covered here by current-record replay controls, rather than additional actual Chrome injections. Preheld/global/BODY deadline and extra late settlement are also current-record controls. The actual cancellation behavior and eventual native handle drain are exercised in both OFF cancellation cases and sensitive70/71/75 failures. BODY markers serialize entered/settled order and outcome; they do not serialize wall-clock timestamps, so this packet does not prove an absolute post-CLOSE settlement deadline. No Editor/Bridge channel-v7 timing equivalence is claimed.

The unused `new6` selector in the recovered policy contains a historical Key-prefixed filter. Every actual call and this audit uses only the exact immutable `full21` selection; no `new6` result is claimed. Changing this dormant branch would require a new profile and requalification.

An initial unaccepted attempt (`qualify-2026-11-06T19-12-25-106Z`) stopped at a mechanically inherited selector60 survivor. It is retained as diagnostic evidence, never accepted or scored. The final current recipes above use the reviewed explicit selectors30/70/71/75/121/105/57.

## Read-only independent replay

From the repository root, with the current owner clone preserved:

```sh
NODE=/Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node
"$NODE" docs/progress/telegram-extension-2026-11-04/S3/resume-factory-2026-11-06/qualification21-current/audit-factory10.mjs --root /tmp/interiors-resume-factory-20261106-dgab_bxi --qualification /tmp/interiors-resume-factory-20261106-dgab_bxi/campaigns/qualify-2026-11-06T19-14-51-296Z
"$NODE" --test docs/progress/telegram-extension-2026-11-04/S3/resume-factory-2026-11-06/qualification21-current/factory-raw-controls.test.mjs
```

`context-and-qualification-raw.tar.gz` has1788 regular members,69,520,946 compressed bytes. `archive-index.json` lists every member, its original physical path, byte count and SHA256. Inputs and all raw evidence are under `context/root/`; the exact Factory context and runnable controls are therefore recoverable without relying only on `/tmp`. The two formatter files are also under `dependencies/absolute/`. `package-evidence.py` verifies every profile hash before/after packaging and reads back every archived byte to verify the member index. `summary.json` records the physical empty-group observation and explicit no-score/no-whole state. `runtime-binaries.json` pins actual executable bytes without vendoring the Node binary. `final-packet-sha256.json` closes the durable packet files.

## Continuing the gate

No whole415 campaign has started. Root must finish independent review and coordinate a Native slot. The existing manager requires a fresh `verification/qualification-ack.json` bound to the exact current profile and qualification campaign hash. Root owns that decision and should review whether any additional actual control is needed beyond these replay controls. The whole runner uses the same415 inventory and35+21 corpus for every selector and retains every outcome; it cannot report a score until all415 selectors have a valid terminal result. A result below80 requires public behavior test strengthening and a fresh complete gate, never denominator reductions or infrastructure kills.

Future actual commands must use the installed pinned Node and **real pinned pnpm**, with its existing verification flag, as used by this qualification:

```sh
PATH=/Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin:$PATH /Users/romanzheltov/.npm/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node /Users/romanzheltov/.npm/_npx/90ee57dca4845993/node_modules/pnpm/bin/pnpm.cjs --config.verifyDepsBeforeRun=false exec node /tmp/interiors-resume-factory-20261106-dgab_bxi/verification/factory415-campaign.mjs whole
```

That last command is a resume recipe, not an authorization to start. Source restoration may occur only after actual child CLOSE, verified owned group/worker drain, and matching known plain or instrumented Source bytes. Key176's accepted workspace is separate and remains untouched. This local packet proves neither physical Telegram client acceptance nor release readiness.

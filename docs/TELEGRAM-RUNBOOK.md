# Telegram target: local verification and release preparation

Status, 2026-11-06: implementation verification continues. The owner explicitly authorized configuring the real domain, bot and Mini App and publishing the completed application. Applicable implementation/release checks still apply; Web/PWA retirement remains a separate owner decision. The accepted scope is [the extension specification](../plans/telegram-mini-app-extension-spec-2026-11-04.md). Current evidence is under [telegram-extension-2026-11-04](progress/telegram-extension-2026-11-04/README.md).

## Two independent targets

Keep the existing Web/PWA origin, browser build, worker, installed clients and local databases. Telegram uses the common editor through its own composition, signed launch verification, scoped storage and `rspack.telegram.config.mjs`. Its output defaults to `apps/web/dist-telegram`; use a new empty release directory for each build. Never point it at `apps/web/dist` or replace the running browser preview. No Telegram worker is installed or used to clear the browser worker/cache.

Use Node 24.19.0 and pnpm 11.20.0 with the existing lockfile. From `apps/web`, provide these **public**, non-secret build values:

| Variable | Required value |
| --- | --- |
| `INTERIORS_TELEGRAM_BOT_ID` | The real bot's numeric ID; never its token. |
| `INTERIORS_TELEGRAM_ENVIRONMENT` | `production` or `test`, matching the signed launch environment. |
| `INTERIORS_TELEGRAM_LINK` | The owner's actual supported `https://t.me/...` launch link. |
| `INTERIORS_WEB_URL` | The stable HTTPS Web/PWA fallback URL. |
| `INTERIORS_TELEGRAM_OUTPUT` | Optional absolute path to a separate new Telegram release directory. |

The owner supplied @InteriorsEditorBot (numeric ID `9112733311`) and domiknote.ru on 2026-11-06. The real production launch link is `https://t.me/InteriorsEditorBot?startapp`; Telegram uses `https://domiknote.ru/` and the preserved Web fallback uses the distinct origin `https://www.domiknote.ru/`. Verified BotFather has confirmed the Main Mini App URL and the «Открыть редактор» menu button. HTTPS and certificate renewal are configured. This is configuration evidence; the application has not yet been publicly deployed or verified in an actual signed launch. The public signed sample and historical clock in verification scripts are test fixtures. Never use the test verification configuration as a deployed build. Missing or invalid public configuration presents a finite retry/exit/Web fallback without opening writable storage.

Build the real target:

```sh
pnpm exec rspack build --mode production --config rspack.telegram.config.mjs
```

The result contains `index.html`, immutable hashed entry/application assets, `release-manifest.json` and `release-set.json`. Keep the **whole directory** together. The release set binds the loaded HTML/entry and exact files; startup rejects incompatible or unprovable combinations before opening writable storage. The real production target validates current launch freshness. Do not add a bot token, project upload endpoint, server export service, or logging of launch `initData`.

## Local preview and catalog

Use the supplied loopback preview with a separate free port:

```sh
pnpm exec node scripts/telegram-preview-server.mjs \
  --directory /absolute/path/to/new/dist-telegram \
  --port 0 \
  --catalog-origin http://127.0.0.1:4174
```

It reports its selected loopback URL and build ID. Port 4175 is reserved from this preview to protect the existing user browser preview. The catalog option points to an already running catalog; the preview does not start, mutate, republish or stop that service. Its catalog proxy only supports read delivery, preserves byte-range/ETag behavior, strips credentials, and rejects application HTML returned as a model/API response. It has no user-file upload route. A plain browser launch does not impersonate Telegram and is expected to show launch recovery instead of a writable Telegram editor.

For actual Telegram acceptance, configure a **distinct stable HTTPS origin** and the owner's bot Mini App URL. Serve the complete Telegram release there with the same read-only catalog route contract. Keep application HTML/manifests fresh and hashed assets immutable. Confirm that this origin has no controlling service worker. A catalog outage must not be shown as loss of a healthy local Project.

An unpublished rehearsal on the real Nginx server passes375 checks for the current configured Telegram8c421fa9fbda2c9a and Web7dac2c3c22157041 outputs. All52/56 files match their local bytes; control files are no-store, retained assets remain immutable, Telegram worker/manifest routes return404, write methods are refused, and a first-publication rollback restores inactive controls while keeping already referenced chunks available. The two loopback listeners were stopped after the proof; public frontend deployment and actual signed/physical acceptance remain pending. [Server rehearsal evidence](progress/telegram-extension-2026-11-04/S7/resume-2026-11-06/hosting/static-delivery-rehearsal/root-receipt.json).

The Telegram build has also been compiled in an isolated copy without the browser entry, browser HTML, PWA manifest or worker template. The shared configuration reads that template only when the browser worker plugin is applied. The existing Web output remains byte-identical under this change; [actual build evidence](progress/telegram-extension-2026-11-04/S7/target-build-independence/build-audit.json) records the exact inputs and limits. This preparation does not authorize removal of the running Web/PWA.

## Reproducible local checks

These commands run from `apps/web`. The native scripts create separate temporary builds, loopback servers and browser profiles; they do not replace the live Web/PWA `dist`.

```sh
pnpm run typecheck
pnpm exec tsc --noEmit -p tsconfig.telegram.json
pnpm run lint
pnpm run check:architecture
pnpm test
pnpm exec node --test scripts/telegram-release-build.test.mjs scripts/telegram-release-build.boundaries.test.mjs scripts/telegram-preview-server.test.mjs scripts/telegram-readonly-fixture-server.test.mjs scripts/telegram-readonly-proof-audit.test.mjs
pnpm exec node scripts/run-telegram-storage-mutation.mjs
pnpm exec node scripts/run-browser-registered-storage.mjs
pnpm exec node scripts/run-browser-registered-project.mjs
pnpm exec node scripts/run-browser-readonly-project.mjs
pnpm exec node scripts/run-telegram-readonly-source.mjs
pnpm exec node scripts/run-telegram-entry.mjs
pnpm exec node scripts/run-telegram-runtime-ui.mjs
```

For manual host/file-bound hardening, use **an isolated source checkout or snapshot**, then run:

```sh
pnpm exec node scripts/run-telegram-host-mutation.mjs
pnpm exec node scripts/run-telegram-glb-bounds-mutation.mjs
```

These mutation configurations use `inPlace: true`: the wrappers relocate temporary outputs but do not clone the source directory. Do not invoke them over a checkout being edited or used by another task. Retain their raw reports with the exact source hash; a passing narrow scope does not replace a failing broader required scope.

Despite its historical filename, `run-telegram-storage-mutation.mjs` also runs the uninstrumented native storage baseline when no Stryker mutant is active. It does not itself launch mutation analysis. The signed entry proof uses the published signed test vector and a test-only historical clock; common editor proofs use explicit synthetic scopes. Neither is physical Telegram evidence. Each entry/UI runner prints its temporary artifact directory. Existing Web/PWA regression and the new [Telegram CI workflow](../.github/workflows/telegram-quality.yml) remain separate. This CI definition is prepared locally; a remote CI success is not claimed without a real run.

Against the existing locally published catalog, separately run:

```sh
pnpm exec node scripts/run-telegram-catalog.mjs
```

This builds the actual target through the test-only signed-entry verification configuration, reads the existing catalog, and verifies real floor/wall resources, pinning, exact hashes, 3D/reopen, loaded offline work, renderer loss/restore, integrity failure, cancellation, retry and range delivery. It does not publish models or upload Projects. The required published test assets are `single-bed` and `evidence-wall-sconce`; unavailable assets produce a failed prerequisite, not a synthetic pass.

Do not run the ordinary Web/PWA build or `verify:web` over the owner's active `dist`. Run those unchanged checks in an isolated checkout/snapshot with its own output and loopback ports. Preserve existing scenarios; a focused rerun does not replace the required full regression.

## Files, storage and recovery

Projects and exact referenced model resources stay on the device. Telegram storage is separated by verified account scope, including resources, writer fences, pin journal and preferences. Browser and iOS Home Screen storage must not be assumed to be shared. Observable host-context changes drain/revoke the previous runtime; an invisible account change is not claimed detectable.

Telegram custom import is static GLB only. FBX/ZIP conversion remains a browser feature and is unavailable in the embedded editor. A new GLB checks the existing25 MiB limit before reading file bytes. Exact historical GLB repair uses the distinct existing50 MiB per-file,180 MiB aggregate and900-entry limits; every selected file's metadata is checked before any file is read. These read bounds do not replace structural/security/hash validation or widen the formats accepted by import.

The file panel prepares a real local File asynchronously, then requires a fresh user action for system handoff. A resolved system share/download operation does **not** prove the file was saved outside the WebView. Verify that separately by finding the file and selecting it for import.

| File | Meaning |
| --- | --- |
| `.interiors` | A supported complete Portable Backup with exact referenced resources. |
| `.interiors-recovery.json` | An explicit unsaved-change recovery file; it is not the saved Durable Revision. |
| `.interiors-source.json` | A lossless wrapper for an unverified stored source. It is neither a verified backup nor automatic project restoration. |

The source-recovery panel only lists and reads after explicit selection; no silent migration or repair occurs. A corrupt/future record stays intact, and healthy neighboring Projects remain available. Missing exact resources block editing until exact repair or an explicit complete recovery action. Storage failure must preserve the last Durable Revision; never clear databases, substitute an empty Project, or silently discard history.

The unreleased browser composition has a separate backup-only section for readable sources and a source-recovery section for damaged records beside healthy editable Projects. Each record is addressed by storage namespace, Project ID and Revision ID. A full archive and an unverified source remain different files and actions. These views do not authorize provisioning, upgrading or repairing a read-only database; the existing-only readers retain each source independently. The default browser entry remains unchanged until its activation gates pass.

The additional **Web registered-transfer ingress** is still subject to the AD-31/SPEC/UX/readiness storage reconciliation and no-overwrite proofs. Do not enable its rollout merely because the existing default browser routes or isolated Telegram tests pass. The old browser codec/export remains a distinct contract.

## Build and backup compatibility

This table identifies actual observed builds separately from code that has not been released. A manifest's `projectSchemas: [1]` describes its local Project schema; it does not prove that every archive bearing an `alpha-1` label has that shape. Physical database version2 in the Telegram scope is also distinct from Project schema1.

| Client / build | Actual status and local schema | Backup route |
| --- | --- | --- |
| Existing Web/PWA `ccdd13662cdca379` | Owner's preserved preview build. Project/asset/catalog read+write1, worker protocol1. Installed copies must be identified from their own loaded manifest; their version is not assumed. | Existing `alpha-1` runtime JSON backup through the historical codec. No registered-wire ingress is present in this build. |
| Web/PWA `8f8584add72d5b25` | Isolated historical regression build:335 browser and10 PWA cases passed. Same local schema families1. It is not the final source snapshot or a deployed replacement. | Legacy runtime/export remains the default. The new registered browser destination is still inactive in production composition. |
| Web/PWA `b108e21f1a77803b` | Historical isolated regression build:336 browser and10 PWA cases PASS. It has not replaced the owner’s running preview. | Legacy export plus verified supplemental registered-wire export. Its results apply to its recorded source snapshot. |
| Web/PWA `b129c67e9278adae` | Historical isolated candidate and former local preview on port4191;233 unit files/3442 tests, types, lint, boundaries and both builds PASS. Final current336 browser/10 PWA repetitions and remaining storage/composition gates are pending. It has not replaced the owner’s running preview. | Candidate registered ingress, separate private storage and the existing legacy route; guarded activation in the main checkout remains pending. An unverified empty source is preserved as an exact zero-byte download. |
| Current additional browser registered path | Unreleased; AD31 activation gates still pending. Its private database is separate from the legacy browser database. | Strict registered import, exact legacy-codec representability before publication and each edit; supplemental wire export alongside the unchanged legacy export. Source is identified by namespace+Project ID. |
| Telegram `cd43be41b9f9e51b` | Historical isolated build with blank public deployment configuration and safe configuration recovery. | Historical evidence only; it does not identify the current candidate. |
| Telegram `2f500945fa98bdc1` | Historical isolated candidate build; its blank public deployment configuration produces safe configuration recovery. Unreleased; this row does not identify the newly configured candidate. Project/asset/catalog1 only in the actual generated writable manifest. | Registered `interiors.project/runtime-v1-wire` version1; separate readable-only startup has no writer. Final configured build ID and physical evidence must be recorded before release. |

Current recovered candidate, 2026-11-06: Web build `7dac2c3c22157041` and real-configured Telegram build `8c421fa9fbda2c9a` compile in isolated outputs. The candidate passes3510 unit tests/237files, app/domain/Telegram types, lint and architecture checks. These builds are not deployed. Key176 (142K/34S,80.6818% at80%) and TMA350 (308K/42S,88% at80%) are independently accepted. Common2903 and BrowserReader783 remain incomplete; Factory415 (325K/90S,78.3133%) and TelegramReader662 (487K/175S,73.565%) completed below80% and require meaningful test-gap successors. All four remaining gates still precede guarded67-path integration and final release verification. The catalog is running separately on loopback using PostgreSQL18.4, a SELECT-only runtime role and the existing published catalog `alpha-2026-08-30.1`; all20 resources passed exact GET/HEAD/range checks. Evidence: [resumption status](progress/telegram-extension-2026-11-04/current-status.md), [hosting](progress/telegram-extension-2026-11-04/S7/resume-2026-11-06/hosting/status.json), [BotFather configuration](progress/telegram-extension-2026-11-04/S7/resume-2026-11-06/botfather-configuration.json). No user Project was uploaded.

| Archive producer → consumer | Supported interpretation / expected outcome | Acceptance boundary |
| --- | --- | --- |
| Legacy Web/PWA → same compatible legacy browser/Home Screen context | Existing exact `alpha-1` runtime codec. Explicit file selection creates a separate copy under the existing rules. | Never assume browser and Home Screen databases are shared. Retain the original file and Project. |
| Legacy Web/PWA → strict Telegram / additional registered browser route | Only exact historical canonical runtime JSON with the registered legacy witness is accepted after complete envelope, domain, resource and smoke checks. New Project identity is required. | Geometry-only/empty payloads can be ambiguous with PPJ-A1; they are not promoted merely because JSON parses. |
| Ambiguous legacy empty/geometry-only backup → Telegram | Direct strict import refuses. Explicitly import into the compatible original browser context, then choose the supplemental registered-wire export verified in isolated current Web `b108e21f1a77803b`. | An isolated actual-runtime native chain passed, with exact proof under `progress/telegram-extension-2026-11-04/S3/runtime-empty-backup-bridge`; repetition against the completed composition remains pending. This is not an old shipped-bundle or physical-client result. No direct-import witness relaxation. |
| Registered browser wire export → Telegram; Telegram wire export → new registered browser destination | Exact runtime-v1-wire1 grammar, integer geometry and original resource hashes; new destination Project ID, source preserved, session history excluded. | Resourceful isolated native paths exist; full current composition and both clean/existing destination acceptance remain gated. |
| Registered wire → old `ccdd13662cdca379` / other legacy-only client | Explicit schema refusal; keep the archive, update to a verified compatible Web build or reopen a compatible client. | Do not rewrite the archive as legacy or mutate existing destination data. A new browser's separate exact legacy export is available only where its profile proves representability. |
| Normative PPJ-A1 / proposed general ProjectV2 → active runtime | `verification-unavailable` or schema refusal as prescribed by the actual dispatcher; no PPJ-to-runtime mapper is supplied. | A schema2 migration fixture in controller tests is not general ProjectV2 support. Do not add silent conversion, integer rounding or a fallback parser. |
| Unknown, corrupt, truncated or oversized archive → either new registered destination | Rejection/cancellation before atomic publication; previous durable data and owned roots remain protected. | Record the actual reason and failed verifier separately; technical verifier unavailability is not proof that the user's file is corrupt. |

Before shipping, replace the unreleased rows with each actual immutable build ID and its manifest/archive compatibility evidence. Test both clean destination storage and existing Projects, new IDs, exact resources and zero millimetre semantic drift in both directions. Unsupported combinations stay explicit; do not broaden writable schema ranges to make startup green. Complete physical system-save/reselect remains a separate requirement.

## Release and rollback

Retain complete immutable directories for every release that can still have an open client. On preview restart, provide each retained directory explicitly:

```sh
pnpm exec node scripts/telegram-preview-server.mjs \
  --directory /absolute/path/to/current/dist-telegram \
  --retain-directory /absolute/path/to/previous/dist-telegram \
  --port 0
```

The option is repeatable. A cold directory validates its inventory rather than trusting paths supplied by the caller. Old hashed application chunks must remain available after switching or restarting, including an already loaded old HTML/entry whose application/3D code has not been requested yet. Never combine an old HTML document with unrelated new entry/manifest files. Rollback changes only Telegram delivery and retains compatible previous assets; it does not reset local data or the Web/PWA release. An incompatible schema/proof remains read-only rather than being rewritten by the older release.

## Physical acceptance still required

Record actual OS, Telegram version, device, stable origin, bot ID/environment and build ID for iPhone 15 Pro Max and Samsung S24 Ultra, or an explicitly accepted replacement. On **each** device verify create → geometry edit → floor/wall catalog placement → 3D → local save → close → reopen; raw numeric text/caret under the keyboard, safe areas, Back/Close/swipes, background/resume, network loss after local pinning, file export outside the WebView and explicit re-import with exact resources/new Project ID. Include account-switch isolation, failed save/recovery and the approved installed PWA/update/rollback matrix. Record missing hardware or unavailable system file handoff as an open condition.

The owner must verify Telegram before a separate Web/PWA retirement decision. The [retirement inventory](../plans/web-pwa-retirement-inventory-2026-11-04.md) prepares that decision; it does not authorize deletion, clearing user data, unregistering workers, commits or publishing.

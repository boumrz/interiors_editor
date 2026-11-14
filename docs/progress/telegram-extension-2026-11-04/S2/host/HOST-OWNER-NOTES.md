# Isolated Telegram seams — 2026-11-04

This is an implementation handoff, not a readiness verdict or device acceptance.
Original checkout, preview/dist, browser routes, packages, dependencies and existing
build/test configurations were not changed. No commit, upload, bot delivery or
publication was performed.

## Allowed scope and ownership

- `src/adapters/telegram/host-bootstrap.ts` + `.test.ts`: independent S2 / Story
  10.2 AC1–2. Inert SDK load, signed launch validation, finite timeout/retry,
  explicit ready/exit and teardown. The existing signed-launch validator is reused.
- `src/adapters/telegram/host-file-bridge.ts` + `.test.ts`: independent S3 /
  Story 10.5 file seams allowed by readiness report line1090. Local File preparation,
  bounded reading and system handoff only; no codec/persistence/UI replacement.
- `host-native-check.mjs` and `host-mutation.config.mjs`: isolated verification
  artifacts. They do not modify existing product/build configurations. Native
  fixture output is created under a fresh temporary directory; no HTTP server is used.
- S4 theme/viewport/Back/lifecycle below is design-only. Its implementation waits
  for completed and verified S2 / Stories10.2–10.3. No S4 production code/tests exist here.

## S2 bootstrap integration seam

Only the future explicit Telegram entry creates `createTelegramSdkScriptSource`
with its `document` and a lazy `readWebApp` callback. The adapter injects the official
SDK URL checked on2026-11-04: `https://telegram.org/js/telegram-web-app.js?64`.
Browser entry and shared core do not import or instantiate this module.

Create one `createTelegramHostBootstrap` per host lifetime with trusted release
bot/environment configuration, a finite positive `timeoutMs`, current clock and an
explicit exit fallback. Construction does not load SDK or create storage/runtime.
`start()` cancels its previous attempt; timeout/error/invalid signed launch yields
an `unavailable` result with privacy-safe reason. Retrying calls `start()` again.
Do not display cancelled superseded attempts as a new account error.

Only `{kind:'verified', scope}` may proceed to the independently required
shell-bound manifest, client capability/release and full AD-26 runtime/storage
guards. A verified launch is not writable admission. No callback in this adapter
creates a runtime, opens DB or authorizes a server request.

`ready()` explicitly hides the host loading placeholder after essential UI exists;
it is not offline/module/resource readiness. `exit()` requests SDK close or calls
the supplied fallback and returns requested/failed/unavailable; it does not claim
that system closure was prevented or completed. UI supplies retry/exit and the
configured active Web/PWA link. No production bot identity/link is invented here.

On host replacement or unmount, call `dispose()` before accepting late bootstrap
results. The runtime owner independently revokes session generation, disables
actions, removes subscriptions and drains admitted operations before replacing
the runtime. SDK presence and activation are not identity checks.

## S3 local file integration seam

The caller keeps using the accepted encoder and exact pinned resources. Inject
the applicable existing maximum file-size policy; this bridge invents no new file
or WebView memory limit. Prepare a `portable-backup` File only from complete encoder
bytes. Prepare an unpublished candidate as `recovery-draft`; its name has the
`.interiors-recovery.json` suffix and JSON MIME, never a saved Revision assertion.

`prepare` means local bytes/File are ready. `handoff` returns only
`handoff-attempted`, cancelled, unsupported or failed. Neither fulfilled Web Share
nor anchor click proves external saving. A share cancellation/failure does not
silently trigger a second download. A new user action may retry or choose a route.

Concrete `createBrowserHostFileBridge` lazily uses native File + Web Share files
when supported, otherwise a local blob anchor download. It never calls Telegram
`downloadFile`, fetch, upload, bot APIs or cloud storage. A bridge call must follow
an explicit user action; perform asynchronous codec preparation beforehand so the
native action can retain user activation.

`read` checks File.size before arrayBuffer allocation, then checks late cancellation,
actual byte length and the same bound. Picker ownership remains in UI; selected
bytes still pass the strict registered staged decoder and atomic new-Project
publication. The file seam does not repair, import or publish anything itself.

The native Chromium proof downloads exact three-byte local fixture data outside
the page and reselects it through an actual file input. It proves that transport
only, not Portable Backup validity, complete Project roundtrip, Telegram WebView,
iOS/Android behavior or FR-44/FR-57 acceptance. Physical external file reselect
and build/schema corpus remain required before their dependent claims.

## S4 read-only API/ownership proposal

After prerequisites, keep SDK-derived layout data separate in a host snapshot:
color scheme + semantic-token candidates; current viewport height; stable viewport
height + stable flag; system safe insets; Telegram content-safe insets; visual
viewport/keyboard rectangle; monotonic layout generation. Do not flatten these
into one summed padding value. Normalize rectangles into one CSS coordinate
system and intersect applicable visible/safe bounds; document each source's
origin and avoid applying the same occlusion at nested layout levels. Device
evidence must determine actual overlap; no universal sum/max rule is asserted.

UI owns semantic token mapping and contrast, header/dock/sheet layout and focus.
Do not copy arbitrary host colors into domain state. PlanProjection owns gesture
invalidation when layout generation changes; a stale screen-to-plan transform
cannot publish. Stable viewport positions fixed controls; animated height changes
remain separate and do not create commands. Preserve360px/200%/44px targets,
DOM alternatives and reduced motion. Fullscreen remains retired.

One AppShell navigation/safety seam must serve both host Back and in-app Back.
It consumes the current state, including raw rename/dimensions/room/item/rotation/
wall-position input and child-owned drafts. Priority: saving → persist-failed →
draft/conflict/dirty input → panel → editor → Projects. Never call the existing
eager `returnToProjects` directly from host Back. Suppress blur-triggered numeric
commit before confirmation; Continue preserves raw values/selection/focus.
Child-owned drafts need explicit cancel handles, not synthetic Escape/click.

Use one feature-detected Back subscription route and retain its exact callback
for offClick/offEvent. Snapshot and restore only host warning/swipe state owned
by this instance. Dispose subscribers before runtime teardown; never let an old
subscriber dispatch into a replacement generation. Warn on system Close when
available without promising prevention of process termination.

Lifecycle event subscriptions are UI/composition-owned and removed idempotently.
Resume rechecks generation, fence/base and runtime integrity before mutation;
activation never authenticates an account. Offline readiness is derived from
actual editor/2D/3D lazy modules, codecs and exact resources, not first paint or
SDK ready(). PWA cold-offline and established draft-safety signals remain intact.

## Verification and limits

All commands used Node24.19.0 and pnpm11.20.0 with
`pnpm --config.verifyDepsBeforeRun=false` in this isolated apps/web directory.

- Final selected unit run:43/43 PASS,17 bootstrap +26 file bridge.
  `/tmp/interiors-tma-host-final-unit.log`.
- Strict scoped TypeScript for all four new files and transitive imports:PASS.
  `/tmp/interiors-tma-host-final-types.log`.
- Biome lint for all four new files:PASS.
  `/tmp/interiors-tma-host-final-lint.log`.
- Native Chromium:3/3 local proofs PASS, actual DOM SDK-script events/native
  Ed25519 and explicit ready/close, actual Blob download + file-input reselect,
  and timeout + late SDK response without storage access.
  `/tmp/interiors-tma-host-native.log` and the runRoot/result.json it names.
- Full mutation, unchanged production source:386 total,340 killed,31 timeout,
  15 survived,96.11% detected. Bootstrap169:128 killed/31 timeout/10 survived;
  file bridge217:212 killed/5 survived.
  `reports/mutation/host-boundaries-final.json` and
  `/tmp/interiors-tma-host-mutation-final.log`.
- Targeted whole-line follow-up detects original bootstrap survivor48:
 2 mutants,1 assertion kill and1 timeout. The new late-error assertion proves
  teardown is not invoked twice after timeout.
  `reports/mutation/host-bootstrap-cleanup-followup.json` and
  `/tmp/interiors-tma-host-mutation-followup.log`.
  This is not a third full386 run and does not replace its raw score.
- Both report source texts match restored production source exactly. The source
  was unchanged across both full mutation runs and the follow-up.

Remaining full-run survivors are retained in the raw report:

- Bootstrap48 is detected by the targeted follow-up above.
- Bootstrap51/53 remove optional calls inside existing exception containment;
  undefined cleanup functions still cannot escape or prevent settlement.
- Bootstrap54/55/56 change private settled-attempt cache clearing. Later calls
  cancel an already settled attempt; the settlement guard prevents callbacks
  from clearing a newer active attempt. A retained reference differs in cache
  hygiene, not writable admission. This proof is bounded to the current lifecycle.
- Bootstrap64 permits extra late parsing/crypto work, but the separate post-await
  settled guard rejects its result before verifiedSdk is assigned. It has no
  runtime/storage callback and is not claimed completely equivalent in work done.
- Bootstrap118/119 remove an early ready guard; the existing try/catch still
  returns false for missing SDK, and dispose already clears verifiedSdk.
- Bootstrap168 removes explicit return undefined from a catch; implicit return
  yields the same value for that function.
- File178 changes internal configuration-error wording.
- File343 removes a duplicate pre-effect abort guard under the outer checks on
  this current synchronous native path; no intervening await occurs. This does
  not justify removing the later pre-click guard, which is now detected.
- File345/352 change an internal cancellation string, while the outer aborted
  signal still returns cancelled. File354 changes the internal attempted string,
  but actual click and the public handoff-attempted outcome remain unchanged.

Full snapshot typecheck was also attempted. It currently fails on six pre-existing
copied S2 harness references to pinStaging/resources missing in the copied earlier
TelegramProjectRepository. Those modules were copied while their owner was
implementing them and were not edited here. The final log contains only those
six errors: `/tmp/interiors-tma-host-full-types-final.log`. Root must run the full
repository checks after integrating the completed modules; scoped PASS is not
a claim that this intermediate snapshot passes every repository gate.

No browser/PWA rollout, product entry integration, physical Telegram client,
full Project transfer, release or retirement acceptance is claimed.

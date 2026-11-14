# S2 common-UI drawing-preference seam — 2026-11-04

The three production files were reviewed, copied and taken over by root before this final evidence handoff. **Do not overwrite original production sources from this workspace**: root is adding resource hydration independently. Only the five new verification files below remain to copy/review.

Verification-only tree: `/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-prefs-verification-r6wccibz`.
Isolated workspace: `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-prefs-ea4d00dv/apps/web`.
Original three-file review diff: `/tmp/interiors-tma-prefs-review.diff` (created before root ownership transfer).

## Accepted seam

`ui/drawing-dimension-visibility.ts` exports only `DrawingDimensionPreferencesPort { read(): string|null; write(raw:string): void }`. Existing key, parser, serializer, load/save helpers and defaults are unchanged.

`AppShell` optionally accepts `drawingDimensionPreferences`. A provided port supplies all reads/writes, including when it throws; the existing helpers use their graceful defaults/error handling without falling back to the global browser key. Calls preserve the method receiver. Omission retains the existing browser localStorage key and behavior. `EditorApp` forwards the optional port. No Back/Close, theme, viewport, PlanProjection, RoomScene, controller, factory, other ports, codec, build target, dependency or release change.

Actual Telegram runtime composition must supply its verified `drawingDimensions` port explicitly. This independent seam does not implement Telegram storage, account switching, signed identity, physical-client isolation or full Story10.2/10.3 readiness.

## Behavioral TDD and native proof

Real Chromium via existing pinned Playwright/Rspack runs the actual EditorApp→AppShell→browser production runtime in a fresh test context, with an explicit writable startup-handshake fixture and unavailable catalog gateway. Only preference ports are opaque A/B in-memory class instances. The fixture is not a Telegram product target or a real scoped-storage test. It registers no PWA worker and does not use main.tsx DEV cleanup.

- `/tmp/interiors-tma-prefs-native-red.log`: before production changes, **2 new failures / 1 old default-browser PASS**. The provided port was ignored and UI read the pre-existing browser key.
- `/tmp/interiors-tma-prefs-native-green.log`: first **3/3 native PASS**.
- `/tmp/interiors-tma-prefs-forward-red.log`: remove only EditorApp's forwarding attribute; the actual PREFS01 browser test fails. Source restored to the accepted SHA afterwards. Installed Stryker does not generate a JSX-attribute-removal mutant for that line, so this semantic mutation supplies the missing forwarding evidence.
- `/tmp/interiors-tma-prefs-deps-red.log`: remove only the read-effect dependency; PREFS04 fails because the mounted UI keeps the former same-identity provider values. Source restored afterwards; no account-switch shortcut was added.
- `/tmp/interiors-tma-prefs-native-final-green.log`: **4/4 native PASS**. PREFS01 checks A→B→A, UI destruction/recreation/reopen, independently read/written port values and unchanged native IndexedDB Project/Revision rows. PREFS02 checks read/write errors, graceful defaults, no browser-key fallback and unchanged semantic rows. PREFS03 checks omitted-port browser-key reads/writes and UI recreation. PREFS04 replaces only the provider for the same identity/controller/mounted UI; the replacement reader and healthy writer are used while the previous writer remains faulty. A/B identity-like transitions still destroy the UI.

The legacy global key is watched at Storage.prototype, seeded/read for inspection through original native methods, and proven untouched with zero reads/writes for every injected-port route. Actual browser persistence is used only in Playwright's fresh profile. Semantic snapshots compare projects/revisions, not unrelated writer-heartbeat metadata.

## Required checks

- Existing UI regressions: **86/86 PASS**, `/tmp/interiors-tma-prefs-unit.log` (AppShell, drawing-dimensions and drawing-dimension-visibility Rstest tests).
- **Full app tsc PASS**: `/tmp/interiors-tma-prefs-final-type-app.log`.
- **Full ES2022-only domain tsc PASS**: `/tmp/interiors-tma-prefs-final-type-domain.log`.
- Scoped Biome lint PASS: `/tmp/interiors-tma-prefs-final-lint.log`.
- Existing Biome globs exclude tests/**/*.tsx; the native fixture was additionally linted via stdin with a matching src/ui virtual path. `--write` output was byte-identical to the source, so no fix was applied. `/tmp/interiors-tma-prefs-final-harness-lint.log` and `/tmp/interiors-tma-prefs-final-harness-linted.tsx` record that check.
- Node24.19.0 and pnpm11.20.0 pinned. No manifests/dependencies or existing configs changed. Each native/mutation command owns a fresh loopback URL/output and fresh browser contexts. Rspack test output stays outside the original/dist/live preview.

## Mutation scope and resolved survivor

Full narrow source scope `AppShell.tsx:1541–1559` plus `editor-app.tsx:99` produced **13 mutants:12 Killed,0 Timeout,1 Survived (92.31%)**, report `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-prefs-ea4d00dv/apps/web/reports/mutation/drawing-preferences.json`, log `/tmp/interiors-tma-prefs-mutation.log`.

Sole ID5 changed `[drawingDimensionPreferences]` to `[]`. Initial tests remounted for every binding, so this was a real missing provider-replacement vector, not global equivalence. Added PREFS04 for a new provider of the **same identity**, with existing UI/controller preserved. A targeted automated rerun of the exact dependency mutation is **1/1 Killed,0 Timeout/Survived**, `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-prefs-ea4d00dv/apps/web/reports/mutation/drawing-preferences-dependency.json` and `/tmp/interiors-tma-prefs-mutation-dependency.log`. The 12 previously detected branches and this targeted follow-up have evidence; this is not described as a fresh 13/13 full run. All eight source/verification file hashes match their pre-run snapshots after final restoration. No unresolved survivor remains in the tested changes.

## Verification files to copy

- `tests/browser/drawing-preferences-harness.tsx`: `7eb9ab77485d9c7ba226cc50cb2b43a68ed21409a1e9857ffdda5e3820f62d0a`
- `tests/browser/drawing-preferences-harness.html`: `0fb601ce1c72b62cb1138be81c5a3ab40738c36390ac2711457fe715e106d3eb`
- `tests/browser/drawing-preferences-e2e.check.ts`: `8c063bbb1a0a413fcc522fcdb7d66a831e55eaa2d81cdfb7ca8b5b9cc4ff5cc7`
- `rspack.drawing-preferences-test.config.mjs`: `48096260fc02d0bdbc723d195d71b73f4c3fa3d5b7ac8df2c8c9ce399a020edf`
- `playwright.drawing-preferences.config.mjs`: `5964aa2a0697e68b128c9d9c6ba6ce304373219e3dcd55d9b690f94bb0ba85cb`

## Already accepted production-source receipt (record only; no copy)

- `src/ui/AppShell.tsx`: `c4a40e69070a69104853bac291009cf0b7f988035b8f1440ff4d04303dfa62bf`
- `src/app/editor-app.tsx`: `1920868a66bca7837a632ce1f86f22dbde65e3743f55458f2ff590e1df854417`
- `src/ui/drawing-dimension-visibility.ts`: `26c063db61bff3b5bbdf3d4a5ba4dea4b9451479be5c3957614ceb158f01d2e1`

No original edits or commits by this agent. Root owns subsequent source integration and the broader Web/PWA/Telegram gates.

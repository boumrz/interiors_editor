# Real Telegram runtime UI proof (test-only)

Transfer only the seven new files in transfer-new-files-sha256.json. All original application files remained untouched by this owner. Original AppShell/editor-app/host-file-bridge/local-GLB/local-file helper copies in the temporary workspace are dependency snapshots, never handoffs. Root owns their production changes. Full dependency SHA snapshot is recorded; final UI bundle used this isolated snapshot, not an assertion about future root integration.

Run from apps/web using pinned Node24.19.0/pnpm11.20.0:
`npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm --config.verifyDepsBeforeRun=false exec node scripts/run-telegram-runtime-ui.mjs`
Runner owns fresh mkdtemp output, ephemeral loopback port and fresh Playwright profiles, preserves artifacts, and closes only its own server. Dedicated .check.ts/testMatch keeps the default editor .spec discovery unchanged. Production build/main/PWA setup/package/tsconfig are unmodified.

## Evidence

- Native actual Chromium mobile-profile UI01–05: 5 PASS (final24.4s), real EditorApp/AppShell and shared controller through actual TMA runtime, registered four ports, native IndexedDB/Web Locks/WebCrypto. Full TS app check and newfile/harness lint passed.
- UI01 actual create rectangle, atomic Durable publication and reload/open exact Project/Revision. UI02 complete A→B→A React/runtime dispose/remount, scoped preferences, distinct Projects, unchanged real baseline browser Project DB, legacy preferences and CacheStorage.
- UI03/04 actual raw-UPPER self-authored triangle GLB registered/pinned through controller before mount, native digest matches same256bits, actual custom catalogue card enabled and actual3D status rendered:1. Original AppShell failed both paths; root wired local-GLB helper; GREEN snapshot records exact hashes. Visually inspected screenshot contains actual triangle in saved room.
- UI05 actual export, visible preparation then separate handoff gesture, share0→1 with actual File, honest handoff-attempted wording, close panel, native DataTransfer reselects same File through real input and registered importer; imported Project has new ID and exact level. Local system.share is a deterministic test stub recording File; no real OS share/disk survival or physical external handoff acceptance is claimed. Import waits actual Projects DOM and Durable UI, never force-clicks. Browser source rows/preferences/cache remain unchanged.
- Two isolated manual native mutations: handoff callback no-op and close callback no-op both fail their intended UI05 assertions. Exact timestamps and mutation/restoration hashes recorded in evidence/file-callback-mutations.json; helper restored. These are two targeted detections, not a full-scope mutation score.

## Boundaries

Synthetic test-scoped VerifiedTelegramScope assertion and loaded test-capsule approval are explicit fixture construction, not signed-launch/physical Telegram proof. No fake controller or browser codec fallback; generic ZIP encoder is only the required legacy encoder port, actual export uses registered writer bound inside runtime to actual scoped resources. The registered decoder snapshot includes root availability mapping. Self-authored GLB only; unavailable catalogue gateway preserves local-only paths. No user files/network upload. Every network request is restricted to exact fixture origin.

No claim of full S2 AD26 corpus, physical client/OS-crash durability, real Telegram account isolation, S3 worst-case/cross-build file compatibility, mobile system handoff, S4 Back/keyboard/theme or full S6/S7 acceptance. Native UI skeleton checks do not authorize writable external release. Parent must run fresh integrated root checks after copying newfiles onto its later production sources.

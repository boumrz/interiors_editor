# Shared Project controller extraction handoff

Scope: three source files in the isolated temporary copy only. No original checkout, package/dependency/build configuration, server, deployment or commit changes.

`createSharedProjectController(dependencies)` owns the shared application use cases, controller and SessionRetentionProjectRepository. It returns `{ controller, publicationRepository }`. The shared module imports application ports/use cases and ProjectController; no browser or Telegram adapters.

The browser wrapper preserves both existing IndexedDB adapters, writer facade and owner/takeover defaults, pin journal/coordinator, publication fault/test seam, concrete backup codecs/smoke and ReleaseStartupCoordinator's reconcile/migration path. `releaseStartup` exposes `Pick<ReleaseStartupCoordinator, "handshake">`. All 41 shared use case/controller constructor calls retain their original order and the eight unsupported fixture-command slots remain undefined. Inert constructors permit the session-root closure to capture the initialized const controller directly, removing an unreachable fallback.

## Evidence

- Initial RED: missing shared module before production extraction, `/tmp/interiors-tma-shared-red.log`.
- Final GREEN: 8/8 actual behavioral unit tests, `/tmp/interiors-tma-shared-green.log`.
- Strict scoped TypeScript: exit 0, `/tmp/interiors-tma-shared-types.log`.
- Scoped Biome lint: exit 0, `/tmp/interiors-tma-shared-lint.log`.
- Focused Stryker 9.6.1: 15 mutants, 14 killed, 1 survived, 0 timeout/error, exit 0; `/tmp/interiors-tma-shared-mutation-final.log`, `reports/mutation/shared-controller.json`. Existing configuration supplied programmatic options via an external /tmp launcher; no repository configuration edits.
- Remaining mutant ID5 changes `enableLegacyV2FixtureMode=false` to true. Bounded redundancy: all seven guarded legacy V2 use cases remain undefined. Every reference to this flag guards a route together with its missing use case; no route is enabled by the flag alone. It does not claim full-project equivalence or a 100% score.
- All three source SHA256 values were verified unchanged after Stryker restoration.

The eight tests cover create/first room/rename/undo/redo/reopen/confirmed deletion; resource-free JSON export; local custom model placement; exact-resource portable import through decoder/smoke/prepared pin ports and verified export; corruption refusal and retained publication admission; undo resource corruption without pointer/history loss and exact restoration; local library separated from resource store and advisory storage; dedicated/fallback recovery encoder and recovery decoder selection.

No native browser regression or full Web/PWA acceptance was run by this subtask. Root owns that verification and integration. This is not a Telegram writable-runtime or physical external-file roundtrip claim.

## Files

- `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-shared-14kq1cg8/apps/web/src/app/production-app.ts`: `57d8fd6ce0073684934ecbeff772d37cbebcc629cc3e2480b458d7c6188f29cf`
- `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-shared-14kq1cg8/apps/web/src/app/shared-project-controller.ts`: `19ea40b8d7791f06de5d44506a652a769f01f243e61afcf4068705ca0aa74a94`
- `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-shared-14kq1cg8/apps/web/src/app/shared-project-controller.test.ts`: `a04ac81123791d9ae1f42aebf13fccfdda5da5cd7637ee9b8e1bc6551ff3f70f`

Original browser production-app.ts baseline and current SHA256: `bab745a13336bfb90bdaac022e048ddb37e186e985ff9b35f065f53550fdb61c`.

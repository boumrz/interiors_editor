# Release validation: catalog, directory deletion, room metadata and workspace tests

Date: 2026-11-01. Runtime: Node 24.19.0, pnpm 11.20.0. Source/test edits are frozen after the final targeted browser correction. This report records the owned slices; the coordinated whole-project regression is reported separately.

## Implemented behavior

- Catalog publication has a 15-second default cancellable timeout, supports a configured deadline, preserves caller cancellation, and releases its timer/listener on completion. Timeout remains catalog unavailability, never Project resource recovery.
- `ProjectController.permanentlyDeleteProjectFromDirectory(projectId)` deletes only the explicitly confirmed, validated named Project through the existing fenced directory capability. It does not take over another writer, delete corrupt/unvalidated targets, switch to an editor, or overwrite newer navigation. Other Projects and revisions stay intact.
- Room type/height updates may omit `name`. Omission preserves the exact existing metadata, including absence, whitespace and legacy strings. Explicit blank names remain invalid. The same rule applies to confirmed height/opening reconciliation. No portable schema migration.
- Workspace browser scenarios use visible history, inline catalog failure/retry, import above catalog browsing, dimension tabs without axis-only filters, room types without editable names, opening-specific context, and no removed split gesture or instructional hints. Legacy split compatibility is seeded with the real domain mutation and validated serialization. Existing geometric, resource retention, cancel/confirm and atomic deletion assertions remain.

## TDD and unit verification

- Publication deadline/cancellation additions: initial expected failing tests, then the full HTTP adapter suite passed.
- Named directory deletion: initial missing-method failures, then 100 controller tests passed.
- Optional room name: 4 new tests failed on the original `input.name.trim()`; all passed after optional-name preservation. A real two-room fixture then verified that only the selected Room changes.
- Mutation follow-up: four meaningful survivors were replayed only in the isolated snapshot. Each was killed by exactly one behavior assertion: no writer inspection after abandoned navigation, independent Project/revision identity validation, multi-room lookup, and preservation of the unselected room.
- Final combined unit command: `pnpm exec rstest run src/app/project-controller.test.ts src/adapters/catalog/http-catalog-gateway.test.ts src/domain/update-room-properties.test.ts src/application/update-room-properties.test.ts`.
- Final result: **138 passed, 0 failed** (controller 100, HTTP 18, room domain 15, application 5). See [unit log](release-owned-unit-2026-11-01.log).
- Full TypeScript check passed after the final domain changes. Biome checks passed for owned changed files; the browser file was formatted after its last assertion migration.

## Mutation evidence

All mutation runs used a separate copied snapshot at `/tmp/interiors-catalog-release-mutation/apps/web`. `inPlace` was enabled only inside that snapshot to match the repository's TypeScript 7/Rstest convention; the shared checkout was never mutated. Dependencies and catalog fixture assets were read through symlinks. Concurrency was 1.

The initial exploratory run covered the entire publication method, the directory method and room candidate: **244 mutants, 203 killed, 41 survived, 83.20%**. Four meaningful directory/room gaps were strengthened. The broad HTTP scope also covered existing envelope validation outside the timeout change; 35 of its survivors were not part of the changed timeout behavior. This exploratory result is retained transparently in [the broad report](mutation/release-catalog-controller-room-broad-2026-11-01.json).

The final run used exact changed publication deadline/cancellation ranges, the full new directory method, and the room update candidate. It generated **172 mutants: 170 killed, 2 survived, 0 timeouts, 0 errors; 98.84%**.

| Scope | Killed | Survived | Score |
| --- | ---: | ---: | ---: |
| Directory deletion controller | 98 | 0 | 100% |
| Room update candidate | 50 | 0 | 100% |
| Publication deadline/cancellation | 22 | 2 | 91.67% |

Both remaining HTTP mutants change only the caller AbortSignal listener options on line 77: `{ once: true }` to `{}`, or `true` to `false` (final IDs 9 and 10). These are behaviorally equivalent here: native AbortSignal emits abort once, `AbortController.abort()` is idempotent, and `finally` explicitly removes the listener. No production mutation exclusions or implementation-detail tests were added to inflate the score.

See [final JSON report](mutation/release-catalog-controller-room-2026-11-01.json) and [final mutation log](release-owned-mutation-2026-11-01.log).

## Targeted phone browser verification

Browser: Chrome with Playwright iPhone 13 emulation; source server `http://127.0.0.1:48174`, isolated test output folders. No browser scenarios were skipped or removed to make the suite pass.

- Initial release migration selection: 24 scenarios. First pass: 17 passed; 6 failures were outdated test interactions/assertions and 1 exposed the real optional-name mutation bug.
- Corrected retry: 5 of 6 passed; the remaining scenario required checking actual rendered wall/room elements instead of a hidden counter absent when an item exists.
- Final two scenarios: 2/2 passed, including exact preservation of absent Room names. Together all 24 selected scenarios were confirmed green.
- Additional legacy metadata/aria migrations: diagonal deletion and divider deletion passed. The remaining crossbar scenario exposed a genuine geometry regression; its original 12-wall/4-room assertions were retained and passed after the geometry owner's fix.
- Integration selection: 6/7 passed, covering crossbar, X-junction, explicit atomic T-contact removal, notification close, and locked item behavior. The last failure was one additional obsolete lock instruction assertion; it was migrated to absence while retaining disabled controls, durable lock and resource-history assertions.
- Final `ITEM-E2E-03` retry: **1/1 passed (16.1 s)**. All seven integration scenarios therefore have a green result.
- The final whole-project regression may have collected the previous ITEM03 assertion before this last test-only edit; a separate exact retry is retained in [the final browser log](release-browser-last-2026-11-01.log).

Logs: [initial 24](release-browser-targeted-initial-2026-11-01.log), [retry](release-browser-targeted-retry-2026-11-01.log), [last two](release-browser-targeted-final-2026-11-01.log), [additional](release-browser-additional-2026-11-01.log), [integration seven](release-browser-integration-2026-11-01.log).

## Source fingerprints at handoff

Paths are relative to `apps/web`; hashes are SHA-256.

| File | SHA-256 |
| --- | --- |
| `src/adapters/catalog/http-catalog-gateway.ts` | `85a70fa5f1d3e7535ababe2bc7494d5878ddf0acaa2b4aef41baa3e5148a39aa` |
| `src/adapters/catalog/http-catalog-gateway.test.ts` | `5615c9869a61dd0de4add0bc42c42e4abed140c4103b0cd2f39347c2cdcca1dd` |
| `src/app/project-controller.ts` | `a3f8c811c637ab0ade34f4898f6ec351496320bc599c36c0964d1857001d272c` |
| `src/app/project-controller.test.ts` | `b4cd528393c345745b205a3c62b5f0a8285290bea804f285663c981554f8b81c` |
| `src/domain/update-room-properties.ts` | `36cd311814d74e5c4a11dd22a1826717b88948080588d1c81ed2bd43587c3605` |
| `src/domain/update-room-properties.test.ts` | `98525b07f186419128a0a9dffe07dcfcce9ac8803f0c10823cf5feb186719a15` |
| `tests/browser/editor-workspace-e2e.spec.ts` | `3ffdf32b63b93654e81f230679b4b167bbd88a7c03f9280aa078e772e3fd82d0` |

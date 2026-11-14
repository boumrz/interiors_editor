# Runtime V1 read-only validation and opening seam handoff

Four owned source files only, in an isolated copy; no original checkout edits, dependencies, product/build configuration, servers, upload or commits.

## API and behavior

`validateRuntimeV1Project(value: unknown): RuntimeV1ProjectValidationResult` is synchronous. Accepted carries `project: Project`, the exact same original reference. Rejected carries `RuntimeV1ProjectValidationReason`, an exported stable union of two BACKUP reasons plus existing domain reason unions; no string erasure, adapter type imports or Project casts.

The hook runs after the codec's closed V1 grammar and before resource reads/hashes. It narrows through the existing authoritative structural guard; checks current policy including100 definitions,50MiB/resource,180MiB total and exact50..100000mm nonzero wall lengths; derives and binds existing PlanGraph/Room geometry; accepts empty/open drawings without inventing Rooms; performs the adopted all-floor orientation prepass; checks original Opening addresses through new readonly core assessments and item hosts/footprints through existing assessors. Confirmed overlap/clearance warning states remain accepted. Original fields/order/own-undefined/negative-zero/nested variant values and finite yaw spelling are unchanged.

AD30's adopted 'Read-only проверка legacy orientation' was read in full. Every floor item is prechecked, including obstacles, before opening/item assessments. Finite projected yaw produces a disposable `ParametricFloorItemInput` with the existing `rotationStepForYawRadians` step. Raw source yaw and property presence stay untouched. Nonfinite derived yaw from ±MAX_VALUE without an authoritative yawStep returns existing domain INVALID_DIMENSION, after schema/policy, without changing finite wire acceptance or core projection. A valid explicit yawStep retains priority.

`assessDoorOpeningPlacement(state,input)` and `assessWindowOpeningPlacement(state,input)` return `WallOpeningPlacementAssessment = {kind:'accepted'}|WallOpeningRejection`, perform only the original pre-ID checks in original order, and allocate/mutate nothing. Existing add commands call them before their unchanged ID allocation/construction/defaults. update/move logic was not refactored.

## Evidence

- Opening RED before seam:20 new failures /27 old passes; `/tmp/interiors-tma-opening-assessment-red.log`.
- Validator RED before module: missing module; `/tmp/interiors-tma-v1-validation-red.log`.
- All-floor prepass RED:2 exact mixed-collision/MAX-order failures; `/tmp/interiors-tma-v1-projection-prepass-red.log`.
- Final96/96 behavioral tests across validator, wall-openings, domain Door project and application Door project suites; `/tmp/interiors-tma-v1-validation-green-final.log`.
- Scoped strict TypeScript and Biome lint exit0; `/tmp/interiors-tma-v1-validation-types-final.log`, `/tmp/interiors-tma-v1-validation-lint-final.log`.
- Final focused Stryker9.6.1:294 mutants,273 killed,21 survived,0 timeout/error;92.86% overall >=80 break. Validator139/160 killed; extracted opening/creation scope134/134 killed. `/tmp/interiors-tma-v1-validation-mutation-final.log`, `reports/mutation/runtime-v1-validation.json`. The first report is preserved as `runtime-v1-validation-initial.json`.
- All four source SHA256 values match their pre-mutation values after restoration. Stryker's final run disabled its optional typecheck preprocessor to avoid attempting Babel parsing of an unrelated native harness HTML template; the actual scoped TypeScript check was run separately and passed.

No full browser/PWA regression, publication integration, physical device compatibility or external-file acceptance is claimed by this subtask. Root owns integration and those checks. The hook never reads resources, hashes them, calls mutation commands/IDs/clock/pin/store ports, or publishes a Revision.

## Bounded survivor analysis

- IDs 29: The mutation also projects each wall item as a temporary floor input. Closed wall records have no yaw fields, so the query produces existing zero and stores an unused Map entry; wall assessment remains unchanged. Extra bounded local work is observable in cost only, not a claim of unrestricted equivalence.
- IDs 74, 75: The missing floor-input branch cannot occur after the successful non-yielding all-floor prepass: the same immutable snapshot and exact unique IDs are used in both loops. The guard remains defensive.
- IDs 86, 87, 88, 89, 90, 91, 92, 93, 94, 97, 100, 103, 106: Deleting/weakening these upper collection guards cannot admit a value today: the authoritative legacy structural guard already caps vertices600/walls300/rooms50/openings200/items250. The stricter definitions100 guard is independently exercised. Inclusive-boundary mutations were killed by exact-limit fixtures.
- IDs 129, 130, 133: The missing endpoint branch is unreachable after the authoritative structural guard has checked every wall reference; the synchronous validation never changes vertices or IDs.
- IDs 144, 145: A zero squared wall length requires coincident coordinates, already rejected by the structural guard (including +0 versus -0). The explicit nonzero qualifier preserves the source-owned minimum-nonzero-length wording.

## Source paths and SHA256

- `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-v1-validation-dqadcq4e/apps/web/src/application/runtime-v1-project-validation.ts`: `c75f165ffa1da69d6f68c76465533f20751b7af6d3eeb4d8722c4984cb285ee5`
- `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-v1-validation-dqadcq4e/apps/web/src/application/runtime-v1-project-validation.test.ts`: `241da18960fdb2e790cd5e53047f64eb54534fdfe838aca2211838ca726f9f82`
- `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-v1-validation-dqadcq4e/apps/web/src/domain/wall-opening.ts`: `0281a6161c406da81c6a435a4da69d89fd33b960c8bb2b09876c1fb08d3aafcb`
- `/private/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-v1-validation-dqadcq4e/apps/web/src/domain/wall-openings.test.ts`: `f7542b85590f271fe1560eedb498de5ef437f8e836d7a1afa5f5f6b222dc18bb`

Immutable uninstrumented frozen copy with the same hashes: `/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-v1-validation-frozen-gywzxlox`.

Original existing-file baseline hashes before this task: wall-opening.ts `66c5911ef14a766b844afc17c9b7e5eb27949db1813bb7577346529345c64328`; wall-openings.test.ts `4b9f75e289b13a6bb4ab7a09b6c7b816c4befedb99e3d86f248be361214a1ab7`.

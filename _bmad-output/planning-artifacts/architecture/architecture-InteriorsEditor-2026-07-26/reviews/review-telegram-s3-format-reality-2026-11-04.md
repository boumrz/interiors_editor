---
title: "AD-30 reality review: V1 portable disposition"
date: 2026-11-04
lens: "serializer, persistence, ZIP admission, numbers and build/file matrix"
verdict: "changes required / source-owner blocker"
---

## Finding: V1 export coverage and BackupFeasibility

**High.** The companion applies the eight-value restriction to `yawRadians` in *both* the historical V1 branch and the new `V1-wire` grammar. The existing V1 structural validator in `apps/web/src/domain/project-json-transfer.ts` accepts every finite `yawRadians`; `project-json-transfer.test.ts` includes a `0.5` fixture. The current backup export uses the V1 serializer and has no corresponding eight-value admission. Therefore a structurally accepted, readable and previously exportable V1 Project can be refused export by the proposed new wire, even if resources are healthy. The companion explicitly says rejection on unrepresentable data, but AD-4 requires every non-corrupt Durable Project meeting current policy to fit a complete offline backup, and S0–S7 preserves existing Web/PWA. Neither proposed refusal nor preserving the prior file alone proves those requirements for a current Project. Exact physical examples and full domain admissibility still need a focused fixture; this review does not claim every structurally valid fixture was physically published.

Also, current `parametric-item.ts` generally resolves legacy yaw to a discrete step for the ordinary editing path, and subsequent edits may remove `yawRadians`; the existence of a finite value does **not** by itself establish continuous rendered semantics. The loss at issue is refusal of an existing field/Project by the new portability boundary. Source owners must either specify exact lossless support for all previously admissible values with evidence, or record the conflict and restrict the dependent S3 readiness until a permissible compatibility/backup route is agreed. Do not silently quantize or claim full current-V1 coverage.

## Verified brownfield facts

- `serializeProjectCanonically` has no root `projectSchemaId` and uses JSON.stringify of the V1 shape. Export builds the `interiors.project/alpha-1@1` manifest and uses that serializer. In V1 the durable repository validates both Project structures, semantic JSON value equality, and checksum over the original revision string; the application recovery path adds its own checks. Distinguishing portable wire from internal revision serialization is justified.
- Hashes of `project-json-transfer.ts` and `project.ts` match the companion's recorded snapshots. The named arrays, floor/wall record keys, counts, optional fields and catalog quartet agree with the validator; the additional raw and closed restrictions are proposed policy, not a statement that current V1 already enforces them.
- Current ZIP decoding reads bounded `project/project.json`, checks the declared length, source ID and checksum, and validates resource entries; import then uses the raw parser and the V1 structural guard. PPJ-A1 project-member staged ingress is not the production import path. The proposed PPJ dispatcher/legacy disambiguation is a design proposal and needs SPEC registration and implementation/evidence.
- Existing old decoder explicitly accepts manifest selector `interiors.project/alpha-1@1`; a new `runtime-v1-wire@1` selector is not supported by this path. `ccdd13662cdca379` is an identified prior release in the delivery report, not proof of actual user-file coverage. The matrix correctly marks future wire, cross-target files, PPJ mapping and physical roundtrips pending.

## Secondary clarity

The words “produced by V1 serializer” in the proposed legacy grammar cannot be established from format and checksum: a third party can construct matching bytes. The adjacent paragraph correctly limits this to syntactic compatibility; change the phrase to “matching the historical serializer output” to avoid implying provenance. The “all V1 fields” statement should be qualified by the additional representability limits and especially the unresolved backup obligation above.

This is a read-only code/document review. It did not run tests, create real export files, inspect user data, assess S3 readiness or alter canonical documents.

## Повторная проверка изменений

**Вердикт: замечание по отказу finite-yaw устранено в архитектурной disposition; остаются source-owner registration и обязательное доказательство feasibility до замены export.** `V1-wire` сохраняет finite `yawRadians` без принудительной квантизации, включая пример `0.5`, сохраняет optional fields и существующий приоритет `yawStep` (`rotationStepForFootprint`). Замена прежнего export явно запрещена до доказанного покрытия healthy Durable V1. Наличие такого решения не доказывает выполнимость строгой grammar для всех записей, текущих файлов, физический roundtrip или S3 READY.

**Уточнение чисел:** фраза «все конечные binary64 без потерь» буквально включает IEEE-754 `-0`, но `JSON.stringify(-0)` выдаёт `0`. Исторический V1 export также использует JSON.stringify; поэтому нужно точно сформулировать, какие значения и исторические normalizations принадлежат формату, где теряется знак нуля и как работает fail-closed при необходимости побитового сохранения. Добавить fixture `-0` и не утверждать побитовую обратимость, которой JSON не даёт. Это вопрос точности контракта, а не доказательство наличия пользовательского повреждения.

**AD-26:** проверка `pin-staging-lease-coordinator.ts` подтверждает, что `reconcile()` освобождает подтверждённые staging roots, а `discard()` реализует ограниченный pin cleanup; обобщённый межконтекстный scope-wide GC ими не доказывается. Исправленное правило не выдаёт session roots одного controller за глобальный inventory. Проверенный независимый [Telegram Mini Apps vector](https://github.com/Telegram-Mini-Apps/tma.js/blob/master/apps/docs/platform/init-data.md) действительно содержит Ed25519 signature, bot ID, data-check string и ожидаемый успешный verify; это не официальная документация Telegram, и Spine правильно это обозначает. При фиксации implementation tests следует стабилизировать проверяемые байты или ссылку на конкретную revision источника и использовать отдельные test clock и production/test keys.

Рекомендация о слове «произведённый» сохраняется: проверка совместимости формы не доказывает автора файла. Повторная проверка остаётся документной; файлы пользователя и физические устройства не проверялись.

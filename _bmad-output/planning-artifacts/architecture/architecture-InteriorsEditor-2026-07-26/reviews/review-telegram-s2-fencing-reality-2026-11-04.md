---
title: "S2 scoped fencing — persistence reality review"
date: 2026-11-04
verdict: "changes required"
---

## Findings

1. **High: verification without a durable protection right permits delete/publish race.** Section 4 says a second consumer atomically protects existing bytes *or* reobtains and verifies their hash/size. The latter alone is insufficient: A reaches `no-publish`; B reads and verifies the same bytes; A executes `deletePinnedIfOwned`; B publishes a revision referencing now-missing bytes. Every consumer must obtain atomic resource-store protection/pin before its publication; after cleanup wins it must obtain exact bytes, verify and atomically pin/protect them again. No plain read/hash or unconditional fallback is enough. Recheck the actual protected bytes after protection, considering concurrent repair/replacement. Exercise deletion both before/after protect and before publication. The current `writeIfAbsentPinned` and `protectExistingResource` remove the first writer's exclusive deletion right atomically, illustrating the necessary seam; this observation does not prove the future cross-store protocol.
2. **High: Revision ID collision is not covered by the new-project ID collision predicate.** Existing `writeStaging` uses `revisions.put` keyed solely by `revisionId`, shared across Projects; an ID collision can overwrite an existing durable Revision before the current-pointer guard runs. Require, atomically within scoped stage creation, absent Revision ID and no overwrite (or exact same-attempt idempotent replay whose Project, checksum and bytes are verified), plus no attempt/lease ID reuse; test collisions with another Project and a previous same Project revision and ensure their bytes/checksums stay unchanged.

## Confirmed observations

- `DurableProjectRepository.publishCandidate` stages before fenced pointer publication and calls project-ID-only cleanup on stale base; `recover()` indiscriminately discards every listed stage. `IndexedDbVersionedProjectStore.writeStaging` performs no lease/base check, and pointer publication checks fence inside its transaction only later. Consequently current adapters cannot substantiate the proposed stronger Telegram behavior by themselves.
- Pin journal stores lease and a publication reference, and `reconcile()` checks publication callback/current state; this is not the proposed complete immutable predicate plus durable receipt. Current `discard` can fall back to unconditioned resource `delete`. A scoped implementation must not rely on that fallback.
- Permanent deletion currently deletes the writer lease, and future lease acquisition increments from existing record or starts at 1. Retaining a monotonic scope/project generation/tombstone is a new design obligation, not a description of baseline. Cross-context protections cannot be supplied by the per-runtime JS barrier alone.
- The S3 correction explicitly recognises `JSON.stringify(-0) → 0` and requires a fail-closed disposition where a stored negative-zero distinction matters; do not assert bit-exact representation has been demonstrated. The independent Telegram Mini Apps vector contains a complete Ed25519 example and is identified as third-party; the link still tracks `master`, so reproducible evidence should pin the source revision or exact vector bytes.

This review is read-only. It did not run race tests, alter application code or canonical decisions, access physical devices, or make an implementation-readiness assessment.

## Повторная проверка после исправлений

**Вердикт: оба первоначальных high замечания устранены в проектном контракте; реализация и evidence остаются обязательными.** Пункт 5 теперь требует atomic protect/pin для каждого второго consumer и проверку защищённых bytes; перечень проверок включает гонки между чтением, защитой и publication. Пункт 2 требует no-overwrite Revision с проверкой ID в пределах scope, а также контроль attempt/lease ID. Пункты 1 и 7 дополнительно определяют общий Web Lock с fail-closed и adoption полного journal после takeover. Это не подтверждение работы браузеров или исходного baseline: deterministic races и physical WebView evidence не запускались.

**Остаточная точность ID:** нельзя строго гарантировать формулировку «attempt ID и lease ID никогда не переиспользуются» одной криптографической случайностью и проверкой текущих записей, если завершённые journal/receipt удаляются. Для абсолютного запрета ABA нужны долговечный счётчик/tombstone или формально непереиспользуемая комбинация scope и monotonic generation/sequence; иначе указать вероятностную гарантию и отдельно доказать защиту от ABA. Включить forced collision после завершения и удаления журнала в проверку. Эта деталь относится к способу соблюдения уже принятого invarianta, а не к доказанному дефекту текущих пользовательских данных.

## Заключительная проверка allocator

**Итоговый verdict: PASS для рассмотренного архитектурного решения; реализация, race tests и device evidence не оценивались.** Пункт 3 теперь фиксирует сохранённый scope-local uint64 counter, отдельную необратимую atomic reservation под Web Lock, различающиеся kind, запрет reset/reuse и fail-closed при исчерпании без wrap. Corpus включает crash после reservation, попытку reset, overflow и ABA. Это закрывает предыдущее замечание о невозможности доказать no-reuse одной случайностью. Для реализации остаётся доказать долговечность reservation и корректное точное представление полного диапазона, включая восстановление после crash; сама запись не является прохождением этих проверок или readiness.

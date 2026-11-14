---
title: "InteriorsEditor — topology/data-integrity re-review: D-011…D-013, revision 7"
review_type: topology-data-integrity
reviewed: 2026-08-05
reviewer: "Codex /root/architecture_topology_review"
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
artifact_revision: 7
previous_reviews:
  - review-topology-data-integrity-d011-d013-2026-08-05.md
  - review-topology-data-integrity-r5-2026-08-05.md
  - review-current-source-topology-policy-revision-6-2026-08-05.md
  - review-topology-policy-adversarial-r6-2026-08-05.md
status: complete
verdict: ACCEPTABLE_AS_PRECANONICAL_INPUT
readiness: NOT_READY
scope: "Fresh read-only topology/data-integrity review of revision 7; no canonical source, Spine, memlog, evidence, prototype, application, test, or configuration mutation"
source_mutations: none
---

# Независимый topology/data-integrity re-review — revision 7

## Вердикт

**`ACCEPTABLE_AS_PRECANONICAL_INPUT`; `NOT_READY` остаётся без изменений.**

Revision 7 закрывает оба предыдущих data-integrity риска: больше не смешивает
расширение контейнера с его entry path и задаёт полное правило группирования
точных candidate/Plan contacts. Оно годится только как вход в следующий
source-owning `bmad-architecture` update. Это не означает, что AD-7 уже
изменён, valid-X уже канонизирован, S-2 стал production kernel или что можно
начинать implementation.

## Независимая проверка

Сопоставлены draft revision 7, предыдущий R5 topology/data-integrity review,
R5/R6 current-source reviews, R6/R7 adversarial reviews, Architecture Spine
AD-3, AD-4, AD-7 и AD-12, Geometry Contract §§1, 3, 4, 6 и 10–12, Project and
Portable Backup Contract §§1–5, glossary и delegated clarification §§4.2.1 и
4.3.1.

Read-only mechanical checks:

- все 11 source links и все перечисленные completed review inputs из draft
  разрешаются в workspace;
- `lint_spine.py` для неизменённого текущего Spine вернул `ok: true` и `0`
  findings; это проверка целостности текущего Spine, не adoption draft;
- независимый exact-boundary probe подтвердил grammar
  `^-?(?:0|[1-9][0-9]*)$`, отсутствие half-way случая в predicate для всех
  `L = 1…100000`, относительный 100-mm step для восьми направлений, разбиение
  single/multiple pass-through и four-piece X, а также различие канонического
  и намеренно недопустимого backup entry path.

## R7 data-integrity assessment

| Проверяемая граница | Revision-7 evidence | Оценка |
| --- | --- | --- |
| Exact JSON/Portable Backup boundary | Draft lines 97–116, 265–281, 320–331 и 401–408 называют только `project/project.json` **inside the `.interiors` bundle**. Это в точности соответствует обязательной logical structure Project/Backup Contract §2 (`manifest.json`, `project/project.json`, …). Fixture отдельно требует отвергнуть `.interiors/project/project.json` через существующую path/schema boundary. | **Pass.** R6 wire-format contradiction устранено; отрицательный fixture не создаёт альтернативного формата. |
| Lossless integer ingress | Raw JSON numeric lexeme проходит schema-aware проверку до IEEE-number coercion; `Number.isSafeInteger` остаётся final guard; `-0` нормализуется в `0`; `BigInt` эфемерен. Safe/project bounds проверяются до exact arithmetic и ещё раз после endpoint construction. | **Pass as proposed policy.** Это предотвращает округлённое принятие дробного persistence input и не переносит `BigInt` в JSON/Revision/Backup. Stable import reason остаётся у `bmad-spec`, как и должно быть. |
| No partial mutation / durability | Draft lines 134–152 разделяют parse/normalization/topology rejection, stale worker discard и persistence failure после `Validated`. Только полный Validated ChangeSet достигает `PendingDurability`; reject не создаёт History/autosave/durable projection; post-validation failure сохраняет только fenced pending retry/recovery state. | **Pass.** Это соответствует AD-3 и AD-12 и не превращает rejected candidate в частично опубликованный Plan. |
| Relative 100-mm direction | Lines 154–180 используют `k × d`, `k > 0`, а gesture candidate вычисляется как `origin + (100 × k) × d`. Exact numeric path обходить только visual selection и не обязан быть кратным 100 mm. | **Pass.** Совпадает с delegated §4.2.1: off-grid origin сохраняет точную cardinal/45° геометрию, а visual grid не становится storage lattice. |
| Endpoint and junction contacts | Lines 194–213 задают полный набор: endpoint/existing Vertex, endpoint/existing segment interior, candidate interior/existing Vertex (включая multi-Wall junction) и interior/interior. Каждая coordinate group reuse-ит существующий Vertex или создаёт ровно один общий Vertex. | **Pass.** Ранее пропущенный singular proposed-interior pass-through существующего Vertex теперь однозначно split-ит proposed segment; уже инцидентные существующие segments, у которых contact является endpoint, не получают ложный split. |
| Complete partition semantics | Каждый proposed/existing segment, содержащий group coordinate в своём interior, partition-ится по всем distinct contacts, ordered along the segment, в distinct consecutive endpoint pairs. Zero/duplicate/coincident/too-short piece, overlap, self-intersection, non-integer or out-of-limit contact отклоняют весь detached candidate. | **Pass.** Правило покрывает T, one-X, multi-X и multiple junction pass-through без first-crossing-only результата; сохраняется invariant Geometry Contract §3, что intersection допускается только в shared Vertex. |
| D-022 boundary | Kernel, tolerance, ties/hysteresis, selection continuity, Room/Opening reconciliation, usable-polygon rounding и measurement locale/precision перечислены как открытые и не выводятся из библиотеки. | **Pass.** R7 не маскирует незакрытую политику под topological default. |

## Проверка all-contact partition semantics

Новый total rule имеет требуемую семантику в каждом точном случае:

1. **Endpoint → existing Vertex:** group reuse-ит Vertex; ни один segment не
   split-ится только из-за endpoint contact.
2. **Endpoint → existing segment interior (T):** existing segment содержит
   coordinate в interior и split-ится; proposed segment заканчивается в том же
   shared Vertex.
3. **Proposed interior → existing Vertex/junction:** proposed segment содержит
   coordinate в interior и split-ится, включая случай нескольких existing
   segments, уже сходящихся в этом Vertex.
4. **Proposed interior → existing segment interior (X):** обе стороны
   split-ятся в одной coordinate group, yielding exactly one Vertex and four
   pieces for one X.

Grouping before partitioning также предотвращает два разных Vertex на одном
contact coordinate. Ordering all distinct contacts per affected segment
предотвращает разницу между «первым найденным crossing» и полным ChangeSet.
Full invariant validation остаётся последним guard для Room, Opening и host
последствий, поэтому rule не обещает durable acceptance кандидата, который
после split нарушает другой invariant.

## Что всё ещё не разрешено этим review

- R7 ещё не прошёл обязательный owner workflow: decision log через
  `memlog.py`, re-distill AD-7, canonical reconciliation PRD/SPEC/UX и три
  независимые проверки уже **distilled Spine**.
- Valid exact X остаётся рабочим input, пока `bmad-prd`, `bmad-spec` и
  `bmad-architecture` не устранят имеющееся source-level расхождение с FR-9.
- Перед adoption необходимы corpus fixtures, перечисленные в draft lines
  320–369, в том числе raw-byte backup ingress, all-contact partitions,
  no-partial mutation и storage failure.
- `D-022`, terminal spike evidence, physical NFR-15 traces, AssetUsageGrants,
  `G-1`, `G-CP-ADR` и финальный independent `READY` остаются открытыми.

Ни Spine, ни `.memlog.md`, ни source-of-truth contract, ни implementation
artifact не были изменены этим review.

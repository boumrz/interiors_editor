---
title: "InteriorsEditor Alpha — rubric-review Architecture Spine (2026-08-09)"
review_type: architecture-rubric
status: complete
reviewed: 2026-08-09
reviewer: "rubric walker — read-only review context"
verdict: concerns
readiness_status: "not assessed; G-READY remains NOT_READY"
targets:
  - ../ARCHITECTURE-SPINE.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
  - ../../../../project-context.md
  - ../../../../../plans/topology-kernel-decision-input-2026-08-09.md
  - ../../../../../plans/storage-recovery-decision-input-2026-08-09.md
  - ../../../../../plans/renderer-mobile-decision-input-2026-08-09.md
  - ../../../../../plans/catalog-control-plane-decision-input-2026-08-09.md
---

# Rubric-review обновлённого Architecture Spine

## Вердикт

**CONCERNS.** Обновление последовательно фиксирует минимальные архитектурные
границы для topology kernel, fenced storage/recovery, renderer lifecycle и
Catalog Control Plane. Однако до полного handoff пакета нужны два точечных
исправления: явный source-owner handoff для V1/V2 migration/reason mapping и
полная архитектурная граница для mutating mobile/numeric/list interaction.

Это read-only review. Оно не является implementation-readiness assessment,
независимой человеческой проверкой, юридическим заключением, device trace или
доказательством какого-либо gate. Текущий `G-READY` остаётся `NOT_READY`.

## Scope и метод

Проверены обновлённый `ARCHITECTURE-SPINE.md`, его новые source inputs от
2026-08-09, обязательные Geometry и Project/Backup companions, UX contract и
`project-context.md`. Rubric применяет checklist reviewer gate:

1. зафиксированы ли реальные divergence points;
2. enforceable ли `Rule` каждого нового/изменённого `AD-*`;
3. не оставляет ли `Deferred` несовместимый выбор нижележащим units;
4. соблюдены ли source-owner boundaries;
5. покрыты ли затронутые CAP и operational/environmental dimensions;
6. не подменены ли evidence, external authority или actual readiness.

### Deterministic observations

- `uv run .agents/skills/bmad-architecture/scripts/lint_spine.py --workspace
  _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26`
  вернул `ok: true`, `0` findings;
- все declared source/companion paths из frontmatter разрешаются;
- `AD-4` теперь нейтрален к substrate и явно фиксирует `ProjectId` binding,
  fenced logical publication и cross-store journal/reconciliation;
- `AD-10`/`AD-13` оставляют renderer candidates deferred и не подменяют
  physical/participant evidence browser automation;
- `AD-17` сохраняет no-Project-data perimeter и не назначает Roman, агента или
  иной неуполномоченный субъект Legal/Asset, Security/Operations либо
  independent reviewer.

## Checklist summary

| Dimension | Observation |
| --- | --- |
| Paradigm, direction and ownership | Hexagonal ports, Commands и disposable projections остаются согласованными с CAP/SPEC. |
| Topology divergence | `AD-20` корректно выбирает domain-owned kernel и исключает library/renderer/legacy source of truth. |
| Durable publication | `AD-3` + amended `AD-4` задают один fenced publish boundary; concrete substrate корректно оставлен deferred. |
| Renderer/mobile boundary | Lifecycle, fallback, cutaway и comparable corpus зафиксированы; общий semantic command boundary для всего mobile/a11y input landed не полностью. |
| Catalog/control-plane perimeter | Allow-list `CatalogGatewayPort`, local pin/publication и negative corpus соответствуют входному материалу. |
| Source-owner discipline | Exact offset/join, raw grammar, reason union, UX thresholds и Legal grants не присвоены Architecture. V1/V2 migration/reason mapping ещё не имеет явного owner handoff. |
| Deferred hygiene | Renderer, storage substrate, control-plane operations и external evidence названы с условиями возврата; два gaps ниже нужно закрыть/явно defer. |
| Operational/environmental envelope | PWA update, local recovery, catalog operations и deployment details либо bound, либо explicitly deferred. |
| Technology currency | Новые решения не привязывают новую версию technology; existing pinned/candidate stack не изменён этим review. |
| Evidence integrity | Нет заявления о `READY`, фактическом device result, participant result, independent review result или AssetUsageGrant. |

## Critical findings

Критических findings в рамках этого update не найдено.

## High findings

### RR-20260809-01 — V1/V2 migration/reason mapping не закрыт и не вынесен в Deferred

**Severity:** High  
**Disposition:** defer to source owner before any legacy import/migration path.

**Evidence.** Topology input прямо требует определить, какие V1/V2 Projects
мигрируют losslessly, какие остаются readable legacy, какие требуют explicit
recovery, а также mapping старых ошибок на stable canonical reasons. `AD-20`
защищает V1/V2 как characterization fixtures, но не называет matrix, owner или
revisit condition. Geometry Contract содержит общий copy-on-write migration и
current reason union, но не canonical V1/V2 migration/reason table.

**Why it matters.** Два independently built import/migration units смогут
принять разные lossless/read-only/recovery outcomes либо разные reason codes;
это создаст silent reinterpretation именно там, где `AD-20` её запрещает.

**Required remediation.** Добавить в `Deferred` явный source-owner handoff:
fresh `bmad-spec` update Geometry + Project/Backup contracts должен принять
versioned V1/V2 matrix, stable reason mapping и corresponding corpus. До этого
V1/V2 допускаются только как characterization fixtures; automatic migration,
legacy import и Durable publication через них не определены. Архитектура не
должна сама изобретать эту matrix.

### RR-20260809-02 — Mobile interaction boundary не покрывает numeric/list и reduced-motion целиком

**Severity:** High  
**Disposition:** autofix in Architecture while preserving UX ownership.

**Evidence.** Renderer/mobile input требует связать one/two-finger,
numeric/list alternative, accessibility target, safe-area, keyboard и
reduced-motion с тем же semantic topology command path. `AD-13` фиксирует
one/two-finger и numeric semantic paths, а `AD-15` — Focus, safe viewport,
keyboard и critical controls. Но Spine не фиксирует, что mutating numeric/list
alternative проходит тот же `PlanProjectionPort`/allocation-free preflight/
Command route; reduced motion отсутствует в architecture boundary вовсе. UX
уже владеет concrete gesture table, labels, 44×44 targets и reduced-motion
presentation, поэтому эти детали не нужно дублировать.

**Why it matters.** Иначе UI unit может реализовать list/numeric alternative
как второй mutation path или сделать reduced-motion ветку семантически иной,
минуя topology validation, stale/fence checks и stable reasons.

**Required remediation.** Кратко дополнить `AD-13` либо `AD-15`: любой
**mutating** touch/numeric/list alternative routes through the same
`PlanProjectionPort` where screen conversion is needed and the same detached
preflight → Command path as the canonical interaction; pan/pinch, Focus и
reduced-motion остаются UI-only and do not alter Draft/Project semantics. UX
retains thresholds, labels, target dimensions and motion presentation. Добавить
эти rows в planned interaction corpus, не заявляя, что corpus уже выполнен.

## Medium finding

### RR-20260809-03 — Capability map не отражает AD-20 для CAP-8

**Severity:** Medium  
**Disposition:** autofix.

**Evidence.** `AD-20` declares `CAP-8` in `Binds` because it owns allocation
intent/inverse, yet the `CAP-8 history` row in Capability → Architecture Map
lists only `AD-3, AD-12`.

**Why it matters.** Это не меняет rule, но скрывает новый kernel/inverse
invariant от будущего slice owner и traceability review.

**Required remediation.** Add `AD-20` to the CAP-8 row only; do not broaden
CAP ownership or create a new requirement.

## Observed strengths and no-finding areas

- `AD-4` resolves the concrete storage divergence raised by the input without
  prematurely selecting IndexedDB Blob, OPFS or hybrid. Its journal condition
  makes the rule enforceable even if a later substrate has no native
  cross-store transaction.
- `AD-10` and `AD-13` preserve renderer-as-projection, define loss/recreate/
  fallback behaviour and keep a renderer selection contingent on comparable
  corpus plus independent review. No physical device or participant result is
  inferred.
- `AD-17` has the required catalog-only allow-list, local ownership boundary
  and negative-corpus obligation; API, delivery, operations, authentication,
  retention and named external authorities remain correctly deferred to
  `G-CP-ADR`.
- `AD-20` preserves the Geometry and Project/Backup companions as owners of
  exact offset/join, raw grammar and reason-union semantics, so it does not
  turn the Spine into a competing capability contract.

## Closing note

After RR-20260809-01 through RR-20260809-03 are addressed, rerun the
deterministic lint and this rubric lens together with the configured reviewer
set. Those document checks still cannot substitute for the future versioned
corpora, target-runtime replay, independent attribution, Legal grant dossiers,
participant sessions or physical-device traces.

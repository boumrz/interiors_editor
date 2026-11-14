---
title: "InteriorsEditor — current-source/reality review: D-011…D-013 reconciliation"
review_type: current-source-reality
reviewed: 2026-08-05
reviewer: "Codex /root/ownership_readiness_review"
reviewed_artifact: ../topology-policy-reconciliation-draft-2026-08-05.md
status: complete
verdict: REJECT_FOR_CANONICAL_ADOPTION
readiness: NOT_READY
scope: "documentation-only first reviewer lens; no source, Spine or memlog mutation"
source_mutations: none
---

# Независимый current-source/reality review: D-011…D-013

## Вердикт

**`REJECT_FOR_CANONICAL_ADOPTION`; общий статус остаётся `NOT_READY`.**

Draft честно помечен non-canonical и пригоден как **pre-gate input**. Его
математическая формула для положительного целого `L` корректна, обработка
`L = 0` согласована с `ZERO_LENGTH`, а описание S-2 evidence не выдаёт
синтетический prototype за продуктовую спецификацию. Но текст пока не может
быть перенесён в AD-7: остаются две недоопределённости нормализации и одно
непримирённое противоречие с текущим PRD о X-intersection.

Это только первый current-source/reality lens. Он **не** заменяет обязательные
независимые adversarial lower-level divergence и topology/data-integrity
reviews, указанные самим draft; этих двух отдельных review outputs пока нет.

## Метод и граница

Read-only сверены draft, текущий AD-7, SPEC и geometry contract, PRD, UX,
project-context, change proposal и S-2 work package/policy/test evidence,
включая независимый S-2 integrity review. Ни Spine, ни `.memlog.md`, ни
prototype source/test не изменялись и не запускались.

Механические read-only checks:

- `uv run .agents/skills/bmad-architecture/scripts/lint_spine.py --workspace ...`:
  `ok: true`, `0` findings;
- exact-integer probe проверил predicate
  `(2n-1)^2 < 2L^2 < (2n+1)^2` для всех `L = 1…100000` и
  `Number.MAX_SAFE_INTEGER`, не используя float; для `L = 0` не найдено ни
  одного неотрицательного `n`.

## Что согласовано и не переоценено

| Проверяемый тезис draft | Current-source result |
| --- | --- |
| Grid не является канонической координатой; visual grid и snap различны. | Согласовано с Geometry Contract §1/§4, glossary и AD-7. |
| 100 mm gesture snap, visual 100/500/1000 mm, eight directions и off-grid integer numeric input. | Это ровно delegated **working policy** D-011…D-013 из change proposal §4.2; пока не adopted PRD/SPEC/AD rule. Draft это честно обозначает. |
| Integer endpoints и preview фактической диагонали. | Согласовано с PRD FR-8, Geometry Contract §1 и AD-7. |
| S-2 способен подтвердить лишь bounded synthetic integrity evidence. | Точно: report/independent review подтверждают 43/43, typecheck, coverage и mutation в disposable runtime, но policy-boundaries оставляет grid/tolerance/45° normalization, X/T, Room reconciliation и kernel open. |
| S-2 не делает terminal, не authorizes production и не закрывает NFR-15. | Точно: work package и independent review сохраняют `needs-further-evidence`; draft не делает обратного утверждения. |
| Границы после D-011…D-013 остаются open. | Согласовано с S-2 policy boundaries; no library default may become policy. |

Следовательно, в draft нет ложного claim о physical evidence, S-2 terminal
status или готовности к implementation. Его `canonical: false` и
`implementation_ready: false` соответствуют реальности.

## Проверка exact diagonal formula

Для положительного integer `L` выбор nearest integer к `L / sqrt(2)` равносилен

```text
n - 1/2 < L/sqrt(2) < n + 1/2
⇔ (2n - 1)^2 < 2L^2 < (2n + 1)^2.
```

Обе части положительны при допустимом `L` и candidate `n`, поэтому возведение
в квадрат сохраняет порядок. Half-way tie невозможен: крайние квадраты
нечётные, а `2L^2` чётно. Thus draft lines 75–95 correctly replace an
authoritative float/`Math.round` decision with an exact `BigInt` predicate.
Для `L = 0` левая строгая часть уже ложна (`1 < 0` для `n = 0`), поэтому
правило draft «reject before normalization» необходимо и математически верно.

## Findings, blocking canonical adoption

### CS-TP-01 — High: negative/non-integer length is not rejected before the squared predicate

**Evidence.** Geometry Contract §1 defines domain length as a *signed safe
integer*; PRD FR-6 requires zero and negative dimensions to reject before
commit. Draft only gives a concrete pre-normalization reason for `L = 0`
(lines 90–95 and 108–111). Because the predicate contains `L²`, a negative
`L` produces exactly the same `n` as `abs(L)` if an implementation reaches
normalization. Fractional requested length has no equally explicit stable
rejection path either.

**Risk.** A command adapter can silently turn an invalid negative requested
length into a valid positive diagonal candidate, breaking the rejected-command
and no-partial-mutation contract.

**Required closure.** Before the exact predicate, state a total input boundary:
non-integer or `L < 0` returns `INVALID_DIMENSION`; `L = 0` returns
`ZERO_LENGTH`; only `L ∈ positive integer` reaches `BigInt` normalization.
Add corpus cases for negative, fractional and zero `L`, each proving that no
candidate/Command/Revision is constructed or changed.

### CS-TP-02 — High: “one of eight direction vectors” lacks the required integer scalar and sign handoff

**Evidence.** Draft lines 69–73 says that a numeric endpoint/delta must hold
one of `(±1,0)`, `(0,±1)`, `(±1,±1)`. Read literally, that admits only unit
deltas; a direction rule must instead say that the endpoint delta is an
integer positive scalar multiple of one of those eight unit directions. The
same omission leaves the requested diagonal's origin/quadrant/sign selection
outside the normative rule, although the verification section later mentions a
quadrant.

**Risk.** Touch, numeric and future kernel paths can implement different
acceptance predicates: one checks exact unit vectors, another checks slope,
and a third silently chooses a quadrant.

**Required closure.** Define one exact relation, e.g.
`(deltaXmm, deltaZmm) = k * d`, where `d` is one of the eight unit directions
and `k` is a positive integer. For a requested diagonal length, bind the
already-selected/entered diagonal `d` to `k = n`, with endpoints
`start + n*d`; normalization chooses magnitude only, never direction. Cover
all four diagonal signs, axis directions, an off-grid valid scalar and an
invalid non-45° delta.

### CS-TP-03 — High: X-intersection cannot be merely deferred while current PRD says every geometric intersection splits

**Evidence.** Draft lines 85–88 and 142–148 leave `reject` versus automatic
four-segment split for X intersections open, matching Geometry Contract §3.6
(`split` **or** reject) and S-2 policy boundaries. But current PRD FR-9 says
without that qualification: “Геометрическое пересечение создаёт общую Vertex
и необходимые Wall segments атомарно.” Its consequence presently promises a
split, not the open `reject` branch.

**Risk.** A canonical AD-7 saying that X default remains unresolved would
conflict with a current product requirement that appears already decided. This
is an acceptance/data-integrity difference, not just a library choice.

**Required closure.** The owner workflows must either select automatic split
or reconcile FR-9 to say: an **accepted** intersection atomically creates the
shared Vertex/segments, while an attempted X may be rejected by the separately
chosen X policy. Record that explicit routing in the architecture update; do
not leave the current contradiction hidden in “outside this delta”.

### CS-TP-04 — Medium: `SnapPolicy` is called versioned without a lifecycle/provenance contract

**Evidence.** Draft lines 61–67 introduces a “versioned pure policy” but does
not say whether its version is code-only, input/Command provenance, or a
versioned schema attribute. The canonical Plan correctly must not store a
visual grid, but AD-3/NFR-4 still require deterministic command/durable-state
behavior across policy evolution.

**Risk.** A later policy change could re-normalize an existing user intent or
make a Command replay depend on whatever policy happens to be installed.

**Required closure.** State that completed endpoints are never
re-normalized; define the policy-version lifecycle. If Commands can be replayed
from intent, include an immutable policy identifier in their input/provenance;
if not, state that `SnapPolicy` is construction-time code/configuration only
and a policy change is schema/compatibility-governed. It must not become a
second mutable geometry source of truth.

## Non-blocking observation

The visual-grid zoom thresholds are intentionally not specified. That is
acceptable only as presentation/UX policy because draft explicitly forbids any
effect on DraftCommand, canonical coordinates or Revision. A future UX owner
must define threshold/hysteresis if consistent visible grid behaviour becomes
an acceptance criterion; it is not evidence that D-011 changes canonical
geometry.

## Required disposition

1. Keep the draft non-canonical and `NOT_READY`; do not edit AD-7, PRD, SPEC,
   geometry companion, decision register or project-context from this review.
2. Resolve CS-TP-01…CS-TP-04 in the fresh source-owning `bmad-architecture`
   update, then route resulting companion/PRD/UX wording to their owners.
3. Preserve the S-2 boundary: new corpus is required for this delta; S-2
   source is neither a production module nor proof of diagonal normalization.
4. Obtain two new, distinct outputs before any canonical adoption:
   adversarial lower-level divergence review and topology/data-integrity
   review. This current-source review cannot stand in for either.
5. Re-run the spine mechanical lint and the reviewer gate after those fixes.

Nothing in this review alters `G-READY`, NFR-15, the waiver boundary or
authorization for product implementation.

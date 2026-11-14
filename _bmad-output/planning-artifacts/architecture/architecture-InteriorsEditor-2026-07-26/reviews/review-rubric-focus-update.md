---
title: "InteriorsEditor Alpha — независимый Focus rubric-review архитектуры"
review_type: architecture-rubric-focus-update
status: complete
reviewed: 2026-08-04
reviewer: "independent rubric walker"
verdict: pass-with-follow-up
targets:
  - ../ARCHITECTURE-SPINE.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/DESIGN.md
  - ../../../ux-designs/ux-InteriorsEditor-2026-07-26/EXPERIENCE.md
---

# Независимый Focus rubric-review архитектуры

## Verdict

**PASS WITH FOLLOW-UP.** Обновлённый Spine теперь содержит достаточный
архитектурный контракт для реализации Focus: это UI-only AppShell seam с
событийной моделью native fullscreen, capability-first fallback, fakeable
platform port и явной защитой доменного/durable state. Toolchain больше не
является скрытым prerequisite для первого scaffold. Критических или high
расхождений с SPEC, PRD и UX Focus не найдено.

Это verdict качества архитектурного substrate, **не** общий `READY` и не
подмена обязательных gates: Playwright доказывает browser paths, а восемь
physical `NFR-15` rows остаются release evidence.

## Scope and method

Проверены текущий `ARCHITECTURE-SPINE.md`, Focus contract в SPEC (`CAP-5`,
`CAP-9`, `CAP-11`), PRD (`FR-53`, `NFR-15`, `NFR-27`) и UX (`DESIGN.md`,
`EXPERIENCE.md` / `UXF-7`). Применён good-spine checklist: divergence points,
enforceable AD rules, coverage, deferred hygiene, test seams, toolchain,
operational envelope и отсутствие ложных device claims.

Детерминированная проверка `lint_spine.py` завершилась `ok: true` с нулём
findings. npm registry подтвердил exact pins AD-16 на дату review:
Node `24.19.0`, pnpm `11.20.0`, create-vite `9.1.2`, Vite `8.2.0`, TypeScript
`7.0.2`, React `19.2.8` и Playwright `1.62.0`.

## Rubric result

| Dimension | Result | Evidence |
| --- | --- | --- |
| Real divergence points | Pass | AD-15 отделяет Focus от domain, renderer и persistence и фиксирует state reconciliation native events. |
| Enforceable rules | Pass | `FocusPlatformPort` fakeable; unit/browser paths и physical rows названы отдельно. |
| SPEC / PRD / UX coverage | Pass | `CAP-5`, `CAP-9`, `FR-53`, `NFR-27` и `UXF-7` прямо bound в AD-15. |
| Toolchain / first scaffold | Pass | AD-16 фиксирует starter, Node, pnpm, frozen lockfile и emitted bundle target до bootstrap. |
| No false device claim | Pass | Native fullscreen и standalone определены как capability observation/fallback, не как обещание убрать browser/system chrome. |
| Operational envelope | Follow-up | Release compatibility есть в AD-11, но promotion ownership/cache-header contract не зафиксирован в spine. |

## No blocker / high finding

Не найдено. В частности, AD-15 соответствует важным Focus requirements:

- вход немедленно устанавливает in-app Focus, а `NativeActive` возможен только
  после `fullscreenchange` и проверки фактического элемента;
- rejection, `fullscreenerror`, отсутствие element и external user-agent exit
  возвращают только native substate к in-app Focus;
- Focus не создаёт Command/Revision/history/persisted mutation и не меняет
  Project, selection, mode/tool, gesture, durability, writer lease или
  recovery state;
- safe viewport, textual status, exit и применимые action rails сохраняются;
  blocking recovery/confirmation/error имеет приоритет;
- explicit rule отделяет controlled Playwright paths от `NFR-15` physical
  observation. Следовательно, Spine не превращает simulation или PWA
  standalone в false native-fullscreen compatibility claim.

## Medium follow-up

### RRF-01 — Operational release contract остаётся неполным

**Severity:** Medium — discuss/defer with a named release owner before public
alpha; не блокирует отдельно Focus implementation.

**Evidence.** AD-11 определяет `ReleaseManifest`, schema compatibility,
safe activation и immutable artifacts для rollback/recovery. Structural seed
называет static origin/CDN, а `Deferred` оставляет vendor neutral. Но Spine не
фиксирует, кто и как promotes immutable build между environments/device lab,
какой cache/header contract обязателен для entry document, service worker и
hashed assets, и где хранится compatibility/rollback decision record.

**Why it matters.** Разные delivery units могут одинаково выполнить AD-11,
но по-разному кэшировать entry/SW или считать build promoted, что создаёт
несовместимый PWA update path. Это operational seam, а не Focus UX defect.

**Closure.** Либо добавить короткий release-environment AD (promotion,
immutable artifact retention, cache policy, owner and evidence record), либо
явно оставить его Deferred с owner/revisit condition до release certification.

## Boundary retained by this review

Ни Playwright, ни данный документ не закрывают `NFR-15`. Для каждого из восьми
named physical contexts требуется observed fullscreen probe/request result,
in-app fallback, external exit (когда applicable), state preservation и
safe-viewport rails. Это не рекомендуется смягчать в architecture update.

---
work_package_id: W-SPK-2026-08-04
spike: S-4
title: "Изолированный touch / numeric interaction evidence prototype"
status: PAUSED
waiver: _bmad-output/planning-artifacts/spike-only-waiver-2026-08-04.md
prototype_root: _bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-4/
evidence_root: _bmad-output/planning-artifacts/evidence/spikes/S-4/
implementation_evidence_owner: "Codex /root/gcp_decision_research"
independent_reviewer: "Codex /root/ownership_readiness_review"
terminal_independent_review: S-4-post-amendment-b-independent-review-2026-08-05.md
terminal_disposition: PAUSED
cleanup_status: COMPLETED_RECOVERABLE_TRASH_MOVE
cleanup_trash_target: /Users/romanzheltov/.Trash/InteriorsEditor-W-SPK-2026-08-04-S-4-2026-08-05
gate_g1_user_research: PENDING
g1_note: "Выполняется параллельно и не пройден; автоматизированный prototype не заменяет исследование с участниками."
created: 2026-08-04
---

# W-SPK-2026-08-04 / S-4 — work package

## Вопрос эксперимента

Можно ли на мобильном экране сделать различимыми и доступными три пути
изменения стены: direct touch edit, точный числовой ввод и отмену активного
жеста; при этом не смешать one-finger edit, two-finger camera/navigation и
системные/панельные жесты?

## Разрешённая работа

- Одноразовый, synthetic, mobile-first DOM prototype только в указанном
  `prototype_root`.
- Локальные manifest, test runner, Playwright tests, synthetic fixtures и
  генерируемые test artifacts только в `prototype_root`.
- Проверяемые отчёты и единственный финальный screenshot — только в
  `evidence_root`.
- Проверка browser-emulated mobile touch flows и доступных DOM-контролов.

## Жёсткая граница

Это не application/production code и не foundation для него. Запрещены root
source, root manifests/configuration/tests, PWA/build/CI configuration,
production data, real user project data, network publication, shared module,
commit, tag, push и перенос исходников prototype в product.

## Планируемые проверяемые свойства

1. Все main action targets имеют CSS bounds не меньше `44×44` px и учитывают
   `safe-area-inset-*`.
2. В режиме `Правка стены` один указатель обновляет только preview стены;
   два указателя не мутируют этот preview и переводят interaction в camera
   gesture state.
3. В режиме `Камера` одиночное касание не редактирует стену.
4. Числовая альтернатива принимает целые миллиметры, показывает единицу `мм`,
   сохраняет последнее допустимое значение при неверном вводе и позволяет
   подтвердить изменение без direct manipulation.
5. Отмена активного жеста возвращает последнее durable synthetic значение;
   undo действует только после подтверждённого изменения.
6. Нет зависимости от hover/precision pointer; reduced-motion отключает
   декоративную transition, controls имеют доступные names/status.

## Pass / pause / kill criteria

**PASS** допускается только при всех условиях ниже:

- воспроизводимые Playwright mobile-touch и accessibility checks проходят;
- зафиксированы реальные recordings задач с назначенными участниками на
  физических iPhone и Samsung contexts;
- `G-1` имеет независимое evidence `PASS`;
- независимый reviewer подтверждает report и отрицательные результаты.

**PAUSED** обязателен, если отсутствуют recordings участников, physical-device
task evidence или `G-1 PASS`, даже когда browser automation green.

**KILLED/PIVOTED** обязателен, если prototype обнаружит неустранимый конфликт
между edit/camera/numeric contract либо участники не могут различить роли
жестов после корректировки гипотезы.

## Предопределённый текущий terminal risk

До появления real participant/device task recordings и отдельного `G-1 PASS`
эксперимент не может завершиться `PASS`; после browser evidence его ожидаемый
статус — `PAUSED` с точным перечнем недостающих доказательств.

## Current evidence disposition — 2026-08-04

Full S-4 browser evidence and independent review are recorded in
`S-4-evidence-report-2026-08-04.md`. The reviewer confirmed `PAUSED`: the
six emulated Playwright paths reproduce, but mutation strength is 60.16%, the
sticky history rail overlaps the numeric card in the retained viewport capture,
and no participant, physical-device or `G-1 PASS` evidence exists.

`PAUSED` does not authorize cleanup, source promotion or a product claim. A
newly proposed bounded S-4 amendment may only repair/test the documented
synthetic layout issue or add separately labelled browser evidence; it cannot
alter the pass criteria or substitute for physical research.

## Amendment A — in-app Focus layout / non-overlap evidence

**Authorized 2026-08-04 after independent `PAUSED confirmed` review.** This
amendment responds to the user request for an unobstructed phone authoring
surface and to the reviewer's concrete overlap finding. It does not reopen the
terminal `PASS` gate.

### Bounded experiment

Within the existing S-4 prototype only, test whether a named **in-app Focus**
layout can immediately free the synthetic canvas area while preserving a
touch-sized explicit exit, truthful synthetic status, current mode, applicable
cancel/undo/redo and an explicit numeric alternative. The normal numeric card
may be explicitly collapsed in Focus but cannot silently disappear. Entering
or leaving Focus must not change the synthetic wall value, history or active
gesture. The layout must reserve space so its history rail cannot overlap the
numeric input or apply action at the `390×844` emulated context.

### Permitted changes

- TDD-first Playwright test additions and the minimum matching changes to
  `index.html`, `styles.css` and `app.js` below the existing S-4 prototype
  root.
- One new emulated-WebKit Focus screenshot in this S-4 evidence root and an
  update to the existing S-4 evidence report with its exact provenance.
- A post-change ordinary full Playwright regression and Stryker mutation run
  for the isolated `app.js`; raw artifacts remain in the prototype root.

### Non-goals and evidence guardrails

- No root application source, React/Rspack/Rstest/Kotlin/PostgreSQL code,
  shared module, build/PWA/CI config, asset or user data may be created.
- No request may claim to hide browser/system chrome, certify native
  fullscreen, physical touch, safe insets, keyboard behavior, Safari/Home
  Screen, Android, Samsung, participant usability or `G-1`.
- Native Fullscreen API behavior is explicitly outside this synthetic
  amendment; its architecture remains capability-first and requires its own
  physical evidence path.

### Acceptance checks

1. A new Playwright test first fails before the Focus UI exists, then passes
   only after a direct named control enters in-app Focus.
2. The test observes exit/status/mode/cancel/undo/redo and the labelled numeric
   return path in Focus; it proves synthetic wall/history preservation across
   enter/exit.
3. At `390×844`, numeric input and apply controls have no rectangle
   intersection with `.history-bar` and remain actionable.
4. Existing six S-4 scenarios remain green; the new Focus scenarios are
   independent and use semantic locators.
5. Mutation results, including surviving/timeout counts, are recorded without
   a threshold or a compatibility claim.

### Amendment A result — 2026-08-04

The bounded checks are complete: the Focus test was red before the named
control existed, then the ordinary post-mutation Playwright regression passed
**7/7**. At `390×844` WebKit emulation it asserts in-app Focus, unchanged wall
value in its empty-history/idle-gesture baseline, critical rails, numeric return
path and non-overlap with `.history-bar`.

The full `app.js` mutation run recorded **306 mutants: 190 killed, 115
survived, 1 timeout, 62.42%**. Raw hashes and the one Focus screenshot are in
`S-4-evidence-report-2026-08-04.md`; they are browser-emulation evidence only.

Post-Amendment A independent review is recorded in
`S-4-post-amendment-a-independent-review-2026-08-04.md`. It verified 7/7,
mutation counts and hashes but found `S4-FOCUS-POST-01`: the test does not yet
browser-prove preservation of non-empty undo/redo history or active preview.

`PAUSED — needs further S-4 evidence` remains mandatory: the amendment resolves
only the earlier synthetic layout finding and cannot satisfy participant
recordings, physical-device task evidence or `G-1 PASS`. It authorizes neither
cleanup nor production promotion.

## Amendment B — Focus state preservation evidence

**Authorized 2026-08-05 under the still-active, nonterminal
`W-SPK-2026-08-04` waiver.** Product Owner delegated the owner/reviewer choice
in writing: “Реши сам кого назначить, мне нужно, чтобы решения были приняты
для продолжения работы.” This is not a waiver extension and it does not change
any `PASS` criteria.

| Role | Appointment |
| --- | --- |
| Amendment-B implementation/evidence owner | `Codex /root/gcp_decision_research` |
| Amendment-B independent reviewer | `Codex /root/ownership_readiness_review` |

### Bounded question

Can the existing synthetic **in-app Focus** flow browser-observe preservation
of both (a) non-empty confirmed undo/redo history and (b) an active wall
preview/cancel path, without changing a wall value, history entry, gesture
semantics or the no-native-fullscreen boundary merely by entering or leaving
Focus?

### Only permitted changes

Within the existing S-4 prototype/evidence roots only, the named owner may:

1. Add RED→GREEN Playwright scenarios that create a non-default confirmed wall
   value, enter/exit Focus, prove undo and redo still restore the expected
   values, then separately enter/exit Focus during an active preview and prove
   the preview/cancel outcome is preserved.
2. Make the minimum matching changes to the synthetic S-4 `app.js`, HTML or
   CSS required by those tests; no new product concept, native Fullscreen API,
   network request, Project data or production module is allowed.
3. Rerun the complete ordinary regression and the full `app.js` mutation
   command, retain new raw output/hash evidence and label every result as
   browser-emulated synthetic evidence.
4. Update the S-4 owner evidence report and request a fresh independent review
   from the appointed reviewer before recording any terminal disposition.

### Explicit non-goals

- Do not improve or hide the previously reported mutation score by narrowing
  the mutation target or threshold; record the full-file result honestly.
- Do not claim physical touch, iPhone/Safari, Samsung/Android, Home Screen,
  installed PWA, safe-area/keyboard, native fullscreen, participant research
  or `G-1` evidence.
- Do not clean up, promote or copy this prototype into product code. A terminal
  decision still requires the independent review and waiver §5 cleanup rules.

## Terminal disposition — 2026-08-05

The appointed independent review,
[`S-4-post-amendment-b-independent-review-2026-08-05.md`](S-4-post-amendment-b-independent-review-2026-08-05.md),
records terminal **`PAUSED`** for `W-SPK-2026-08-04`. Amendment B closes only
the synthetic browser assertion gap for preservation of non-empty history/redo
and active preview/cancel across in-app Focus.

`PASS` and any readiness/promotion conclusion remain prohibited. Missing
evidence includes assigned-participant physical iPhone and Samsung task
recordings, independent `G-1 PASS`, and all eight physical `NFR-15` device
acceptance rows. This synthetic browser evidence also does not establish real
touch, safe-area/virtual-keyboard, browser/system-chrome, PWA, performance or
native Fullscreen capability/request/exit behavior.

The full `app.js` mutation accounting remains negative quality evidence:
**306 total; 188 killed; 110 survived; 8 timeouts; 64.05%**. It may not be
used as a quality or production-promotion claim.

Under waiver §5, terminal cleanup was completed as a recoverable move of the
exact prototype root to
`/Users/romanzheltov/.Trash/InteriorsEditor-W-SPK-2026-08-04-S-4-2026-08-05`.
The target was proven absent before the move; the moved directory retains
**389456 KiB**, **15979 files** and **986 directories**. The former workspace
prototype path is absent, and no permanent deletion occurred.

Evidence reports, raw reports, trace and screenshot remain in `evidence_root`.
No source was copied into a product root and no commit is authorized.

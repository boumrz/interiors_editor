---
title: "InteriorsEditor — независимый UX review geometry-state"
review_type: geometry-state-source-reconciliation
reviewed: 2026-08-05
reviewer: "Codex /root/ux_source_reconciliation/ux_geometry_state_review"
previous_verdict: NEEDS_REMEDIATION
rereview: "Fresh read-only rerun after the final AD-7 UX reconciliation and prescribed memlog append."
reviewed_artifacts:
  - DESIGN.md
  - EXPERIENCE.md
  - .memlog.md
reviewed_snapshot:
  design_sha256: "02c18269245a71ea6a7058daead2268e56e81ef11c5bb459a40b294f09b02289"
  experience_sha256: "ac20ff129bee180509fe3d83f2537f35672904c17a3fd5ae34eb9a407310cb29"
  memlog_sha256: "f2b26aab4452f031020d1bedb325258b629787afabee01e9743de27afac8ad47"
review_basis:
  - ../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md
  - ../../architecture/architecture-InteriorsEditor-2026-07-26/reviews/review-current-source-canonical-ad7-can-remediation-2026-08-05.md
  - ../../architecture/architecture-InteriorsEditor-2026-07-26/reviews/review-topology-policy-adversarial-canonical-gate-remediation-2026-08-05.md
  - ../../../project-context.md
status: complete
verdict: PASS
readiness: NOT_READY
scope: "Fresh final read-only check только UX-представления geometry draft, candidate, durability и доступных alternatives; без выбора D-022 и без изменения доменных/архитектурных контрактов."
source_mutations: none
---

# Независимый review: geometry-state

## Вердикт

**`PASS` для узкой geometry-state UX lens; `NOT_READY` сохраняется.** Final
UX snapshot устраняет все P1 из первоначального review и сохраняет границу
`D-022`. Это не разрешение на implementation и не решение `D-022`.

Проверка read-only: этот reviewer не менял `DESIGN.md`, `EXPERIENCE.md` или UX
memlog; final source changes и append-only provenance были внесены владельцем
UX update до re-review. Принятые remediation reviews AD-7 принимают лишь
архитектурный seam и прямо оставляют UX-owner обязанность согласовать candidate
priority, preview, formatting, error и continuity.

## Наблюдаемая база первоначального review

- `EXPERIENCE.md` §5.1 и §6 сейчас сводят рисование стены к
  «начало / preview / конец»; §8 даёт лишь `draft command` и `invalid geometry`.
- `DESIGN.md` описывает generic `DimensionInput`, `PropertyField`,
  `StatusBanner` и `UndoRedoBar`, но не geometry-specific candidate output.
- При этом SPEC CAP-2, PRD FR-7–FR-13, Geometry Contract §§1, 4–6, 11 и
  AD-7 уже требуют integer-mm candidate/result, origin-relative gesture,
  exact T/X normalization, shared formatting seam и no-partial-mutation path.

## Первоначальные findings — разрешены final snapshot

### UX-GEO-01 — stale deferred list conflicts with adopted D-011–D-013

**Severity: P1.** `EXPERIENCE.md` §14 всё ещё оставляет открытыми визуальный
шаг/привязку и допустимость числовой позиции вне сетки. Это расходится с
принятыми источниками: visual grid — presentation-only, gesture candidate
строится от active origin шагом 100 mm, а valid integer-mm numeric
endpoint/delta может быть off-grid и проходит общую validation path.

**UX-owned correction.** Убрать эти уже решённые вопросы из списка допущений
и добавить их как наблюдаемое поведение Plan UI. Оставить в `D-022` только
невыбранные screen-space tolerance, candidate eligibility/equal-tie,
selection of relative-step `k`, visual-grid hysteresis, T/X continuity,
room/opening policy и precision/locale. UI не должен подменять их значением
или library default.

### UX-GEO-02 — нет наблюдаемого active-gesture candidate contract

**Severity: P1.** Пользователь не получает авторитетно определённых origin,
candidate class, resolved endpoint и signed delta. Generic preview не даёт
понять, почему cursor/endpoint выбран, и не покрывает AD-7 construction-class
order: eligible exact existing Vertex → eligible exact intersection/end →
constrained-direction → origin-relative 100-mm candidate.

**UX-owned correction.** Добавить behavioral component/state pattern для
`GeometryDraft`/candidate overlay и его DOM-equivalent. Пока Active Gesture
существует, оба представления получают от candidate engine и показывают:

- active origin `x/z` в мм;
- фактически выбранный class и объяснение его роли в указанном порядке;
- resolved endpoint `x/z`, signed `Δx/Δz`, direction и measurement text;
- `Draft`, validatable/validated либо rejected state и доступное `Отменить
  действие`/точное поле.

Этот порядок — лишь объяснение уже returned candidate, а не UI-algorithm.
Нельзя назначать пиксельный tolerance, equal-tie winner, hysteresis либо
значение/правило выбора `k`; это остаётся `D-022`. Для origin-relative class
можно сообщить «100-mm increments from this origin», не обещая, как именно
выбирается candidate.

### UX-GEO-03 — numeric off-grid and diagonal input are underspecified

**Severity: P1.** `DimensionInput` знает только generic мм и ошибку. Он не
обещает valid off-grid integer endpoint/delta, не различает endpoint от delta,
не требует quadrant для length-only 45° input и не показывает выбранный signed
quantised delta/actual length до confirm. Это оставляет риск скрытого rounding
или расхождения touch/numeric path.

**UX-owned correction.** Описать Plan numeric sheet как один visible and
accessible alternative к canvas:

- поля exact endpoint **или** signed delta принимают только integer-mm input;
  off-grid value допустим, если проходит тот же complete validation path;
- length-only diagonal показывает обязательный named quadrant
  `NE|NW|SE|SW`, returned signed `ΔxMm × ΔzMm`, quantised actual length и
  explicit confirm; supplied endpoint/delta сохраняет свои signs;
- rejected input остаётся видимым вместе с last valid value, affected point/
  segment и localized stable reason context (`INVALID_DIMENSION`,
  `UNSUPPORTED_DIRECTION`, `PROJECT_BOUNDS_EXCEEDED` и т. п.), а не получает
  nearest-angle correction.

Это не выбирает precision/locale: text берётся только из общего
`MeasurementFormatPolicy`.

### UX-GEO-04 — exact T/X preview and atomic rejection lack a UX contract

**Severity: P1.** Current `EXPERIENCE.md` §9 говорит о conflict point
абстрактно, но не описывает результат exact T и otherwise-valid exact X:
одну shared Vertex, required non-zero partitions и один previewed complete
ChangeSet. Также не выражено, что non-integral/overlap/self-intersection/
too-short result не изменяет canonical Plan, 2D/3D, history, autosave или
`PendingDurability`.

**UX-owned correction.** В geometry preview/error pattern добавить:

- explicit label/DOM summary of exact T or exact X normalization and the
  affected segments/one shared vertex before confirm;
- visual and numeric/list alternative that identifies the conflict coordinate,
  affected objects, stable reason and safe action;
- a rejected candidate remains a non-persistent preview. It must not be
  presented as a partially accepted wall, a changed room, a history entry or a
  save. Existing Durable Revision remains the current model.

Не определять UX-ом near-contact tolerance, T/X continuity or automatic
selection behaviour; it renders only exact candidate output and the reason
provided by the domain/policy seam.

### UX-GEO-05 — durability state machine is too coarse for geometry

**Severity: P1.** Current spines distinguish `draft command`, generic invalid
geometry, `saving`, `saved/durable` and `persist-failed`, but do not give a
non-ambiguous user-facing mapping for `Draft → Rejected | Validated →
PendingDurability → Durable`. This risks calling a validated geometry command
saved before atomic publication, or treating persistence failure as a geometry
reject. It also makes Focus preservation of this state underspecified.

**UX-owned correction.** Add a concise state table that maps the domain terms
to truthful UI copy and available actions:

| Domain state | Required UX semantics |
| --- | --- |
| `Draft` | Live preview only; cancel or edit changes it; no history, autosave, canonical projection or saved label. |
| `Rejected` | Previous Durable model remains current; show reason/affected context and keep a correction path; no `PendingDurability`. |
| `Validated` | Complete candidate passed validation but is not yet a saved revision; UI may transition immediately to saving, never to `saved`. |
| `PendingDurability` | Clearly state local persistence is pending; no saved/history claim. On persistence failure retain last Durable Revision, expose only retry/recovery-export path for the pending candidate and fence the next mutation. |
| `Durable` | Only after staging/checksum/atomic pointer swap: show saved and allow the resulting history entry. |

Focus entry/exit must preserve the same draft and truthful status without
creating any state transition, Command, Revision or history entry.

### UX-GEO-06 — shared measurement and geometry accessibility are not linked

**Severity: P1.** UX already requires numeric/list alternatives generally,
but it does not bind Preview, 2D, 3D and export to one
`MeasurementFormatPolicy` nor require the geometry-specific values/error
context in the accessible alternative. Independent UI/renderer rounding would
violate PRD FR-13 and AD-7.

**UX-owned correction.** State that preview overlay, DimensionInput, selected
object/DOM inspector, 2D, 3D and export receive measurement text from the same
policy over the same canonical value (the diagonal uses exact squared length).
The formatted text is display-only and never feeds an input. Precision and
locale remain expressly deferred. Require an accessible live/status summary
for origin, candidate class, endpoint/delta, validation/durability state and
localized reason; canvas colour/shape alone cannot carry this information.

## Non-decision guard

This review does **not** choose a geometry kernel, pixel tolerance, candidate
eligibility or tie resolution, relative-step `k` selection, grid hysteresis,
T/X continuity, Room reconciliation, Opening relocation, usable-polygon
rounding, MeasurementFormatPolicy precision/locale, or any physical-device
claim. Those stay `D-022`/source-owned and the project remains `NOT_READY`.

## Первоначальное exit condition

The geometry-state lens can pass after the UX spines and append-only memlog
express all six corrections above, retain the explicit `D-022` boundary, and
make no implementation/readiness/device-evidence claim. The result would only
accept UX source reconciliation; it would not close S-2, a kernel/corpus gate,
or `G-READY`.

## Fresh final re-review — supersedes the findings above

The final snapshot is the pair of UX spines with hashes recorded in front
matter and the append-only UX memlog entry dated `2026-08-05T04:33`. It was
reviewed after the owner reported the snapshot stable. The memlog records the
same boundaries through the prescribed workflow; this rerun therefore has no
provenance gap.

| Initial finding | Final reviewed evidence | Result |
| --- | --- | --- |
| `UX-GEO-01` stale deferred list | `EXPERIENCE.md` §14 now distinguishes adopted AD-7 behavior (presentation-only grid, origin-relative 100-mm gesture, off-grid integer numeric input, quadrant diagonal and atomic exact T/X) from the actual `D-022` decisions still open. | **Resolved.** |
| `UX-GEO-02` active gesture/candidate visibility | §5.1.1 shows signed origin, returned candidate class, endpoint/`Δx/Δz` and the canonical class order. It expressly treats the order as explanation, not a UI tie-breaking algorithm. Focus preserves this exact draft (§5.5 / §6). | **Resolved.** |
| `UX-GEO-03` off-grid numeric/diagonal input | §5.1.1 requires signed integer-mm endpoint/delta, the shared validation path and no grid/nearest-angle rounding; length-only diagonal has explicit `NE|NW|SE|SW`, signed quantised delta and actual length before confirm. | **Resolved.** |
| `UX-GEO-04` exact T/X and no-partial reject | §5.1.1 and UXF-2 show one shared Vertex plus affected non-zero segments as one pre-confirm atomic preview. Rejected contacts retain the Durable Project and change neither history, autosave, `PendingDurability` nor canonical projection. | **Resolved.** |
| `UX-GEO-05` geometry/durability state machine | §5.1.2 and the screen inventory distinguish `DraftCommand`, `Rejected`, `Validated`, `PendingDurability` and `Durable`; neither validation nor persistence failure can be mislabelled as saved. | **Resolved.** |
| `UX-GEO-06` shared formatting and accessibility | §5.1.1 sends Preview/2D/3D/export through one `MeasurementFormatPolicy`; §11 exposes origin, candidate, endpoint/delta, quadrant, lifecycle and error as linked DOM/numeric text, not canvas-only state. | **Resolved.** |

## Remaining issues in this lens

**None.** The text deliberately does not select a kernel, screen-space
tolerance, eligibility/tie, relative-step `k`, hysteresis, T/X continuity,
Room/Opening policy, usable-polygon rounding, or formatter precision/locale.
Those retained decisions are correctly marked `D-022`/source-owned. The UX
spines make no device, native-fullscreen, implementation or readiness claim.

## Final verdict

**`PASS` — geometry-state UX source reconciliation only.** This accepts the
final UX wording and its memlog provenance. It does not accept implementation,
S-2, a geometry kernel/corpus, physical `NFR-15` evidence, or `G-READY`; all
remain `NOT_READY` outside this lens.

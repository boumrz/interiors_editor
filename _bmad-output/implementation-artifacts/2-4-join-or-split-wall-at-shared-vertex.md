---
baseline_commit: NO_VCS
---

# Story 2.4: Присоединить или split-нуть Wall в общей Vertex

Status: done

## Story

Как пользователь,
я хочу присоединить новую Wall к существующей геометрии или разделить Wall
касанием,
чтобы связный план изменялся предсказуемо и сохранялся одной операцией.

## Minimal Alpha Acceptance Criteria

1. Direct Wall gesture может завершиться в существующей endpoint/Wall body;
   materialized result использует одну shared canonical Vertex и не оставляет
   overlap или разорванные сегменты.
2. Выбранная Wall предоставляет touch-split внутри сегмента. Marker/preview и
   cancel остаются transient; confirm публикует исходную head Wall, одну новую
   Vertex и tail Wall одним atomic durable change.
3. Точные integer-mm T и cardinal X нормализуются до materialization. T получает
   одну shared Vertex; X получает одну shared Vertex и ровно четыре incident
   canonical pieces.
4. Stable Wall/Room identity и unaffected subgraph сохраняются. Door/Window и
   wall Item однозначно rehost-ятся на successor либо показывают точный
   consequence preview; cancel/reject не создают Revision.
5. Non-integer/out-of-bounds contact, positive overlap, zero/too-short piece,
   invalid direction и unresolved host отклоняются до partial allocation с
   stable reason.
6. Confirmed result переживает reload и остаётся одним canonical source для
   Plan/3D. Прямой numeric/global-coordinate UI по решению Product Owner в
   Alpha отсутствует.

## Tasks / Subtasks

- [x] Реализовать endpoint/body join и exact all-contact normalization.
- [x] Реализовать selected-Wall touch split с explicit confirm/cancel.
- [x] Материализовать exact T и isolated cardinal X как shared Vertex topology.
- [x] Сохранить deterministic head/tail IDs и atomic durable publication.
- [x] Реализовать однозначный rehost и explicit destructive consequence для
      Door/Window/wall Item на split/T/X successors.
- [x] Проверить rejection до allocation/Revision для invalid candidates.
- [x] Доказать phone touch, reload и Plan/3D projection через focused E2E.

### Review Findings

- [x] [Review][Patch] Selected-Wall split допускает successor короче допустимой длины [apps/web/src/domain/general-wall-project.ts:1611] — fixed with allocation-free `TOO_SHORT_WALL` boundary at `thicknessMm`
- [x] [Review][Patch] Последующий AddWall глобально сливает и удаляет ранее подтверждённый split [apps/web/src/domain/add-wall-segment.ts:385] — fixed by protecting every pre-existing degree-two joint from add-time coalescing
- [x] [Review][Patch] Exact hosted T/X не предоставляет consequence preview и atomic re-entry [apps/web/src/domain/general-wall-project.ts:348] — fixed across domain/application/controller/phone UI with refreshed atomic resolution
- [x] [Review][Patch] Диагональный split может rehost-нуть wall Item на 1 мм за пределы tail successor [apps/web/src/domain/general-wall-project.ts:1870] — fixed with one source-address tail origin and exact Item/Window boundary evidence
- [x] [Review][Patch] Positive-overlap extension обрезался до нового участка вместо allocation-free `COLLINEAR_OVERLAP` [apps/web/src/domain/add-wall-segment.ts:99] — fixed with strict whole-candidate rejection in both directions
- [x] [Review][Patch] Короткий endpoint extension обходил minimum-piece invariant [apps/web/src/domain/add-wall-segment.ts:99] — fixed with unconditional pre-allocation `TOO_SHORT_WALL`
- [x] [Review][Patch] AddWall draft/consequence мог пережить Revision change, конфликтовать с другой публикацией или показывать ложную отмену retry-candidate [apps/web/src/ui/AppShell.tsx:2073] — fixed with revision-bound transient state, publication ownership hand-off and guarded resolving lifecycle
- [x] [Review][Patch] Destructive T/X preview показывал только counts и терял keyboard/screen-reader context [apps/web/src/ui/AppShell.tsx:9348] — fixed with exact resource labels/IDs, assertive non-modal alert focus and deterministic cancel focus return
- [x] [Review][Defer] Общий publication path не использует exact-base Revision CAS [apps/web/src/application/general-wall-project-mutations.ts:332] — deferred, pre-existing
- [x] [Review][Defer] Pre-adoption topology corpus использует matching fixture executor, а не production PlanGraph commands [apps/web/src/domain/topology-corpus.test.ts:12] — deferred, pre-existing
- [x] [Review][Defer] Общий IdPort не предоставляет атомарную reservation/validation для полного набора новых identity [apps/web/src/domain/general-wall-project.ts:2580] — deferred, pre-existing

## Dev Notes

- Trace: `CAP-2`, `CAP-3`, `CAP-4`, `CAP-8`; `FR-9`, `FR-12`, `FR-38`–`FR-40`;
  `NFR-1`, `NFR-3`, `NFR-4`, `NFR-26`; `AD-1`, `AD-2`, `AD-3`, `AD-6`,
  `AD-7`, `AD-12`, `AD-19`; `V-05`.
- Canonical geometry remains one integer-mm planar graph. IDs are allocated only
  after detached preflight; renderer objects and gesture markers are disposable.
- General multi-X chains, every post-closure diagonal lineage permutation and
  the complete S-2/device corpus remain topology/release gates. They do not
  expand this Product Owner-approved minimal join/split implementation slice.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** The production path now proves the
  complete walking skeleton: a phone user joins a Wall to supported geometry or
  selects a Wall and requests a split, reviews/cancels the transient candidate,
  and confirms one atomic durable topology result. Exact T/X contacts share one
  canonical Vertex; affected Door/Item hosts are deterministically rehosted or
  handled through one explicit consequence choice. Invalid topology remains
  non-durable and allocation-free.
- Closure evidence: 140/140 focused domain/application Rstest checks and nine
  iPhone-13 browser-emulation scenarios green cumulatively through the external
  tunnel. Two first-pass scenarios completed topology/reload but exceeded the
  5-second assertion while Cloudflare was still transferring dev-only 3D lazy
  chunks; network traces showed pending chunk requests, and both scenarios
  passed on the isolated rerun. No production code changed in this checkpoint.
- Existing source-changing evidence remains recorded: 100% focused concave
  split and destructive split-host mutations, 90.09% T-host reconciliation and
  95% isolated-X mutation coverage, plus the corresponding full type/lint/build
  and mobile/PWA regressions.
- **Review patch closure — 2026-08-27.** All four Story-local review blockers
  are fixed with RED/GREEN evidence: split pieces at 99/100 mm reject before ID
  allocation while 101 mm accepts for a 100 mm Wall; later unrelated AddWall
  preserves explicit cardinal and diagonal split identities; hosted AddWall T/X
  now exposes sorted exact Item/Opening consequences and confirms one refreshed
  atomic mutation; diagonal tail addresses use `floor(total) - floor(tail)` so
  exact far-edge and tail-boundary Item/Window hosts remain valid.
- Closure gate: 109/109 focused domain tests, 16/16 application tests,
  1503/1503 full Rstest, lint, both TypeScript configs and production build
  green; Playwright 149 passed with only the environment-gated live PostgreSQL
  scenario skipped, plus 5/5 PWA. Targeted Stryker: AddWall preview 51/51,
  application resolution 2/2, diagonal/split-ID slice 78/83 with five
  behaviorally equivalent internal-label mutants.
- **Final independent closure — 2026-08-27.** A three-layer BMAD re-review found
  no remaining Story-local blocker across AC1–AC6, domain allocation order,
  application/controller publication and the phone consequence flow. Positive
  overlap and a short endpoint extension now reject before identity allocation;
  a confirmed retry-pending candidate is no longer presented as cancellable
  transient UI. The touch E2E proves exact named consequences, initial focus,
  blocked competing gesture, safe cancel with focus return, Undo/Redo stale
  invalidation and one atomic destructive confirm.
- Final evidence: 1505/1505 Rstest, warning-free 259-file Biome, both TypeScript
  configs and production build green; full Playwright 149 passed with the sole
  live-PostgreSQL environment scenario skipped, PWA 5/5, and the final focused
  touch scenario green after the accessibility follow-up. New targeted Stryker
  slices killed 30/30 AC5 mutants and 10/10 retry-ownership mutants.

### File List

- `_bmad-output/implementation-artifacts/2-4-join-or-split-wall-at-shared-vertex.md`
- `apps/web/src/domain/add-wall-segment.ts`
- `apps/web/src/domain/add-wall-segment.test.ts`
- `apps/web/src/domain/general-wall-project.ts`
- `apps/web/src/domain/general-wall-project.test.ts`
- `apps/web/src/domain/topology-corpus.test.ts`
- `apps/web/src/application/general-wall-project-mutations.ts`
- `apps/web/src/application/general-wall-project-mutations.test.ts`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/ui/AppShell.test.tsx`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`

### Change Log

- 2026-08-26: Created the missing implementation artifact, reconciled the
  delivered minimal Alpha acceptance boundary and moved Story 2.4 to `review`.
- 2026-08-27: Fixed all Story-local code-review blockers, completed the full
  domain/application/mobile/PWA quality gate and passed independent final
  re-review; Story 2.4 moved to `done`.

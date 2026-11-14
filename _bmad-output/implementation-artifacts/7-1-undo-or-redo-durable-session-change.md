---
baseline_commit: NO_VCS
---

# Story 7.1: Вернуть или повторить любую Durable правку текущей сессии

Status: done

## Story

Как пользователь,
я хочу отменять и повторять сохранённые правки,
чтобы безопасно сравнивать варианты плана и предметов.

## Minimal Alpha Acceptance Criteria

1. Undo/Redo доступны только для успешно опубликованных Durable Commands
   текущей session boundary. Canonical Project, derived Rooms, Openings,
   placements и resource references восстанавливаются одной согласованной
   Revision; UI/renderer пересоздаются из domain state.
2. Invalid/cancelled command не создаёт History entry. Stale base, lost fence
   или persistence failure оставляет current Revision и обе history branches
   неизменными; failed travel доступен для safe retry.
3. Новая команда после Undo сохраняет redo branch и её resource roots до
   успешной atomic publication replacement. `SessionRetentionPolicy` до
   mutation отклоняет необратимый resource/entry envelope со stable reason
   `PROJECT_HISTORY_RESOURCE_LIMIT` и явной новой session-boundary подсказкой.
4. Current, undo и redo exact resource references проверяются до history
   travel и при возврате приложения. History-only issue оставляет healthy
   current Project видимым/exportable, переводит редактирование в read-only и
   не обрезает ни одну ветку автоматически.
5. Exact bytes repair плюс явная recheck восстанавливает те же branches без
   Project Revision. Если repair невозможен, `DiscardSessionHistory` точно
   объясняет потерю Undo/Redo; cancel сохраняет обе ветки, а confirm повторно
   проверяет healthy current manifest и writer fence, затем очищает обе ветки
   без новой Durable Revision.
6. Reload/reopen, import, recovery и новый Project начинают новую видимую
   session boundary; Portable Backup не переносит session History.
7. Named phone-browser evidence `HISTORY-E2E-00` и `HISTORY-E2E-01` покрывает
   обычный durable Undo/Redo и controlled history-only resource repair/discard.

## Tasks / Subtasks

- [x] Включать в session History только successful Durable publications.
- [x] Сохранять current и обе branches на reject/cancel/stale/failure.
- [x] Проверять prospective current+undo+redo roots через retention policy.
- [x] Проверять exact current/undo/redo resources до travel и после resume.
- [x] Реализовать read-only history recovery с exact recheck.
- [x] Реализовать confirm/cancel `DiscardSessionHistory` без Project Revision.
- [x] Добавить обязательный controlled browser fixture `HISTORY-E2E-01`.
- [x] Подтвердить focused mutation, full regression, phone tunnel и PWA gates.

## Dev Notes

- Trace: `CAP-8`; `FR-38`; `NFR-3`, `NFR-4`, `NFR-11`, `NFR-13`, `NFR-24`,
  `NFR-26`; `AD-2`, `AD-3`, `AD-4`, `AD-12`, `AD-19`; `V-02`, `V-04`,
  `V-05`, `V-10`, `V-11`, `V-16`; `EV-03`, `EV-04`, `EV-06`, `EV-07`,
  `EV-11`, `EV-17`.
- Session History хранит полные immutable Durable candidates; semantic
  ChangeSet/inverse остаются валидируемыми candidate inputs и не получают
  отдельной durable записи или resource authority.
- Controlled browser fixture создаёт healthy resource-free current через Undo
  размещения custom GLB; resource-bearing Redo остаётся единственным history
  root. Поэтому тест отличает history-only issue от current corruption, а не
  ослабляет normal Project recovery.
- Cross-store startup crash reconciliation и physical forced-GC corpus остаются
  release hardening/evidence. Они не расширяют одобренный Product Owner
  functional Minimal Alpha slice и не считаются пройденным release gate.

## Dev Agent Record

### Completion Notes

- **Minimal Alpha closure — 2026-08-26.** Production controller уже проводит
  каждую supported mutation и history travel через один durable repository
  boundary. Stack transition происходит только после publication; failure
  сохраняет source/target и позволяет retry. Reload/open/import/recovery
  очищают session roots как отдельная видимая boundary.
- Proactive integrity scan проверяет current, undo и redo exact GLB hashes.
  Current issue использует обычный Project recovery; history-only issue держит
  current plan healthy/read-only, exact repair возвращает обе branches, а
  explicit discard rechecks current bytes и writer fence перед очисткой stacks.
- Новый `HISTORY-E2E-01` использует реальные catalog import, placement,
  Undo/Redo, IndexedDB resource store и UI. Он доказывает cancel, exact repair,
  повторный travel и approved discard при неизменных current revision ID и
  общем количестве Durable Revision.
- Final evidence: 76/76 focused и 1385/1385 full Rstest, warning-free 252-file
  Biome, обе TypeScript-конфигурации и production Rspack build. Оба history
  сценария прошли локально и 2/2 через внешний tunnel; 5/5 production PWA E2E
  прошли. Full mobile run дал 144/145, где новый history scenario зелёный, а
  единственный несвязанный `PROJECT-E2E-04G` timeout прошёл isolated 1/1 за
  3.7 s.
- Existing unchanged mutation evidence remains valid: shared
  `SessionRetentionPolicy`/repository 50/50 killed (100%); controller history
  recovery/discard guards имеют ранее зафиксированные fresh-source mutation
  checks для target detection, current recheck, fence rejection и stack clear.
- Production source не менялся в closure checkpoint; добавлен отсутствовавший
  обязательный end-to-end acceptance fixture и reconciled story artifact.
- **Acceptance closure — 2026-08-28.** Independent повторная приёмка закрыла
  найденный P1: history travel и его retry теперь вызывают только
  `publishNextRevision(candidate, capturedSourceRevisionId)`. `stale-base`
  восстанавливает source Durable Revision и оставляет обе ветки повторяемыми;
  адаптер без CAS-port fails closed, а persistence failure и потеря writer lease
  во время retry не сдвигают session History. Подтверждено 78/78 focused
  controller tests, scoped mutation 45/47 killed (два surviving optional-chain
  mutants эквивалентны гарантированному `current`), 1592/1592 Rstest, clean
  264-file Biome, обе TypeScript-конфигурации, production build, 154 mobile
  scenarios (1 environment-skipped live catalog) и 5/5 PWA. Независимый
  аудитор принял все семь AC; cross-store crash/forced-GC corpus остаётся
  только declared release hardening, не closure blocker этой Story.

### File List

- `_bmad-output/implementation-artifacts/7-1-undo-or-redo-durable-session-change.md`
- `apps/web/src/app/project-controller.ts`
- `apps/web/src/app/project-controller.test.ts`
- `apps/web/src/application/session-retention-policy.ts`
- `apps/web/src/application/session-retention-policy.test.ts`
- `apps/web/src/application/session-retention-project-repository.ts`
- `apps/web/src/application/session-retention-project-repository.test.ts`
- `apps/web/src/ui/AppShell.tsx`
- `apps/web/src/ui/AppShell.test.tsx`
- `apps/web/tests/browser/editor-workspace-e2e.spec.ts`
- `apps/web/tests/browser/project-e2e.spec.ts`
- `apps/web/stryker-session-retention.config.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/roadmap-to-alpha.md`

### Change Log

- 2026-08-26: Added the missing controlled `HISTORY-E2E-01`, reconciled the
  delivered Minimal Alpha history boundary and moved Story 7.1 to `review`.
- 2026-08-28: Fixed the exact-base CAS bypass in history travel/retry, added
  stale-base, missing-CAS, retry-failure and writer-lease regression coverage;
  independent acceptance moved Story 7.1 to `done`.

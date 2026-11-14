---
document_name: "Git и worktree governance для InteriorsEditor"
status: active-pre-ready
project: InteriorsEditor
created: 2026-08-04
document_language: Russian
---

# Git и worktree governance

## Граница текущей фазы

Репозиторий инициализирован для безопасного учёта planning/evidence работы.
До final BMAD `READY` запрещено создавать production application scaffold,
package/build/test/PWA/CI/deployment artifacts. Разрешены только документы и
явно ограниченные waiver-spikes в их выделенных roots.

## Ветви и ownership

- `main` — защищённая baseline-ветка; прямые изменения, force-push и merge без
  независимого review запрещены.
- На один executable vertical slice назначается один implementation owner и
  отдельный independent reviewer. Один agent/person не исполняет обе роли для
  одного work package.
- После появления первого одобренного commit каждый slice работает в отдельной
  именованной ветке и linked worktree. Имя ветки связывает `V-*` или `S-*`
  identifier с целью работы.
- Waiver-spike никогда не переносится в production автоматически: его source
  остаётся в approved spike root и подлежит cleanup по waiver.

## Проверки и review

- До первого commit Product Owner отдельно подтверждает commit scope; текущая
  инициализация Git не является commit или публикацией.
- Перед review сохраняются воспроизводимые команды, RED/GREEN/MUTATE evidence
  и итог тестов в разрешённом artifact root.
- После `READY` обязательные slice checks включают type/lint, Rstest,
  Playwright и применимую mutation evidence. До `READY` этот документ не
  разрешает создавать их root configuration или CI workflow.
- CI workflow и remote/publish policy выбираются только в разрешённом
  post-`READY` slice; этот документ описывает governance, а не CI setup.

## Generated files

`.gitignore` исключает disposable dependencies и generated reports waiver
spikes. Нельзя выполнять `git add .`: перед staging нужно явно проверить
`git status` и добавить только согласованные source/planning/evidence files.

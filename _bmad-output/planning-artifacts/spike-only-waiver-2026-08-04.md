---
title: "InteriorsEditor — узкий waiver для evidence-spikes"
date: 2026-08-04
project: InteriorsEditor
waiver_id: W-SPK-2026-08-04
status: active-experimental-only
authority:
  product_owner: Roman
  written_authorization:
    - "Я подтверждаю реализацию по всей документации"
    - "Я полностью всё подтверждаю, не спрашивай меня каждый раз, просто делай, что должен"
effective_scope: "Только S-1, S-2, S-3, S-4 и S-6 evidence experiments"
not_after: "2026-08-18T23:59:59+03:00"
ends_on_first_of:
  - "новый официальный BMAD implementation-readiness verdict = READY, выпущенный после вступления waiver в силу"
  - "терминальный статус зафиксирован для каждого из S-1, S-2, S-3, S-4 и S-6"
  - "not_after"
extension: "Только новый письменный waiver; продление по умолчанию запрещено"
---

# W-SPK-2026-08-04 — узкое разрешение на доказательные spikes

## 1. Назначение и предел действия

Этот документ является узким письменным исключением из pre-implementation
запрета. Он разрешает только одноразовые, изолированные эксперименты для
`S-1`, `S-2`, `S-3`, `S-4` и `S-6`, когда без исполнимого опыта нельзя собрать
предусмотренное evidence. Он не является разрешением на продуктовую
реализацию, bootstrap, feature work, production PWA или выпуск.

`G-READY` по-прежнему означает только финальный официальный verdict BMAD
implementation-readiness `READY`. Этот waiver не удовлетворяет `G-READY` и не
может разблокировать ни один `V-*` slice.

Единственный именованный человек в этом документе — Product Owner Roman.
Реальные implementation/evidence owner и независимый reviewer назначаются и
фиксируются до старта конкретного work package; отсутствие назначения означает
`NOT ENTERED`, а не свободное право начать эксперимент.

## 2. Исключительно разрешённые места работы

Ни один путь не считается созданным этим документом. При фактическом старте
допустимы только следующие изолированные поддеревья:

| Spike | Единственный допустимый prototype root | Единственный допустимый evidence root | Разрешённый вопрос |
| --- | --- | --- | --- |
| S-1 | `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-1/` | `_bmad-output/planning-artifacts/evidence/spikes/S-1/` | сравнить renderer-кандидаты и lifecycle WebGL2/R3F/Babylon на одинаковых сценах |
| S-2 | `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-2/` | `_bmad-output/planning-artifacts/evidence/spikes/S-2/` | проверить integer-mm topology, corpus, rounding и reconciliation |
| S-3 | `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-3/` | `_bmad-output/planning-artifacts/evidence/spikes/S-3/` | проверить durability, local contexts, recovery, migration и PWA lifecycle |
| S-4 | `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-4/` | `_bmad-output/planning-artifacts/evidence/spikes/S-4/` | наблюдать touch/numeric interaction contract на изолированном prototype |
| S-6 | `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/` | `_bmad-output/planning-artifacts/evidence/spikes/S-6/` | проверить versioned manifest, provenance, notices, cache/pin и device-budget evidence для малого representative set |

Внутри каждого prototype root разрешены только:

- изолированный experiment source, локальный dependency manifest/lockfile и
  test-runner configuration, если они целиком находятся в том же root;
- experiment tests, synthetic fixtures и Playwright browser flows, относящиеся
  только к указанному spike;
- sample asset только после отдельного человеческого разрешения на этот sample
  и только в объёме, необходимом для опыта;
- локально созданные reports/traces до их переноса в соответствующий evidence
  root.

Это исчерпывающий список. Playwright flow в waiver — экспериментальное
наблюдение, не production E2E coverage и не закрытие `V-*` acceptance criteria.

## 3. Строго запрещённая поверхность

Запрещено создавать, менять или использовать как обход waiver:

- root `src/`, root package manifest/lockfile, root `tests/`, root build,
  test, lint, TypeScript, Playwright, PWA, CI либо deployment configuration;
- production application, production PWA, shared production module,
  production catalog, deployment, publishing или любую `V-*`/feature Story;
- реальную миграцию пользовательских данных, Project, browser store или
  production catalog; допустимы лишь synthetic fixtures в разрешённом root;
- реальный пользовательский Project content, telemetry с личными данными,
  неразрешённый 3D/texture asset или network publication;
- commit, tag, push, release либо перенос spike implementation в product code.

Не создаётся новый корневой runtime, package ecosystem или shared test harness.
Наличие успешного prototype не даёт права расширить этот список.

## 4. Asset и security boundary

S-6 может использовать synthetic fixtures. Любой не-synthetic sample asset
допустим только после отдельного человеческого разрешения, которое покрывает
конкретный эксперимент; его нельзя объявлять Alpha catalog resource только по
этому waiver.

Этот waiver **не** выдаёт и не заменяет `AssetUsageGrant`. До появления полного
human-approved `AssetUsageGrant` с coverage in-app render/thumbnails,
model/subresources, optimization/transcoding, `.interiors`, private 3D transfer,
rendered PNG download/share и всеми required notice placements S-6 не может
получить `PASS`, а sample не может попасть в production catalog. Human approver
остаётся `PENDING`; AI не может быть назначен вместо человека.

Все experiment inputs считаются недоверенными. S-3/S-6 не могут использовать
реальные пользовательские данные, а S-1/S-2/S-4 не могут превращать UI/scene
state в вторичный source of truth. Внешняя сеть, публикация и data collection
не входят в разрешённый scope.

## 5. Evidence, terminal status и cleanup

Каждый spike завершает статусом `PASS`, `PAUSED` или `KILLED/PIVOTED` и
оставляет проверяемый report с owner/reviewer, replay instructions, input
provenance, device/browser context и отрицательными результатами. `PASS` не
равен product delivery и сам по себе не открывает `V-*`.

После terminal status конкретного spike сохраняются только:

1. ADR, созданный через owning `bmad-architecture` workflow;
2. versioned corpus;
3. raw/derived traces без personal Project content;
4. evidence report.

Все prototype source, manifests/lockfiles, local dependencies, caches,
generated build output, transient screenshots/video, temporary sample assets и
другие implementation artifacts удаляются из prototype root. Sample asset
может остаться только как часть разрешённого corpus и только если его отдельное
человеческое разрешение допускает такое хранение. Cleanup фиксируется в
terminal report.

Ничего из spike не переносится в продукт автоматически. Любой будущий
production path требует одновременно: (1) финального официального `READY` и
(2) нового, отдельно определённого TDD vertical slice с собственными
acceptance criteria и review.

## 6. Невыданные исключения

Waiver не отменяет и не переносит:

- `G-1` — требование user research;
- physical real-device evidence, включая обязательные NFR-15 contexts;
- human approval полного `AssetUsageGrant`;
- final official BMAD implementation-readiness;
- ownership, независимый review, requirements traceability, security/privacy
  либо будущий TDD process.

Verdict `NOT READY` или `NEEDS WORK` сам по себе не завершает waiver: он лишь
оставляет `G-READY` закрытым и не меняет его границ. Срок заканчивается только
при новом официальном `READY`, после terminal status всех пяти разрешённых
spikes либо в `not_after` — в зависимости от того, что наступит раньше. Его
нельзя продлить молчаливо, ссылкой на эту запись или продолжением работы в тех
же папках: для этого требуется новый written waiver.

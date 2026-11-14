---
title: "InteriorsEditor — повторная adversarial canonical-проверка AD-7 после remediation"
review_type: adversarial-canonical-architecture-gate-rerun
reviewed: 2026-08-05
reviewer: "Codex /root/architecture_adversarial_review"
reviewed_artifact: ../ARCHITECTURE-SPINE.md
reviewed_memlog: ../.memlog.md
previous_review: review-topology-policy-adversarial-canonical-gate-2026-08-05.md
review_basis:
  - ../topology-policy-reconciliation-draft-2026-08-05.md
  - review-topology-policy-adversarial-r7-2026-08-05.md
  - review-topology-data-integrity-r7-2026-08-05.md
  - review-current-source-topology-policy-revision-7-2026-08-05.md
  - ../../../../specs/spec-interiors-editor-alpha/SPEC.md
  - ../../../../specs/spec-interiors-editor-alpha/geometry-contract.md
  - ../../../../specs/spec-interiors-editor-alpha/project-and-backup-contract.md
  - ../../../prds/prd-InteriorsEditor-2026-07-26/prd.md
  - ../../../../project-context.md
status: complete
verdict: ACCEPT_FOR_CANONICAL_ARCHITECTURE_GATE
readiness: NOT_READY
scope: "Independent read-only adversarial rerun for the remediated AD-7 and its provenance; no source, Spine, memlog, application, test, configuration, or evidence mutation"
source_mutations: none
---

# Повторная adversarial canonical-проверка AD-7

## Вердикт

**`ACCEPT_FOR_CANONICAL_ARCHITECTURE_GATE`; `G-READY` остаётся
`NOT_READY`.**

Все четыре P1 из предыдущего adversarial gate устранены в фактическом тексте
AD-7 и воспроизводимо записаны как `constraint`/`decision` в memlog. Это
accept только для узкого архитектурного решения AD-7: не для реализации,
не для закрытия D-022, не для выбора kernel, не для promotion S-2 и не для
готовности продукта.

## Независимая проверка

- Сверены remediated `AD-7` и `Deferred`, memlog, R7 draft/reviews,
  delegated policy, PRD, SPEC и companions, включая Geometry и
  Project/Portable Backup contracts.
- Обязательная механическая проверка прошла:

  ```text
  uv run .agents/skills/bmad-architecture/scripts/lint_spine.py \
    --workspace _bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26

  { "ok": true, "total_findings": 0, "by_severity": {} }
  ```

- Снова применён прежний coercion probe: raw JSON
  `9007199254740991.1` действительно может стать safe integer после обычного
  `JSON.parse`. Новый AD-7 больше не допускает использовать этот уже
  приведённый `Number` как границу принятия: raw token должен быть сохранён и
  проверен **до** IEEE coercion.

## Закрытие предыдущих P1

| Предыдущий риск | Проверяемый remediation | Оценка |
| --- | --- | --- |
| Потеря lossless JSON boundary и bundle locator | AD-7 lines 185–192 требует schema-aware decoder, raw JSON numeric token и проверку до host IEEE `Number`; lines 187–188 называют единственный canonical member `project/project.json` внутри `.interiors`. Это соответствует Backup Contract §2 (lines 80–90), не создавая ошибочный `.interiors/project/project.json` путь. Memlog constraints 60 и 63 отдельно фиксируют ordering и locator; grammar/path allowlist/reasons остаются у SPEC/Backup owner. | **Pass.** Сильная архитектурная граница вернулась, не присваивая владельцу Spine чужую детализацию grammar/reason. |
| Неопределённый gesture scalar `k` | AD-7 lines 212–215 ограничивает `k` положительным целым и `direction` одним из восьми unit directions; memlog decision 61 повторяет это и сохраняет off-grid numeric path вне кратности 100 mm. | **Pass.** `(125, 0) + 100 × 1/2 × NE` больше не является допустимым gesture candidate. |
| Разное округление preview / 2D / 3D / export | AD-7 lines 240–245 требует один product-owned `MeasurementFormatPolicy`, одинаковый exact squared length и запрет formatted-text-to-Command. Memlog constraint 62 совпадает с PRD FR-13 (uniform diagonal display). | **Pass.** Precision/locale честно остаются source-owned Deferred detail, но единый источник форматирования уже не может разойтись по adapter/UI. |
| Невоспроизводимый re-distill из generic `event` | Старый event 57 остаётся историческим, но больше не является единственной provenance: memlog constraint 59 фиксирует complete four-class/all-contact partition; constraints 60 и 63 — raw-token/locator seam; decision 61 — integer gesture; constraint 62 — measurement seam. Все они появились до remediation event 64 и соответствуют rendered AD-7. | **Pass.** Fresh distillation из durable decisions/constraints сохраняет load-bearing semantics; `event` не нужно удалять. |

## Негативные проверки

- **AD-3 не ослаблен.** AD-7 lines 194–199 сохраняет detached complete
  ChangeSet и отсутствие `PendingDurability`, History, autosave или canonical
  projection у reject; post-validation persistence failure остаётся отдельным
  AD-3 branch.
- **Lifecycle SnapPolicy не регрессировал.** AD-7 lines 220–224 по-прежнему
  делает policy construction-only, current-session Draft-only и запрещает
  re-interpretation Durable Revision.
- **Topology boundary не потерян.** AD-7 lines 226–238 содержит все четыре
  exact-contact class, one-Vertex-per-coordinate и ordered atomic partition
  every affected interior; T/X не делегированы библиотеке.
- **D-022 не закрыт ошибочно.** `Deferred` lines 639–644 оставляет kernel,
  tolerance, tie/hysteresis, relative-step-`k` selection, continuity, merge,
  Room/Opening, usable polygon и precision/locale открытыми. Новая фиксация
  integer domain `k` ограничивает допустимую форму candidate, но не выбирает
  его pointer-selection policy.
- **Нет readiness leak.** `Deferred` lines 645–654 маршрутизирует source-owner
  reconciliation и corpus; lines 681–683 прямо удерживают S-2, G-1,
  G-CP-ADR, legal/AssetUsageGrant, physical NFR-15 и `G-READY` открытыми.

## Retained follow-through, не блокирующий этот узкий accept

`bmad-prd`, `bmad-spec` и `bmad-ux` всё ещё обязаны согласовать свои
source-owned contracts и создать raw-byte/topology/formatting corpus. Geometry
Contract §6 всё ещё несёт старую open split/reject формулировку X, поэтому
никакая implementation authority не возникает до этого reconciliation и
остальных readiness gates. Это явно зафиксировано в `Deferred`, а не скрыто
архитектурным acceptance.

Ни один канонический, source или implementation artifact этим review не
изменён.

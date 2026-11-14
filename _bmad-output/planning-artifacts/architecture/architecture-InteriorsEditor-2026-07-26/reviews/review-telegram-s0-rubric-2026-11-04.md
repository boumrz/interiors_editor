# Reviewer Gate — Telegram S0: rubric

Date: 2026-11-04. Scope: Architecture Spine update against FR-55–58, NFR-28, UXF-8 and TMA S0; read-only independent review.

## Verdict: changes required

- **Critical:** The current Spine references AD-25–AD-29 (AD-11, CAP-9 table and Telegram S0 evidence section) but defines none of those decisions. There is no actionable architecture for identity verification/scope and generation fencing, isolated entries and retention, host lifecycle, delivery and format disposition. `lint_spine.py` passing does not detect references to absent ADs. Insert the actual decisions and re-run independent gate.
- **High:** Old `Structural Seed` still describes the checkout as a planned single PWA with no scaffold, although README/code establish a real Web/PWA and the extension requires two compositions. Mark as historical seed and clarify that AD-25–29 supersede its platform assumptions, preserving current root rather than inventing a second application.
- **High:** Historical `Deferred` text says `G-READY = NOT_READY` without current applicability, whereas README records a later READY 30 August; explicitly distinguish the prior implementation gate and Telegram extension's as-yet-unassessed readiness. Earlier verdicts should not be rewritten as current claims.
- **Medium:** The CAP-9 map cites absent AD IDs and the CAP-1/CAP-10 rows do not map the S0 identity and transfer decisions. After adding them, update maps and source-owner compatibility gate to avoid dropping the new invariants in downstream handoff.

## Boundary of review

No application, configuration, test, source of truth other than this review, or user data changed. Prior NFR-15 and release/device evidence do not prove NFR-28. AssetUsageGrant source collision requires owner/readiness disposition; this review does not decide licensing policy.

## Повторная проверка после исправлений

**Verdict: pass with two clarity remediations and recorded external gates.** AD-25–AD-29 теперь определены; покрыты единое ядро и независимые оболочки, локальная проверка Telegram identity, единый scope и teardown barrier, host/draft safety, schema guards без worker, сохранение immutable URLs и file/format boundary. Исправлены структурный seed, контекст старого readiness verdict и карты CAP-1/CAP-10. Критическое замечание первоначальной проверки закрыто.

- **Medium:** в AD-29 физическую проверку файла лучше выразить явно в двух направлениях Web/PWA→Telegram и Telegram→Web на iOS и Android (FR-57/NFR-28); одна фраза «на каждом target ... повторно импортироваться» допускает одностороннее толкование.
- **Medium:** Deferred по-прежнему включает исторические формулировки «before implementation», выбор packaging после scaffold и старые незакрытые spikes, хотя baseline уже реализован и прежний scope получил READY. Добавить общую оговорку исторической применимости и приоритета новых S0 решений и фактического baseline; эти пункты не являются новым запретом на уже существующий код и не освобождают расширение от новой readiness оценки.
- **Remaining owner/evidence gates, не дефекты принятого local design:** конфликт AssetUsageGrant между AGENTS и PRD/SPEC/AD-14; source-owner disposition V1/PPJ-A1 до S3; возможность идентификации и lifecycle на физических Telegram клиентах; физический внешний файл и при необходимости отдельное решение владельца; фактические bot/origin, проверка владельцем и отдельный retirement gate. Ни одно не выдаётся за уже пройденное доказательство.

Review проверяет архитектурные формулировки и source traceability; не утверждает успешный runtime, device tests, release или новый READY.

### Закрытие замечаний повторной проверки

Оба замечания уточнены: AD-29 теперь требует физический внешний roundtrip в обоих направлениях на iOS и Android; Deferred помечен как исторический с уточнением применимости и текущей границы readiness. Эти исправления не являются device evidence или verdict `READY`.

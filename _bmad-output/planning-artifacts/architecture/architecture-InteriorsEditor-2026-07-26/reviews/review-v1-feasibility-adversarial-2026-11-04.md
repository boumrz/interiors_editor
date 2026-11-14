# Adversarial review — format-specific BackupFeasibility

Дата: 2026-11-04. Объект: раздел Format-specific BackupFeasibility в `telegram-portable-v1-disposition-2026-11-04.md` и AD-30. Проверка источников и документа; код и canonical artifacts не редактировались.

## Verdict: PASS WITH IMPLEMENTATION AND EVIDENCE PENDING

Ранее выявленные несовместимости закрыты архитектурно:

1. В V1 считается фактический wire member/envelope либо source-owned conservative budget 4096 + 1024/reference; прежний browser default и hard caps не меняются. Один успешный encode не заменяет whole-Project/domain validation.
2. Policy и writer связаны с одним scoped `repository.resources`, без optional resource-read shortcut, untrusted file flag или fallback на PPJ. Каждый original key проверяется независимо на size и все 256 SHA bits; aliases дополнительно сравниваются byte-for-byte, а resource budget считается до dedup.
3. Candidate snapshot фиксируется до первого asynchronous шага и проходит тот же путь в publication; internal JSON checksum не подменяет точное V1 equality для -0/undefined. AD-26 commit повторно проверяет fence, base, roots и scope/generation. SessionRetention current/undo/redo и redo на reject сохраняются.
4. Упомянут второй прямой `assessBackupFeasibility` в `CreateCustomGlbFloorItemUseCase`: его нельзя обойти или считать автоматически переведённым только потому, что порт внедрён в repository wrapper. Нормативный 25-MiB custom admission остаётся.

Границы: нужна демонстрация actual formatter/validator wiring после создания repository, непротиворечивого snapshot при concurrent mutation/takeover, точных envelope и alias limits, missing/corrupt key, history и browser default regression. Domain reason `INVALID_DIMENSION` не переобозначается как schema failure. Этот review не удостоверяет реализацию, тесты, физические WebView или readiness.

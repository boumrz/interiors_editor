# Независимая rubric/source-проверка: V1 feasibility seam

Дата: 2026-11-04. Проверка раздела «Format-specific BackupFeasibility» в `telegram-portable-v1-disposition-2026-11-04.md` против AD-4/AD-30, актуальных SPEC-компаньонов и текущего кода. Read-only проверка canonical источников; данный файл — review.

## Вердикт: PASS WITH IMPLEMENTATION AND EVIDENCE PENDING

Выбор feasibility adapter на доверенной composition boundary согласуется с форматом V1-wire, сохраняет действующую Project policy и не ослабляет PPJ-A1: актуальный `project-and-backup-contract.md` ограничивает AST-R1 именно PPJ route и отдельно регистрирует V1-wire/scanner. Раздел не заявляет реализации, readiness или принятия licensing policy.

## Проверенные границы

1. Registered V1 encoder измеряет фактический portable Project member из защищённого `candidate.project`; internal `serializedProject` и checksum не заменяются. Immutable snapshot до async и повторная проверка в fenced commit нужны потому, что internal JSON не различает -0/0 и own-undefined/absent.
2. Общие limits и whole-Project policy остаются обязательными: в частности, 100 definitions, 10 MiB Project member, 50 MiB/resource, 180 MiB по исходным keys до dedup, 190 MiB container и 280 MiB unpacked. Для wire используются фактические envelope bytes либо доказанная V1 оценка с fixed 4096 bytes; старые 2048 bytes не выдаются за достаточную оценку V1.
3. Writer и feasibility связаны с одним `repository.resources` выбранного scope после его создания; каждый original key читается независимо и проходит length/SHA-256 bits, alias copies сравниваются byte-for-byte. Optional shortcut без resources в Telegram, выбор по file flag и permissive fallback исключены.
4. Feasibility остаётся дополнительным admission, не заменяет pin/root proof, fenced publication и `SessionRetentionPolicy` current/undo/redo; отклонение/гонка не меняют Durable state и не нарушают redo. SessionRetention wrapper и прямой предварительный вызов `CreateCustomGlbFloorItemUseCase` должны использовать согласованную policy либо последний путь должен оставаться явно ограниченным.
5. Browser default, PPJ grammar/AST-R1, custom admission 25 MiB, Project Limits и licensing не меняются; domain outcomes сохраняются отдельно от ошибок codec и policy. Это не подтверждение физической GLB безопасности или device compatibility.

## Остаточные проверки

Потребуются реализация и поведенческие evidence для V1 lone-surrogate/own-undefined/-0, 100/101 definitions, размеров Project/manifest/container, scoped resources и aliases, незарегистрированного выбора, неизменности browser default, custom 25 MiB и history roots, а также race против takeover/cleanup. Эти проверки здесь не запускались; наличие архитектурного решения не является implementation-readiness verdict или физической приёмкой.

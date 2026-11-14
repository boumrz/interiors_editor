# Adversarial review — S3 portable V1 disposition

Дата: 2026-11-04. Предмет: AD-30 и `telegram-portable-v1-disposition-2026-11-04.md`; review не изменяет canonical источники и не утверждает выполнение реализации.

## Вердикт: CONCERNS

Новый отдельный selector, независимый внутренний serializer и copy-on-write защищают сохранённые Revision. Legacy без root явно считается только синтаксической ветвью, не доказательством происхождения; документ осознанно отклоняет пересечение с PPJ и сохраняет оригинал. Проверка непредставимых чисел без округления и explicit unsupported old client — верные консервативные границы. Найдены две ошибки/неразрешённые границы с последствиями для S3.

### High — Отказ экспорта существующего healthy V1 противоречит непрерывности backup

Grammar отвергает `yawRadians: 0.5`, допускаемый наблюдаемым V1 guard; конкретный fixture находится в `apps/web/src/domain/project-json-transfer.test.ts`. Документ честно говорит, что непредставимый проект получит отказ export, но при этом AGENTS/AD-4 требуют backup feasibility каждого non-corrupt Durable Project, а S0–S7 сохраняют Web/PWA. Два исполнителя могут по-разному разрешить это противоречие: один отключит работающий backup для затронутого проекта, другой оставит прежний экспорт либо изменит policy, не имея source-owned решения. Указать прямо в handoff blocker до S3 для владельцев SPEC/Product: как сохранить доступный пользователю backup без silent data loss и деградации прежнего Web/PWA, включая export после обновления и reopen; доказать реальными V1 файлами и old IDB. До принятия решения не утверждать совместимость/backup readiness всех исторических healthy projects. Округление, скрытая migration или удаление исходного проекта не являются исправлением. Сам по себе синтетический fixture не доказывает наличие такого проекта у пользователя, но доказывает принятие формы кодом.

### High — Precedence для unregistered manifest selector

Admission шаг 1 требует `registered selector` до staging Project, тогда как действующий `portable-backup-ingress-registry.md` §4.3 и §5 различает форму и регистрацию: синтаксически валидная неизвестная пара остаётся candidate до bounded 10 MiB check, checksum и lossless AST. Иначе файл с unknown selector и oversized member или bad checksum будет ошибочно классифицирован как schema unreadable вместо `BACKUP_PROJECT_LIMIT` или `BACKUP_CHECKSUM_MISMATCH`. Требуется ранняя проверка **формы**, но регистрация/dispatch только после размера, checksum и AST; зафиксировать составные fixtures unknown selector + oversize / checksum mismatch / malformed AST. Нельзя ранним dispatch перекрывать ранний fault.

### Medium — Уточнить исключение для обновляемых identity/timestamps

Правило «все поля без потерь» и создание нового ID должны явно различать portable source поля и новую destination identity. Существующий import меняет не только `projectId`, но и `updatedAt`; материализация без уточнения допускает несовместимые исходы у разных реализаций. Зафиксировать, какие timestamps destination сохраняет или меняет согласно существующему контракту, что изменение этих технических атрибутов не нормализует остальные поля, а original file/source остаются неизменными. Добавить проверку полей, optional presence и списков через оба направления.

## Открытые evidence и границы

Консервативный отказ ambiguous V1/PPJ корректно отмечен как нерешённый source/product вопрос: он означает, что произвольный исторический файл нельзя обещать открыть. Матрица старых/новых builds не заменяет реальный corpus и physical handoff; она правильно признаёт, что старый decoder отвергает новый selector. Тестов/приложения reviewer не менял.

## Повторная проверка после исправлений

**Итог: PASS WITH OPEN SOURCE DECISION AND EVIDENCE.** Ранняя стадия проверяет лишь синтаксис manifest selector, а регистрацию и dispatch — после Project size guard, checksum и bounded AST; добавлены комбинированные negative vectors. V1-wire сохраняет конечный `yawRadians` как binary64, включая `0.5`, не материализуя округление; при наличии `yawStep` сохраняется текущий приоритет. Замена browser export запрещена до доказательства покрывающей все healthy Durable V1 представимости и текущей BackupFeasibilityPolicy. Admission явно сохраняет `createdAt`, создаёт новый Project ID и задаёт `updatedAt`/Revision time одним текущим моментом. AD-26 теперь различает реально существующий exclusive pin cleanup и ещё не реализованный scope-wide GC, сохраняя barrier.

Не закрыты: source-owned регистрация и решение о неоднозначном пересечении legacy/PPJ; доказательство, что весь реально допустимый healthy V1 представим в wire (включая строки, числа, лимиты и optional fields); real files, physical roundtrip и применимый readiness gate. Это условия продолжения S3, не обещание совместимости исторических файлов и не тестовое подтверждение.

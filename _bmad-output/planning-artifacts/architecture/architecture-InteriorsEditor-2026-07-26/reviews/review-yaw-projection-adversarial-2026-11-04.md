# Независимая edge/adversarial проверка: legacy yaw projection

Дата: 2026-11-04. Область: AD-30 и раздел «Read-only проверка legacy orientation» в `telegram-portable-v1-disposition-2026-11-04.md`.

**Вердикт: PASS для архитектурной применимости; реализация и evidence ожидаются.** При чтении актуального `parametric-item.ts` новое правило закрывает перечисленные расхождения без изменения wire grammar или persisted значения. `INVALID_DIMENSION` является существующим domain reason, но сам текущий production importer и текущий placement assessor не заявляются уже реализовавшими новый whole-project guard.

Проверены точки расхождения:

- Валидный `yawStep` имеет приоритет перед даже предельно большим finite `yawRadians`. Отклонять raw finite yaw лишь из-за потенциального overflow нельзя. При отсутствии обоих полей текущая projection равна нулю.
- Для `0.5` и ±`1e100` применяется прежняя конечная projection; ±`Number.MAX_VALUE` без `yawStep` при делении дают Infinity и затем NaN. На этапе domain/placement `INVALID_DIMENSION` допустим только после успешных schema/policy checks и до collision, staging/pin и publication, не как schema error.
- Проверка конечности обязательна **для всех** floor items до любого collision assessment: иначе collision для первого предмета может использовать NaN footprint ещё не проверенного соседа.
- Интерфейс `assessParametricFloorItemPlacement` принимает `yawStep`, а не `yawRadians`. Для временного input требуется преобразовать уже конечный результат `yawRadiansFor` существующей `rotationStepForYawRadians`; исключить собственный item по его ID. Проверка не меняет исходный `yawRadians`, собственное присутствие/значение `yawStep`, source Project, Revision или file bytes; существующие collision warnings остаются warnings.
- Нужны future tests для обоих знаков предельного числа, 0.5 и ±1e100, заданного/отсутствующего/own-undefined step, всех восьми значений step, двух предметов с поздним NaN и конкурирующих более ранних schema/policy ошибок. Сохранение существующих конечных проекций и поведения восстановительного пути должно быть доказано, а не выведено из этого review.

Production tests, physical devices и реализация нового guard в рамках проверки не выполнялись. Для отклонения не нужен отдельный core projection repair; если его позже предложат, он требует самостоятельного доказательства preservation и соответствующего gate.

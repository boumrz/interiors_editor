# Rubric review — read-only V1 yaw projection

Дата: 2026-11-04. Область: AD-30 и раздел `Read-only проверка legacy orientation` в архитектурном companion. Проверка только документов и source; код и нормативные источники не изменялись.

## Вердикт: PASS с открытым implementation/evidence

- Wire допускает любые finite binary64 `yawRadians`; проверка конечности вычисленной projection находится после schema/policy на domain-стадии и возвращает существующий `INVALID_DIMENSION`. Она не ослабляет PPJ и не маскирует ошибку как `BACKUP_SCHEMA_UNREADABLE`.
- Whole-project prepass проверяет все floor items до collision; это предотвращает попадание нечисловой проекции соседнего предмета в оценку другого. Существующий assessor принимает `yawStep`, поэтому conversion из конечной `yawRadiansFor` ограничен временным input. Сам предмет исключается из collision target; сохранённый source не изменяется.
- Явный `yawStep` имеет приоритет над любым finite legacy yaw; при отсутствии обоих действует существующая projection 0. В частности, ±`Number.MAX_VALUE` отклоняются только при нечисловом derived result; наличие корректного `yawStep` не должно блокироваться unused yaw. Для `0.5` и ±`1e100` требуется сохранить текущий результат.
- Текущий importer не доказан как реализующий whole-project prepass. Readable source не следует называть повреждённым только из-за отказа admission; восстановление/полный backup обещаются лишь при реально доступном проверенном пути. Новый core projection repair для ограниченного отказа не требуется.

Незначительное уточнение: в кратком правиле AD-30 лучше использовать «неконечная projection», как в companion, поскольку проверяется `Number.isFinite`, а не только `NaN`.

## Остаётся проверить

Реализация и corpus для обоих знаков, отсутствующего/явного `yawStep`, ранних schema/policy failures, нескольких items, сохранения source bytes и нормальных finite projections. Эта документная сверка не является запуском тестов, физическим evidence или readiness verdict.

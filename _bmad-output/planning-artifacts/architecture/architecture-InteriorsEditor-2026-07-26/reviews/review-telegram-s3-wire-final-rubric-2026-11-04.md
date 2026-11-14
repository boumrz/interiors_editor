# Независимый rubric review: финальный S3 wire

Дата: 2026-11-04. Проверены `ARCHITECTURE-SPINE.md` AD-30 и `telegram-portable-v1-disposition-2026-11-04.md` против FR-57 и текущих `project-json-transfer.ts`, `project.ts`, `canonical-serialization.ts`, `durable-project-repository.ts`, exporter/feasibility. Это review документного контракта, не проверка реализации и не S3 readiness.

## Вердикт: CONCERNS

### High — определение healthy исключает потенциально читаемые существующие V1 данные

Companion ограничивает healthy **типизированной** V1 моделью и отдельно исключает `colorVariantId` как массив. Но текущий `isStructurallyValidProjectV1` вызывает `alphaParametricItemColorVariantFor(String(item.colorVariantId))`: JSON array `["alpha-blue"]` и вложенные одноэлементные массивы преобразуются в `"alpha-blue"`, проходят этот конкретный guard при точном соответствующем `color` и отсутствии assetDefinitionId. `decodeCanonicalProject` использует этот же структурный guard после bounded raw parser; repository `isReadable` сравнивает checksum и JSON-semantic equivalence. Таким образом, TypeScript type или переименование в «неподтверждённое» само по себе не доказывает, что такие checksum-valid durable Projects не возникали и не пригодны к восстановлению; наличие конкретных пользовательских данных также не доказано.

Нужно либо явно включить конечные JSON-safe значения, которые фактически проходят этот coercion (ограничивая depth и расписывая точное сохранение raw type и read-only семантику), с тестами прежнего importer/reopen и новым wire, либо обозначить недоказанную representability как открытый blocker и сохранять проверенный путь прежнего клиента. Не утверждать «все здоровые V1 доказанно представлены» исключительно за счёт определения healthy как типизированного.

### Medium — порядок root/level одновременно фиксирован и обещан исходным

Companion требует root wire keys в фиксированном порядке, но также обещает сохранить порядок V1 record keys исходного `candidate.project`. `DurableProjectRepository.isReadable` сортирует object keys перед JSON-сравнением Project со строкой Revision и потому может принять source object с иным insertion order, тогда как `serializeProjectCanonically` отдельно конструирует root и level в фиксированном порядке. Для такого source writer не может одновременно фиксировать root order и сохранять его как исходный без отдельного представления порядка. Уточнить, что порядок root/level нормализуется как несемантический, а source bytes не меняются, либо явно кодировать исходный порядок; не заявлять обе гарантии одновременно. Аналогично проверить описанное сохранение optional-own-undefined для всех V1 records.

## Положительно и границы

Отдельный wire selector, строгая изоляция PPJ, legacy witness и отсутствие заявления о гарантированном recovery sole-copy согласованы с FR-57. Closed tables охватывают реальные V1 fields/ranges, 0.5 и отрицательный ноль. Escaped surrogate и own-undefined представляются отдельно, а внутренние IDB serializer/checksum не меняются. Ограничение non-scalar strings и AST capacity отделено от PPJ. Формулы envelope приведены как план с обязательной executable проверкой; numerical caps, обе physical platform и конкретные реальные source files пока не доказаны.

## Повторная проверка после исправлений

**Вердикт: PASS WITH OPEN SOURCE DECISIONS AND EVIDENCE.** High исправлен в границах установленного depth ≤8: VariantValue явно включает одноэлементные вложенные массивы, сохраняет их исходную форму и цветовое соответствие, не выдавая coercion за строковую семантику. Документ отдельно признаёт недостаточность одного `isReadable`, непроверенные глубокие значения и нестандартные properties массивов; sole-copy без доказанного recovery остаётся открытой зависимостью. Medium исправлен: root/level writer нормализует порядок по прежнему serializer и не утверждает равенства insertion order source object; nested record order и source bytes оговорены отдельно.

Проверка не доказывает, что такой wire уже реализован, все исторические user files доступны или worst-case оценки/real-device roundtrip выполнены. Регистрация SPEC, проверенный recovery для ambiguous sole-copy и последующий readiness остаются обязательными.

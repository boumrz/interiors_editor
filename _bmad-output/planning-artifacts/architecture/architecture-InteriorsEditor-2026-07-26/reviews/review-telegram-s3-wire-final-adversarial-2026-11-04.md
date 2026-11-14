# S3 wire — независимый adversarial review

Дата: 2026-11-04. Проверены `ARCHITECTURE-SPINE.md` AD-30 и текущий `telegram-portable-v1-disposition-2026-11-04.md` относительно `project-json-transfer.ts`, `durable-project-repository.ts`, текущего serializer/export/decoder и hard limits. Это snapshot до возможных исправлений. Canonical документы этим review не изменялись.

## Вердикт: CONCERNS — две проверяемые проблемы

### High — ограничение типизированным V1 само по себе не доказывает полное покрытие существующих readable Project

`isSchematicFloorItem` и `isSchematicWallItem` проверяют variant через `alphaParametricItemColorVariantFor(String(item.colorVariantId))`, а не проверяют `typeof item.colorVariantId === "string"`. Например, при `color="#416b91"`, отсутствующем `assetDefinitionId` и валидных остальных полях значение `colorVariantId: ["alpha-blue"]` проходит структурный V1 validator; JSON.stringify, JSON.parse и repository `hasSameCanonicalJsonValue` сохраняют этот массив, а `String(["alpha-blue"])` возвращает `alpha-blue`. Следовательно, такая checksum-valid Revision может пройти текущий `isReadable`; прежний canonical serializer и exporter записывают этот массив. Текущая wire-таблица принимает только string enum и исключает объект через новое определение «типизированный healthy», хотя evidence о том, что ни один такой Project/file не существует, и полном source/product disposition на это исключение здесь нет. Действительно, он нарушает TypeScript type и в нормальном UI мог не создаваться; это **контрпример технической читаемости**, а не утверждение о существующем пользовательском файле.

Нельзя объявлять «любой isReadable V1» поддержанным, подменяя его определением type-correct data. Source owner должен либо заморозить версионированную строго bounded compatibility grammar для реальных допущенных форм и lossless preserve (например единственный вложенный singleton-array путь с ограничением глубины/размера и точным конечным enum), либо явно зарегистрировать условие исключения и необходимый recovery/решение относительно такой sole copy. Не ослаблять PPJ-A1 и не выполнять implicit String coercion при сериализации; неизвестно, что исторические revisions все ограничены текущим AST-R1, поскольку `isReadable` не вызывает этот parser. Привести test fixture с настоящим Project + checksum и проверить старый exporter → новый importer.

Отдельно, JS arrays могут иметь enumerable неиндексные свойства, сохраняемые structured clone, но игнорируемые `JSON.stringify` и `sortJsonValue(...).map`. Структурный validator их не исключает. Например `project.level.vertices.extra={...}` при валидном array содержимом не влияет на `isReadable`/Revision JSON. Это не доказанный поддерживаемый domain state, а граница: если обещание относится к V1 **семантическим полям**, явно исключить эти произвольные свойства из модели и не называть wire побитной копией всего raw IDB object; если оно относится ко всему raw object, нужен отдельный bounded lossless scope и source-owner решение. Исходный IDB остаётся нетронутым в обоих случаях.

### Medium — числовая оценка fixed ZIP/manifest overhead занижена

V1 `projectId` — любая непустая строка до 256 UTF-16 code units; `"\\u0000".repeat(256)` допустим и scalar. Его canonical JSON representation занимает 1538 байт с кавычками, больше 683-byte surrogate wrapper, принятого в оценке fixed 2048. Прямой Node расчёт по указанной форме manifest/checksum ledger с extended-year timestamp, 64-char SHA и 10 MiB Project entry: `manifest.json=2022`, `checksums.json=143`, local+central headers трёх путей плюс EOCD `344`; fixed overhead **2509 bytes > 2048**, даже без единого asset. Это разрушает доказательство заявленного bound, хотя не показывает фактическое превышение 190 MiB: запас в нём достаточен для потенциального исправления.

Пересчитать fixed overhead с max scalar controls, surrogate wrapper, длинным ISO, manifest/checksum Project entry, всеми тремя local/central headers, EOCD, требуемыми ledger/path bytes; задать обоснованную константу и пересчитать общий арифметический bound. Для ZIP STORE исключить дополнительные optional headers/metadata, иначе учесть их. Проверить ещё случай 250 definitions, когда разные case-preserving resourceHash адресуют один digest/path. Проверка размеров — до rollout.

## Проверенные границы

- Отдельный V1 parser не изменяет PPJ-A1; special `-0` для zero-valued numeric pointers сохраняет знак raw candidate, но old JSON `0` не позволяет его восстановить. Нужен фактический reopen в IndexedDB и checksum test, не только `structuredClone`.
- `OptionalUndefined` должен сохранять и case `Window.swingSide` own-undefined, и любую комбинацию own-undefined в catalog quartet, если все реальные значения отсутствуют. Marker допустим только на exact optional pointers, noncanonical marker — refusal.
- `V1String` wrapper для lone surrogate требует canonical base64url, даже byte count и повторную проверку наличия непарного surrogate; scalar-only wrapper отвергать. Manifest `sourceProjectId` использует ту же кодировку для нового selector и должен сравниваться по восстановленным UTF-16 code units, в legacy — по исходному decoded V1 string; PPJ порядок и правила остаются самостоятельными.
- Upper/lowercase resource aliases требуют independently verified original source keys, size и exact bytes до дедупликации и на восстановлении всех исходных keys; bytes не выводятся из spelling и alias не доказывает их наличие. Сценарий отсутствующего одного alias остаётся явно rejected/preserved.
- Старый empty V1 без witness консервативно rejected. Указанный old-build recovery path — кандидат, не доказанная sole-copy гарантия; его физическое и operational evidence либо отдельное решение по условию FR-57 остаётся открытым.
- Reader не должен первым применять source-ID JSON.parse, поскольку текущий production код делает это раньше checksum. Unknown well-formed selector + oversize/checksum остаются в порядке, записанном в новом документе; отрицательные комбинации — required evidence.

## Повторная проверка после правок

Предыдущий вариант `colorVariantId: ["alpha-blue"]` и ограниченные вложенные singleton-arrays зарегистрированы как `VariantValue` с сохранением формы, без coercion при export/import. Глубина выше 8 и non-index array properties явно остаются вопросом совместимости/recovery; сохранение их sole copy не объявлено доказанным.

Обновлённые арифметические числа воспроизведены независимо: Project bound 7,920,128; decoded charge 4,805,888; members 18,720; array elements 2,900; nodes 21,621; общий container bound 196,923,904 < 199,229,440. Исходный контрпример fixed overhead теперь 2509 < 4096. Для одного ресурса с 75-byte path и 64-byte hash расчёт manifest entry 216 + resources mapping 168 + checksum entry 162 + ZIP headers 226 + три разделителя = 775 < 1024.

**Остаток:** сам `STORE` не ограничивает дополнительные ZIP headers, comments, data descriptors или metadata; writer должен явно исключать их либо bound включать их cap. Полезно явно подставить все terms metadata accounting: `48×21621 + 32×18720 + 8×2900 + 16×21620 + 4,805,888 + 1,691,648 + 8,320 = 8,511,824 < 16,777,216`, где numeric-lexeme allowance намеренно завышен; отдельно зафиксировать per-object/pointer/base64 limits. Выполняемого worst-case corpus, реальных файлов, sole-copy recovery и физического roundtrip это исследование не создаёт. После устранения ограничения ZIP вывод: **PASS WITH SOURCE RECONCILIATION AND EVIDENCE PENDING**; до него — конкретное medium замечание к доказательству.

## Итоговая проверка ZIP и memory bound

Записанные single-disk STORE без ZIP64, extra fields, data descriptors и archive/entry comments закрывают прежний пропуск overhead; лимиты per-object, array, pointer, numeric token, wrapper и transient bytes указаны. Контрольное арифметическое уточнение: подстановка **записанного** `pointerLinks≤21,621` даёт `48×21621 + 32×18720 + 8×2900 + 16×21621 + 7,575,453 + 1,691,648 + 8,320 + 512 = 11,281,917`, не 11,281,901; с более точным ограничением `pointerLinks≤21,620` получается 11,281,901. Оба значения меньше 16,777,216. Исправить формулу или итог; на решение о вместимости 16-byte разница не влияет.

Вердикт: **PASS WITH SOURCE RECONCILIATION AND EVIDENCE PENDING** после механического исправления указанной арифметической опечатки. Доказуемые source contracts, runnable max corpus, sole-copy recovery и физический roundtrip остаются отдельными gates.

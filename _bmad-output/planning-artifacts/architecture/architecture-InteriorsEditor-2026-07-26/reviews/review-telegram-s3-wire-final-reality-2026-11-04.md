# Reality review — S2 unified IndexedDB и S3 V1 wire

Дата: 2026-11-04. Независимый read-only review исходников и архитектурных companions. Тесты приложения и физические WebView не запускались.

## Вердикт

**PASS WITH EVIDENCE PENDING после двух механических уточнений оценки bounds.** Решения согласуются с обследованным baseline. Фактическая регистрация SPEC, реализация, проверка worst-case corpus и физическое evidence остаются отдельными gates; этот review их не заменяет.

## Замечания

1. **Low — base64 wrapper size.** Кодирование 512 UTF-16BE bytes даёт максимум 683 base64url characters без padding, но закрытый JSON object `{"utf16be":"..."}` включает ещё 14 ASCII bytes: максимум **697 bytes**, не 683. В формуле Project используется более консервативный предел 1536 bytes на строку, а fixed envelope reserve 2048 bytes имеет запас, поэтому этот арифметический нюанс сам по себе не опровергает рассчитанный общий bound. Исправить обозначение и проверить worst-case manifest fixture.
2. **Medium — доказательство AST count требует явной суммы.** Из одного утверждения «1652 records, максимум 18 собственных полей» ещё не следует лимит 49152 members с вложенными wrappers. Консервативный подсчёт: vertices 600×4=2400; walls 300×7=2100; rooms 50×9=450; openings 200×11=2200; floor items 250×25=6250 (wall меньше); definitions 250×18=4500; root+level ≤17. Итого ≤17917 members Project AST, включая members wrapper-объектов; соответствующее число value nodes остаётся значительно ниже 65536, array elements ≤1650. Это ручная верхняя оценка, её нужно подтвердить исполняемым corpus до rollout. Manifest и checksum ledger имеют собственные bounded parsers.

## Проверенные факты

- Текущий `TelegramScopeStore` открывает `interiors-editor-projects:<scope>` version 1 с object store `scope-metadata`, identity `protocolVersion:1` и точным decimal uint64 counter. Запись counter запрашивает и проверяет `durability:"strict"`; `onversionchange` синхронно отзывает session и закрывает DB. Предлагаемая version 2 сохраняет identity, value counter и protocolVersion 1, учитывает late `onblocked`, abort и отличие browser-created versionchange transaction от обычных strict write transactions. Проверяемая migration, а не уже реализованная capability.
- Предложенная одна scope DB допускает одну IDB transaction для финальных pointer/receipt/resource predicates. Асинхронный hash вынесен из активной IDB transaction, а повторное чтение identity и проверка fencing выполняются под scope Web Lock. Фактические cross-context races и доступность Web Locks на целевых WebView ещё не проверены.
- Текущий exporter создаёт manifest из 11 закрытых полей, `project/project.json`, ledger и только `custom/<lowercase-sha256>.glb`. Старый decoder не распознаёт новый selector. Новый V1 envelope отдельно фиксирует manifest, resources, ledger и точные bindings; PPJ grammar и более ранние source-owned reason codes не считаются изменёнными до rederive.
- Нынешний production decoder извлекает source ID через `JSON.parse` до checksum и не подключает полный PPJ staged ingress. Proposed checksum-first dispatch — будущий контракт, не факт baseline.
- Исходный `canonicalProjectSerializer` участвует в IDB revision/checksum и не модифицируется. `yawRadians` может быть finite 0.5; wire сохраняет его без квантизации. `-0` в structured-clone object и уже сериализованный `0` в revision — разные наблюдаемые представления; восстановление `-0` в новом object и проверка после reopen требуют будущих tests.
- Консервативный отказ старого ambiguous файла и кандидат восстановления через старый build явно не выдаются за проверенный путь или за гарантию sole-copy recovery; FR-57 остаётся открытым до реальных build/file evidence.

## Проверка суммарной ёмкости

180×1048576 + 7920128 + 2048 + 250×1024 = **196921856**, меньше 190×1048576 = **199229440**. Этот вывод зависит от подтверждения заложенных closed-record, wrapper и ZIP overhead bounds для всех допустимых inputs; один расчёт не доказывает browser memory safety.

## Повторная проверка после исправлений

**PASS WITH IMPLEMENTATION AND EVIDENCE PENDING.** Оба замечания исправлены: wrapper размером до 697 bytes указан отдельно от 683 base64url characters; fixed envelope reserve увеличен до 4096 bytes и включает scalar control-escape source ID. Пересчитанная сумма 188743680 + 7920128 + 4096 + 256000 = **196923904 < 199229440** корректна.

Для AST теперь приведены отдельные верхние bounds с учётом дополнительно обнаруженного `VariantValue` (singleton arrays, допускаемые фактическим `String(value)` guard): 11865 base members + 4055 string wrappers + 2800 optional-undefined markers = **18720**, array elements ≤2900, value nodes ≤21621. Арифметика и перечисленные maxima согласуются с закрытой таблицей; этот ручной review не выполняет worst-case fixture.

S2 по-прежнему фиксирует проверку v1 identity/counter и inventory до commit versionchange transaction, отмену запоздалого blocked open, unchanged `identity.protocolVersion=1`, strict ordinary write transactions, сохранение существующей Revision при Undo/Redo и atomic receipt. Runtime и реальные WebView не проверялись.

# Mutation evidence: bounded scoped metadata

Полный файл `telegram-scope-store.ts` проверен в native Chromium: **218 mutants,
158 killed, 11 timeout, 49 survived, 77.52%**. Это результат
[полного прогона](storage-mutation-final.json), а не нового прогона после всех
усилений tests. Production source во всех прогонах неизменен; сравнивается его
SHA-256 и exact source text в JSON. Нового mutation threshold/100% gate нет.

Следующие адресные проверки сохраняют собственные scope, числа и JSON; их
проценты не выдаются за повтор всего файла или искусственный общий score.
Первый narrow diagnostic выбрал 33 inner mutants из-за column-range semantics,
поэтому не доказывает повтор всех запрошенных 51 survivors. Для последующих
проверок используются целые строки. Промежуточные логи сохранены как история.

## Разбор всех 49 исходных survivors

Независимый reviewer проверил каждый ID. «Диагностическое различие» и
«защита, избыточная при текущем native API» не означают полной математической
эквивалентности и не исключаются из raw score.

| Исходные IDs | Значение и решение |
| --- | --- |
| 20,21,85,126,127,128 | Реальные пробелы проверки close/cache/late handles. Upgrade сам закрывал leaked handles через onversionchange и маскировал их. Добавлен observer реальных owned handles и проверка **до** upgrade; адресные результаты ниже |
| 189,190 | Реальный пробел closed-shape проверки: whole Array с собственными enumerable полями может сохраняться native IDB. TMA-STORAGE-17 создаёт его внутри renderer, требует отказ без ID/repair и сохраняет Array |
| 215 | Снять transaction.onerror безопасно только при default abort. TMA-STORAGE-18 создаёт настоящий ConstraintError через add существующего counter и preventDefault; требует отказ, неизменный counter и уникальный следующий ID |
| 15,35,48,59,68,73,83,97,120 | Меняются статические сообщения ошибки; отказ/отсутствие ID остаются. Диагностика отличается; stable wording не является контрактом этого внутреннего substrate. UI ещё не подключён и не должен зависеть от этих строк |
| 123,208,214,217 | Меняется fallback text. Native request error обычно non-null; manual transaction abort имеет null error, поэтому 214 достижимо меняет диагностику |
| 122,207,213,216 | Меняется rejection object на Error/null. Это не полная эквивалентность; отказ и отсутствие ID сохраняются. 213/216 включают достижимый null error; новые write-error tests не подменяются чтением synthetic error |
| 18,82 | Публичные операции уже запрещены неизменно revoked session. disposed остаётся дополнительной защитой текущего private lifecycle |
| 22 | После drain rejected open уже очищен; сохранённый opening разрешается DB. Optional chaining — дополнительная защита при текущем queue/cache порядке |
| 31 | Без callable guard отсутствующий request сам отвергает Promise до открытия DB. Диагностика меняется, общего writable fallback нет |
| 44,45 | Native exclusive request без ifAvailable не вызывает callback с null; abort guard остаётся. Обоснование ограничено именно этим native протоколом |
| 79 | До put ещё нет изменений; post-put native error/abort откатывает их. Удаление explicit abort меняет lifecycle, а не является полной эквивалентностью. Новая проверка prevented-default failure сохраняет обязательный отказ |
| 99,100 | AbortSignal испускает abort один раз, listener также явно снимается. Нельзя переносить аргумент на другой event source; explicit observer cleanup проверяется отдельно |
| 107 | При фиксированном open(name,1) native upgrade имеет oldVersion0; более новая DB даёт VersionError. Guard остаётся для будущего изменения schema |
| 110 | В native upgradeneeded request.transaction существует. Optional chaining остаётся defensive |
| 130,131,132 | Versionchange уже отзывает session и закрывает DB; cached reference не даёт новых допусков. Это отличается от реальной утечки незакрытого handle |
| 134 | Один serialized open; его catch снимает cache до следующего публичного open. Equality guard остаётся на случай будущего изменения lifecycle |
| 149,169 | У созданной adapter-ом native схемы inline keyPath=key связывает record key с lookup primary key. Аргумент не распространяется на чужую/иначе созданную схему |
| 180,181 | Следующий previous>=maximumCounter всё равно запрещает ID и сохраняет counter. Меняется причина corrupt/exhausted, это диагностическое различие |
| 191,192,195 | Поздние field/key checks либо пойманное исключение сохраняют отказ для cloned primitives/null. Это не случай whole Array, покрываемый 189/190 |
| 201 | При plain structured clone exact key count и последующие значения сохраняют закрытую форму. Изменённое prototype окружение вне этого обоснования |

Native put failure с preventDefault — управляемая инъекция поверх настоящего
IDB, не OS/disk-failure certification. Counter write не выдаёт ID до commit;
strict durability наблюдается, но eviction/OS crash/WebView release остаются
отдельными evidence. Metadata-only increment не доказывает полный AD-26,
Project publication/receipt или resource protocol.

## Адресные прогоны

- [Close/open lines 48–55,120–184](storage-mutation-handles.json): 61 mutants,
  38 killed, 6 timeout, 17 survived. Исходные 20,21,85,126,128 обнаружены;
  для 127 понадобилось отдельно проверить active handle после failed reopen
  **существующей** DB до retry/upgrade.
- [Terminal/schema lines 169–172,189–239](storage-mutation-terminal.json):
  83 mutants, 64 killed, 5 timeout, 14 survived; native TMA-STORAGE-01–18.
  Исходные 127,189,190,215 обнаружены (IDs 2,56,57,80 адресного прогона).
  Вместе два follow-up обнаруживают все девять значимых gaps из исходных 49.
  Сопоставление выполняется по mutatorName/location/replacement, не по локальному ID.
  Source всех трёх JSON совпадает с восстановленным production файлом:
  SHA-256 `75d61ab4ed570e07d87bf659c43f35d3dea08d8a71851d2911bad71706db7fa4`.

Исходные проверки не удалены и не ослаблены. Native cases перенесены в
`telegram-storage-e2e.check.ts` с explicit dedicated testMatch: обычный browser
suite сохраняет 335 названий, новые 18 cases запускаются своим config и
по-прежнему входят в TypeScript/lint.

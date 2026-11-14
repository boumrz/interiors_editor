# S2 — проверенные изолированные компоненты, 4 ноября 2026

## Продолжение по поручению завершить всё расширение

### Текущий checkpoint (предыдущий текст ниже — исторический)

Telegram repository и loaded-shell preflight реализованы, но product entry ещё
не подключён. Общий прогон после интеграции codec/validation/GLB/hash seams:
**2527/2527 unit, 166 файлов; обе TS-конфигурации PASS**. Это не physical или
полное S2 acceptance.

Нативный scoped protocol corpus **67 PASS**: реальный IndexedDB/Web Locks,
uint64 reservation, v1→v2 atomic upgrade, drain/revoke, current/history publish,
prepared pin ownership, abort/cancel/protection, takeover/adoption, deletion
and repair. Последние [RED](current-proof-quarantine-red.log) /
[GREEN](current-proof-quarantine-green.log) закрывают missing/corrupt current
Revision, отсутствующий/подменённый creation receipt, согласованно неверный SHA
и orphan pin roots с существующим либо утраченным writer fence. Подтверждённый
current snapshot хешируется вне IDB transaction и полностью перечитывается в
write transaction. Неизвестные bytes сохраняются, original text предлагается
только как unverified-source. Нет blanket startup cleanup или общего GC.

[Изолированный browser regression](browser-composition-regression-full.log)
после shared factory дал **332 PASS, 1 focus failure, 2 прежних opt-in skips**.
Ошибка inert/focus ordering исправлена layout cleanup;
[пять повторов focused path](opening-focus-fixed-full.log) и
[10 PWA](opening-focus-fixed-pwa.log) PASS. Широкий suite после этой правки ещё
не повторялся; прежний 333 PASS относится к более раннему снимку. Active
preview 4175/dist и десять browser/root конфигураций не менялись:
[новый preservation audit](continuation-preservation-audit.json).

Scope-store mutation350:255 killed/13 timeout/82 survived. Все37 выбранных
meaningful survivors killed в followup61 (59k/2 contextual equivalents),
[точное сопоставление](storage-v2-followup-matching.json). Loaded-shell/scoped
technical-state full197:182k/1timeout/14 bounded survivors (92.89%), без NoCoverage;
[текущий отчёт](bootstrap-guards-mutation-final.json). Независимые SDK/file,
shared factory и runtime handoffs имеют собственные scope/limitations.

Полный repository mutation2420 ещё идёт на историческом SHA, см.
[исходный snapshot](project-mutation-snapshot.json). Новые current-proof,
pin-root, reload-ack/source guards проверяются отдельным текущим
[follow-up296](current-proof-mutation-scope.json). Не объединять их в
выдуманный current full score и не объявлять Story10.2 завершённой до review.
Текущая factory собирает actual repository/resources и обязательный registered
writer; подключение UI/target следует после её окончательного handoff.

S3 V1-wire/ограниченный legacy зарегистрированы и реализуются независимо;
PPJ остаётся unaccepted handoff при недоступном полном validator. New custom
backup admission сохраняет25MiB. Licensing, public bot/HTTPS, physical iOS/Android
и внешний file roundtrip pending. Нет upload/cloud, удаления Web/PWA, публикации
или коммитов.

Работа продолжается. Следующий increment обновляет Telegram DB v1→v2 без
сброса identity/counter, добавляет закрытый composite transaction access и
writer generation policy. Native 26 cases проходят, включая новые RED/GREEN
upgrade/schema/metadata/drain probes. Общий publication API теперь передаёт
exact base и отличает history pointer transition; 2072 unit проходят.
Проверка типов и mutation этого increment ещё завершаются. Ни полноценный
Telegram repository, ни product entry пока не подключены. Следующие разделы
и source inventory ниже — исторический снимок предыдущего increment; новые
production изменения общего publication path потребуют свежего Web/PWA
регресса перед закрытием нового среза.

**Это начало S2, а не завершённая Story 10.2.** После отдельного локального
planning READY реализованы signed validator, session queue и отдельный scoped
metadata substrate. Последний проверяется test-only harness с настоящими
IndexedDB/Web Locks. Производственного Telegram entry/runtime, journal,
редактора и writable Project path пока нет. Web/PWA использует S1 browser path.

## Signed bootstrap

`src/adapters/telegram/signed-launch.ts` проверяет raw query строго один раз:
malformed percent/UTF-8/surrogates, повторные decoded keys, CR/LF, обязательные
signature/auth_date/user, duplicate user JSON members и точный положительный
safe integer ID. Он переиспользует bounded raw JSON parser, не PPJ schema.
Bot/environment берутся из одного снимка trusted configuration до async crypto.
Применяются Ed25519 с опубликованным Telegram production/test key, 300 s / +60 s
freshness и SHA-256 scope по AD-26. Неудача возвращает reason без raw identity;
runtime/storage/network/logging компонент не вызывает.

Native Web Crypto подтверждает опубликованный Telegram-signed known answer из
[исходной документации tma.js](https://github.com/Telegram-Mini-Apps/tma.js/blob/9350703debf015ff6b5fa751fdf1f72ae8ae250a/apps/docs/platform/init-data.md).
Это независимая публикация fixture; protocol/keys принадлежат
[официальной документации Telegram](https://core.telegram.org/bots/webapps#validating-data-for-third-party-use).
Старый auth_date проверяется injected test clock; в production freshness не
отключается. Fixture bot не является конфигурацией приложения. Дополнительные
negative cases проверяют подпись, bot/environment, signed extra fields, время,
encoding/duplicates/ID, оба края размера и недоступную crypto.

Независимый review нашёл изменение исходного объекта configuration между
verification и scope digest. [RED](identity-config-race-red.log) воспроизводит
его с настоящей crypto; [GREEN](identity-config-race-green.log) подтверждает
исправление снимком bot/environment. Финальный read-only review новых дефектов
не нашёл.

## Runtime session queue

`src/app/telegram-runtime-session.ts` владеет одной локальной очередью и одним
AbortSignal на bootstrap. `revoke()` синхронно закрывает новые допуски и
отменяет signal, а его Promise дожидается уже допущенной составной операции.
Queued и поздняя работа отклоняются; ошибка операции не ломает очередь.
A→B→A создаёт новый объект, не оживляя прежнюю generation.

Это локальный primitive. Он **не реализует** scope Web Lock, storage fence,
receipt или pin protocol и не является доказательством production DB races.
Внутри будущей допущенной составной операции нужны private inner adapters;
рекурсивный повторный захват той же очереди недопустим.

## Свежая проверка

| Проверка | Результат |
| --- | --- |
| Два новых компонента | [guards-green.log](guards-green.log): 16 / 16 |
| Весь unit suite | [unit-final.log](unit-final.log): 2060 / 2060, 147 файлов, без skipped |
| Обе исходные TS-конфигурации | [typecheck-final.log](typecheck-final.log): PASS |
| Lint | [lint-final.log](lint-final.log): 357 файлов, PASS |
| Boundaries | [boundaries-final.log](boundaries-final.log): 15 / 15 + production graph PASS |
| Signed bootstrap mutation | [лог](identity-mutation-final.log), [JSON](identity-mutation-final.json): 96.59%, 198 killed / 7 survived / 0 timeout, всего 205 |
| Session queue mutation | [лог](session-mutation.log), [JSON](session-mutation.json): 100% detected, 7 killed / 7 timeout / 0 survived, всего 14 |
| Native scoped metadata | [storage-native-final.log](storage-native-final.log): 18 / 18 browser cases |
| Substrate TS / lint / boundaries | [types](storage-types-final.log), [lint](storage-lint-final.log), [boundaries](storage-boundaries.log): PASS; lint357 |
| Substrate mutation, весь файл | [лог](storage-mutation-final.log), [JSON](storage-mutation-final.json): 77.52%, 158 killed / 11 timeout / 49 survived, всего 218; до последних усилений tests |
| Substrate mutation, lifecycle follow-up | [лог](storage-mutation-handles.log), [JSON](storage-mutation-handles.json): 61 mutant, 38 killed / 6 timeout / 17 survived |
| Substrate mutation, terminal/schema follow-up | [лог](storage-mutation-terminal.log), [JSON](storage-mutation-terminal.json): 83 mutants, 64 killed / 5 timeout / 14 survived |
| Сохранность обычного browser suite | [discovery verification](default-discovery-verification.json): все прежние 335 case names сохранены; 18 native cases имеют отдельный testMatch |
| Сохранность исходного приложения | [финальный audit](final-preservation-audit.json): 547 исходных файлов без потерь, 104 прежних конфигурации и 60 live-dist файлов неизменны; S1 product sources после S2 неизменны |

Timeout в queue scope — удаление admission/body либо инверсия active, при которых
ожидаемая операция не достигает test checkpoint. Это обнаруженное зависание,
а не 14 assertion failures. Identity survivors: недостижимый fallback для
постоянного public-key hex; extractable public verification key (ключ не покидает
функцию); два эквивалентных завершающих catch; проверка decoded length,
дублируемая exact signature encoding; два regex изменения, всё равно
отвергаемые последующими key/base64/length guards. Обходов подписи, freshness,
scope или duplicate detection среди survivors не обнаружено.

Начальные RED/промежуточные логи сохранены. Mutation scopes охватывают оба
production файла целиком, новых зависимостей/runner/threshold нет. Команды из
`apps/web` с закреплённым Node/pnpm:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm exec stryker run stryker.telegram-launch.config.mjs
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm exec stryker run stryker.telegram-session.config.mjs
```

Все 49 исходных storage survivors разобраны в [triage](storage-mutation-triage.md).
Девять значимых пробелов проверок close/late handles, whole-Array records и
preventDefault native write error закрыты дополнительными cases и обнаружены
адресными прогонами. Остаточные изменения диагностики и избыточных guards
сохранены в raw score. Адресные проценты не являются повторным результатом
всех 218 mutants; нового полного score после усиления tests не заявляется.

Browser/PWA build и 17 browser cases относятся к [S1](../S1/README.md).
18 новых native storage cases — отдельный S2 fixture, не Telegram client.
Новые модули не входят в browser entry; новый product build/PWA suite и
physical Telegram tests повторно не заявляются.
Все контрольные суммы текущих исходников и evidence зафиксированы в
[post-check inventory](source-evidence-inventory.json). Это снимок после
проверок, не заявление о pre-run hashes каждого исторического прогона.

## Scoped metadata substrate

`src/adapters/persistence/telegram-scope-store.ts` не открывает storage в
конструкторе. Перед каждой операцией требуются verified session, secure context,
exclusive Web Lock `interiors-tma-storage-v1:<scope>` и повторная проверка
generation после получения lock. Lock удерживается до завершения операции;
queue и lock не захватываются рекурсивно.

Новый DB name — `interiors-editor-projects:<scope>`, отдельный database version1,
пока только `scope-metadata` с identity/protocol marker и canonical decimal
uint64 `lastReserved`. Browser DB name/version3 не меняются. Marker и counter0
создаются вместе только при oldVersion0. Отсутствующие/повреждённые записи
существующего scope не инициализируются повторно. Резервирование attempt/lease
увеличивает общий counter через BigInt в отдельной RW transaction под lock и
возвращает ID только после commit; abort не возвращает ID, более поздняя
неиспользованная reservation остаётся пропуском. Значения выше2^53 точны,
exhaustion закрывает запись без wrap.

После независимого review [RED strict durability](storage-durability-red.log)
обнаружил default mode. Теперь transaction запрашивает `durability: strict` и
проверяет фактический режим до изменения counter; relaxed/unsupported закрывает
операцию. Native test наблюдает режим и проверяет отсутствие ID/изменения при
forced relaxed fallback. Это следует [IndexedDB durability contract](https://w3c.github.io/IndexedDB/#durability-hint);
реальные OS-crash, eviction и WebView physical evidence этим не заменяются.

Close синхронно отзывает session и дожидается допущенной операции; pending lock
не открывает DB. Pending open отменяется до upgrade transaction, поздний
initializer abort-ится, поздний handle закрывается. Versionchange отзывает
generation; rejected open не остаётся cached. Синтетический blocked event в
тесте проверяет обработчик и поздний initializer, а не настоящее upgrade
contention. Межконтекстная сериализация counter и rollback проверены настоящей
IDB. При будущей schema migration counter/marker обязаны сохраниться. При
подключении второй resource DB отдельно необходим отказ при частичной потере
stores: oldVersion0 одной DB не доказывает новый scope, если другие его данные
ещё существуют. До этого и полного receipt/pin protocol Project writes закрыты.

Test-only `tests/browser/telegram-storage-harness.ts` использует явные fake
scope IDs, не импортируется product entry и не является mock Telegram acceptance.
Его Rspack config имеет отдельный безопасный default output в temp directory;
прямой [build без output override](storage-safe-default-build.log) прошёл.
Worker/release/catalog artifacts в fixture не генерируются.

Для Stryker каждый mutant компилируется заново в собственный temp fixture,
получает отдельный loopback port и browser profile. HTML задаёт активный mutant
до загрузки subject, а Playwright проверяет соответствие runner metadata.
Counter atomicity не доказывается Map-fake. Wrapper владеет общим temp root и
очищает его после Stryker, включая fixtures убитых по timeout workers:

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 pnpm exec node scripts/run-telegram-scope-mutation.mjs
```

Pinned TS7 не поддерживает legacy API Stryker для копирования tsconfig;
используется прежний in-place instrumentation, независимые typecheck остаются
обязательными. Три command workers имеют собственные outputs/profiles.
Промежуточный [setup failure](storage-mutation-setup-failure.log) и
[прерванный прогон до review fixes](storage-mutation-before-review.log) сохранены,
не считаются завершённым mutation evidence.

## Следующая безопасная граница

Новый code audit выявил, что существующие recover/staging/journal не являются
полным AD-4/AD-26 cross-context протоколом, а общего scope-wide GC вообще нет.
Architecture сформулировал, SPEC принял обязательный
[S2 fencing disposition](../../../../_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/telegram-s2-fencing-disposition-2026-11-04.md):
scope Web Lock, атомарные fence/stage/receipt predicates, monotonic no-ABA IDs,
conditional no-publish и pin cleanup, conservative retention при неясности.
До доказанной интеграции этого протокола первая writable операция не включается.
Безусловный browser recover к новому Telegram scope не подключается.
GC в S2 не добавляется; Project/history/resource bytes сохраняются.

Применимый readiness разрешил локальную реализацию полного уточнённого S2;
этот metadata-only increment остаётся частичным, Story 10.2 не завершена.
На момент этого исторического metadata increment S3 wire/legacy ещё не были
зарегистрированы; текущая регистрация и source scope описаны выше. Licensing source conflict не решён.
Реальные bot/HTTPS origin и физические iOS/Android account/lifecycle/file tests
остаются pending. Нет upload, публикации, удаления Web/PWA или коммитов.

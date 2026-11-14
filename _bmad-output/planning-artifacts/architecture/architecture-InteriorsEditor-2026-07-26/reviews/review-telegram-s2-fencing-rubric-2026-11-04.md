# Reviewer Gate — Telegram S2 fencing и recovery

Date: 2026-11-04. Независимая проверка AD-4/AD-26 и `telegram-s2-fencing-disposition-2026-11-04.md` против TMA-08/10/11 и S2. Runtime-тесты не выполнялись; canonical документы не менялись.

## Verdict: concerns; две границы требуют решения до writable S2

1. **High — crash/reopen после смены fence.** Пункт 3 требует текущего owner/fence для доказанного `no-publish` и сохраняет запись при потерянном/истёкшем старом fence. Пункт 5 запрещает его повторное использование, а пункт 6 не задаёт, как новый уполномоченный writer безопасно завершает старый attempt. После нормального crash и takeover Project может неограниченно оставаться read-only, хотя S2 требует close/reopen. Необходимо явно описать transaction adoption/reconciliation с текущим fence нового owner, проверкой immutable identity старого attempt, отсутствия published receipt, запретом старой publication и доказательством неизменности newer pointer; либо прямо считать разрешение этого случая незакрытым blocking gate до writable S2. Нельзя просто переактивировать старый token или делать read-then-delete.
2. **High — takeover между двумя физическими stores.** После transaction no-publish в Project DB, но до conditional delete bytes в resource DB, другой context может приобрести новый fence. Предписание «прежний writer теряет право на cleanup» не следует из единственной предыдущей проверки fence; простая повторная проверка тоже имеет меж-store TOCTOU. Нужен согласованный atomic/cross-context handoff: например, доказуемая ограниченная immutable cleanup authorization для уже закрытого attempt, безопасная даже после takeover, с idempotent `deletePinnedIfOwned`/атомарной защитой других пользователей в resource store; либо механизм общей межконтекстной сериализации acquisition/cleanup. Выбранная семантика должна явно согласовывать это с запретом действий stale writer и покрываться interleaving test. До доказательства — conservative retention, без fallback на необусловленный delete.

## Что согласовано

- AD-26 отделяет local generation barrier от cross-context fence и честно указывает, что существующие `recover()` и неполный pin journal не доказывают AD-4. Перед любыми writable S2 операциями требуются атомарные stage/owner/base predicates, receipt и safe cleanup.
- Отсутствие общего scope-wide GC описано как baseline; S2 не вводит выдуманный GC, оставляет bytes и `sessionRetentionRoots()` одного controller не выдаёт за глобальный inventory.
- Scope охватывает проектные и ресурсные данные, journal, history roots и writer/takeover. Старый scope сохраняется, A→B→A подлежит проверке, Project IDs и fence generations не переиспользуются.
- SPEC-owner и владельцам epics/stories/readiness дан handoff; приложение, тесты, хранилище и новые серверы данным planning-review не изменены. Список гонок и физическая проверка остаются запланированными evidence, не результатом.

## Повторная проверка после исправлений

**Verdict: pass для архитектурного решения; фактические S2 и readiness остаются открытыми.** Оба high замечания закрыты на уровне контракта:

1. После явного takeover новый владелец под общим scope lock и собственным fence может идентифицировать полный прежний attempt, проверить durable receipt и безопасно завершить published либо атомарно закрыть доказанный no-publish. Неполные/неоднозначные записи остаются сохранёнными и read-only. Старый token не восстанавливается.
2. Один обязательный Web Lock для всех версий и всех операций этого scope удерживается на протяжении transactions обеих stores, включая takeover и destructive cleanup; atomic protect/pin resource record конкурирует с conditional delete. Это закрывает описанный меж-store interleaving для сотрудничающих contexts одного lock domain. Недоступный lock не включает writable fallback, а crash по-прежнему требует journal/fence recovery.

Список race evidence дополнен takeover между no-publish и cleanup, crash/adoption, collision и A→B→A; эти проверки не выполнялись. Требуются source-owner reconciliation, реализация и её независимое доказательство, включая доступность Web Locks и storage-partition поведение целевых WebView. При неясных legacy journals консервативная read-only блокировка остаётся намеренной; общая GC не заявлена существующей и не добавлена в S2.

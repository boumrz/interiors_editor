# Независимый adversarial review — S2 scoped fencing

Дата: 2026-11-04. Проверены `telegram-s2-fencing-disposition-2026-11-04.md` и AD-26; canonical файлы reviewer не изменял.

## Вердикт: CONCERNS

Transaction-bound writer/base/attempt checks, durable receipt и отказ от безусловного recover существенно сужают cross-context гонки. Runtime barrier корректно не выдаётся за межконтекстную синхронизацию; отсутствие общего GC отражено честно. Обнаружена одна high и две medium неоднозначности.

### High — Re-fetch без атомарного pin/protect не защищает bytes

Пункт 4 допускает: второй consumer «атомарно защищает имеющиеся bytes **либо** повторно получает и проверяет точный hash/size». Возможна последовательность: B читает/проверяет уже записанный A hash, A после своего no-publish удаляет его `deletePinnedIfOwned`, B публикует Project, рассчитывая на исчезнувшие bytes. Условие «если cancellation уже выиграл» не охватывает cancellation после проверки B. Закрепить для **каждого** consumer до публикации атомарный resource-store pin/protect, сериализованный с conditional delete; повторное получение и хеширование лишь способ получить verified bytes и должно завершаться таким pin/protect. Защита сохраняется до durable root handoff/безопасного release. Проверить обе очередности: cancel-before-protect и protect-before-cancel, включая паузу после read/hash и два разных Project в одном scope.

### Medium — ABA повторно использованного leaseId

Attempt ID назван уникальным, но вызываемый `deletePinnedIfOwned(hash, leaseId)` условлен отдельным `leaseId`, которому не задана гарантия непереиспользования. Старый cleanup для `(hash, leaseId)` после повторного использования той же пары способен удалить pin нового attempt. Сделать leaseId не повторяемым в рамках scope навсегда либо составным scope+уникальный attempt+generation и связывать журнал/receipt/exact resource record с этим идентификатором. Race test должен вручную попытаться повторить старый cleanup после нового pin того же hash.

### Medium — Отсутствие receipt должно быть доказуемым

Атомарный `no-publish` можно обосновать отсутствием receipt только если authoritative journal/receipt этого attempt были созданы полно и не могли быть удалены или потеряны раньше конечной resolution. Сейчас журнал разрешено идемпотентно удалять, но нет явного порядка retention или durable terminal marker. Зафиксировать полный и непрерывный жизненный цикл attempt (`open → published | no-publish`) с атомарным terminal state/receipt и retention до завершения всех относящихся cleanup/reconciliation; отсутствие записи, неполная старая запись и ошибка чтения не являются no-publish. Тестировать crash между каждым переходом и повторный reconcile после более новой current Revision.

## Граница

Этот review не объявляет наличие implementation-ready/release verdict, не утверждает физическое поведение WebView и не отменяет требование независимого source reconciliation. Неполные/неопределённые записи остаются conservative roots; готовый общий GC здесь не проектируется.

## Повторная проверка после исправлений

**Итог: PASS WITH IMPLEMENTATION AND EVIDENCE PENDING.** Все три замечания устранены архитектурно: каждый consumer до publish обязан выполнить atomic pin/protect в resource store; attempt/lease ID не переиспользуются, а atomic transaction проверяет коллизии и Revision использует no-overwrite; terminal journal/receipt сохраняются до resolution конкретной попытки, отсутствие записи или неполный journal не доказывают no-publish. Дополнительный общий scope Web Lock сериализует участвующие contexts и обе stores; adoption после takeover требует действующего нового fence и точной идентичности старой полной записи. Обозначенные проверки включают cancel/protect, ABA, crash и takeover.

При реализации lifetime non-reuse IDs нужно действительно обеспечить durable allocator/tombstones либо эквивалентной проверяемой гарантией: генерация случайного ID и проверка только живых строк не доказывают абсолютное отсутствие повторного использования после удаления. Это уточнение способа выполнения принятого правила, не утверждение существующей реализации. Web Locks на целевых WebView, безопасная cross-context обработка и полный детерминированный corpus остаются обязательными evidence до writable S2; документ сам по себе их не выполняет.

### Дополнительная проверка lifetime ID

Scope-local durable монотонный uint64 counter теперь резервирует attempt/lease IDs под Web Lock до выдачи; сохранение counter и запрет wrap закрывают ранее отмеченный пробел lifetime non-reuse. Реализация должна представлять uint64 точно без JS `Number` precision loss и fail closed при отсутствии/повреждении counter существующего scope, без его сброса. Evidence и implementation по-прежнему pending.

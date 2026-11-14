# Key176 — восстановление и усиление публичных проверок

Изолированная работа от 6 ноября 2026 года. Production-модуль не изменён;
plain SHA-256 `e16a5383d160d88ba7717307148151e1d2d04c3c0ecc724599ed8db7da8d3128`.
Полный прогон завершён и независимо принят Root: **142 Killed /34 Survived
=80,681818%, threshold80 пройден**. Допуск относится только к текущему Key176;
см. [Root ACK](whole39-final/root-whole-ACK.json).

## Восстановленная основа

- Все прежние `/tmp` и host-temp рабочие каталоги отсутствовали; старые session/PID
  не использовались. Старый Key176 127 Killed /49 Survived =72,159% остаётся
  завершённым непройденным gate, а не результатом нового прогона.
- Из сохранённого `../key176-v9-complete-failed-gate/frozen-inputs-and-root-checks.tar.gz`
  восстановлены 964 обычных файла `packet/context/app/`. Архивные пути проверялись;
  symlink, абсолютный путь и `..` не принимались.
- Новый owned root: `/tmp/interiors-resume-key-20261106-7fye9mxs`; приложение
  находится в `apps/web`. Production-файлы основного `apps/web`, его output и
  пользовательские данные не изменялись; исключение generated cache описано ниже.
- Четыре root manifest/config файла, семь catalog fixture файлов и два JSON
  contract fixtures скопированы без изменения байтов. Установки зависимостей,
  новых версий, commit, deployment и пользовательских upload не выполнялись.

## Публичный corpus

Все исходные 32 Node и21 Native проверки сохранены. Дополнительно13 Native
проверок используют настоящие IDB stores: неправильный keyPath, autoIncrement,
лишний index, отсутствующий обязательный store и положительные здоровые controls.
Пять lifecycle проверок наблюдают занятую writer-fence запись, фактический abort
readonly transaction до результата, native handle чужой DB, уже закрытый native
handle и настоящий versionchange без блокирования другого открытия. Итого
фиксированный corpus: **32 Node →39 Native**. Все requests, transactions,
results и events в новых Native проверках настоящие; observer меняет только
явно проверяемый маршрут либо момент доставки/отмены, не эмулирует IDB.

Минимальные store fixtures проверяют только публичный technical key lookup по
AD-31/FR-45. `free` не удостоверяет полный bootstrap/schema/manifest, здоровье
остальных stores или writable capability; соответствующие независимые gates
остаются обязательными.

Первый guard Projects дублируется внутри последующего обхода stores. Это
объясняет выживший sensitivity139 и не даёт оснований исключать mutant из
полного176. Ни один denominator, threshold80 или raw status не корректируется.

## Процесс и ограничения доказательств

- Plain32→21, plain32→34, plain32→39 и plain32→39 после локализации cache прошли.
- Pinned Node24.19.0 /pnpm11.20.0 /Stryker9.6.1 используются без установки.
- Все176 официальных signatures вновь получены pinned Instrumenter и сверены
  с историческим report. Instrumenter coordinates преобразуются из zero-based
  в one-based line/column только для сопоставления с JSON report; сам payload
  не переписывается ради этого преобразования.
- Один owned Native процесс за раз. Замена Source допускается только между
  реальными CLOSE; до восстановления проверяются пустые owned/unknown groups.
  Timeout, compiler/setup, canary, malformed evidence и cleanup ошибки не kills.
- Первоначальный общий `node_modules` link мог менять только generated Rstest
  scheduling cache. Неизвестное прежнее содержимое не восстанавливалось и
  неизменность этого generated cache не заявляется. Теперь package links ведут
  к прежним зависимостям, а `.cache` — настоящая owned локальная директория.
  Один actual32-case scheduling seed фиксируется и reset/hash-check выполняется
  перед каждым вызовом; after SHA сохраняется отдельно.
- App/domain typecheck и lint шести новых TS файлов пройдены после восстановления
  двух отсутствовавших в архивном app JSON contract fixtures. Сначала lint
  обнаружил два callback-return, они исправлены braces без production изменения.
  Изменившийся hash fixture требует новой qualification, старый snapshot не
  переносится на следующий.
- Прежняя14-call qualification39 дала instrumented-OFF PASS,12 настоящих named
  kills и корректный source-poison refusal. Она сохранена отдельно. После
  последних lint/closure правок новая exact-profile qualification14/14 также
  завершилась успешно. Никакие старые scores на новый snapshot не перенесены.

Полный отдельный177-call прогон (OFF+все176) завершён с нулём invalid/timeout
классификаций. Все1000 inputs восстановлены;177 recorded groups пусты до
восстановления plain Source. Отдельный Root-аудит завершён: независимо
проверены177 calls,4271 raw files,33 controls,8496 archive members и10 packet
hashes; свежая physical проверка не нашла owned процессов. В
`whole39-final/` сохранены полный context/raw archive (8496 файлов), их hashes,
mutation report, summary, read-only аудитор и33 tamper controls. В собственном
replay аудитор заново проверил все177 calls и1000 inputs, реальный raw↔formatted
error binding, actual BODY attachments, namespace/source/local IDs, immutable
emissions/served hashes и raw score. Это инструмент для независимой проверки,
а не подмена независимого reviewer исполнителем среза.

Ограничение нового direct-controller формата: записаны actual spawnPID/PGID,
leader EXIT, observed CLOSE/end timestamp и physical drain. Отдельного старого
stock-manager ordered-events массива и command/cwd scalar здесь нет. Их
наличие не выдумывается; context связывают fixed controller bytes и фактические
scoped case/module/served artifacts. Прежнее ограничение thin Node post rows
также явно сохранено.

## Воспроизводимые материалы

`sources-current/` содержит актуальные дополнительные app файлы, root fixtures
и verification инструменты. Они применяются к указанному выше восстановленному
архиву, а не заменяют полный app. `current-source-files-sha256.json` фиксирует
их байты; `sources-current/verification/profile.json` —1000 frozen inputs.
Каталог `files/` и `new-files-sha256.json` сохраняют ранний34-case snapshot и
не являются текущей qualification. Актуальные результаты — в
`qualification39-final/` и `whole39-final/`.

Локальные команды выполняются из owned `apps/web`, через точные уже имеющиеся
Node иpnpm. Внешний manager:

```text
node ../../verification/key176-campaign.mjs prepare
node ../../verification/key176-campaign.mjs qualify
node ../../verification/key176-campaign.mjs whole
```

Последняя команда требует exact fresh qualification acknowledgement; она
не выдаёт независимый READY сама. Итоговая приёмка принадлежит независимому
review. Полный выпуск Telegram, physical iOS/Android и retirement Web/PWA этим
локальным scope не доказываются.

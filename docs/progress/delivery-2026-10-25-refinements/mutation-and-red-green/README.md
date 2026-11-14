# Узкие mutation и RED/GREEN — 25 октября 2026

Этот каталог сохраняет выбранные доказательства реализации фильтров размеров, начального угла предмета, контактов манипулятора, завершения создания и размерной графики. Это архив отдельных запусков, а не результат нового запуска тестов и не утверждение об окончательной сборке. Общие финальные unit/browser/PWA/build и публичную проверку ведёт основной delivery manifest за пределами этого каталога.

Скопированы исходные небольшие логи и семь mutation JSON. Временные workspace, `node_modules`, bundles, профили браузера, screenshots/traces и большие старые диагностические JSON не копировались. Данные файлов сохранены без изменения. [artifact-manifest.json](artifact-manifest.json) содержит исходный путь, размер и SHA-256 каждой копии; [scope-summary.json](scope-summary.json) выводит scope, статусы мутаций и SHA исходного текста непосредственно из JSON.

## Как читать результаты

`Killed` и `Timeout` — разные статусы. В приведённых узких запусках timeout, no-coverage и ошибок инструмента нет. Процент ниже относится только к перечисленным файлам или диапазонам строк того снимка. Номер строки в архивном config нельзя автоматически применять к более позднему файлу: сначала нужно сверить SHA и функцию.

Исходный текст каждого мутируемого файла встроен в `files[...].source` соответствующего JSON. Его SHA вычислен в `scope-summary.json`. Это идентичность исследованного снимка, без заявления о совпадении с окончательным release. Для первоначальных preferences дополнительно сохранены авторский [snapshot manifest](preferences/snapshot-manifest.json), [summary](preferences/summary.json) и SHA теста. Исторические абсолютные `/tmp`-пути в исходных логах — сведения о месте запуска, а не существующие переносимые зависимости архива.

## Stryker: точные области и результаты

Stryker 9.6.1, Node 24.19.0. Указанные запуски выполнялись в отдельных копиях исходников с `inPlace: true` внутри временной копии, `coverageAnalysis: off` и одним worker. Исходные конфигурации и команды тестов сохранены в поле `config` JSON. Данные статусов в таблице пересчитаны из самих отчётов.

| Область | Архивный scope | Killed / Survived | Score / порог | Результат |
| --- | --- | --- | --- | --- |
| Первоначальные предпочтения | Полный `drawing-dimension-visibility.ts` | 69 / 4 | 94,52% / 70 | Порог достигнут. |
| Проверенные preference + initial pose | Visibility целиком; `parametric-item.ts:277`, `:674`; `custom-glb-asset.ts:54–91` | 90 / 4 | 95,74% / 70 | Порог достигнут. Доменный поднабор отдельно 21/21 killed. |
| Отбор кандидатов размеров | Полный `drawing-dimension-selection.ts` | 192 / 23 | 89,30% / 80 | Порог достигнут. |
| Зазор внутренних надписей | `drawing-dimension-layout.ts:242–247`, `:391–403` | 21 / 3 | 87,50% / 80 | Порог достигнут. |
| Полигоны стен как препятствия | `drawing-dimension-layout.ts:140`, `:417–419`, `:437–439` | 6 / 0 | 100% / 80 | Порог достигнут для шести сгенерированных мутаций узких guards. |
| Распределение приоритета между комнатами | `drawing-dimension-layout.ts:101–118` | 22 / 2 | 91,67% / 80 | Порог достигнут. |
| Выноска и SVG renderer вместе | Полный `DrawingDimensions.tsx` и `drawing-dimension-layout.ts:433–461` | 57 / 15 | **79,17% / 80** | **Порог не достигнут**, инструмент завершился с ошибкой порога. |

Источники таблицы:

- Preferences: [JSON](preferences/mutation-report.json), [лог](preferences/mutation.log), [config](preferences/stryker.config.mjs).
- Повтор preference + pose: [JSON](pose/preferences-pose.json), [verified log](pose/verified-pose-mutation.log), [точный scope](pose/final-pose-mutation-scope.json), [config](pose/stryker.preferences-pose.config.mjs).
- Selection: [JSON](dimensions/dimension-selection-mutation-report.json), [финальный лог](dimensions/dimension-selection-stryker-final.log).
- Clearance: [JSON](dimensions/dimension-clearance-mutation-report.json), [финальный лог](dimensions/dimension-clearance-stryker-final.log).
- Content obstacles: [JSON](dimensions/dimension-content-obstacles-mutation-report.json), [лог](dimensions/dimension-content-obstacles-stryker.log).
- Fair priority: [JSON](dimensions/dimension-fair-priority-mutation-report.json), [лог](dimensions/dimension-fair-priority-stryker.log).
- Leader + renderer: [JSON](dimensions/dimension-leader-renderer-mutation-report.json), [финальный лог](dimensions/dimension-leader-renderer-stryker-final.log).

### Что означает результат leader + renderer

В совместном отчёте SVG-компонент `DrawingDimensions.tsx` имеет **34 killed / 0 survived, 100%**, а диапазон геометрии `leaderToLabel` — **23 killed / 15 survived, 60,53%**. Эти числа дают общий результат 57/72, 79,17%. Сильный поднабор SVG не превращает общий запуск в успешный. Выжившие варианты геометрии не объявляются здесь эквивалентными; они остаются видимым ограничением этого запуска.

Этот SVG renderer не следует путать с двумя WebGL helpers устойчивого 3D-кадра. Для последних отдельно сохранено [3D verification](../../evidence/2026-10-25/3d-refinements/verification.md): 8/8 Stryker mutants, 17 ручных удалений GL-state calls и 4 UI-варианта. Архивы не объединяются в общий процент всего renderer или приложения.

### Разбор выживших вариантов

Для четырёх preferences survivors сохранён [поимённый triage](preferences/survivor-triage.json): автор ограничивает доказательство эквивалентности частным guard `isRecord`, вызываемым из ограниченного JSON parser с независимыми проверками конверта и всех пяти полей. Их исходный статус остаётся `Survived`, число killed не увеличено.

23 selection, 3 clearance, 2 fair-priority и 15 leader survivors сохранены в исходных JSON с locations и replacements. Этот README не заменяет отдельный доказательный разбор каждого и не классифицирует их все как эквивалентные. Достижение численного порога также не означает исчерпывающего покрытия поведения.

## RED → GREEN: предпочтения и угол

- [Preferences RED](preferences/red.log) — тесты до появления helper; [GREEN](preferences/green.log) — 17/17. Проверяются пять независимых групп, все 32 комбинации, сохранение all-off, границы 2047/2048/2049 символов, строгий v1, свежие defaults и исключения чтения/записи. Подробности — [исходный README](preferences/README.md).
- Initial-pose validation: [RED](pose/pose-validation-red.log) содержит один отказ при 46 прошедших тестах; [GREEN](pose/pose-final-green.log) — 62/62. Это разные составы focused-набора, а не утверждение о двух одинаковых полных запусках.
- Поворот при размещении: [RED](pose/placement-pose-red.log), [GREEN](pose/placement-pose-green.log), [native 2D GREEN](pose/placement2d-native-green3.log). Подтверждают черновой угол и реальные элементы управления; общие итоги находятся вне этого каталога.

## Контакты манипулятора: ручные обратные изменения

Это отдельные ручные мутации, **не Stryker-процент**:

- [RED двух порядков отпускания](contacts/contact-red.log) — два падения на изменении центра предпросмотра.
- [RED обычного жеста двумя пальцами](contacts/contact-pinch-red.log) — план ошибочно оставался неподвижен.
- [Финальный focused GREEN](contacts/contact-final-green.log) — 3/3, 9,6 с, отдельный снимок Chromium mobile/touch.
- Три намеренных изменения времени жизни контакта убиты проверками: [нет регистрации](contacts/contact-inverse-no-contact-registration.log), [раннее освобождение](contacts/contact-inverse-premature-contact-release.log), [нет возврата угла](contacts/contact-inverse-no-angle-cancellation.log). [Baseline](contacts/contact-isolated-baseline.log) и [восстановленный baseline](contacts/contact-isolated-restored.log) — по 2/2.

[Исторические SHA и статусы](contacts/contact-inverses-summary.json), [финальная сводка конкретного контактного slice](contacts/contact-final-summary.json) и [исходное пояснение](contacts/CONTACT-README.md) сохраняют различие между снимком трёх inverse-тестов и последующей проверкой primary-pointer guard. К окончательной сборке они автоматически не приравниваются. Проверки выполнялись с реальными CDP touch-событиями в эмуляции, не на физическом телефоне.

## Завершение создания и точный ожидающий кандидат

Сохранены [wall RED](creation/creation-wall-red.log) и [retry RED](creation/creation-retry-red.log), где успешное создание или повтор ещё не возвращали «Руку». В wall RED доказательством служит **только CREATION-01**: после настоящего подтверждения ожидалось `select`, оставалось `wall`. Второй тест того файла ещё ожидал интерактивный `wall-draft` после передачи кандидата controller; это ожидание противоречило согласованному владению черновиком и не считается доказательством дефекта. Последующий отдельный retry RED уже проверяет точный контроллерный кандидат и возврат к «Руке». Первоначальный ошибочный тест без подтверждения стены сюда не включён.

Независимые наблюдения сохранены как [pending creation](contacts/pending-creation.json) и [cancellable failed item](contacts/failed-item-draft.json). Проверки владельца исправлений: [RED](creation/pending-creation-fix-red.log), отдельный [early-pin RED](creation/pending-creation-early-pin-red.log), [GREEN 8/8](creation/pending-creation-fix-green.log), [focused unit](creation/pending-creation-fix-unit.log). Они различают сохранённую старую ревизию, кандидата, уже принадлежащего controller, и раннюю ошибку подготовки ресурса до передачи кандидата.

[Три ручных inverse-варианта](creation/manual-ui-mutations.json) — не поглотить принятый floor-кандидат, ошибочно принять early-pin failure за владение кандидатом, не вернуть «Руку» после retry — завершились соответствующими падениями тестов. Сводка содержит SHA своего исторического source snapshot; это не полный мутационный отчёт AppShell.

## RED → GREEN: размерная графика

| Проверка | RED | GREEN | Что зафиксировано |
| --- | --- | --- | --- |
| Selection | [лог](dimensions/dimension-selection-red.log) | [лог](dimensions/dimension-selection-green.log) | Отдельная политика измерительных фактов. Дополнительные [coverage guards](dimensions/dimension-selection-coverage-guards-green.log) и [lane guards](dimensions/dimension-selection-lane-guards-green.log) сохранены отдельно. |
| Фактический шрифт и внутренний зазор | [font RED](dimensions/dimension-clear-font-clearance-red.log), [short RED](dimensions/dimension-clear-short-font-clearance-red.log) | [final font GREEN](dimensions/dimension-clear-font-clearance-final-green.log), [compact GREEN](dimensions/dimension-clearance-compact-green.log) | Читаемая надпись не заходит в свою границу помещения. |
| Тело стены как препятствие | [RED](dimensions/dimension-physical-content-obstacles-red.log) | [GREEN](dimensions/dimension-physical-content-obstacles-green.log) | RED: 31 passed / 1 failed. GREEN расширенного focused-набора: 71 passed / 0 failed. |
| Порядок внутренних размеров разных комнат | [RED](dimensions/dimension-room-fair-priority-red.log) | [GREEN](dimensions/dimension-room-fair-priority-green.log) | RED: 32 passed / 1 failed. GREEN расширенного focused-набора: 72 passed / 0 failed. |
| Связь короткой/сдвинутой надписи с линией | — | [short geometry](dimensions/dimension-short-leader-geometry-green.log), [renderer](dimensions/dimension-renderer-leader-green.log), [final geometry](dimensions/dimension-leader-geometry-final-green.log) | Сохранены реальные GREEN логи; отдельный RED для этих конкретных шагов в архиве не заявлен. |

71/72 focused unit не означают итоговые общие unit приложения. Они принадлежат последовательным снимкам тестов, число которых увеличивалось.

## Старый широкий прогон — диагностический, gate не пройден

В [небольшом исходном логе](diagnostic/dimension-policy-stryker-strengthened.log) старого широкого запуска:

- `drawing-dimension-layout.ts`: **597 killed, 2 timeout, 270 survived, 68,93%**;
- весь тогдашний набор layout + selection + SVG: **779 killed, 2 timeout, 337 survived, 69,86%**;
- break threshold **80**, фактический выход — ошибка порога.

68,93% — значение строки layout, а не оценка всех новых модулей или окончательной сборки. Последующие узкие запуски показывают свои scopes и снимки; они не пересчитывают этот широкий результат и не превращают его в прошедший полный gate. Большой старый JSON намеренно не включён. Его survivors не объявлены доказанно эквивалентными.

## Воспроизведение и дальнейшая работа

Для повторения конкретного исторического запуска сначала восстановить соответствующий исходный и тестовый снимок, сверить SHA, затем применить сохранённый `config` с Node 24.19.0 и Stryker 9.6.1. Диапазоны мутаций в старых configs относятся к старым строкам. Мутации следует выполнять в отдельной копии; не запускать `inPlace` на общей рабочей папке и не устанавливать зависимости через общий symlink `node_modules`.

В архиве нет утверждения о едином полном mutation gate финального приложения. Воспроизводимость отдельных scopes, их оставшиеся варианты и исходные отрицательные результаты сохранены явно. Физическая проверка телефона, общий browser-регресс, PWA и идентичность опубликованной сборки относятся к основному delivery отчёту.

---
title: Исправления сенсорного редактора и размерный 2D-план
created: 2026-10-25
status: implemented-and-verified
owner: root
baseline: /tmp/interiors-phone-fixes-2026-10-25/baseline.tar
authorization: Восемь прямых требований владельца от 25 октября; реализовать и проверить без дополнительных вопросов.
---

# Цель и источник решений

Восстановить прямое управление планом на телефоне, удалить ненужные инструменты и заменить отдельное измерение постоянными чертежными размерами. Эта спецификация написана до изменения кода и является договором текущего исправления. Новый запрос владельца имеет приоритет над прежними UI-требованиями про интерактивное «Измерить», ввод opening offset/sill, редактирование толщины и создание макетной настенной панели. Канонические CAP/FR/NFR/AD не перенумеровываются; SPEC.md не перегенерируется вручную.

Трассировка: CAP-2/3/4/5/6/8/10; FR про стены, Opening, предметы и размеры; NFR-1–4/10–20/24/26; AD-1/2/3/4/6/7/10/12/13/16/22/23. Действующий READY уже подтвержден. Предыдущие данные, геометрические проверки, writer fencing и атомарность публикации сохраняются. Коммит и push не разрешены.

# Срезы и критерии приемки

## S1. Дверь и окно перемещаются вдоль своей стены

Актор: пользователь телефона. Триггер: зажать видимый маркер проёма в режиме выбора и потянуть. Путь: PlanProjection → ephemeral drag → existing moveOpening controller → domain validation → atomic publish → 2D/3D/reopen/history.

- Маркер Door/Window видим и имеет область касания не меньше 48×48 CSS px при любом масштабе; размеры плана не перехватывают касания.
- Начальный захват сохраняет смещение пальца относительно центра: касание и отпускание без движения не сдвигают Opening и не создают Revision.
- Кандидат вычисляется проекцией на исходный wall axis, включая четыре направления диагонали 45°. Сохраняются openingId, wallSegmentId, width, height, sill и legacy orientation.
- Горизонтальные/вертикальные координаты не перемещают проём с его стены. Candidate хранит целые mm. Preview показывает положение до окончания жеста.
- На отпускании один валидный move создает ровно одну Durable Revision. Недопустимые границы, overlap и host collisions не публикуются; показывается понятное объяснение, исходная позиция остается.
- Второй палец, pointercancel, Escape, смена проекта/ревизии, read-only или потеря writer отменяют draft. После pinch пальцы не могут случайно опубликовать его. Ошибка сохранения пользуется существующим retry/recovery.
- В редакторе проёма отсутствует числовой offset. Сохраняется редактирование ширины/высоты; нижняя отметка старых проёмов не обнуляется при resize.

RED: реальные touch-drag Door и Window + no-op/pinch/cancel; bounds/overlap rejection; diagonal; save/reopen/Undo/Redo; отсутствие offset в доступном UI.

## S2. Новый проём автоматически занимает доступный интервал

- Новый проём запрашивает тип, ширину и высоту. «Отступ от начала» и «Порог / нижняя отметка» отсутствуют. Для Window остается осмысленная высота подоконника; Door всегда создается с sill=0.
- Auto-placement выбирает детерминированный допустимый свободный интервал, предпочитая центральное положение/ближайшее к нему. Учитываются ширина проёма, занятые интервалы, host usable length, floor/wall asset collision и высота. Не используется перебор каждого mm длинной стены.
- Изменение ширины/типа повторно ищет свободное место. Если его нет, кнопка добавления недоступна и объясняет отсутствие места; нет ID allocation, частичной записи или ухода за границы.
- Preview соответствует тому же input, который повторно валидируется на confirm. Смена wall/revision или writer не публикует устаревший intent.

RED: occupied preferred point, несколько проёмов, короткая/диагональная/обратная стена, exact endpoints, ширина 800/799, readonly и отсутствие свободного интервала.

## S3. Кружок разделения стены перетаскивается

- Выбор «Разделить» и касание стены создают draft с видимым кружком и зоной касания ≥48 px.
- Drag кружка меняет только preview точки и двух будущих частей, а не текущий PlanGraph. На отпускании candidate остается доступен для явного «Разделить».
- Подтверждение сохраняет один валидный Split. У концов не допускаются нулевые части; collision с Opening/Asset использует существующий атомарный conflict preview, без silent deletion.
- Pinch/cancel/revision/fence отменяют draft. Кружок не начинает pan/selection/wall creation. Действия доступны и при увеличенном тексте.

RED: repeated down on existing circle, moved candidate, horizontal/vertical/45°, endpoint rejection, no Revision before confirm, cancel/no-op/conflict, Undo/Redo/reopen.

## S4. Предмет вращается через заметную полусферу

- При выборе напольного предмета в 3D доступна видимая дуга/полусфера фиксированного экранного размера: не менее 144 px по ширине, hit band ≥48 px. Размер не зависит от маленького footprint или дистанции камеры.
- Центр предмета остается доступным для перемещения; полусфера не перекрывает обязательные действия шапки/dock и не требует приближения.
- Захват в произвольном секторе не меняет yaw. Движение добавляет относительный yaw к исходному; canonical yawStep остается 0..7, без pitch/roll и изменения host/footprint dimensions.
- Pointer capture сохраняет drag вне полосы. Второй указатель, pointercancel, Escape, deselect, revision/writer change отменяют preview и не публикуют rotation. На release один valid gesture = одна atomic Revision; zero-step = no-op.
- Сохраняются простые доступные кнопки поворота на ±45°; 2D/3D и Undo/Redo показывают одинаковую ориентацию.

RED: far/near camera target size, sector-no-jump, clockwise/counterclockwise and wrap, moved-outside-target, second touch, locked/read-only, cancellation, durable/reopen/history.

## S5. Удаление лишних инструментов

- В UI нет редактирования толщины, tool «Измерить», MeasurementPanel, запуска/preview макетной настенной панели и связанных элементов меню.
- Для новых стен применяется единая существующая геометрическая константа 100 mm. Данные толщины старых стен не переписываются; inward-offset usable geometry остается правильной.
- Existing legacy wall assets и их exact bytes не исчезают из проектов и backup. Каталожное настенное бра/оборудование остается поддержанным wall placement, не превращается в напольный объект. Удаляется именно generic mock wall-panel creation, а не совместимость wall-anchored assets.
- У старого wall item сохраняются выбор/удаление и безопасное отображение; новые панели создавать нельзя. Нет числового UI для позиции Opening; app error copy не предлагает исправлять скрытые поля.
- Площадь/периметр и пассивная геометрическая информация не удаляются вместе с интерактивным Measurement tool.

RED: отсутствие инструментов в Plan/3D/menu/inspectors; новые стены 100 mm; legacy thick-wall + wall-asset backup exact roundtrip и сохранение экземпляров.

## S6. Постоянные чертежные размеры для российского пользователя

Профиль представления DrawingDimensions-RU V1: ориентироваться на действующие на 25.10.2026 СПДС/ЕСКД; первичный нормативный research и точные источники дополняются перед реализацией этого среза. Не обещать сертифицированную рабочую документацию или нормативный печатный масштаб экрана.

- Постоянные размерные/выносные линии, читаемые числа без суффикса единиц и общая легенда «Размеры в миллиметрах». Existing MeasurementFormatPolicy с «мм» сохраняется в полях, aria и справочной информации; только чертежные числа используют отдельный formatter.
- Отображаются длины стен, ширины проёмов и цепочка простенков по host; общие габариты плана; размеры помещения в чистоте по derived usable polygons, когда такую привязку можно определить однозначно.
- Размер по оси WallSegment не выдается за размер в чистоте. У каждой annotation есть явный reference kind; неподдержанный clear-span не угадывается. Для угловых/вогнутых помещений показываются реальные грани, а не выдуманный прямоугольник.
- Габариты и room clear spans берутся из фактических rendered outer/inner boundaries; chain на оси допускается только с явным обозначением «по осям». Если perimeter references неоднозначны, используется явно названная осевая цепь.
- Обновление dimensions происходит из Project/ephemeral preview; добавление подписей не создает Revision и не меняет канонические mm. 2D размеры не сохраняются как второй источник истины.
- Наклонные стены имеют размер вдоль сегмента; подписи читаются без переворота. Засечки, вынос за границы и промежутки построены в экранных px с учетом zoom, без претензии на mm печатного листа.
- Label layout избегает наложения читаемых чисел друг на друга, шапки/dock/drag handles; при недостатке места применяется leader/разнесение и управляемое увеличение, а не выдуманное число или удаление геометрии. Нет интерактивного режима измерения.

RED: прямоугольник, L-plan, adjacent rooms, 45°, reversed endpoints, opening chain sum, no zero piers, legacy thickness clear reference, zoom/pan/text fit и отсутствие domain mutation.

## S7. Ровные панели и действия

- Selected-wall card: короткий заголовок «Стена», согласованная сетка label/value, одна аккуратная иконка, основной action 44–52 px на обычном тексте (рост допускается при accessibility text), без растянутого пустого блока.
- Проверить и привести к той же системе selected item, Opening properties/new Opening, split/conflict preview, catalog placement и rotation controls.
- На 360×480, 393×852, landscape и 200% тексте нет горизонтального overflow, обрезанных подписей, недоступного confirm/cancel и наложения действий. Modal focus/busy/retry и visualViewport keyboard сохраняются.

RED: bounding boxes + full label visibility + screenshots основных состояний; old modal keyboard/busy/recovery regression.

# Последовательность, ownership и verification

До production changes создаются этот документ и визуальный storyboard. Root — единственный writer AppShell.tsx, PlanProjection.tsx и их CSS. По отдельным согласованным модулям делегируются auto-opening helper, чистые drawing-dimensions helpers, RoomScene3d interaction/CSS. Каждый owner сначала получает RED, затем GREEN и isolated scoped mutation. Не использовать pnpm install внутри копий с общим node_modules symlink.

Новые browser tests создают проекты самостоятельно и используют настоящие touch events/CDP, а не один только synthetic mouse. Существующие тесты удаленных UI маршрутов заменяются тестами нового контракта; не маскировать падения skip-ом, timeout-ом или удалением данных. Доменные/backup/history проверки сохраняются.

Финальные проверки: весь Rstest, обе TS конфигурации, Biome, architecture boundaries, clean production build, delivery tests, полный browser regression и production PWA/offline/update suite, live catalog smoke. Scoped mutations для новых pure geometry/placement/gesture policies и наблюдаемые UI negative regressions. Независимый review до финального green run. Phone HTTPS переключается на новую сборку только после проверок; адрес по возможности сохраняется. Коммиты не создавать.

## Tracking

- [ ] S1 drag Opening и guards
- [ ] S2 automatic placement и clean forms
- [ ] S3 draggable split preview
- [ ] S4 visible stable rotation dome
- [ ] S5 removed tools + legacy compatibility
- [ ] S6 RU drawing dimensions и источники
- [ ] S7 UI audit/polish
- [ ] Full regression/mutations/review и новая phone-сборка


# Итоговая проверка 25 октября

Все срезы S1–S7 реализованы. Дополнительные подтверждённые регрессии: отмена захвата после Escape, второй палец вне SVG, пересечение проёма телом перемещаемой стены, потеря выбранной стены при открытии каталога, перекрытие легенды и toast. Они исправлены с отдельными RED/GREEN-сценариями.

Результаты и честные ограничения: [итоговый отчёт](../../docs/progress/PHONE-EDITOR-FIXES-2026-10-25.md), [машинная сводка](../../docs/progress/delivery-2026-10-25/final-checks/summary.json). 1909 unit, 243 браузерных сценария с адресной перепроверкой, 9 production PWA, 39 backend; TypeScript, lint, architecture и delivery пройдены. Диагностический layout mutation smoke не объявляется полным gate. Коммитов нет.

Финальная визуальная поправка S6: общий габарит располагается после осевого ряда на той же стороне; противоположные цепи не сдвигают этот ряд. Отдельные RED/GREEN unit и DRAWING-07; повторная проверка 40/40 затронутых browser cases и 9/9 PWA, Stryker helper 92,74%.

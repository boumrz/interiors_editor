# TMA: интерфейс и замыкание стен, 14.11.2026

Изменения реализованы и проверены локально по прямому запросу владельца.
Область и уточнение правил геометрии закреплены в
[контракте](../../../contracts/tma-ui-and-wall-contact-2026-11-14.md).
Общий Telegram release verdict и физическая приёмка этим отчётом не меняются.
Коммитов нет; пользовательские хранилища не очищались. По последующему
прямому запросу владельца TMA [опубликована 14.11 в 23:42 МСК](publication/README.md).

## Что изменилось

- На здоровом стартовом экране TMA скрыты «Данные для проверки» и
  «Восстановить несохранённую правку». Ошибки, повтор сохранения, recovery export,
  защита несохранённых полей и writer takeover сохранены.
- Общий радиус прямоугольных элементов — 12 px; самостоятельные действия
  разделены промежутками 8 px. Проверенные touch targets — от 44×44 px.
  Круглые образцы цветов и геометрические маркеры сохраняют свою форму.
- «Новый проект» получил синий текст. Меню проекта сохраняет исходную кнопку,
  показывает один плоский список на ширину карточки, закрывается снаружи и
  по Escape с возвратом фокуса. Длинные подписи переносятся при тексте 200%.
- Подтверждения TMA используют «Подтвердить» / «Отменить», включая действия
  на плане и размещение в 3D. Описание последствий и состояние выполнения
  сохранены. Подтверждение удаления стены больше не перекрывает её инспектор.
- Точный контакт с серединой незаконченной стены замыкает комнату и сохраняет
  ненулевой остаток. Остатки 1/99/100 мм сохраняются, открываются, переносятся
  через файл, удаляются и продолжаются. Выбор касанием учитывает перекрытие
  областей соседних стен; исходные миллиметры не меняются.
- Web/PWA сохраняет оформление через прежние fallback значения и прежние
  подписи. Общие исправления меню и геометрии доступны обоим приложениям.

Установлен пользовательский [tasteskill 2.5.1](https://www.tasteskill.dev/)
в `~/.codex/skills/design-taste-frontend`, вместе с его references, library и
scripts. Применены правила единой системы, отступов, контраста, доступности и
проверки в браузере. Маркетинговые hero/фотографии/анимации не добавлялись в
рабочий редактор. Упомянутого upstream инструмента `inspect.mjs --app` в
поставке нет; автоматический аудит этим инструментом не заявляется.

## Проверки

Node 24.19.0 / pnpm 11.20.0; Chromium с эмуляцией телефона. Тестовые проекты
и серверы изолированы от пользовательских данных и обычного preview.

| Проверка | Результат | Доказательство |
| --- | --- | --- |
| Unit / integration | 3583 PASS, 241 файл | [checks.log](checks.log) |
| TypeScript, Biome | PASS; у Biome 34 информационных замечания, ошибок нет | [static.log](static.log) |
| Границы архитектуры | 15 PASS | [checks.log](checks.log) |
| Delivery / SDK / packaging | 59 PASS | [delivery.log](delivery.log) |
| Настоящий signed TMA entry / SDK / темы | 27 PASS | [telegram-entry.log](telegram-entry.log) |
| Scoped runtime UI, хранение, recovery, навигация, Plan / 3D | 60 PASS | [telegram-runtime-ui.log](telegram-runtime-ui.log) |
| Дополнительная проверка точного касания остатка при zoom in/out | PASS | [tiny-wall.log](tiny-wall.log) |
| Дополнительная проверка меню и отсутствия page errors | PASS | [telegram-entry-menu.log](telegram-entry-menu.log) |
| Web: основной редактор, жесты, проёмы, предметы, история | 160 PASS | [web-editor.log](web-editor.log) |
| Web: прочие UI / recovery / layout сценарии | 100 PASS | [web-other.log](web-other.log) |
| Web: проекты, геометрия и phone layout | 74 подтверждены: 73 PASS и один исправленный кейс повторно PASS | [web.log](web.log), [web-enlarged-menu.log](web-enlarged-menu.log) |
| Web production build | PASS | [web-build.log](web-build.log) |
| PWA: worker, offline, обновления, сохранность данных | 10 PASS на свежем production build | [pwa.log](pwa.log) |
| TMA: HTTP-каталог, exact pinning, floor/wall GLB, 3D, reopen | 9 подтверждены: 8 PASS и wall-case повторно PASS после обновления ожидаемой подписи | [catalog.log](catalog.log), [catalog-wall.log](catalog-wall.log) |

Это 440 различных браузерных сценариев, подтверждённых несколькими запусками;
это не один монолитный запуск 440/440. Открытых падений функциональных тестов нет.
В проверке каталога использовался упакованный HTTP fixture с 12 моделями,
а не развёрнутый backend. Два opt-in live-control-plane сценария не запускались.
Физические Telegram iOS/Android/Desktop в этом прогоне не проверялись.
Публикация и её отдельные внешние проверки описаны в
[отчёте развёртывания](publication/README.md).

TDD RED зафиксирован для геометрии, оформления, выбора короткой стены и
кратких подтверждений до соответствующих исправлений. После этого пройдены
GREEN проверки выше. Независимые read-only ревью UI и геометрии не нашли
дополнительных ошибок в рабочей реализации.

## Мутационные проверки

Stryker выполнялся только в отдельных копиях, без инструментирования рабочего
дерева. Raw результаты не подменяются процентом «100% покрытия».

- Основной срез: 212 мутантов, 199 killed, 13 survived, 0 timeout/error/no coverage,
  **93,87%** — [JSON](mutation-unit.json), [лог](mutation-unit.log).
  Pure touch geometry: 138/138; storage bounds: 6/6; authored-wall guard: 6/6;
  host tokens: 4/4; выбранные shared labels: 2/2.
- Проверка явного разделения с новым коротким tail закрыла два содержательных
  survivor исходного среза: отдельный запуск **4/4 killed** —
  [JSON](mutation-explicit-split.json), [лог](mutation-explicit-split.log).
  Оставшиеся guards геометрии защищают отсутствующие endpoints/нулевую source
  длину, отсекаемые входной проверкой, либо математически избыточный bound:
  `previousLength <= targetLength <= targetThickness <= previousThickness`.
- Меню: 21 мутант, 8 killed, 10 timeout, 3 survived, **85,71%** —
  [JSON](mutation-menu.json), [лог](mutation-menu.log).
  Укреплены проверки клика внутри меню и возврата фокуса с action на summary.
  Три survivors относятся к optional guards/fallback; они сохранены.
- Краткая пара размещения в 3D: **4/4 killed** —
  [JSON](mutation-placement-labels.json), [лог](mutation-placement-labels.log).
- Дополнительная интеграционная проверка wiring выбора стены: 15 мутантов,
  9 killed, 6 survived, **60%** — [JSON](mutation-selection.json),
  [лог](mutation-selection.log). Она подтверждает вызов resolver и преобразование
  координат; не доказывает все альтернативы admission ширины и DOM-overlay gate.
  Эти формулы и приоритеты дополнительно проверены независимым code review;
  вычисление pure touch geometry отдельно имеет 138/138 killed.

## Снимки экранов

- Проекты: [светлая тема, 320 px](projects-light-320.png),
  [тёмная тема, 320 px](projects-dark-320.png).
- [Меню проекта, 360 px](project-menu-360.png),
  [подтверждение, 390 px](confirmation-390.png).
- Редактор: [390 px](editor-390.png), [768 px](editor-768.png),
  [820 px](editor-820.png), [320 px с текстом 200%](editor-320-enlarged-text.png).
- [Панель размеров](dimensions-390.png).

Raw логи, PNG и JSON остаются локальными evidence согласно `.gitignore`;
Markdown отчёт сохраняется в Git. [Хеши исходников](source-hashes.json) фиксируют
проверенное рабочее дерево без создания коммита.

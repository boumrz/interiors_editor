# Sprint Change Proposal — интерактивная расстановка, расширяемый контур и 3D cutaway

**Дата:** 2026-08-06  
**Статус:** approved by the Product Owner's standing implementation authorisation  
**Режим:** batch; пользователь отдельно попросил не останавливать работу на повторных согласованиях.

## 1. Проблема

Текущий телефонный редактор умеет создать параметрический предмет и полный
ортогональный divider, но не даёт практически полезного планирования: предмет
нельзя выбрать и изменить после размещения, новые предметы могут наложиться,
а уже разбитый контур нельзя расширить. WebGL2-проекция показывает технические
коробки, а не читаемый изометрический cutaway пространства. Пользователь
предоставил референс и указал Floorplanner как ориентир по понятности, не как
источник для копирования бренда или ассетов.

## 2. Влияние и границы

- **Затрагиваются:** активная Story 2.2, будущие Story 5.4 и 5.5; `CAP-2`,
  `CAP-5`, `CAP-6`; `FR-21`–`FR-23`, `FR-28`–`FR-32`; `NFR-1`–`NFR-5`,
  `NFR-14`, `NFR-17`–`NFR-20`, `NFR-26`–`NFR-27`; `AD-1`–`AD-3`, `AD-5`,
  `AD-7`, `AD-8`, `AD-10`.
- **Не меняются:** канонический `PlanGraph` в integer-mm, derived Room,
  host-addressed floor placement, `Room.heightMm`, local-first publication и
  disposable 3D projection. Изменение не требует нового backend/API или
  сторонних 3D-моделей.
- **Риск:** PRD определяет item-item collision как warning по умолчанию, тогда
  как этот продуктовый срез предотвращает перекрытие для простых параметрических
  floor placeholders. Это строгий временный placement policy только для
  поддерживаемого editor slice, не заявление о строительной норме и не
  окончательная tiered-collision политика.
- **Не включается в этот срез:** произвольные endpoint/45-degree walls,
  openings, complete face reconciliation, licensed 3D catalog, photorealistic
  renderer, backend control plane и physical-device NFR-15 certification.

## 3. Принятый подход

1. Добавить durable resize выбранного Parametric Placeholder и не допускать
   перекрытие его прямоугольного footprint с другим placeholder; касание кромок
   допустимо. Tap выбирает предмет, drag по 100-mm grid перемещает его, а
   свойства в canvas overlay публикуются по blur/Enter без кнопки «Применить».
2. Для доказанного полного ортогонального grid-subset добавить расширение
   внешнего контура на grid-aligned полосу слева/справа/сверху/снизу. Оно
   сохраняет неизменённые комнаты и их ID, создаёт новые derived cells и не
   создаёт параллельной geometry model.
3. Перевести WebGL2-сцену в ясный isometric cutaway: светлый floor/walls,
   открытая наблюдателю часть внешнего контура и различимые параметрические
   объекты. Это spatial low-fidelity projection, а не обещание фотореализма
   референса без лицензированных ассетов.
4. Каждый пункт вести RED → GREEN → targeted mutation → Playwright mobile
   regression. Скриншоты сохранять как browser-emulation evidence.

## 4. Изменения stories

| Story | Было | Стало |
|---|---|---|
| 2.2 | full-span divider только внутри starter/grid | Поддерживаемый grid может расширяться внешней полосой; scope всё ещё не равен общему wall-topology editor. |
| 5.4 | Будущая story transform selected item | Первое durable select/move/resize поставляется сейчас для Parametric Placeholder; rotate/duplicate/lock/delete/undo остаются в story. |
| 5.5 | Collision feedback запланирован | Простой placeholder получает prevent-overlap policy и видимую причину; tiered warnings/clearance остаются будущей работой. |
| 4.1 / 4.2 | Техническая disposable WebGL projection | Тот же adapter получает cutaway composition; DOM/domain не получают renderer state. |

## 5. Handoff и критерии приёмки

**Классификация:** moderate direct adjustment; `/root` остаётся единственным
owner этого вертикального slice, без параллельных изменений тех же модулей.

Срез считается доставленным только когда:

- domain/application tests покрывают resize, overlap, edge-touch и grid expansion;
- rejected transform/expansion не публикует новую Durable Revision;
- mobile Playwright проходит select → resize → drag и placement without overlap,
  plus expansion of an already partitioned plan;
- browser-emulation screenshots показывают новый 2D и 3D cutaway;
- lint, typecheck, Rstest, build, Playwright и targeted mutation выполнены и
  фактические результаты записаны без claim о physical-device alpha release.

Пользователь уже дал письменное разрешение продолжать реализацию без новых
approval prompts. Этот документ не закрывает `G-S2`, `G-S4`, `G-S1` или
release gate `NFR-15`.

---
title: "Независимый exact-geometry review — D-022 R6"
date: 2026-08-05
review_kind: external-independent-precanonical
reviewed_artifact: d-022-geometry-policy-decision-draft-r6-2026-08-05.md
reviewed_artifact_sha256: 276a7c7224c5b33a2554fbc7b34811a85178e6d9b7a6ae6e65230e61fc3bb6fa
verdict: REJECT_FOR_PRECANONICAL_INPUT
---

# Независимый review exact geometry для D-022 R6

## Вердикт

`REJECT_FOR_PRECANONICAL_INPUT`. Проверенный файл действительно имеет заданный
SHA-256, а восемь SHA-256 в его таблице byte-векторов (§3.4) пересчитываются
правильно. Но R6 пока нельзя передавать source owners как закрытую policy:
несколько правил либо дают неверный результат на допустимой геометрии, либо не
образуют исполнимую/самодостаточно детерминированную спецификацию. Кроме того,
мiter-only reject и changed-face Room retention прямо расходятся с текущим
Geometry Contract. Сам R6 подтверждает, что fixture matrix — будущая работа, а
не уже полученное доказательство.

## Проверенный контекст

- SHA-256 R6 независимо проверен до чтения: `276a7c7224c5b33a2554fbc7b34811a85178e6d9b7a6ae6e65230e61fc3bb6fa`.
- Сверены текущие `SPEC.md` и все его companions, PRD, Architecture Spine и
  `project-context.md`; главным нормативным сравнением был
  `geometry-contract.md`.
- Восемь показанных в R6 CB3 byte-векторов дают заявленные SHA-256. Это
  проверяет только хеши показанных bytes, а не достаточность wire grammar.

## Findings

- В C2 отсутствует eligibility по уже определённому hit square. §4.3 вводит
  `insideHitSquare` и C1 применяет его к Vertex (R6 строки 599–607, 615–623),
  но §4.4 принимает любой положительный finite ray contact как C2 candidate
  или blocker (659–684); hit square используется только для collinear blocker
  (665). Например, при origin `(0,0)`, масштабе 1 CSS px/mm, pointer `(100,0)`
  и вертикальной стене `x=1000`, C1 пуст, но C2 выбирает `(1000,0)` и подавляет
  C4, хотя контакт на 900 px вне 22-px tolerance. Дальний non-integer contact
  также отклонит gesture, который заканчивается до него. Это нарушает смысл
  «eligible exact intersection/end» из текущего Geometry Contract §4 и делает
  выбор зависимым от не относящейся к жесту части бесконечного луча.

- Маршрут диагностик selection противоречив. R6 §2.1 отправляет non-finite и
  non-invertible presentation input в source-owned invalid-dimension/gesture
  route (204–208); таблица §1 относит invalid presentation/scale/conversion к
  `D022_R6_SELECTION_SNAPSHOT_INVALID` (123–129); §4.3 снова говорит, что
  source-owned input-dimension failure возвращает этот R6 diagnostic (580–584).
  Для одного и того же raw value нет единственного reason/state и, следовательно,
  нет проверяемого first-failure outcome.

- Immutable topology reservation невозможно заполнить по указанному phase
  order. R6 требует точный набор ID для каждого будущего Vertex/Wall до exact
  contact normalization (506–522), запрещая и лишний reservation ID, и output
  ID вне reservation. Однако §4.2 помещает `NormalizedTopologyEffectV4` только
  после уже неизменяемой Command/reservation (526–535). Для AddWallSegment,
  пересекающего неизвестное число existing WallSegment, только normalization
  определяет число Vertex и частей. Не описан fenced discovery/reservation phase,
  поэтому произвольный допустимый T/X cannot construct the required Command.
  Текущий Geometry Contract требует обратный порядок: detached candidate →
  exact-contact normalization → complete ChangeSet (§5–6).

- После partition нет правила identity для фрагментов существующей стены и нет
  явно созданного lineage-root для новой candidate wall. R6 одновременно
  требует, чтобы existing topology entities сохраняли base IDs (511), а каждый
  output wall был либо retained, либо reserved (516–522), но не говорит, какой
  из двух/нескольких child fragment split-wall сохраняет old ID. Дополнительно
  каждая FaceAtom/RootInterval требует `baseRootWallId` (379–381, 421), а
  §5.7 требует, чтобы root каждого old/new occurrence разрешался к тому же
  base root (1037–1066). Для wholly new AddWallSegment нет `CreatedRoot` variant
  или нормы, которая делает reserved proposed wall root. Поэтому exact X и
  добавление новой границы не имеют единственного identity/lineage encoding.

- CB3 wire grammar не является self-delimiting в нормативном тексте. Для
  `UInt` и `SInt` указаны только минимальная magnitude и sign (247–266), но не
  сказано, что перед magnitude обязателен LEB128 length и где он расположен.
  `CB3-UINT-2` косвенно предполагает такой length, однако vector не заменяет
  grammar: последовательность `03 01 02` иначе допускает чтение magnitude
  `0x0102` либо value длины 1 со значением 2. Точно такая же неопределённость
  есть у signed scalar. Закрытая byte policy должна дать полный field-by-field
  grammar для scalar, array, record и union, а не выводить его из examples.

- `TypedContentRefV2` оставляет открытый semantic escape hatch. `schemaId`
  может обозначать «one named source canonical record grammar» (286–305,
  372, 434), но R6 не задаёт closed registry schema IDs, версий и canonical
  serializers этих grammars. Проверка digest доказывает равенство bytes, но не
  их тип, допустимые поля или deterministic decode. Это противоречит заявлению,
  что untyped Bytes escape hatch невозможен, и не позволяет independently
  validate source-reference/replay roots.

- Dart/ring gate отклоняет допустимый articulation exterior. Для двух простых
  замкнутых комнат, соприкасающихся одним Vertex без bridge, bounded positive
  orbits просты, а единственный exterior orbit повторяет articulation vertex.
  R6 считает non-simple negative orbit Exterior только при наличии bridge pair;
  иначе он отвергает Plan (729–741). Ни current Geometry Contract, ни AD-7 не
  запрещают такой multi-wall junction: они требуют simple bounded Faces и
  детерминированную нормализацию exact contacts. У R6 нет fixture для
  corner-touch/articulation exterior: `DART-SUCCESSOR-…` покрывает bridge и
  rooms with a shared twin wall, но не этот случай (1500).

- Q2 policy меняет действующий contract до его reconciliation. Current Geometry
  Contract требует miter, ограниченный четырьмя половинами большей толщины,
  затем детерминированный bevel (Geometry Contract §7.1, строки 201–217).
  R6 при том же cap отвергает strict excess и запрещает bevel/clipping
  (857–870); он также отвергает collinear adjacent segments с разной толщиной
  (832–838), хотя current valid-plan invariants такой Plan не запрещают.
  Пометка «proposed source delta» не устраняет конфликт: до owner decision R6
  не может быть closed transition policy, а fixture с требованием `no bevel`
  закрепляет противоположное текущему source поведение (1503).

- Metric target language не имеет closed byte representation и не может
  однозначно представить `WallCenterline`. `MetricEdge` объединяет
  WallCenterline, UsableBoundary и AssetFootprint, но всегда содержит
  `faceOrFootprintDigest` (925–949). У wall centerline такого digest нет, а
  Null запрещён CB3; не определены ни absent variant, ни tag/encoding для
  session target bytes. Это также несовместимо с фразой, что каждый tag/digest
  входит в target bytes, при том что §3.3 прямо исключает metric target из CB3
  root и не даёт альтернативного wire grammar (441–446). Нельзя стабильно
  сравнивать, сортировать или проверять stale Wall measurement target.

- Metric targets не fenced к состоянию, которое пользователь выбрал. У
  `ExistingVertex` есть только ID, у `AssetFootprintVertex` — ID плюс digest
  definition, а у `UsableVertex` — Room ID, FaceKey и ordinal (928–951). Move
  Vertex или ItemInstance сохраняет ID; ChangeWallThickness сохраняет centerline
  FaceKey, но меняет usable Q2 vertex. Такой target остаётся «resolvable»,
  silently measures another point, и не может вернуть promised stale result.
  Нужен immutable StateSnapshot/entity-or-usable-geometry digest либо явно
  описанная live-reselection semantics; сейчас нет ни одного из них.

- Formatter не замкнут как policy record. `MeasurementFormatPolicyV4` содержит
  quantity, unit, fraction digits и input discriminator (433), но закрытая enum
  registry не объявляет ни Quantity, ни Unit, ни допустимый range fraction
  digits, ни grammar output ASCII token (448–477). §5.6.1 предлагает profile
  `mm/2` и `m²/3` (990–1024), но не определяет, как policy bytes выбирают этот
  profile, padding/zero/decimal token и невозможные combinations. Поэтому два
  formatter-а всё ещё могут produce different bytes/text for the same policy
  digest, что нарушает общий `MeasurementFormatPolicy` из Geometry Contract,
  PRD FR-13 и AD-7.

- Changed-face Room rule противоречит текущему обязательству сохранять
  однозначно соответствующую Room. R6 разрешает automatic retain только для
  byte-identical FaceKey и требует confirmed `RoomSurvivorMapV4` или NewRoomSeed
  для любой changed Face; «changed face can therefore never acquire an
  automatic Room ID» (1085–1099). Current Geometry Contract §7.1 прямо требует
  сохранить ID геометрически изменённой, но однозначно соответствующей Face
  (219–227), а PRD FR-15 требует это «по возможности». Это не merely unresolved
  matching detail, а противоположный adopted behaviour, требующий owner delta
  до fixture work.

- Fixture matrix недостаточна как evidence package и сама заявляет отсутствие
  runnable corpus: §10 называет его future evidence, not tests (1485–1489).
  Помимо отсутствия pinned inputs/outputs, список не требует случаев для
  remote/infinite C2 contact, diagnostic split из §2.1/§4.3, pre-reservation
  discovery, new-root lineage, WallCenterline absent digest, stale same-ID
  metric target или articulation exterior. `RAY-2399-2400-2401` также не
  определяет исполнимый source-valid case: `rowCount = 8 × wallCount`, поэтому
  2,399 не достижимо из Plan, а 2,401 возможно только через corrupt input
  (198–202, 1499). Fixture должен явно разделить valid equality от injected
  corrupt precondition.

## Условие следующего рассмотрения

Нужна новая неизменяемая revision, которая сначала устраняет эти algorithmic и
wire-level неоднозначности, затем получает source-owner reconciliation для
miter/bevel, Room retention, metric formatting/targets и transition identity.
После этого требуется реально исполнимый corpus с pinned bytes, expected roots
и forward/inverse outcomes, включая перечисленные counterexamples; одна лишь
матрица будущих fixture names не является достаточной exact-geometry evidence.

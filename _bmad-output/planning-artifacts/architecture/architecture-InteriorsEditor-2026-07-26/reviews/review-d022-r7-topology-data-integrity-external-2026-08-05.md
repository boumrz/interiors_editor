---
title: "Независимый обзор topology/data-integrity — D-022 R7"
review_target: "../d-022-geometry-policy-decision-draft-r7-2026-08-05.md"
review_target_sha256: "026b4bc9e524ecc2cb8895eb7345d00c667f63b88a9490a957042c2bdceca3ac"
review_date: 2026-08-05
review_scope: "Порядок topology-фаз, fencing, allocation/lineage ID, durable/history/patch boundary, hosts/openings, resources/recovery и fixture evidence"
independence: "Проверены только замороженный R7 и канонический source corpus; R6/R7 review- и advisory-артефакты не читались."
verdict: NOT_READY
---

# Независимый обзор topology/data-integrity — D-022 R7

## Вердикт

**Предканонический вердикт: `NOT_READY`.** R7 верно удерживает exact
arithmetic, selection policy, renderer projections и writer-fence metadata за
пределами durable Project/History-формата. Он также называет ряд необходимых
source-owner gates. Но это ещё не образует полный, fence-safe путь от topology
discovery через подтверждённый пользователем Command, resource admission и
publication до undo/redo и recovery. До принятия перечисленных ниже правил их
каноническими владельцами и до corpus evidence D-022 нельзя считать безопасной
основой реализации.

## Scope и воспроизводимость

- SHA-256 target был проверен до review и совпадает с требуемым значением:
  `026b4bc9e524ecc2cb8895eb7345d00c667f63b88a9490a957042c2bdceca3ac`.
- Текущие hashes каждого R7 `frozen_source_inputs` совпали со значениями,
  записанными в R7:30–58.
- Проверены canonical SPEC и все заявленные им companions, PRD, Architecture
  Spine, project context, domain model и solution design. Predecessor и любой
  R6/R7 review/advisory report не читались.

Сокращения в citations: `R7` — reviewed draft; `GC` —
`geometry-contract.md`; `DM` — `domain-model.md`; `P&B` —
`project-and-backup-contract.md`; `SD` — `solution-design.md`.

## Findings

1. **Фиксированный phase order materializes IDs, Command, ChangeSet и inverse
   раньше user-confirmed Room outcome, без которого ChangeSet не complete.**
   R7 allocates/materializes на steps 4–5, а Room reconciliation выполняет
   только на step 6 (R7:302–314). При этом его собственное правило требует
   preview и user-selected source-defined outcome для каждого split/merge или
   ambiguous correspondence (R7:363–379). Каноническая Room state machine
   требует `Ambiguous → Preview → Reconciled` через explicit command outcome
   (DM:280–293), а в `PendingDurability` может войти лишь validated complete
   ChangeSet (GC:143–167; DM:210–223). Нужен явный
   pause/confirmation/re-entry protocol: получить выбор как command input,
   повторно проверить current base и fence, затем заново выполнить discovery и
   materialize ровно один complete candidate. Нельзя переносить частично
   materialized candidate через человеческое решение.

2. **Тот же confirmation/re-entry path отсутствует для affected hosts и changed
   Openings.** R7 требует confirmed source-defined result для deleted,
   cross-root или ambiguous host (R7:467–472), а для Opening прямо признаёт,
   что relocation/resizing/deletion policy ещё не adopted (R7:501–504). В
   seven-step flow нет состояния ни для preview result, ни для renewed
   candidate после ответа пользователя (R7:302–314). Это не удовлетворяет
   требованию: пока Opening policy не выбрана, UI показывает conflict и block
   commit, а не молча меняет host/offset (PRD FR-19:383–391); hosted item должен
   быть rehosted либо показан как orphan preview, а не остаться floating (PRD
   FR-28:479–495). User decision нельзя считать неявным продолжением старого
   fenced snapshot.

3. **`TopologyAllocationIntent` пока не является total
   allocation/lineage-contract.** R7 задаёт rules только для children split
   existing/new `WallSegment` (R7:321–345). Exact-contact normalization также
   требует детерминированно reuse existing Vertex либо create одну shared new
   Vertex и partition каждого affected segment (GC:169–191). Canonical
   topology vocabulary дополнительно содержит move, delete, split, merge и
   opening operations (GC:127–141). R7 не задаёт entity roles, lineage,
   inverse, allocation failure/retry или collision treatment для этих paths,
   прежде всего для shared Vertex. Его же SO-R7-06 признаёт, что comparator и
   materialization corpus ещё не adopted (R7:600–609). Механизм allocation
   пока не может доказать stable IDs и exact inverse replay на всей command
   surface.

4. **У allocation intent нет определённой fence/base identity, хотя именно он
   соединяет discovery и ID allocation.** Selection и measurement tuples R7
   содержат project/revision/checksum и требуют discard stale worker result
   (R7:155–160, 169–214, 253–288). Напротив, topology intent описан только как
   roles и order (R7:307–309), хотя затем из него выделяются opaque IDs. Section
   8 требует bind validation snapshot к observed fence и base Revision
   (R7:551–557), но не делает это инвариантом intent для worker,
   preview-pause, cancellation, retry или out-of-order path. AD-12 требует
   job/base-revision/cancellation seam и discard stale result (Architecture
   Spine AD-12:296–309; DM:359–361). Intent должен быть либо непередаваемым
   in-process object с enforceable scope, либо иметь проверку base/fence на
   каждой consuming boundary; фразы «все фазы используют один snapshot» самой
   по себе нельзя тестировать.

5. **Room matching rule описателен, но не является исполнимым identity rule.**
   «Complete one-to-one lineage» не определяет affected scope, evidence
   correspondence, face-fingerprint treatment либо точный результат для
   properties/assignments (R7:365–379). Канонические sources требуют
   documented matching algorithm и fixtures, запрещают partially matched
   publication и оставляют split/merge matching и metadata disposition
   владельцу D-022 (PRD FR-15:339–348; GC:219–231; DM:295–296). Пока SO-R7-02
   не имеет adopted predicate и corpus, R7 не может construction-ally задать
   deterministic Room ChangeSet/inverse или доказать, что name, height и
   finishes сохраняются за той же semantic Room.

6. **У proposed `CanonicalPatchApplier` недостаточно declared input для тех
   invariants, которые ему поручено проверить.** R7 ограничивает input schema
   version, base Project record collection и ChangeSet/inverse (R7:409–416), но
   затем требует до Durable publication validate resource invariants
   (R7:430–440). Resource validity требует exact blob bytes,
   hash/media/provenance checks, `AssetUsageGrant`, complete manifest, backup
   feasibility и session roots (P&B:38–62, 228–250). В объявленном input этого
   нет. Получается либо невозможный pure applier, либо undeclared query path.
   Source owner должен разделить pure canonical patch replay и
   RevisionCoordinator admission transaction либо объявить verified
   resource/manifest inputs, ports и их atomic boundary.

7. **Patch target uniqueness не имеет source-owned grammar для nested и
   implementation-variable records.** R7 сам говорит, что surface assignment
   нужен ещё не опубликованный canonical address key (R7:418–428), после чего
   допускает только один Add/Replace/Remove на named target (R7:430–445). В
   source model `surfaceAssignments` находятся внутри `Room`, а `openings`
   implementation может хранить внутри wall collection (DM:43–50, 72–79);
   canonical ChangeSet семантичен и включает Room reconciliation плюс affected
   surfaces/assets, а не adopted patch wire grammar (DM:225–235). Один topology
   command может требовать Room replacement и addressed material action с
   пересекающейся before-record semantics. Без versioned
   collection/address/operation grammar из SO-R7-05 предложенные duplicate и
   equality checks не докажут deterministic forward/inverse replay.

8. **`HostOrigin` не может выполнить собственное утверждение о полном и
   disjoint inventory для floor/ceiling finishes.** Его ceiling/floor variants
   ограничены `assetInstanceId`, а floor variant использует `levelId`
   (R7:451–464). Canonical `SurfaceAddress` отдельно задаёт `Floor(RoomId)` и
   `Ceiling(RoomId)`, а `Room` owns `surfaceAssignments` (DM:72–79, 151–168);
   FR-34 и FR-36 поддерживают floor и ceiling finish actions (PRD:546–562).
   Floor/ceiling finish — не AssetInstance, а floor finish не адресуется одним
   Level. Поэтому affected floor/ceiling assignment не имеет HostOrigin variant,
   stated post-resolution или inverse route. Утверждение R7:462–465 об
   exhaustive/disjoint inventory не доказано, пока source-owned
   surface-assignment routes не будут заданы явно.

9. **Ceiling-to-wall route противоречит same-root transfer rule R7 и опускает
   compatibility/confirmation semantics.** R7 запрещает automatic cross-root
   transfer и требует confirmed rehost/delete/orphan outcome (R7:467–472), но
   затем даёт прямой `CeilingPlacement(roomId) → WallPlacement(wallSegmentId,
   side, …)` route без такого условия (R7:480–490). Это разные canonical host
   address types (GC:264–271; DM:131–149). Draft также не показывает
   compatibility asset с новым Anchor/host, источник новых local wall
   coordinates или user confirmation этой semantic relocation. Полные pre/post
   placement в inverse необходимы, но недостаточны, чтобы сделать cross-root
   transfer legal.

10. **Pinning до `PendingDurability` оставляет неописанное окно
    GC/crash-safety.** R7 pin-ит new bytes до build manifest, ChangeSet
    admission или staging (R7:516–528). Canonical GC roots — current, recovery,
    Trash, staging, custom definitions и обе session-history branches; command
    из середины History сохраняет redo roots до Durable publication (P&B:38–55;
    SD:177–196). R7 не задаёт staging/pin-lease root для только что pinned,
    ещё не admitted bytes, поэтому не доказывает, что GC/crash между pin и
    durable staging сохранит bytes кандидата и корректно закончит их lifecycle.
    Нужен explicit recoverable staging/pin-lease root, созданный atomically с
    bytes и сохранённый через success, reject, cancel, fence loss и crash; он не
    обязан быть полем Project, History или backup.

11. **Recovery верно назван, но не интегрирован в исполнимую transition
    contract.** R7 объявляет current-resource recovery read-only и допускает
    explicit `DiscardSessionHistory` для history-only corruption (R7:530–542),
    однако не задаёт fenced atomic route, root accounting и cancel behavior для
    этих исключительных операций рядом с normal phase flow. Canonical contract
    требует: в `ResourceRecoveryRequired` ordinary Commands/undo/redo запрещены;
    `RecoveryChangeSet` исправляет *все* unresolved references перед одной
    Durable Revision; explicit history action atomically drops обе branches без
    Project Revision (P&B:252–304). Нужна отдельная transition contract с
    current-healthy check, root accounting и гарантией отсутствия
    `HistoryEntry`/Revision у `DiscardSessionHistory`.

12. **Proposed fixture matrix ещё не доказывает перечисленные integrity
    boundaries.** Allocation cases не содержат shared-Vertex allocation, все
    command kinds, IdPort failure/retry и stale intent; host cases не содержат
    floor/ceiling surface assignments; resource/writer rows не содержат
    pin-to-staging crash/GC и user-decision pause с последующей сменой
    lease/base (R7:566–593). Каноническая verification прямо требует
    all-contact/no-partial-mutation corpus (GC:329–360), forced-GC undo/redo и
    precise dropped-redo boundary (P&B:332–356), recovery/Discard confirm и
    cancel paths (P&B:270–321). Будущим fixtures нужны canonical inputs,
    expected source outcomes, exact Revision/History/root inventories и
    fault-injection points для каждого transition, а не только название fixture
    family.

## Conditions для следующего review

Следующая source-owned revision должна сначала опубликовать и подтвердить
evidence: (1) confirmation/revalidation state machine для Room, host и Opening
decisions; (2) total, fence-bound allocation/lineage contract; (3) versioned
semantic ChangeSet/inverse и patch-applier boundary; (4) exhaustive placement
и surface-assignment reconciliation, включая floor/ceiling finishes и legal
cross-root transfers; (5) transactional blob staging/root lifecycle; и (6)
explicit recovery/history-discard transitions. Только после этого corpus сможет
доказать invariant: любой rejected, stale, cancelled, failed или recovered
operation оставляет appropriate Project, Revision, History и GC-root state без
изменения.

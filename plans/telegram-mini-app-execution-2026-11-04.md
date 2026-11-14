# Telegram extension: execution ledger

Status: active. Owner instruction: continue until the whole authorized extension
is implemented; do not end after an intermediate increment. This ledger does
not replace canonical SPEC, owner decisions or readiness.

## Preserved constraints

- Web/PWA remains functional through S0–S7. Prepare retirement, perform no
  removal until owner functional check and separate retirement decision.
- No commits, user-file uploads, cloud synchronization or bot delivery.
- Existing user preview PID15867 on 127.0.0.1:4175 serves apps/web/dist build
  ccdd13662cdca379. Never overwrite/clean it or stop its catalog/tunnel.
- Use Node24.19.0 and pnpm11.20.0 through pinned npx commands. All builds and
  browser fixtures use separate temporary outputs/origins. No new dependencies.
- Root owns S2/runtime/UI integration. One delegated owner implements the
  independent S3 Project-member codec in isolated snapshot
  `/tmp/interiors-tma-s3-pbj0s6f1/apps/web`; its new files are reviewed and copied
  back only after completion. That agent does not edit the original checkout.
  A second isolated owner implements only S2 SDK bootstrap and independent S3
  file seams; its child owns shared-controller extraction in a separate copy.
  No concurrent edits to one original module; all handoffs require SHA review.
- Keep original untracked files: repository has no HEAD/tracked baseline.
  Original547-file SHA manifest is in the S0 evidence location; git diff is not
  a preservation check. Memlogs only via _bmad/scripts/memlog.py.

## Completed and current work

- S0 six owner workflows and scoped readiness; S1 browser composition extraction
  verified, including17 browser/PWA/real-worker-upgrade cases.
- Initial S2 signed initData validator and session queue verified. No product
  Telegram entry or writable Project runtime yet.
- Following owner continuation, architecture/SPEC register single scoped IDBv2
  and exact history-pointer transitions. Architecture/SPEC/Epics refreshed;
  readiness reassessment completed: local full-S2 implementation and S3 codec/
  scanner/proof work READY. Release, physical and licensing gates remain.
- Scoped metadata v1→v2 and composite transaction access:34 native cases pass.
  Upgrade preserves uint64 counter/identity and fails without reset on corrupt
  metadata/unknown stores. Wrapped access expires after callback; even abandoned
  transactions drain and failure rejects the outer operation. New transactions
  validate scope metadata in the same atomic transaction.
- Telegram-only persisted repository now implements fenced add-only revisions,
  atomic pointer/receipt publication, explicit history transitions, immutable
  prepared pin journals, exact hash snapshots, atomic protection/cancellation,
  takeover adoption, per-Project quarantine, deletion tombstones, library roots
  and current/history exact-byte batch repair. It remains test-only/unwired.
- Shared publish(candidate, optionalExpectedBase) now preserves a command's opened
  base through helper/direct edits, retention, fencing and retry. Create/import
  omit base. publishNextRevision has optional history intent; Undo/Redo and retry
  propagate it, allowing the new adapter to distinguish add-only mutation from
  an exact existing-owned-Revision pointer transition.
- Initial mutation of publication guards:210 mutants,191 killed/19 survived,
  90.95%. Meaningful missing vectors were added: malformed scope boundaries,
  whole Array writer records/owner values, zero epoch/expiry, lost-writer flag,
  history retry intent, failed-create retry with CAS-capable repository.
  Updated full mutation finished:210 mutants,201 killed/9 survived,95.71%.
  All shared changed-guard scopes detected; remaining writer-policy survivors
  are diagnostic strings or guards already made fail-closed by later checks.
  Full scoped-v2 mutation:350 mutants,255 killed/13 timeout/82 survivors.
  Added meaningful native vectors for37 survivors; isolated targeted followup
  selected all37 by full AST spans and matched mutator/location/replacement:
  all37 detected. Followup61 total:59 killed/2 equivalent contextual guards.
  Do not substitute this targeted96.72% for a fresh full-scope score.
- Current full unit:2277/2277, both TypeScript projects and lint372 files pass.
  Native repository/storage corpus:58 cases pass, including four real IDB
  abort/rollback boundaries and foreign-owner pin attacks (RED/GREEN fixed).
  Full repository mutation2420 mutants is running in isolated snapshot
  `/var/folders/x6/8g_rbv593g9fb5mktbl8knmh0000gn/T/interiors-tma-project-mutation-nmn5_8ny/apps/web`;
  original source is not instrumented. Source SHA and scope are in S2 evidence.
- Shared publication regression in isolated original-browser snapshot:
 333 browser PASS/2 pre-existing live-catalog opt-in skips;10 PWA PASS;
  production build budget passes. Live4175/dist remains untouched. This run
  precedes shared-factory extraction and the last strict-capability guard;
  verify their affected paths after handoff. No completed S2/release claim.
- S3 Project-member codec/scanner199 new tests reviewed/copied (eight newfiles).
  Exact -0/own-undefined/UTF16/finite yaw and conservative legacy witness preserved;
  bounded worst-case corpus and mutation triage retained under S3/codec.
  Envelope owner continues wire+legacy; PPJ remains explicitly unaccepted raw
  handoff because source-owned full manifest/resource/proof binding is open.
  New canonical companion ppj-a1-envelope-and-handoff.md was read in full.
- Pure loaded-shell preflight now has6 tests: embedded bounded duplicate-free
  metadata, actual entry-path binding, immutable local permit, secure locks,
  capabilities and controlling-worker agreement. No DB/network effects.

## Next implementation boundary: full local S2 / Story10.2

Follow the canonical S2 fencing disposition before enabling any writable entry.

1. Add Telegram-only repository using scoped composite access. Never use browser
   writeStaging/recover or unfenced delegate fallback. Every changing transaction
   checks scope/Project/current owner/token/exact base or create/attempt identity.
   Revision add-only, collision safe. Published receipt and pointer swap atomic.
2. Immutable full journal before any new bytes: scope, Project, attempt, expected
   base/create, owner/fence, candidate checksum and complete target hash manifest.
   Counter reserves attempt/lease IDs in separate completed transactions. No ABA.
3. Conditional no-publish before destructive exclusive-pin cancellation;
   second consumer protects exact resource row atomically. Hash outside active
   IDB transaction, then compare the exact verified snapshot/row identity inside
   the publication transaction. All published/history bytes retained; no GC.
4. Safe takeover/adoption and recovery. Unknown/incomplete record retains bytes
   and blocks the affected write. Receipt remains authoritative after pointer
   advances. Delete preserves Project tombstone and fence/counter generations.
5. PinStagingLeasePort now accepts optional immutable candidate/base context.
   Strong Telegram facade requires it; browser behavior is preserved. CustomGLB
   and PortableBackup import prepare that context before bytes, with RED/GREEN
   evidence. Missing strong pinned-write capability fails before journal/write;
   unjournaled write/delete fallback is forbidden. Mutation of these latest
   shared changes remains required.
6. Runtime composition: extract shared usecase/controller assembly with injected
   repository/resources/library/pin/startup ports from production-app.ts; keep
   browser defaults/lifetime and avoid cloning the whole factory/editor.
   Telegram uses fresh owner UUID per runtime, scoped preferences/takeover keys,
   awaited disposal and full remount on a new generation.
7. Manifest preflight before DB opening/migration/writer/reconciliation. Current
   ReleaseStartupCoordinator calls reconcileBeforeWrite before manifest checks:
   do not inject mutating Telegram recovery there without an ordered facade.
   No-worker is normal, but manifest must bind to the actual loaded shell.
8. Native two-context race/crash corpus in the canonical disposition must pass
   before product wiring: stage/takeover, stale cleanup/newstage, pin cancel/
   protect including deletion races, noABA/collisions, interrupted reserve,
   crash at journal/pin/pointer/receipt boundaries, adoption, repeated startup,
   failure/retry, delete/reuse, release/expiry and A→B→A late callbacks.

## Following boundaries

- S3 AD30 is source-registered and local codec/scanner/proof READY. Independent
  runtime-v1-wire codec; internal serializer/revision checksums/PPJ unchanged.
  Preserve -0, own-undefined, permitted UTF16 code units and finite legacy yaw;
  bounded single dispatch, exact resources and copy-on-write import. Conservative
  legacy witness rule rejects ambiguous empty old files. Prove old immutable
  build→same-context new build→wire recovery on copies, plus worst-case budgets.
  Do not claim producer authenticity or guarantee an unproved sole-copy path.
- Host SDK/environment adapters only at UI/composition. Missing SDK/context,
  invalid signed data/clock/crypto/manifest gives finite retry/exit, no DB/fallback.
- AppShell currently lacks a safe unified Back handler. returnToProjects clears
  selection/drafts eagerly; do not call it directly from host Back. Priority:
  saving→persist-failed→draft/conflict/dirty input→panel→editor→Projects.
  Include raw rename/dimension/room/item/rotation/wall-position forms, not just
  child onPwaUpdateSafetyChange booleans. Suppress numeric blur commit before
  showing confirmation; Continue restores raw values/selection/focus.
- Child-owned drafts need an explicit cancel seam, not synthetic Escape/click.
  Existing draft-safety signals remain for PWA. Host Close warning never replaces
  atomic saving or guarantees prevention of system termination.
- Theme/safe areas/viewport use existing semantic CSS tokens and layout engine.
  Do not sum overlapping system/Telegram insets. Invalidate gesture projection
  on layout/keyboard generation changes; second pointer never submits a draft.
- Lifecycle resumes recheck scope/generation/fence/base/integrity. Actual editor
  dependency graph, renderer readiness and exact resources determine offline
  modes; first Projects paint does not prove whole-app readiness. Cold Telegram
  offline is not promised; PWA cold offline remains mandatory.
- File port separates bytes preparation, system handoff and proven roundtrip.
  Local Web Share/File or browser download only; native downloadFile needs HTTPS
  and cannot consume blob: URLs. No upload workaround. Check File.size before
  full reads, preserve separate recovery-draft naming/semantics and cancellation.
- Separate Telegram build/HTML/output/origin, no worker registration or browser
  DEV cache cleanup. ReleaseManifest generation independent of SW generation;
  bind loaded shell, retain old immutable chunks and reject missing asset/API
  URLs without HTML200 fallback. Keep catalog-only proxy/credentials omission.

## External dependencies still pending

- Real public bot identity/link, stable HTTPS Telegram origin and physical
  iPhone15ProMax/SamsungS24Ultra client access/version evidence. Bot token is not
  needed in frontend and must not be requested/published there.
- Physical account isolation, lifecycle/kill, resource limits and external file
  roundtrip cannot be replaced by native Chromium/bridge-fake evidence.

## Latest official host API reference

Checked 2026-11-04: https://core.telegram.org/bots/webapps . Use current official
SDK script URL from initialization docs; feature-detect Back subscriptions,
closing confirmation, swipe controls, safe/content-safe area events and stable
viewport. New Cloud/Device/SecureStorage/Serverless features do not change this
local IndexedDB/no-user-backend scope.


[Файловый поток: storyboard](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/plans/telegram-mini-app-files-2026-11-04/storyboard.html) — источники, состояния и проверка перед подключением UI.


## Explicit owner disposition — catalogue policy, 2026-11-04

The owner answered the pending source-conflict question: preserve the PRD/SPEC
rule without formal AssetUsageGrant and update AGENTS. AGENTS now follows
FR-28/FR-44 and AD-14: the owner chooses free/self-authored models outside the
app; formal grant/licensing admission is not an Alpha implementation/release
gate. This resolves that conflict only. Resource/hash/security/pin checks, no
user-file upload/cloud and physical/release/retirement gates remain. Six existing
BMAD owners are updating current applicability; old reports remain historical.


## Продолжение 5 ноября: текущая инженерная граница

- Решение владельца по каталогу принято: формальный AssetUsageGrant не gate;
  AGENTS и активные owner-documents обновлены, технические проверки сохранены.
- Текущий original содержит полный S2 protocol7a8… с новым inverse-pin и
  prepared mutation/history proof: свежий native corpus124/124 PASS. Real shared
  EditorApp/runtime UI01–05 root5/5 PASS; затем отдельные UI06 recoveryWriter,
  UI07 strict Telegram ingress и UI08 raw rename/UI09 numeric Back GREEN.
- TMA runtime принудительно выбирает registered Portable import для общего
  transfer action; valid legacy resource-free JSON больше не обходит envelope.
  Browser ordinary JSON route сохранён. RecoveryDraft явно отдельный, writer
  внедрён из registered portable.writer, native empty-draft proof пройден.
- Web дополнительный registered action и controller/shared/production addon
  интегрированы; legacy actions остались. Срез146mutation после укрепления:
 137K/9S/0T; residue документирован. Browser↔TMA two-origin реальные local files
  PASS в isolated proof, physical Telegram/OS handoff не подменяется этим.
- Обнаружен P1 нового browser ingress: UPPER resource key импортировался, но
  прежний exporter отказывал. ПЕРВОЕ предложение global browser FPC guard
  отменяется root как избыточное: оно ведёт к unrelated browser protocol/history
  upgrade и мешает сохранению старой PWA. Ни global guard, ни DB migration в
  original НЕ скопированы. Architecture/SPEC пересматривают disposition на
  ingress-only: actual decode/domain/resources → smoke → cancel → exact legacy
  representability → old FPC/same ImportUseCase; отказ до IDs/pin/staging.
  Существующие browser default policy/history/DB/codecs сохраняются. Отдельно
  выявленный pre-existing browser history protocol debt не выдаётся за fix.
- S4 root пока incremental/inert при отсутствующем hostNavigation: Back policy
 15/15 mutation killed, raw rename/angle live browser proof, portal guard
  сохраняет native dialog/raw/caret. Полная raw inventory/cancel/lifecycle,
  view boundary registration и остальные Back tests ещё выполняются. Не
  подключать host navigation к production target до полного wiring/проверок.
- Новый editor-host-boundary API834… и4lifecycle tests интегрированы. Child owner
  готовит отдельный Plan-first handoff (11native PASS) и затем RoomScene3d;
  root не редактирует Plan/presentation/Scene до handoff.
- Отдельный target owner имеет production build со strict inherited budgets,
  native10/10 startup/release/rollback proof и retained-directory restart proof;
  файлы ещё isolated, original target ещё не интегрирован. Fake test clock/
  published signed vector не являются physical/real-account acceptance.
- Исторический full M1 на oldaed483…/58cases завершён:2420=1334K/350T/736S,
 69.59%; no threshold в том config, exit0 не означает полное качество. Lossless
  report+source SHA и method summary лежат S2/project-protocol-mutation-historical*.
  Current7a8…/124cases не измерены этим score. Independent survivor review pending.
- Live Web/PWA dist4175 не перезаписывать; commit не разрешён. Public botId/link,
  stable HTTPS origin, physical clients и отдельный retirement допуск pending.


### Продолжение 5 ноября: root Back и browser ingress

- Root проверил baseline SHA и перенёс отдельные optional-host границы Plan
  и Scene, без включения SDK в browser. Native Plan15/15, Scene17/17 на root;
  verification-only refresh Plan30/30 и Scene18/18 получен от владельца.
- Root UI08–16:9/9 GREEN на actual scoped factory+EditorApp, включая raw/caret,
  room/initial contour/project name/catalog composer и собственные close.
  Затем genuine pre-Saving checksum RED → synchronous public pending query
  и facade whitelist → UI17+actual 3D integration2/2 GREEN. Inspector collapse
  UI18 genuine RED → capture-before-blur/guard GREEN. Текущий полный запуск
  добавляет StrictMode; результат записывается отдельно, прежние срезы не
  называются проверкой всего текущего дерева.
- Exact13-file browser ingress frozen handoff перенесён после всех SHA checks;
  default FPC/history/DBversion/old codecs не менялись. Новый sealed ingress
  проверяет точную legacy backup representability перед IDs/staging/publish;
  failed candidate требует source reselection, сохраняет recovery capability.
  Новый UI не обещает generic retry этой ветки. Atomic ID collision/old recovery
  staging P1 пока открыт; Architecture рассматривает конкретный opt-in вариант.
- Дополнительный Web/PWA «Экспорт файла для переноса» согласован UX/SPEC/AD-30
  и локальным readiness. Реализация ещё впереди: exact Durable snapshot и pins
  должны быть доказаны. Существующий экспорт сохраняется.
- Владелец view proof нашёл новый no-op tap после Continue, который сбрасывает
  retained Plan preview. Поручен узкий optional-host fix в isolated snapshot;
  это не объявляется решённым по прежним 30 тестам. Physical Telegram, HTTPS/bot,
  весь S3/S4/S5–S7 и retirement по-прежнему не объявлены завершёнными.


### Второй target, SDK и фактические catalog proof — 5 ноября

- По manifest/SHA перенесены21новый файл отдельного production target и6SDKdelta:
  signed bootstrap, независимые output/release-set/delivery/proxy, проверенный
  SDK snapshot, Back/lifecycle/layout subscriptions. Root production target11/11
  native и20Node delivery PASS до SDKdelta; новый SDKdelta15native+29unit у владельца,
  root повтор текущего состояния впереди. Тема пока coherent light fallback;
  владелец готовит isolated dark8CSS+adapter delta с реальным contrast evidence.
- Root host viewport/360px/200% native20–21 GREEN, изображения просмотрены;
  lifecycle22 RED→GREEN. Whole app/domain types и lint проходят, новые test-only
  style infos устраняются при финальной доводке. Active-only getter исправлен
  отдельным frozen2delta, actual quota+RecoveryDraft+retry native19 GREEN.
- Stryker52 для прежнего root Back snapshot:42Killed/0Timeout/10Survived80.77%,
  threshold80 PASS, source восстановлен и rawJSON сохранён отдельно. Срез ДО
  lifecycle/current flags не является полным mutation score всего S4.
- Supplemental browser exporter8files перенесён послеSHA; два UI действия
  RED→GREEN, actualWebempty/pinnedGLB→TMA native5selected cases GREEN у владельца.
  Sealed failed ingress reselection case04 остаётся открыт до narrowcorefix.
- S5actual signed production target+sameproxy читает существующий Kotlin catalog4174
  только GET. Floor single-bed3MiB actualpin→3D→reload proof PASS. Wall доказал
  focusedchrome→SVG selection defect optionalhost: capture windowblur ловит
  локальный DOMblur и отзывает новый контакт. Owner исправляет узко сRED/GREEN;
  первичные неправильные ожидания staged resource roots/раннего Saved оставлены
  как контрольные ошибки теста, не как дефекты продукта.
- Допуск newbrowser ingress atomic/nooverwrite всё ещё открыт: source owners
  разрешили protectedmemory stagedvalidation/resourcejournal +singleatomiccommit
  без видимогоProjectstage; граница старого отложенногоcleanup/IDreuse требует
  точного ограниченного disposition. DefaultWeb/PWA/history/DB не переписывались.
- Retirement inventory обновлён фактическими зависимостями двух target. Никакого
  удаления, коммита, deployment или передачи пользовательских файлов не выполнялось.


### Continuation: integrated target, source recovery and current verification

- Reviewed/hash-verified and integrated final SDK6 handoff: adapter44fbcb65, entryb6806b1c. Actual registration-throws/reentrant cleanup defects fixed by owner with RED/GREEN. Fresh complete559 mutation476Killed/1Timeout/82Survived85.33% passes80; raw/per-ID inventory retained under S4/host-final. Entry receives actual runtime.sourceRecovery.
- Explicit readonly StoredSourceRecovery component/helper integrated. Own prepared file kind unverified-source has .interiors-source.json/application-json, distinct nonbackup/recovery wording and fresh handoff. Root actual private corrupted-source native23PASS; actual signed production entry19/19 currentPASS includes a healthy neighboring Project, exact NUL/loneUTF16/astral source and all-store immutability. Formatter135 current130K/0T/5S96.30 with perIDtriage, production f903 unchanged.
- Retained host Plan pan exposed a real contact-kind ownership defect; ca2f365 fix reviewed/copied, camera moves remain separate from raw retained mutation. Plan42/42, Scene29 owner proof; Root completecommonUI26/26PASS and scopedstorage124/124PASS current. New actual abrupt pageclose duringheldsave proof is being finalized; earlier immediate-loading poll is test-control failure, not productRED.
- Actual signed production target/current catalog+offline+renderer+negative/proxy integration9/9PASS53.9s. Real floor/wall pins, native WebGL loss/restore, initial offline3D and edit/undo/redo, exact Range, corrupted byte refusal,503 retry and late response cancel. Scope/source remain local; no model/catalog publication or user-file upload.
- First full current Web335 cases:333PASS/2FAIL due added browser inspector toggle branch. Corrected from force-expand to toggle with nohostNavigation; existing fourmatchingcases4/4PASS and productionPWA10/10PASS. Accidental runner launch truncated firstrawlog; fully disclosed S7/verification-control-note.md. New full-v2 run uses frozen457source/testsnapshot and distinctlogs, stillinprogress. No existing scenario was edited or removed.
- Shared179files2726unit0skipPASS; lint434files0errors/warnings(3styleinfos); integrated types initially caught proof-only globalBuffer usage, fixed using actual response.body result; app/domain and separateTelegramtypecheckfollowupsPASS. Boundaries15/15 and targetdelivery20/20PASS.
- Added separate Telegram CI workflow preserving existingverify.yml; public testfixtures only, pnpm-execnode honors pinnedruntime, nodeployment. Added docs/TELEGRAM-RUNBOOK.md and updated evidence index. Physicaldevice/publicbot+HTTPS/fileoutsideWebView acceptance remains open; no falsephysicalclaim.
- AD31 isolated browserregistered-storage direction accepted. PRDowner14 FR45/57 and SPEC49 CAP10/§1.4 accept trusted(namespace,rawID) identity, sourceIDdifference, bothknownstoresprecheck and atomicdestinationnooverwrite; latercrossstore rawIDcollision separatelyrouted. UX21 includesmergedscope-awarecards/partialfailure/library/oldPWAvisibility. Architecture/stories/readiness reconciliation is stillrunning; no new storageimplementation before applicablegate. ExistinglegacyDB/defaultpolicy/history/codec remainunchanged.

- Native abrupt-page-close proof finalized: UI26PASS7.4s/18.8stotal. The old page closes during actual heldchecksum before commit, a new native page reopens exact prior Project/Revision and preservedbrowserdata without calling old React cleanup. This is abrupt page closure, not physicalOSkill.
- While AD31 storage remains ungated, removed unsafe newingress from actualbrowsercomposition: productiona09782 +shared8541ce and targetedtransferregressionb403 copiedafterSHAcheck. Missingdecoder→programmaticnot-ready before IDs/DB/checksum/status, olddefaultdecoder unchanged; supplementalexport remainsavailable. Root export/import flags are nowindependent, Browserwrapper onlyenablesexport; UI45testsRED→GREEN. Owner closuremutation2/2killed,96active-IDobservations0mismatch.
- Static production-size observation S7/production-size-observation.json: preservedbrowser ccdd13662cdca379 directHTML JS/CSS197933B/gzip64186B; browserfull-v2snapshot8f8584add72d5b25 197941B/gzip64203B; Telegramsignedverificationtargetb827685158470b7e 5509B/gzip2584Bbeforeverified application chunk. This is staticdirectassetmeasure, notphysicalnetwork/performanceclaim. Existing280KiBasset/290KiBentry budgets unchanged.


### Continuation: AD31 local gate and integration after complete Web/PWA regression

- Applicable AD31 gateREADY now in implementation-readiness-report-2026-11-04.md §1172ff. Scoped(namespace,rawID) +boundedexplicitfreshv0 reconciledPRD/SPEC/UX/Architecture/stories; owner-only storageimplementation starts, notrollout/physicalwaiver. UnsafeoldDBregisteredingress remainsdisabledactualAPI/UI; safeextraexport staysavailable.
- Frozen full-v2 Web335/335PASS16.9min and PWA10/10PASS42.7s. Snapshot457paths recorded, unchanged oldscenariosinclude2livecatalog cases (no skip). Later confirmed fixes have narrowadditionalproof; fullgreenclaim belongs to thisfrozenhashes snapshot. Liveuserdist60/547originalfiles/10protectedconfigs stillpreserved inS7/integrated-preservation-audit.json.
- Independent review surfaced realpending-refresh dataloss/staleaccept: controller414edd keepspending/saving/failure UI and gatesread-onlyaccept by exactcapturedcurrent+navigation/publication afterasyncboundaries. SevenactualRED→fullGREEN, strengthenedtestb33 copied. Rawmutation85v1FAIL35K31T19S kept; same85v2PASS69K11T5S94.12 retained separately (timeouts aredeferredharness waits, notclaimedproductioninfinite loops). No globalhistory/discardpolicy rewritten.
- Rootactual2-context native29 now GREEN: sameclock preservesactive3slease, BexplicitTakeOver viaUI, Aheldchecksum→fencelostcopy, Backconfirmation/Continue/explicitDiscard protectcopy; panelclose preserves it andhealthyreadonlyBackneedsno discard. Initial4sclockadvance andbeforeloadpublicTakeOver testcontrols were rejected, notproductfailures. Closingwarning includescopy; identityguardpreventsdiscardingadifferentcopy. Native30RED→GREEN coversBackduringqueuedrealWebLocktakeover andclosingwarning. Wholecommoneditor31/31PASS51.5s.
- Host-only GLBreadpreflight &FBXexclusion: custom25MiB checkedbeforeread, exactrepair50MiB/file180MiBtotal900entries boundallmetadata beforeanyread, oldWebpathsunchanged. Actualnative27/28RED→GREEN (initialcollapsedpanelmistake preservedascontrol), newhelper41c102 +11cases, fullmutation47/47Killed100%; sourceunchangedaftermutation. Existingdomain25MiBconst exported, valueunchanged.
- PlanactualsemanticpointerCancel originallyclearedvisiblemovebutretainedstaleref; confirmednative49/50RED, tinyhost-only3refcleanupPlan e75d432 aftercameraearlyreturn, full55/55PASS. SceneactualnativeWebGLloss +freshunreadycontact erasedretainedpreview; tiny2guardfix9168b4 preservesraw, full38/38PASS withrestore→freshrotation1Revision. Browserfallbackcleanup unchanged. Rawscopedreports/triage retained; no blanketbroadscoreclaim.
- Neutralrepositoryextraction3files reviewed/copied: strictTMAwrapper749f47, sharedprotocol a017b0, sharedrepo13f366; oldalgorithmcallbacks sevenprefixpredicates remainexactTMA throughrealhostprofile. TMAStore/session/signedfactory/DB/schema/lock untouched. Owner native124+entry19+mirroredRoot31 allPASS; Rootpostcopy124/124PASS34.8s, unit180files2751tests0skipPASS, app/domaintypes/lint4380errorswarnings(3infos). Browser-ownedbootstrap isnextindependentincrement; no activationbeforeproof.
- Applicationhelper623 historicalff36 report FAIL474K3T146S76.57 retained losslessly inS3/helper-full-historical-623. Production38710f unchanged, strengthened159bd +sixnewboundariesproofs copied; meaningfulsame-sizecandidate/equalchecksum/resourceoracles killedoldmaskedgaps. Moretest-onlyvectorproofs pending; no narrowUTF8score substitutedforfullgate.
- CurrentCLI/runbook clearlyrequiresisolatedsourceforinPlaceStrykerwrappers; temporaryoutputwrappersdoNOTclonesource. Rootusesonlyisolatedcopies. No commit/deploy/workerunregister/databasecleanup/userfileupload orcloud. Physicalpublicbot/HTTPS andiOSAndroidexternalfile roundtrip stillopen.


### AD31 directory UI contract and independent guard verification

- Exact erased-types handoff4 copied after SHA/baseline review: ports3922d859, controllerb1ce4d9d (legacy method bodies unchanged), productionc04015a6 and new browser-editor-instance500a0f49. No data/wire/schema change. Legacy composition still has no registered decoder/ingress.
- Root UI5 new behavioral markup cases produced4 actual failures before implementation, then50/50 AppShell PASS; app/domain typechecks and owned lint PASS. Scoped cards carry composite(namespace,rawID) React keys, visible/spoken source and duplicate-copy labels, captured owner options for open/rename(initialAction)/both directory exports/confirmed delete. Unknown-owner scoped cards are disabled. Partial/unprovisioned source is not presented as an empty directory. Exact trusted runtime instance snapshot keys remount AppShell; requested rename survives that remount. This is UI contract evidence, not proof of the not-yet-integrated facade/native routing.
- Full writer-exit manual packet retained inS6/writer-exit-manual:5 native baseline controls PASS;13 exact new-term substitutions,10 behavioral failures and3 bounded survivors;70 actual moduleSHA+HTML canaries match,0setup/infrastructure errors. No Stryker/fullAppShell score claimed. UI29 now asserts closing warning before opening Back guard, preserving new UI31.
- Helper whole623 first final run83.79% used26 tests but accidentally omitted7 existing adapter tests. Its actual raw result is retained as incomplete-corpus and is NOT acceptance. Corrected full33-case original-plus-new corpus is running unchanged623scope/80threshold; do not substitute the omitted-corpus result.
- AD31 bootstrap owner's current18 native cases pass after genuine RED for detected metadata-loss then restoration and cancelled-validation early return. Independent v2 read finds those earlier defects closed; late-open/fallback/atomic-error/mutation corpus remains pending. No Project publication or browser ingress activation declared.


### Current S3 helper acceptance and qualified UI checks

- Required complete helper33-case corpus rerun:623fullscope=520Killed/3Timeout/100Survived83.95%, unchanged80PASS. Every620nonTimeout candidate has33actual test activations; all623IDs/20,515records0mismatch. UTF8runaway-loop546/547/581 are separateTimeouts. Production387+all6source/corpusSHA restored andrestored-environment33baselinePASS. Incomplete26prior83.79 andhistorical62376.57FAIL stay separate;46historicalsurvivors nowKilled by exact-key matching. Losslesspacket S3/helper-full-current-623, no broaderS2/S3gate inferred.
- Temporary-copy environment incident:15oldmtime copied files disappeared across independentownedtemp snapshots. ExactoriginalSHA comparison preceded restoreviafreshmtimecopyfile; actualpertestcanaries prove no setupfailure countedKilled inhelper33. OSagecleanup is a hypothesis, no establishedcause. Originals/liveuserdist/dependencies untouched. Newclones use freshdestinationtimestamps.
- Root subscription-gap native04 deterministicRED (controller publishes afterrendersnapshot/beforeeffectsubscribe) thenoneimmediatecurrentrereadaftersubscribeGREEN. Fullnative36/36PASS57.3s =32actualscopedTMAeditor +4explicitUIcontractdoubles, not36signed/physicalclients. InitialUIproof badsummaryrole/nullselector+fixturemissingprojectName are separatetest-control errors. Whole183files2767unit0skipPASS. Existing13browser-startup tests remainunchanged: optionalinstance subscription moved to separatefacade-enabledwrapper, legacycompositionstillreturnsplainEditorApp.
- Rootsource-presentationmodule mutationv1 full98=76K22S77.55FAILretained;5additionalbehaviorcases coveridentitycollisions,unique/defaultcards,incompletecurrentdirectory,recoveryvsunavailableandexisting-not-absent. Currentformattedmodule+explicitoldfilecompatibilityhint v2 full99=99Killed100%80PASS,55tests/5445pertestobservations0mismatch,sourceSHArestored. NotanAppShell/applicationglobalmutationclaim.
- Historicalbrowserexport243actualraw found/reviewed/copiedlosslessly S3/browser-export-historical-243:149K1T93S61.73FAIL. Itcoversreadonlysnapshot c3c0c90, BrowserRegisteredProjectExporter e1289e8 andcontrollermethod, separatelyfromruntimeexporter40c3. Reviewedtest-only4packet integratedexactafterbaselineSHAguard;Root51targetedPASS. Twooracles genuinelydetectresourcefulprecancelpinread andexternalbufferchangeduringheldchecksumwithrealarchivedecode. Parentwhole243current rerun ispending, historicalFAILnotrelabelled.


### Further local S3 storage and facade increments

- Frozen metadata bootstrap11 reviewed/copied ONLY newpaths; source Session569c10/Storee05d11. Root native39/39PASS11.5s. No Project publication/entryactivation. Owner full535native mutation running elsewhere, no score yet. Combined Root snapshot185files2779unit0skipPASS, app/domainTS andlint4490errors/warnings3infos, architecture15+graphPASS.
- Reviewed lease/profile/no-ABA13 packet: strictTMA writer body mechanically moved to neutralf20e; TMAwrapperb1dba3 retainsregex/exactdiagnostics. Common74ff adds5conditionalhost-callback lines, no await onabsentTMA path; protocolb8e6bbc. Browsercallbackc81c665 streamsretainedownjournal insideSAMEstrictprepareTX before newRevision.add, refuses an exactpreviousProjectID/RevisionID afterabortedstagecleanup. Genuine nativeRED→GREEN retained; differentProjectafterexplicitdeletion permitted. Rootpostcopy browser6/6PASS13.1s andTMA124/124PASS33.3s. No oldbrowserDB/schema/historyrewrite.
- Real configured mutation inventory followsmovedbody: currentcommon2730+strictTMArepo4+sharedlease138+TMAleasewrapper8=2880, notthinwrapper4/historical2420. Actualcombined124TMA+6browser130nativecorpuscleanbaseline/canariesprepared; heavyformalrunpendingverificationcalibration, no acceptedscoreinferred. Metadata350remainsseparatecurrentoldTMA scope.
- Browserexport fullsame3semanticsscope243 accepted230Killed/2Timeout/11Survived95.47%80PASS; all243actualIDs/12,442pertestthree-moduleSHA+namespaceobservations0invalidsetup, all3source4testsrestored. Raw/triageS3/browser-export-current-243 retainshistorical243FAIL separately andKilled105→Timeout explicitly. Twoadditionalmeaningfulnegativeoracles mixedmetadata20/extrasnapshot157 nowgenuineinstrumentedRED→GREEN with53casebaseline andexactper-IDchecks,oneNEWtestfilecopied; no adjusted/fullsyntheticscore.
- QualifiedUIpolish conditionalONLYonnewscopeddirectory class: identity/source fullwidth and44pxactionrow, oldversionexplanationcollapsiblewithexplicitvisibleconsequence; defaultWebcardsunchanged. FourUIcontractnativePASS13.1s including360px200%text andopenedmenus,nohorizontaloverflow. Currentfullpresentation99/99Killed100%/5445activation0mismatch/sourceca9a30restored, separatev3rawkept.
- Rootownsnewbrowser-project-controller-facade.ts/tests; baselineownsnewslotruntime/sealedimport. Agreedslottypesexisting-onlyreadDirectory/dispose, no decoder/bootstrap in facade. IncrementalRED→GREEN7directory→14qualifiedrouting→18owner-bounddirectoryactions→25sealedimportselection→27partialbusy/late-read cases. ThisisUNWIREDworkinprogress, notfunctional/wholemutationacceptance. Busy private query cannotblockhealthylegacy selection; latepartialquerycannotoverwriteactiveeditor; queriescoalesced. Facade lifetime/recovery-confirmation/UIintegration remainpending.


### Actual retained-import identity and browser navigation protection

- Root unwired facade now38 contract-double tests plus3 actual SharedCore memory-store integration regressions. Real registered ZIP/SHA/publication/recovery reproduced the critical mismatch: failed imported B is retained while the screen intentionally still displays prior Durable A. The first control used the wrong writer result tag and is retained separately; corrected v2 failed at the actual facade screen assertion. Readonly Core pendingPublicationIdentity query (7f19da controller/f075 guard) exposes the exact retained retry target, including history travel, as fresh scalar values; the query never infers from screen/current. Four-file owner packet reviewed/hash-guarded and integrated separately from importer/profile WIP.
- Facade tracks the displayed address separately from an import callback identity captured before observers; pending target or exact fence-loss copy must match Project/Revision/checksum. Failed B is exportable, ordinary mutations cannot replace it, successful authorized retry remounts to B, and the old A callback cannot act on B. First import failure remains visible without inventing a Durable projection. Actual competing-writer acquisition of B yields retained B while A remains displayed; only the original explicitly confirmed copy can be discarded. Prior A remains byte-for-byte unchanged in all three actual-algorithm memory regressions. These are not native IDB/profile acceptance.
- Every editor view now carries an epoch-bound controller capability, revoked before owner changes (including equal raw IDs), and cannot observe or address the next selection. Unexpected Project replacement inside the same Core is refused. Disposal revokes synchronously, registers operation drain before reentrant callbacks, coalesces native directory reads and drains before completion. Independent frozen41 review and complete facade mutation proof are in progress. Production browser composition/ingress remain unchanged and disabled.
- New optional EditorNavigationProtection reuses the explicit draft/recovery leave confirmation in browser views without granting Telegram/embedded file capabilities. Native UI05 genuine missing-confirmation RED then GREEN; initial incorrect button label is retained as a test-control failure. Native7/7 passes: actual TMA29/30 plus5 explicit UI-contract doubles. Continue retains the copy; explicit Discard forwards its exact identity once. Old Web path remains unchanged when this optional capability is absent. Root targeted49 tests and subsequent99 tests including AppShell50 pass; typecheck passes and owned formatting/lint is clean.
- New test-only public repository admission3 cases were reviewed/hash-guarded and integrated (native invalid checksum/domain must not change any9 stores; fresh writer has no false lease loss). Their selective actual mutants0/59 proofs remain separate from the ongoing complete2880/common+lease scope with its fixed130 corpus. Current registered adapter complete121 scope accepted113Killed/0Timeout/8Survived93.39%, actual2057 module/namespace observations valid, lossless packet S3/registered-adapter-current-121.
- Browser bootstrap first full535 scope FAIL327Killed/3Timeout/205Survived61.68%; no activation or waiver. Owner strengthens meaningful metadata/cancellation/capability/lifecycle oracles before a full unchanged-scope rerun. Common2880, separate old TMA metadata350, current wire/scanner1401 and envelope1139 gates remain pending; no selective or historical score is substituted.


### Browser protection follow-up: actual pre-blur and late-contact failures

- Independent frozen41 read closed the retained-import P1 and identified browser-only navigation gaps: pre-blur interceptor/Back markers and child Plan/Scene registrations still used hostNavigation. Actual UI fixture now omits both host SDK and fileTransfer while retaining the real common controller/native scoped storage for this interaction proof (not browser-private profile acceptance). New browser pre-blur v1 first exposed an honest preview-status gap; corrected v2 reached Back and recorded actual3→4Revisions and saved yaw1 before any confirmation. Exact before/after/state attachment is retained in S3/browser-navigation-preblur-red-v2-observation.json.
- New browser Plan and Scene vectors first prove a native movement creates one Durable Revision, then invoke actual DOM Back before a queued pointer release. Both genuinely failed by publishing an extra Revision. Narrow fix applies optional neutral isNavigationProtected only to pointer interception/Back markers/raw preview status/child boundary registration/inactive placement draft. Host SDK subscription/visibility/close, Telegram marker/styles, and embedded file policy remain host-specific. Old Web absent optional protection keeps its prior branch predicates.
- Same selected7 native tests pass45.5s: old actual TMA09/12/Scene01 +UI-contract double05 +3new actual common-editor browser-protection vectors. Continue preserves raw numeric text/caret and 3D world pose, old contacts remain revoked, only a fresh contact publishes. Independent3-file delta read confirms the seam and found no new defect; no full AppShell/physical/private-profile claim. Root whole191files2846tests0skipPASS, app typecheckPASS, lint has0errors/0warnings (one informational existing fragment). Preservation audit S7/facade-preservation-audit.json verifies547original files remain, live olddist60 and10protectedconfigs unchanged.
- Registered-controller current fullhelper70 plus narrow newpendinggetter4 raw74Killed/0Timeout/0Survived100%, unchanged80PASS,444actualworker observations/all74IDs0mismatch, all6source/corpusbaselineSHA restored. Complete current packet S3/registered-controller-current-74; earlier helper69 v1/v2 retained separately in S3/registered-controller-historical-69. This does not claim full ProjectController mutation acceptance.
- Root complete facade scope is1184 mutants, fixed38contract+3actual-memory-integration corpus41. Actual loaded facade/controller SHA and module-local mutation namespace are checked before every test. Positive baseline41PASS; deliberate wrongloadedSHA and uninstrumented-ID controls41FAIL each are rejected as invalid infrastructure. Full unit1 run is in progress in a fresh isolated source clone; no current raw score is claimed.


### S3 integration and whole-scope evidence — 2026-11-05, continued

- Scoped local readiness remains distinct from activation/release readiness. Original browser entry is still the legacy runtime with registered ingress disabled. No commits, deployment, user storage cleanup or server-side user-file transfer occurred.
- Root facade grew from frozen41 to95, then99 cases: explicit optional-private absence, real Shared Core retained import B/displayed A, actual old JSON dispatcher quota/fence-loss failures, retained history hidden behind Saved, readonly legacy creation refusal, and stale pre-import view after retry. Genuine startNew refusal first revoked a healthy private editor; correction adopts the legacy selection only after a changed first-run snapshot. Current99 PASS, no skip. Public pending identity remains a fresh read-only primitive projection; the added third actual Core observation shows controlled history stale-base preserves its exact recovery target without claiming native reachability.
- Historical whole1184 raw670Killed/4Timeout/510Survived56.93% FAIL. Two runner-aborted cases1171/1173 are explicitly not behavioral kills; top-level Rstest maxWorkers was ineffective. Historical whole1242 used correct pool.maxWorkers1 and exclusive actual worker leases: raw931Killed/5Timeout/306Survived75.36% FAIL against unchanged80. All1237 non-timeout invocations ran the same95 actual case identities;117762 source/module-local active-ID observations valid; all8 source/corpus paths restored. Five incomplete timeouts are preserved without behavioral detection claims. Complete lossless evidence: S3/facade-historical-1184 and S3/facade-historical-1242. Current source changed after1242; neither historical score is acceptance. Next whole current scope pending.
- Actual private factory, exact readonly two-database raw-key lookup and outer composition are integrated as seven hash-verified paths, with the latest queued-lock native test pair substituted from its frozen packet. No browser entry activation. Integrated factory3 +outer13 +Core observation3 +new raw-source UI6 =25 focused unit cases PASS; app typecheck PASS after type corrections. Actual native runtime01–05 pass separately (not a claimed whole19 run): explicit import/edit/history, exact legacy backup, self-authored GLB bytes and reimport, future-schema sticky refusal, coalesced bounded queued lock and disposal cancellation. Additional actual coexistence06 passed in owner clone, pending test-only packet integration: genuine legacy/private Core and codecs, equal raw Project/Revision IDs in both DBs, correct qualified opens/exports, stale private view refused with all native rows unchanged.
- Source-specific UI getter disables legacy creation/mutation during readonly admission while private editor and legacy exports remain available (native UI07 PASS). A separate legacy startup-source notice preserves the exact unverified UTF16 source via the existing bounded formatter, never labels it Portable Backup or invents Revision identity. Native UI08 verifies actual Chromium download bytes/filename; UI09 changed/closed both refuse stale delivery. Selected4 PASS19.2s in S3/browser-legacy-source-copy-native-v3.log. Earlier source-copy failures were test notification race / wrong alert oracle after safe unmount and are retained, not claimed as product defects. These UI contract doubles prove interaction/download behavior, not actual private storage or physical Telegram/OS delivery.
- Added23 meaningful facade failure-contract cases PASS: Saving/failure screen before busy flag, exact selected export signal/owner, actual source throw/reject, mismatched claimed Durable import addresses, current-view state refresh, and return-to-directory remount. These expand the next immutable whole corpus; no adjusted historical score is inferred.

- Independent survivor read produced14 additional safety vectors, plus an initial honest-loading check: current whole137 baseline PASS with all137 actual source observations. Three deliberate controls reject wrongloadedSHA, uninstrumented activeID and preheld worker ownership. Fresh complete facade1268 scope is running against this immutable4-file137 corpus, break80 unchanged; score remains pending. The staged122 preflight is retained separately and never substituted for137.
- A genuine late-source UI notification defect was reproduced: source flags/raw recovery changed after the private source admitted startup, but the old render still enabled legacy creation and hid its source copy. A narrow injected BrowserRuntimeEditor now observes source revision separately from instance revision. Native10 GREEN16.9s proves immediate capability/source-copy updates and the same private rename DOM node, exact raw text and caret retained; no Core command or navigation occurred. The subsequent type-only required-port refinement removes an unused fake legacy-instance fallback from this new bridge; app typecheck PASS, final native replay pending. Old actual browser constructor still returns its legacy runtime and follows the direct EditorApp branch.
- Native Telegram metadata whole350 finished305Killed/0Timeout/45Survived87.14% PASS unchanged80, whole sourcea635b0d, fixed130-case corpus,27462 actual source/namespace observations0invalid,31 restored paths independently verified. Exact45 survivor triage keeps diagnostic, native-ordering and untested payload/timing distinctions without any denominator adjustment. Frozen packet hash-verified/copied under S2/native-metadata-current-350. Common protocol2880 remains running; it is expected to take hours, not a near-complete pass. Two prior timeout IDs253/254 passed separate quiet actual130-case replays and therefore are not proven behavioral detections; original raw statuses remain unchanged.
- Read-only Fallow3.39 static health/unused-file analysis is captured under S3/browser-runtime-integration. No automatic deletion or refactor, no production runtime coverage claim; inactive new runtime files are expected to appear unused. Its architecture rules are unconfigured, so the actual project boundary checker is separately PASS. Refreshed S7/browser-runtime-preservation-audit.json confirms all547 original files still exist, live60-file dist and all10 protected Web/PWA build/test/manifest configs unchanged. Separate Telegram CI adds browser-native proof steps only; original verify.yml remains unchanged and remote CI has not run.

- Post-run general-build audit rejected Root complete1268/137 despite raw1054K/5Timeout/209S83.517%: the source clone omitted4 sibling catalogGLBs used by inherited CopyRspackPlugin. All1269 invocations including dryrun printed build errors while Rstest still executed cases and returned code0 for survivors. Actual source/namespace/case proof alone was insufficient. Historical1184 and1242 also have this missing-input defect (their raw scores already failed). Complete unadjusted evidence retained, later sidecars/manifests updated; no raw status rewrite.
- Root corrected the clone with exact4 GLB inputs and made general build/setup errors force exit2. A genuine missing-assets negative now rejects infrastructure despite all137 stock cases PASS; clean137 baseline and wrongsource/namespace/worker controls behave correctly. Identical complete1268/137 rerun began05:20UTC, same sources/corpus/80 threshold. It is not yet acceptance.
- Independent urgent audit also revokes helper623/33 raw83.95 acceptance:130 affected Killed IDs contain missing build inputs. Faithful fresh623/33 full rerun is in progress, with exact623 mutation inventory, complete asset/source closure, actual first-byte/namespace observations and general build-error rejection. Registered121, exporter243, guard74, host559 and GLB47 reports were separately checked and have no analogous error; no blanket invalidity or equivalence assumed.
- Full requirement audit found additional implementation work beyond AD31: supported nonwritable Telegram startup must preserve readonly full backup for proven healthyV1, plus lossless unverified original-source recovery for corrupt/unsupported records. A standalone readable-only WeakSet permit is integrated (6-case local baseline passed in owner clone); it does not alter the existing writable permit, grant a writer/renderer, or touch storage. New readonly reader/wrapper/UI slices are in progress; no invented migration or generalV2 parity.
- TMA16 requires a privacy-safe local technical diagnostic record (target/build/schema/catalog/capabilities/stable reason), beyond generic entry failure text. New in-memory collector6 tests and app types PASS; no SDK object/initData/token/account/Project/GLB/path capture, no network/persistent telemetry. Entry/UI/catalog observation wiring and complete mutation proof remain pending.


### Clean proof results and supported readonly Telegram composition — 2026-11-05 06:38 UTC

- Corrected whole facade1268/137 completed clean with raw1054Killed/5Timeout/209Survived83.517%, unchanged80 PASS. All1263 non-timeout invocations have the same137 actual case identities;173269 actual source/local-ID observations are valid, sequential worker ownership is intact and9 paths restored. Exact four sibling assets are present; independent general build-error audit is clean. Raw timeout witnesses are source-triaged separately, no empirical kill claimed. Complete clean packet and later timeout sidecar have a refreshed hash index; rejected first1268 remains separate.
- Fresh same623/33 JSON-helper rerun also completed clean:520Killed/3Timeout/100Survived83.95%,20488 valid actual observations,476 closure paths restored, complete assets/first-byte/source/namespace/worker/build-error controls. Root verified all505 manifested evidence paths before copying S3/browser-json-helper-clean-623. Historical build-fault result stays revoked and unchanged.
- Root hash-guarded15 NEW readonly reader/helper/native-harness paths (reader2acf, helper ebec) and final standalone runtime/permit-test packet (runtimef01,21 cases). Existing-only constructor has zero DB operations, actual reads use readonly native transactions and the exact scoped storage lock; unsupported no-locks branch is honestly unavailable, no bypass or acceptance waiver. Current reader12 unit cases and focused integration65 passed; full current resource/cancellation/native proof remains pending.
- Entry gains a separate optional readable-only composition, after the same signed-launch verification. Three initial readonly cases then three actual-handshake/lifecycle cases were red before implementation and pass after: no writer for nonwritable schema, exact host-ready once, invalid signed launch, start refusal, same-scope ownership revocation, actual renderer loss with writer drain, changed actual worker refusal, synchronous abort/drain of a held readonly startup. The two handshake regressions use the actual dormant runtime handshake, not fabricated outcome shapes. App typecheck passes. Readonly UI leaf and full current native/whole entry mutation proof remain pending; no production browser activation.
- Diagnostic collector expanded8→15 meaningful privacy/bounds/partial-measurement/close cases, all pass. First formal whole128/8 raw77Killed/0Timeout/51Survived60.16% FAIL80 retained; next full proof will include the actual entry consumer. Existing optional diagnostic placement keeps healthy canvas flow unchanged. Legacy startup-source notice now uses a collapsed floating presentation over the saved editor rather than shifting the canvas;8 unit cases pass. Current native geometry and delivery-refusal cases remain queued.


### Readonly coordination and technical diagnostics — 2026-11-05 06:58 UTC

- Routine engineering disposition adds an explicit `native-readonly-snapshot` source profile when the host has no Locks API; the default `scoped-lock` still refuses missing locks, and busy/timeout never silently switches coordination. Native readonly transaction snapshots, owned exact Blob bytes, metadata identity/counter floor, final full-proof CAS and synchronous revoke/drain provide the read-only basis; no writer/ID/provision/upgrade/reconciliation/GC capability. This is not a user waiver or release approval. Four-file preliminaryv2 packet1e6f/e44 was independently reviewed/hash-guarded into the source tree after17 unit/type/lint pass. Current native39 and full mutation remain pending.
- Independent review reproduced and fixed two new-source gaps: explicit native profile unnecessarily observed an unavailable request property; sparse lease-root metadata could satisfy `.every`/Set-size checks. Genuine RED→GREEN fixtures now require no lock-port observation and actual dense own array indices without sparse-length allocation. Shared frozen repository source74ff remains unchanged; no blanket shared metadata acceptance or data-loss claim.
- Root readonly entry no-locks regression RED→GREEN plus all49 targeted entry/reader/helper cases and app types pass. Separate genuine constructor-failure regression proves writer-only technical failure retains verified readonly backup access after fresh actual worker/capability admission. Existing writer callbacks still cannot be reused, and a changed worker cannot obtain a stale permit.
- Diagnostic whole128/46 completed107Killed/0Timeout/21Survived83.59375% PASS unchanged80. Independent audit confirms all128 actual invocation identities, same46 actual tests,5888 valid loaded-source/local-ID records, sequential workers, all449 source paths restored and no compiler faults. Source/local-ID/worker/missing4GLB controls all reject infrastructure2. Complete proof S7/diagnostics-current-128 retains bounded21 survivor dispositions. Two additional privacy oracles (non-string catalog object without coercion, invalid small schema relation) pass17 collector cases; no synthetic score increase. Prior whole128/8 FAIL is preserved.
- The runbook now records actual oldWebccdd13662cdca379 and historical isolatedWeb8f8584add72d5b25 builds separately from unreleased new browser/TMA paths. The client/schema matrix states wire/legacy witness/ambiguous empty/PPJ-A1/no-generalV2 boundaries and explicit old-client refusal/update, without inventing deployed versions. AC01–13 traceability index created with remaining current/physical requirements explicit.
- Three actual mounted signed-entry readonly scenarios are prepared, not executed: exact room full archive +native readonly-only transaction audit; corrupt raw source beside healthy neighbor; absent database without provisioning. They use a real browser scope and production entry, with local SDK/file-handoff observation explicitly distinct from physical Telegram/OS-save proof. Waiting for the agreed native slot; no fourth persistent browser pool started.


### Readonly startup evidence and current quality gates — 2026-11-05 09:05 UTC

- Actual existing-only Telegram reader native43/43 passed with86 actual main/helper source/local-ID observations, no skipped cases or build faults. Current sources remain1e6f3177/e44a024c. Its two distinct complete file gates662 and618 are running against the fixed17unit→43native corpus; no combined acceptance score. Hash-guarded verification closure and raw43 are in S4/readonly-native43.
- Mounted actual signed-entry readonly increment3/3 passed: full archive decoded by the actual codec, exact corrupt neighbour source, and absent/no-lock database without provisioning. Every recorded transaction is readonly and all nine stores remain unchanged. Source snapshot, original logs and report are preserved in S4/mounted-readonly-entry-three. SDK and system handoff are controlled local doubles, not physical Telegram or OS-save proof. Final full current22-case entry suite remains pending.
- Actual readonly UI leaf8/8 passed (StrictMode lifetime, stale/cancelled actions, raw-source ownership, independent file gesture,360px/200% and dark contrast). Earlier complete leaf477/31 result70.02% is FAIL80; a fixed31unit→8native complete gate is being qualified. No historical failed score is promoted.
- New browser all-readonly gap confirmed against approved UX/FR44/Story10.5: old generic recovery screen hid healthy readable records. A separate optional read-only directory/export port and UI now supply two source-qualified records, full old/wire archive choices, and explicit raw-source files without any controller or writer capability. Genuine native RED2→GREEN2 and combined previous13+new2 actual UI checks15/15 passed22.6s, in S3/browser-all-readonly-ui-native. The provider/backend and partial-writable source routing remain in isolated development and are not activated in default BrowserEditorApp. A new cancellation regression was independently RED then GREEN: revoking sourceA cannot cancel a reentrant healthy sourceB export.
- Shared metadata defect independently reproduced: sparse arrays in project manifests, resource roots and prepared pin hashes were accepted because iteration skips holes. Minimal common source74ff013b→0d61a438 adds dense canonical-index checks and array length comparison. Three native RED→GREEN vectors and unchanged old130-case corpus PASS130/130; all nine stored rows preserved. New whole four-file inventory2903 is pending. Historical incomplete common2880 run was stopped after610 distinct valid survivors already made80 mathematically unreachable; no final raw score or completed whole claim exists. Earlier535 storage72.34%, outer30854.55%, and entry56374.9556% are retained FAIL80.
- Historical entry563 lossless raw/source/corpus/controls/restoration archive is now preserved in S7/entry-session-563-failed. A narrow actual diagnostics failure-path fix and meaningful lifecycle/timeout/ownership oracles pass56 current entry cases. Fresh complete configured entry function/helper scope568 with133 actual cases is running; no accepted result yet.
- Wire1401 V3 completed raw1296Killed/16Timeout/89Survived but current audit marks three allocator-OOM workers for independent terminal-process/causation adjudication; not accepted yet, no statuses or denominator changed. Independent whole envelope1139 is running after clean82-case baseline and source/local-ID/worker/skip controls.
- Required old-empty-backup runtime bridge PASS1: retained old encoder→ordinary legacy import→qualified supplemental wire export→strict Telegram import with a new Project. Test-only2 closure integrated in S3/runtime-empty-backup-bridge. Its exact historical a660/74ff source context is disclosed; it is not shipped-old-build UI or OS file evidence, and current complete native regression remains required.
- Original current aggregate snapshot209 files/3139 tests PASS, app/domain/Telegram types PASS and lint0errors (3warnings/4infos), in S7/browser-readonly-current-*. Later narrow readonly UI cancellation change has its own focused proof; this aggregate is not final release verification. Original Web/PWA manifests/config/checks and old user preview are not changed. No commits, cloud sync, Project uploads, bot messages, deployment, Web/PWA removal or data clearing occurred.


### Terminal-process adjudication and bounded entry oracles — 2026-11-05 09:23 UTC

- Root independently accepted complete wire1401 at unchanged1296Killed/16Timeout/89Survived93.647394718%, threshold80. All11083 archive hashes verified;67490 actual case canary rows contain269960 actual module-source/local-ID observations; all89 survivors execute the same199 `(case key,testID)` identities (parameterized titles alone are not unique).3925 compiler logs are clean. Exact three allocation-loop mutations125/134/659 caused V8 heap-OOM/SIGABRT; installed Rstest exit callback, completed parent command and absent exact owned PIDs prove terminal completion despite missing afterAll. Actual unrelated valid-canary SIGABRT is rejected. Raw counts/statuses/denominator and original rejected audit are unchanged; lack of a separate original fork-exit JSON ledger is disclosed. Full lossless evidence and bounded Root decision: S3/wire-current-1401.
- Entry568 first133-case attempt was stopped as an unscored partial: newly strengthened held-boundary tests awaited entry after an already completed refusal. Source product behavior was unchanged. Every457 source path restored and exact parent+3 owned descendants absent. Complete partial evidence is preserved in S7/entry-session-568-unbounded-partial. Public test oracles now race the expected held step with actual operation completion; no test removed. Fresh complete same568/133 runs with genuine failed-assertion bail, unchanged80; baseline/survivors remain all133. First actualinstrumented0 gives one genuine assertion failure with valid module/local-ID, while wrongsource/namespace/worker/assets controls still reject2.
- Native max-failure reporting was independently qualified: the exact canonical Playwright early-stop summary is retained as raw report metadata and accepted only for active mutation+nativeexit1+one genuine marked failing case; all other reporter/setup errors still reject. Rootnotice77 full8unit→13native gate is running after actualreal-selector32 control; previous full13 selector control remains preserved. Childreadonly662 V1 partial is stopped/restored/drained after detecting the same reporter-control gap, with fresh stronger V2 controls/dryruns before unchanged full662/618 restart. No invalid partial statuses are promoted.


### Integrated readonly recovery and current complete gates — 2026-11-05 11:15 UTC

- Complete unchanged legacy source-notice70c3750 full77 now PASS67Killed/0Timeout/10Survived87.012987%, unchanged80. Fixed9 unit +ALL8 affected native scenarios, all baseline/survivor identities and actual source/local selectors independently audited;2106 unit +585 native module observations,540 before-source/corpus paths restored. Root archive S3/legacy-startup-source-current-77 retains all raw and bounded10-survivor triage. Historical complete77/8+13 score79.22% remains FAIL in its own archive; no denominator/status edits. Global qualified directory UI kept its unrelated scenarios.
- Actual browser all/partial readonly UI advanced from15 to18 to20 full native checks; current20/20 PASS24.1s in isolated loopback/profile. Raw-source recovery also works when its namespace is writable but a neighbour record is corrupt: healthy cards remain editable, separate raw-only component has no duplicate healthy cards or full-backup action. This was genuine SSR+native RED then GREEN. New runtime-owned browser navigation-protection forwarding has separate native RED→GREEN1; full current21 and its two source gates20/649 are pending. Global diagnostic/Source labels and exact original IDs remain view-only; no scope hints enter Project/archive payloads.
- Current browser readonly backend18 owner files are integrated by exact old-SHA/absence guards; Root reviewed authority/cleanup/resource-profile deltas and verified22 packet-index hashes including complete proof archive. Current35 focused integrated units and actual native6 pass. Actual identity loss/counter rollback/re-admission/resource-DB disappearance each had genuine native RED→GREEN. Legacy resource loss refuses only resourceful archive; independent empty Project/full file and exact raw original survive. Same-provider WeakMap ownership memory retains monotonic counter/known loss without persistent metadata writes. No default BrowserEditorApp activation occurred. Remaining whole scopes are outer345/provider287/reader783/snapshot583; the first outer345/40 raw55.36% is FAIL and additionally rejected for two undefined-rejection reporter faults. A narrow behavior-preserving obsolete read-proxy simplification is approved only after before/after actual-core/read-only/newgeneration characterization; this is not a score waiver or code movement.
- Current entry function/helper whole568 PASS475Killed/0Timeout/93Survived83.62676% with fixed133 and19942 real source/local-ID observations;457 paths restored, no invalid/timeout. Independent93 per-ID survivor triage is hash-verified. Six additional public lifecycle/host/ownership cases are integrated test-only: composite139 baseline/instrumented baseline PASS and exact current selected290/396/426/309/506/507/508 each genuine marked behavioral failure. Accepted whole83.63% stays untouched; no selected score. Historical563FAIL and stopped568 partial remain preserved.
- Release producer f16fd09d complete161/32 PASS144Killed/0Timeout/17Survived89.44%,5152 actual Node source/local-selector observations,162 invocations with all32 identities,25 paths restored. Only one NEW boundary test file integrated; source unchanged. Old20 cases preserved and prior79.50% failure kept separate (S7/release-producer-current-161).
- Main shared common0d61 full2903/173 is now running concurrency1/80. All173 frozen native cases passed before start;14 exact current Instrumenter witnesses prove meaningful stale digest/expiry/incoming-library guard detection.31 new verification files and guarded520c telegram-storage-harness insertion are integrated; stock-probe rebinding belongs only isolated mutation clone. Browser Runtime07harness1a55 remains unchanged. No incomplete or narrow score is acceptance.
- Telegram reader662 V2 stopped at a validated bound148 survivors after402 attempted IDs: maximum possible514/66277.64%, no final raw JSON or score. Full partial/instrumented/backups,36 restoration paths and exact five stopped descendant PIDs/Chrome0 retained. Sources1e6/e44 unchanged; helper618 not started. Constructor negatives and actual mixedhealthy/corrupt/numeric native cases are strengthened before any new full662/618, with selected current mutations genuinely detected. No private error-message test policy is invented for535; its raw72.34% still FAIL.
- Envelope old full1139 raw86.04% remains REJECTED for exact932 throwing undefined through a fixture/reporter, with no clean failed-test identity. A NEW tiny independent ZIP/public .resolves case catches it as a genuine marked assertion; old82 untouched. Fresh complete1139/83/80 unit1 is running after exact inventory/controls/source restoration; no raw relabel. Wire1401 bounded terminal adjudication PASS remains separate.
- New original integration snapshot213 files/3168 tests PASS0skip9.43s; app/domain/Telegram TS all PASS, architecture15 PASS, lint0errors (3warnings/3infos). Logs S7/integrated-current-*. This is not final release verification. Full final Web335/PWA10/currentTMA-storage/UI/entry/catalog/delivery, matched gesture/build size, human physical/OS save-reselect, final code review and remaining whole scopes are open. Original user preview/old Web/PWA data, configs/manifests and no-commit/no-upload/no-deploy/no-removal constraints remain enforced.


11:41UTC local verification update: bounded browser outer permission simplification328a is integrated after independent7-file packet/5-context hash validation,67 before/after unit cases and actual native6. Default BrowserEditorApp remains unchanged and registered ingress inactive. The previous outer345 failure is retained; fresh outer320/67 raw68.44% and provider287/67 raw64.11% FAIL80, snapshot583 continues separately. No current passing outer/provider gate is claimed.

Unchanged bridge ff8b whole20/18unit+all21native completed15Killed/0Timeout/5Survived75% FAIL80. Root independently audited actual4-module SHA/local IDs, full21 identities for each survivor, compiler logs and worker drain; see S3/browser-runtime-editor-20-historical-fail. A separate genuine mixed-source recovery oracle is prepared for a new full20/22-native gate. Current model e316 whole649/18unit+5native continues on its original frozen corpus; none of the new tests changed that active run. New public lifecycle/raw-source tests separately pass34 total with existing18, exact selected Instrumenter replays independently expose previous oracle gaps. These are not adjusted mutation scores.

Separate Telegram CI now includes current producer boundary checks, readonly proof/fixture controls, existing-only browser6 and Telegram readonly source checks. Original verify.yml, package/lock, normal Rspack/Rstest/Web/PWA configs remain exact baseline. Original file audit at11:27UTC found all547 files present, all60 old release files byte-identical and protected10 configs unchanged. Current producer/delivery/readonly Node43 checks PASS; current app type check and owned lint0errors PASS. Main common2903/173 and separate readonly leaf477/31unit+8native are active; no provisional score or physical-client success is claimed.


12:20UTC correction/current-source update: unchanged envelope codec whole1139/fixed83 is independently accepted at973Killed/7Timeout/159Survived86.0404%, threshold80. All9814 packet hashes and supplemental failed-test identities verified; all973 kills are actual named failures,159 survivors run the same83 file+testID identities. Seven explicit scanner progress failures retain raw Timeout status, with21 observed command/case PIDs absent. No physical fork-exit JSON was recorded; this limitation remains explicit. Only the new independent positive archive test was integrated; the original codec sources are unchanged. See S3/envelope-current-1139-83. Original targeted83 pass, current app types and owned lint0errors pass.

The bridge20/18unit+22native raw16K4S80% is REJECTED because2 and14 were Playwright whole-case35s timeouts, not bounded action assertions. The earlier preliminary numerical-passing commentary is superseded by this independent rejection; no rollout occurred. Raw report is preserved unchanged under S3/browser-runtime-editor-20-22-rejected. Fresh same20/22 strict proof is prepared with an explicit card-readiness assertion and rejection of whole-case timeouts. The old649 partial is also independently rejected/unscored for3 detached listener errors with zero failed testcase identities;552 source/proof paths restored and owned workers drained. No accepted gate uses those results.

Fresh unchanged model e316 whole649 now runs fixed35 actual unit cases in ordered1+34 commands, followed by all6 affected native cases for every unit-pass, same80 threshold. Every old18unit/5native case remains. The first public callback test observes actual supplied native AbortSignal callback failures as a named assertion; exact90/94/121 now fail one real case and drain cleanly. Node file/global-only errors and native whole-case timeouts reject the proof. No source edit or score/denominator adjustment was used. The default BrowserEditorApp remains legacy and registered ingress is inactive.


13:48UTC verification correction: hidden Rstest body timeouts were discovered inside nominal Killed results. Prior Entry568/133 (17 IDs), facade1268/137 (23 IDs), default browser45 (3 IDs), export243 (29 IDs), guard74 (6 IDs) and readonlyRuntime136 (5 IDs) acceptance is SUSPENDED. Their raw reports/statuses/scores remain unchanged and are not release evidence. A test-body timeout with failedTests1 is not automatically a qualified behavioral failure. New runners reject this subtype; test-only bounded public-completion assertions and fixture gate cleanup are being qualified before fresh whole-file runs. Source files are unchanged. Complete envelope1139/83, helper623/33, browser snapshot583/67, admission171/53 and feasibility41/10 were independently scanned without that subtype. Native whole-case timeouts remain separately rejected.

Bridge20 now runs a fresh strict18unit+23native corpus after all positive/negative controls, including actual source/local-selector/worker/build controls. New real UI tests cover partial corruption and held export/download. The model649/35unit+6native finished below80 (439Killed/210Survived67.64) and also contains six unqualified invocations; it is not accepted. Stronger51unit/7native corpus is prepared separately, with no score adjustment. Current default Web production build b108e21f1a77803b was produced only in an isolated clone; original60 dist files/user preview remain untouched. Registered browser ingress remains OFF. Full final browser/PWA/device acceptance is still open; no deletion, commit, deployment or upload occurred.


13:53UTC fresh corrections completed: default browser host e7b7 whole45 with fixed29 cases has43Killed/2Survived95.5556%, PASS80 after explicit public-completion assertions and strict body-timeout rejection; all46 formal invocations and actual host module observations audited, source restored. This supersedes only the suspended earlier45 proof, not its raw records (S1/browser-default-current-45-bounded).

Bridge ff8b freshwhole20/fixed18unit+23native has16Killed/4Survived80%, PASS80. All797 protected source/corpus/proof paths restore exactly, actual local-selector membership and four loaded modules verified, no Node bodytimeout/native whole-case timeout/infrastructure issue. All baseline/survivors retain the identical23 identities (S3/browser-runtime-editor-current-20-23). Fresh facade1268/fixed137 is now running after all23 formerly hidden cases become actual named public-completion assertion failures and source/localID/worker/build/global-error controls reject correctly. Other suspended scopes remain open; no broad score correction or rollout is inferred.


14:13UTC current Web/PWA correction: isolated full336 Web run has335 passes +1 ROTATION-DOME-05 failure (not a pass). New default-Web wire download03T passes with exact source preservation. Unchanged production b108e21f1a77803b PWA10 passes in a separate serial run. Original rotation repeat3 reproduces2passes/1failure; instrumented observation8passes is partial only. Independent source review identifies a likely deferred resize/insets/camera-fit window: raw CDP contact bypasses stable-element actionability. Candidate test-only explicit stable-element wait + actual hit-band assertion preserves the same scenario and all existing geometry/save/layout assertions; product3D is unchanged, repeated candidate/full rerun pending. Raw failures and traces retained. Isolated Telegram production build cd43be41b9f9e51b succeeds without deploying; source/build inventories are under S7/build-comparison-v3.


17:40UTC consolidated local verification update: [current-source status](../docs/progress/telegram-extension-2026-11-04/current-status.md) is the authoritative latest result index; earlier chronological failures remain unchanged. Whole current Web336/PWA10 pass in isolated b108e21f1a77803b; the original ccdd13662cdca379 preview and60 files are unchanged. Rotation-DOME05 required a test-only actual stable-element/hit-band readiness assertion after a reproduced existing timing window; all original scenario assertions remain, six repeated cases and the full336 pass. No 3D production change was made. Current signed entry22, runtimeUI58, browser readonly7, TMA readonly66, browserregistered21, admission39, ordinary native128 and catalogue9 pass. The separate actual-subject expanded173 passes200 module observations using nine explicitly recorded isolated test-import rebindings; ordinary128 and its CI entry remain intact.

Fresh independently audited gates now replace only their own suspended snapshots: facade1268/137 1059K/0T/209S83.5174%; entry declared568/139 482K/0T/86S84.8592%; readonlyRuntime136/21 118K/0T/18S86.7647%; outer320/109 270K/0T/50S84.375%; controller changed guard74/32 100%; export243/51 232K/0T/11S95.4733%; File155/8 145K/0T/10S93.5484%; presentation99/55 and separate localGLB38/6 and38/7 100%. Default45/29 and bridge20/18+23 remain independently accepted. Each raw report, fixed inventory, exact source identity, actual failure identities, canaries, worker ownership and restoration are retained separately; no combined or adjusted score is used. Exact facade1253 callback/public-disposal attribution and outer source-error fixtures have separately calibrated negative controls. Earlier rejected compiler/body-timeout/whole-case-timeout reports are not accepted evidence.

Whole integrated224files/3356tests PASS, app/domain/Telegram types PASS, lint0errors, architecture15 controls plus actual import analysis PASS. New native report parser refusal for unsupported process exits follows a real RED→GREEN synthetic control;23 parser/fixture/loader controls pass. Read-only Fallow health is advisory: configured project boundary checks, not Fallow’s unconfigured policy, establish the import gate. All547 original paths,60 original delivery files and10 protected configs are preserved. Matched old/current gesture observation and actual delivered asset inventory are recorded without a physical/FPS claim. Whole-directory sizes include retained old files and are not presented as active payload reduction.

Remaining local gates: common2903/173 including two still-unproven outer timeouts458/468; bootstrap535/29+70; model649/51+7; browser provider287/124+native, reader783/private-factory/key lookup; Telegram reader662/helper618/26+66; leaf477/36+8; strict raw-source UI122/23 and metadata350/145. Prior UI122 and metadata350 numerical passes are suspended for Playwright whole-case timeouts. Registered browser ingress stays OFF. Real bot/stable distinct HTTPS, physical iOS/Android acceptance and actual external file reselect are still pending owner inputs. No commit, staging, deployment, upload, cloud sync, deletion or original delivery/data clearing occurred.


18:00UTC browser model whole649/fixed51unit+7ChromiumUI has independently accepted524Killed/0Timeout/125Survived80.739599%, threshold80. All650 formal calls,60540 actual unit/four-module observations and4156 native/four-module observations are audited; same51/7 identities on every survivor, no body/hook/compiler/reporter/whole-case-timeout error,798 protected paths restored. Native UI-port-double cases remain distinct from actual existing-only mounted7 storage proof. Exact217 callback+named-state failure is retained with calibrated global/foreign controls. Lossless20670-file formal/control archive and source/corpus closure are recorded in S3/browser-model649-51-7-current-final. Previous whole35-case failure/rejected partials stay unchanged. Browser registered ingress remains inactive pending backend gates.

SourceUI122 strict preflight now passes all23 actual case identities, source/localID/worker/missing-asset controls and actual formerly unproven5/17/23/26/29 failures as bounded action failures, not whole-test timeouts. Full unchanged122/all23/80 has started; no final score yet. Native slot count remains3 (sourceUI122, common2903, metadata535). Additional19 genuine native publication scenarios have six guarded new paths integrated after813+19 packet hashes and8 source contexts, passing original scoped types/lint; native baseline/qualification remains UNRUN.


18:30UTC fresh declared raw-source state-logic range126:0–236:1/full122/fixed23 Chromium cases independently PASS80:110Killed/0Timeout/12Survived90.163934%. All123 formal invocations,1016 actual loaded module/selector observations and exact23 survivor identities audited. Official instrumented payload reconstructed as797b7832; current productionf903 unchanged,808 protected paths/four sibling assets restored, child CLOSE/worker/profile/outer-PGID terminal ownership empty. Five bounded locator action failures remain separately labelled, no whole-test/body/hook/compiler/reporter timeout is accepted. Older raw122 stays suspended, not relabelled. No aggregate formatter/UI score or physical Telegram acceptance is inferred. Original source UI test/config remain unchanged; isolated proof-only wrappers/policies/context are archived separately.

Common prior173 attempt safely stopped/rejected/unscored:1007 started,1004 qualified distinct (688 named failures,316 complete173 passes), two unproven outer timeouts458/468 and interrupted1006.768 paths restored/owned0, no final mutation report or score. Lossless223MiB raw record/trace archive and separately retained derivative index recorded. New CPU33 screen316 produces11 genuine failures/305 all33clean/0invalid; no adjusted score. Native2 baseline/instrumented-off/causal880+1185 and negative source/selector controls qualify; Native19 baseline passes, separate20th public foreign-creation854 follow-up baseline passes. Native10 prepared22-hash packet integrated6 guarded paths/types/lintPASS and now qualifies in a separate clone. FreshCore2903 waits fixed qualified expanded public oracles.

Metadata535 prior29+70 attempt rejected/stopped at actual378 whole-case timeout, source/context restored. Actual cause: emptied onversionchange callback leaked a connection while old test awaited deleteDatabase before observing public refusal. A new snapshot preserves70 Native identities/all150 prior assertions, adds causal event/refusal ordering and generic tagged bounds for163 expected public evaluates plus handled held promises/context cleanup; uninstrumented70 qualification is active. No production source or old raw status change, no fresh535 score yet. Reader662/618 v6 likewise prepares26/66 bounded operations, exact identities and physical terminal checks before its next full scopes.

### 2026-11-05 20:07 UTC — additive public oracle qualifications

Root independently verified and integrated CPU35 mixed-pin admission controls and Telegram metadata denial-only prefix17v3. The latter retains full350 inventory without a score,290 CPU-clean selectors requiring Native145,60 genuine named public failures and0infrastructure invalid; all24,439 packet hashes and11,900 observations audited. Normal integrated2/17 cases pass. No production source/schema/dependency changes. Separate new32 screening316 completed87/229 with0invalid; fresh whole Core scope remains pending. Default browser activation is only an isolated34-case candidate with qualified control failures and a fresh whole87 run in progress. Original entry stays e7b7/ingressOFF until localAD31 gates. Current release/physical status remains not ready.

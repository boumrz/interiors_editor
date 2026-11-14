# Current-proof mutation survivor triage

Embedded source: `src/adapters/persistence/telegram-project-repository.ts`; SHA-256 `3de9be0c53d9df610412655cb3c5fd854bd4142158c97f12e8f678695c31e1bf`.

All 99 survivors accounted for: {'A': 82, 'B': 10, 'C': 7}. No new P0/P1 confirmed; A means missing evidence against a mutant, not a bug in the original code.

Root's newer whole-Project/readable guards and 69-pass corpus are newer than this frozen 296-mutant source. No fresh combined mutation score is claimed.

## A: local-fence-disappeared-before-first-publish — IDs 22, 23

Removing the combined guard permits token 1 to be reissued when only this runtime's remembered lease exists; the persisted Project/Revision claim guards have nothing to inspect.

Proposed vector: Acquire p1 before any publication; delete only writer-fences[p1] via native IDB; inspect/access and explicit takeover from the same repository must refuse, leave metadata counter/fence/stores unchanged.

Bounds: Existing TMA-PROJECT-06 retains a durable Revision, so the later claim scan masks these mutants.

## B: pointer-guard-dominated — IDs 24

A persisted pointer can reach this branch only after a complete current proof; that proof requires an owned Revision. The unchanged revisions claim scan rejects a missing fence.

Bounds: Bounded to one single mutant, unchanged verifiedCurrentUnderLock/assertCurrentProof and the unchanged revisions scan. Malformed/missing current Revision already throws before this branch; not global equivalence.

## A: valid-orphan-claims — IDs 27, 32, 34

The pin-only orphan tests are caught by assertProjectJournals even after this scan disappears. Valid-shaped historical Revision or published/no-publish journal claims without a pointer are not rejected by that later routine.

Proposed vector: After a healthy publication, atomically remove only projects[p1] and writer-fences[p1], retain Revision and exact published receipt; use a fresh owner for access and explicit takeover and require not-ready with all surviving rows/counter unchanged. Separately table-case Revision-only and published/no-publish-attempt-only claims.

Bounds: Do not discard roots or recreate a fence as part of the test setup. TMA-PROJECT-09 is a pin-only, structurally incomplete orphan and cannot isolate this scan.

## A: lost-writer-before-observation — IDs 37, 43

A previously owning runtime can otherwise reacquire after an intervening takeover expires without first observing the foreign active lease. Flipping !explicitTakeover also wrongly blocks an explicit recovery by a stale local owner.

Proposed vector: A acquires token 1; B explicitly takes token 2; expire B without A inspecting in between; A ordinary access must stay read-only. A explicit takeover must then succeed with a higher token.

Bounds: TMA-PROJECT-08 observes the foreign writer first and sets the persistent takeover-required marker, masking the local-previous guard.

## A: same-owner-new-fence-generation — IDs 45, 48

The old local fencing token must be rejected even if the persisted owner string is equal. An owner match cannot authorize a different generation.

Proposed vector: Two repository instances deliberately receive the same nonempty ownerId: A acquires token 1, B explicitly takes token 2, A ordinary access must refuse. Keep B current healthy data/roots unchanged.

Bounds: This is an API collision/reused-owner negative vector, not a claim that production random UUIDs routinely collide. The constructor does not enforce global ownerId uniqueness.

## A: owner-only-fence-corruption — IDs 46

The remembered lease compares the full owner/token pair. A valid-shaped persisted owner-only replacement would be silently reacquired after expiry if this predicate disappeared.

Proposed vector: A acquires token 1; native IDB changes only stored ownerId to a different nonempty string and makes the lease expired; A access must refuse, leaving that exact row unchanged.

Bounds: Requires deliberate native corruption, not a conforming takeover: conforming takeover increments the token as well. Do not claim this is an ordinary writer transition.

## A: unknown-pin-schema — IDs 62

Dropping isPreparedLease can interpret a pin with an unregistered extra field or wrong scope while all fields consumed below still match a valid attempt.

Proposed vector: Prepare a resource publication; add one unknown own field to its pin row (or wrong scope), preserving its key and all referenced roots. access/takeover must quarantine without fence/counter/row changes.

Bounds: Existing orphan-only test lacks an attempt; it fails later regardless of pin shape.

## C: private-error-text — IDs 63, 99, 111, 136, 158, 193, 199

Only an internal Error message changes. Public methods map these errors to the same declared result/reason, and persistent state decisions are unchanged.

Bounds: Bounded to these exact private strings and their present catches. Do not add assertions against exception wording or broaden to no-publish state literals.

## A: pin-attempt-identity — IDs 65, 67, 68

An unconditional/OR find predicate can choose a valid attempt with a different attemptId. Subsequent pin checks compare lease/project/revision/hashes but do not recompare attemptId.

Proposed vector: Prepare one valid resource attempt, change only pin.attemptId to a different well-formed absent attempt ID; keep pin.leaseId, project/revision/hashes and the actual attempt unchanged. access/takeover must refuse and preserve every row.

Bounds: A missing attempt with no alternative journal cannot isolate these mutants; selecting the unrelated valid journal is necessary.

## A: pin-no-publish-contradiction — IDs 72, 73, 74, 75, 76, 77, 78, 79, 80, 82, 84

Each mutation can remove or weaken the no-publish/identity prefix while the existing resource hash relation remains true. A surviving pin must not be interpreted as a live prepared/published root for a no-publish attempt.

Proposed vector: Prepare a resource attempt, preserve its pin/resources, make its matching journal valid no-publish with no receipt and remove its owned stage/Revision as cancellation would. Existing fence remains. access/takeover/publication must quarantine without cleanup or fence renewal.

Bounds: 84 changes a semantic state literal, not diagnostic text. Keep the journal shape valid so isAttempt and the later journal loop do not mask the missing pin-state guard.

## A: pin-lease-id-mismatch — IDs 85

A pin can point to the correct attempt ID but a different lease ID; no later journal check compares that pin relation.

Proposed vector: Move the pin to a new well-formed leaseId key and remove its old key, keeping pin.attemptId/project/revision/hashes equal; leave actual attempt.leaseId unchanged. access/takeover must refuse and preserve roots.

Bounds: Changing only data while retaining a different inline IDB key is not a valid native setup; use delete+put under the new inline key.

## B: project-record-filter — IDs 87

Both attempts and pins come from projectRecords(store, projectId), which only returns records whose string projectId equals the requested project. find does not select outside that filtered array.

Bounds: Bounded to the unchanged projectRecords filters; the check remains valuable defensive documentation and is not globally redundant for arbitrary arrays.

## A: pin-revision-id-mismatch — IDs 89

A valid pin with the matching attempt/lease/project/hashes can independently have a wrong revisionId.

Proposed vector: Change only pin.revisionId to another string; access/takeover must refuse without modifying the pin, journal, resource roots, or fence.

Bounds: The current orphan case has no journal and therefore does not isolate this relation.

## A: pin-hash-subset-missing-member — IDs 92, 96

some instead of every, or an always-true manifest comparison, accepts a pin containing both one legitimate hash and one absent hash.

Proposed vector: Prepared pin.resourceHashes contains two unique valid SHA strings; exactly one is absent from its attempt manifest. Require access/takeover refusal and exact unchanged records.

Bounds: Use at least two pin hashes so every→some is observably weaker; a single unsupported hash can be rejected by both predicates.

## A: valid-multiple-resources — IDs 94

Replacing the inner some with every rejects a healthy manifest with two different resources. The existing resource corpus predominantly prepares one resource.

Proposed vector: Prepare an actual two-resource candidate/pin with exact distinct bytes; renew access while that preparation exists, then complete publication/reopen. Assert writable and both exact resources retained.

Bounds: This is a positive compatibility vector; it must not relax hash/size/root checks.

## A: pointer-closed-metadata — IDs 118, 119, 120, 121, 122, 123, 124, 125, 127, 129

These changes can admit a pointer with extra own fields or a mismatched scope while the exact healthy current Revision/receipt remain unchanged. Readability validates the Project, not this pointer metadata.

Proposed vector: Table-case only projects[p1] changes: one unknown extra own field, wrong scope, and an array-with-the-four-own-fields if useful. load must be recovery-needed; access/takeover/publish must refuse; exact records remain.

Bounds: For 123 choose extra field with correct scope, or wrong scope with the original key count; avoid changing multiple rejecting fields so each guard remains isolated.

## B: native-inline-project-key — IDs 131

projects has inline keyPath projectId. A native get(projectId) returns a row whose projectId is the queried key; delete+put with a different projectId changes its lookup key.

Bounds: Bounded to the native IDB schema and string API input. Do not fake an impossible key/data mismatch by replacing an IDB response.

## B: current-revision-type-dominated — IDs 133

If pointer.currentRevisionId is non-string, isV1Candidate requires the candidate Revision ID to be a string and the unchanged equality at line 1667 requires it to equal that pointer ID; invalid IDB keys throw safely.

Bounds: Bounded to current-proof admission; this does NOT apply to readRecoveryRow, which intentionally accepts unknown candidate shapes (see 265).

## A: current-revision-owned-metadata — IDs 139, 140

These broad changes skip exactRevision ownership when a row has an extra own field, wrong scope, or mismatched non-key project metadata while its embedded candidate is healthy.

Proposed vector: Change only the current Revision row by adding one unknown own field, preserving candidate and exact creation receipt; require load recovery and no writer/publication changes.

Bounds: Use a valid candidate so readable cannot mask metadata admission.

## A: pointer-name-binding — IDs 141, 142, 155

The modified predicates can allow pointer.name to differ from candidate.project.name while every candidate/Revision/receipt ownership relation is otherwise valid.

Proposed vector: Change only projects[p1].name; load must be recovery-needed, and writer access/takeover/publication must refuse without rewriting the name or fence.

Bounds: For 141/142 this isolates a relation removed by the larger mutation; actual Project name, serializedProject and SHA stay unchanged.

## A: coordinated-cross-project-proof — IDs 143, 144, 145, 146, 151

Removing the candidate→requested Project binding can accept an internally healthy foreign candidate if an untrusted creation journal metadata field is coherently relabelled to the requested Project. exactRevision only binds row metadata to its own embedded candidate.

Proposed vector: Publish p1/r1 and p2/r2. Point p1 at r2 and match p1 pointer name to p2. Change only r2 creation-journal projectId to p1, preserving its checksum/serializedProject/manifest/receipt. Loading p1 must refuse; p2 raw rows and all counters/fences must remain unchanged.

Bounds: This is an explicit coordinated native-corruption vector, not an ordinary valid publication. With an untouched foreign receipt the later creation.projectId check would mask these mutants.

## B: candidate-shape-dominated — IDs 147, 148

Only the record/isV1Candidate prefix disappears; unchanged ownership/name/exactRevision checks and verifiedCurrentUnderLock.readable still perform structural V1 validation before any accepted load/write. Invalid dereferences are caught as recovery-needed/not-ready.

Bounds: Bounded to current-proof callers all going through verifiedCurrentUnderLock; this is not evidence that raw staged candidates may skip validation.

## B: native-current-revision-key — IDs 153

The native revisions inline keyPath revisionId equals the lookup pointer.currentRevisionId. exactRevision additionally requires row.revisionId===candidate.revision.revisionId, so their unchanged conjunction implies this predicate.

Bounds: Bounded to unchanged exactRevision and native keyed lookup. Other exactRevision mutations are independent mutants, not simultaneously active.

## B: native-creation-attempt-key — IDs 178

The receipt is fetched by revisions.creationAttemptId from publication-attempts, whose inline keyPath is attemptId; an existing native row therefore has that same attemptId.

Bounds: A non-string/missing key either fails isAttempt or the native request. No impossible IDB key/value replacement should be fabricated.

## A: creation-project-binding — IDs 180

A valid-shaped exact self-receipt can carry a wrong projectId while the current candidate and Revision are correctly owned.

Proposed vector: Change only current creation journal projectId to another string; keep receipt, checksum, serializedProject and manifest exact. load/access/takeover must quarantine and preserve original records.

Bounds: The journal key is attemptId, so this wrong projectId is representable natively.

## A: creation-revision-binding — IDs 182

hasReceipt verifies the receipt against the journal itself, not against the current pointer.

Proposed vector: Change creation.revisionId and receipt.revisionId together to the same wrong string, keeping other fields untouched. Require quarantine without mutation.

Bounds: Changing the journal field alone is masked by hasReceipt; the two fields must be coherent.

## A: creation-must-be-mutation — IDs 184

A published history receipt is not the Revision creation receipt, even when its candidate checksum/manifest are equal.

Proposed vector: Change only current creation journal intent from mutation to history; isAttempt and hasReceipt remain valid. load/access/takeover must refuse.

Bounds: Do not reject healthy history navigation; only the Revision's original creation ownership is under test.

## A: creation-checksum-binding — IDs 188

An exact self-receipt with a different checksum is not a receipt for the healthy candidate being loaded.

Proposed vector: Change creation.checksum and receipt.checksum together, leave actual candidate/checksum healthy. Require recovery/not-ready and no changes.

Bounds: The existing wrong-digest case changes candidate AND receipt consistently and is caught by real SHA; it does not isolate this binding.

## A: creation-serialization-binding — IDs 190

The journal serializedProject can differ while its self-receipt and the current candidate SHA are independently valid.

Proposed vector: Change only creation.serializedProject to a different string; keep candidate/checksum/receipt/manifest exact. Require recovery/not-ready with unchanged data.

Bounds: The receipt does not contain serializedProject, so hasReceipt cannot dominate this relation.

## A: proof-to-write-snapshot-race — IDs 195, 198

The complete proof is read and hashed outside the write transaction. Without this recheck a coherent current pointer/Revision/receipt replacement during that awaited SHA can be followed by a new writer fence or publication based on an unverified snapshot.

Proposed vector: Use a one-shot checksum port callback: after the old current proof is captured and before its SHA resolves, native-IDB replace current candidate+creation with a self-consistent but invalid actual digest (or another valid-shaped unreadable Project). Return the old snapshot SHA. Writer access/takeover must refuse and not renew fence/reserve new publication IDs.

Bounds: Mutation must occur outside the strict IDB transaction, during the awaited checksum, and bypass the conforming WebLock intentionally. Merely changing pointer to another already-proved healthy historical Revision is weaker evidence.

## A: recovery-source-project-id-type — IDs 221

readRecoveryRow deliberately accepts unknown candidate shapes and only checks equality of ownership IDs. If the listing key type guard disappears, a native numeric inline Project ID can escape the declared string result.

Proposed vector: Seed one unknown-source Project keyed by numeric projectId plus a matching numeric-owned Revision/candidate, with a string current Revision ID and serializedProject; listRecoverySources must skip it and preserve other valid unverified sources.

Bounds: This is a read-only API-shape negative vector, not a write/data-loss finding. Use native numeric IDB keys, not cast fake responses.

## A: recovery-list-missing-row — IDs 227

Dropping !row can dereference row.revisionId after a missing Revision and reject the entire recovery listing, hiding another valid unverified source.

Proposed vector: Keep p1 pointer but delete its Revision, and keep a separate p2 future/unsupported Revision source. listRecoverySources must return only p2, not throw, and every durable row must remain unchanged.

Bounds: Current TMA-PROJECT-10 explicitly omits recoverySources assertion for missing-revision, leaving this case uncovered.

## A: recovery-pointer-scope — IDs 257, 258, 259, 261

These changes can export a source behind a pointer declaring a different scope while its Revision row otherwise has the active scope.

Proposed vector: Change only pointer.scope on a future/unsupported source; listRecoverySources/readRecoverySource must not expose it. Keep a second valid source to prove independent availability and unchanged data.

Bounds: Read-only rejection and writer admission are distinct; the current-proof checks do not execute before raw source row selection.

## B: native-recovery-project-key — IDs 263

readRecoveryRow fetches an inline projectId-keyed Project by exactly projectId; native returned pointer.projectId equals that key.

Bounds: Bounded to the native schema. Numeric key handling remains covered separately by the listing guard 221.

## A: recovery-source-revision-id-type — IDs 265

Unlike current-proof validation, readRecoveryRow has no V1 type guard. A numeric pointer Revision ID with a native numeric Revision key and matching unknown candidate IDs can otherwise escape as a declared string revisionId.

Proposed vector: Seed an unknown source with string projectId, numeric currentRevisionId and matching numeric Revision/candidate IDs, and string serializedProject. readRecoverySource/list must not expose it; keep valid sources available.

Bounds: This does not justify decoding or normalizing unknown source bytes.

## A: exact-revision-closed-metadata — IDs 270, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285

Each broad/prefix change bypasses closed metadata when candidate/manifest are exact; an extra own field is representable natively and must remain uninterpreted.

Proposed vector: Add one extra own field only to a healthy current Revision row; require load recovery and writer refusal. Also table-case an existing history root with extra metadata before history publication/repair to retain the non-current callsite contract.

Bounds: All exactRevision callsites were inspected: history prepare, atomic commit, takeover reconcile, pin cancellation, repair roots, current proof. Current shape guards do not replace row ownership checks.

## A: exact-revision-scope — IDs 287

Embedded Project readability does not validate the surrounding Revision row.scope.

Proposed vector: Change only current Revision row.scope; keep candidate and receipt healthy. Require quarantine and no writes.

Bounds: This non-key metadata can differ in native IDB.

## A: exact-revision-project-owner — IDs 289

Revision keyPath is revisionId, so its projectId ownership metadata can be changed independently of a healthy embedded candidate.

Proposed vector: Change only current Revision row.projectId; keep candidate and receipt healthy. Require quarantine and no writer/publication changes.

Bounds: Do not alter embedded candidate.projectId; that would be masked by other ownership guards.

## B: native-revision-id-key-at-all-callers — IDs 291

Every exactRevision caller fetches revisions by the expected Revision ID. In current proof the candidate ID is separately tied to pointer; reconcile/cancellation separately tie candidate/row IDs to attempt; history, commit, repair fetch by the supplied candidate ID. Native inline revisionId therefore supplies this equality.

Bounds: Bounded to the six present callsite families and unchanged neighbouring guards, not globally equivalent for arbitrary objects or a future detached validator.

## A: prepared-revision-creation-type — IDs 293

Current loads/history/repair have later receipt/type guards, but atomic commit only relies on exactRevision for creationAttemptId type. A changed prepared Revision can otherwise be published and immediately become unreadable.

Proposed vector: Prepare a resource-backed first publication, then before final pointer commit change only prepared revisions[r1].creationAttemptId to a numeric value via native IDB. Keep exact stage/candidate/manifest and active lease; final publication must fail and preserve pointer/receipt absence and roots.

Bounds: Use an explicit prepared phase or a checksum/verification hook so the mutation precedes commit without replacing IDB responses. Ordinary load alone is masked by creation isAttempt.

# Independent read-only current-proof admission audit

Original reviewed source: `apps/web/src/adapters/persistence/telegram-project-repository.ts`, SHA256 `538a444a075fd3dcaaac09da0520d98d285756f783685205d95ec4b604b8d7e6`. No original edits or test/process actions. These are statically confirmed control-flow gaps, not an executed native RED claim. Root subsequently added native vectors in `tests/browser/telegram-project-e2e.check.ts` and owns fixes.

## Current pointer / Revision / creation receipt

`loadProject`1558–1606 reads only projects and revisions, validates candidate shape/hash, but does not validate RevisionRecord.creationAttemptId, exactRevision metadata or the exact published mutation-creation receipt. Deleting the creation attempt entirely still permits durable/healthy load and card display. Corrupting only revision.creationAttemptId is also ignored. Removing a receipt field from an existing published journal already blocks writer admission through assertProjectJournals, but load still shows healthy; these cases must not be conflated.

`acquireUnderLock`507–580 validates writer policy and journals but not current Revision proof. For an existing fence, missing/corrupt current Revision can still obtain writable renew. A deleted whole creation journal leaves0attempts/stages and bypasses assertProjectJournals583–638. New mutation only CAS-checks base pointer, so corruption introduced after a healthy Project was opened can be followed by a new publication from its in-memory candidate without discovering the missing base proof.

Native negative vectors: create healthy Project then independently delete current Revision, delete complete creation journal, change candidate bytes without hash, or change creationAttemptId. Verify load/list recovery-needed and non-writable admission; readonly queries preserve rows. Nonexplicit renew should validate before writer.put. Explicit takeover fencing advance may itself be safely permitted, but it must not return writable or publish against inconclusive current proof; preserve ambiguous bytes. Do not assume any fence advance itself constitutes data loss.

## Pin-staging-only orphan with existing fence

The missing-fence branch531–544 checks claims in pin-staging-leases; the existing-fence branch does not. assertProjectJournals inventories only attempts and staging. reconcileProjectUnderLock678–855 iterates attempts only. A genuine prepared resource publication followed by loss of attempt+stage+candidate Revision, while its pin lease/resources/fence remain, therefore passes writable inspection and takeover. With no Project pointer, load even returns empty. This is an admission/quarantine gap; no physical byte deletion or GC behavior is alleged.

Native negative vector: begin genuine pins and write resource, fault-remove its attempt/stage/Revision, leave pin lease/resources and existing valid fence. Inspect/renew/takeover and fresh publication must not treat this as clean writable state; unknown roots remain preserved. Root added `leavePinRootsWithFence` fixture for this exact generated-state vector.

A common exact current-proof snapshot and transactional recheck can serve load, renew/takeover and publication admission. Perform expensive hash validation outside a native IDB transaction, then compare exact pointer/Revision/receipt snapshots inside the writer/publication transaction; do not introduce WebCrypto awaits into an unkept transaction. Root owns the final design and implementation.

## Root remediation followup

A second independent read-only reviewer inspected newer original source SHA256 `fbc7ed97bc9a75a57fd3103665d35347559e71336b564782ded0977c11c73b71` without Stryker markers. No new P0/P1 was confirmed. Root added readCurrentProof/verifiedCurrentUnderLock before acquire, assertCurrentProof in the write transaction, and pin inventory before writer.put. Earlier findings above describe the previous SHA only. No review-owner native execution is claimed for the remediation. Two useful remaining native vectors were sent to root: explicit takeover under each current-proof corruption mode; and consistent replacement of revision/creation/receipt checksum with the same wrong digest while all exact bindings and canonical serialization remain intact, to force the asynchronous SHA check rather than an earlier structural mismatch. Root owns execution and acceptance.

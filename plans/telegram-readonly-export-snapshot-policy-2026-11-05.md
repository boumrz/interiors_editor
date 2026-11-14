# Implementation note: Telegram read-only export admission

Status: local implementation under verification; no release/activation waiver. This note applies TMA04/TMA11/TMA16 and existing readable-release, local storage, backup/recovery and scoped-lifetime rules. It adds no writable schema or general ProjectV2 migration. Stable CAP/FR/NFR/AD ownership remains with the approved planning artifacts.

## Separate capabilities

The existing writable permit and controller are unchanged. A separate opaque readable permit requires the actual Telegram delivery target, loaded entry path, valid copied ReleaseManifest, secure IndexedDB capability, readable Project/asset/catalogV1 and the exact controlling-worker pair when a worker exists. Absence of a Telegram worker is normal; unavailable worker metadata is not equivalent to no worker. Signed launch still supplies the verified account scope before constructing any source. A readable permit grants neither a writer nor rendering capability.

The source constructor is inert. It opens only an existing scope database without specifying an upgrade version; a version0 creation attempt is aborted. Actual physical database version2, store key paths/index inventory, exact scope metadata and the monotonic uint64 reservation counter are checked through native readonly transactions. Unexpected schema, identity loss/counter regression or known database loss permanently revoke that reader generation. No owner UUID, ID reservation, write transaction, writer fence, pin root, migration, reconciliation, GC or preferences store is exposed by this source.

## Explicit read coordination

Default `scoped-lock` keeps the exact common scoped storage lock and does not silently fall back when that lock is held, unavailable or times out. When the host has no callable Locks API, trusted production composition explicitly selects `native-readonly-snapshot`. This profile never observes or requests the lock port. The serial runtime queue and native transaction semantics remain in force.

In the explicit native profile, one native readonly transaction captures the Project pointer, its exact Revision, creation receipt and every referenced resource Blob row. The owned immutable snapshot is validated outside that transaction: exact current identities, canonical/domain/wire grammar, checksum, dense manifests/root arrays, original resource keys/metadata/bytes and the real common offline smoke/archive writer. Returned Blobs are owned snapshot values; network/cache is not a backup resource source. A final native readonly transaction rechecks the complete current pointer/Revision/creation proof before an encoded archive is delivered. Concurrent deletion, publication or metadata change must refuse that stale delivery. This does not acquire writer ownership or promise an ongoing live view after the final compare-and-swap boundary.

The unverified-source path is separate. It binds the exact Project/current-Revision/raw source in a native snapshot, preserves the original JS string (including lone UTF16 code units), and labels its file `.interiors-source.json`. It is not a complete Portable Backup or an automatic repair.

## Lifetime and delivery

The readonly runtime rechecks actual shell/capabilities/worker admission before and after each source operation. Revocation synchronously aborts its signal, closes the UI file session, refuses later reads and drops late results. Composition drains the old runtime before admitting a replacement scope. Every started native readonly transaction is awaited through complete/abort. An unfired native IDB open request cannot be physically cancelled: bounded logical abandonment retains its late abort/close handlers and never exposes a late handle or result. This limit is recorded rather than claiming native cancellation that the platform does not provide.

The screen exposes validated names, exact-revision full-backup preparation and explicit unverified source selection. It has no create/import/edit/delete/repair/takeover controls. File preparation is asynchronous and a separate fresh user gesture is required for system handoff. A resolved share/download promise does not prove external file preservation. Retry/Exit callbacks are fenced by the composition's private current-runtime identity, including when the current reader is aborted; a prior generation cannot restart or exit its replacement.

## Verification boundary

Current preliminary reader sources are1e6f3177/e44a024c; default/no-lock constructor, unavailable lock getter and dense root metadata regressions pass17 unit cases. The separately accepted readable permit100 and readonly runtime136 gates do not prove native archive correctness. Current full reader native43/mutation, actual mounted readonly entry, native layout/contrast and full leaf mutation remain pending. Independent source review found no confirmed safetyP1; native concurrent writer/full-proof CAS, raw sparse CAS, absent v0, counter/identity loss and abort/drain vectors are required before acceptance. The unchanged shared repository74ff is not silently replaced by this note.


Verification update2026-11-05: the exact1e6f3177/e44a024c reader completed43 actual native cases (86 actual source/local-ID observations); mounted signed entry readonly3 and leaf UI8 also passed in separate scopes. Reader whole-file gates662 and618 and leaf whole477 composite remain pending. Shared repository has since received the independently reproduced dense metadata fix74ff013b→0d61a438; old130 native cases and three new sparse metadata vectors pass, but complete current2903 gate is still required. These facts supersede the earlier paragraph's pending-native status, without granting release approval or claiming physical OS-save proof.

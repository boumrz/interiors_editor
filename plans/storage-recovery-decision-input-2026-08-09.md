---
title: Storage and Recovery Decision Input
date: 2026-08-09
status: pre-canonical-input
target_workflow: bmad-architecture update
---

# Storage and Recovery Decision Input

## Purpose and authority boundary

This is input to a fresh Architecture update for `G-V01-S3`. It does not
select IndexedDB Blob, OPFS or a hybrid substrate; real iOS/Android lifecycle
and quota evidence remains required before an adoption claim.

## Existing characterization only

`apps/web` currently stages a revision, re-reads/checksums it and swaps a
pointer in IndexedDB. This is a useful durable-publication seam, but it is not
yet project-scoped fencing, resource-root safety, migration, backup or recovery
evidence. The current `readCurrent()`/recovery logic selecting the first
pointer/staging record must not be treated as a multi-Project design.

## Decisions required

1. **Resource substrate:** IndexedDB Blob, OPFS, or an explicitly bounded
   hybrid for metadata/revisions, pinned bytes and staging bytes.
2. **Transaction/fence boundary:** how a project-scoped writer token is checked
   in the same publish transaction that stages the revision, updates roots and
   swaps the current pointer.
3. **Root inventory:** current Revision, undo/redo session history, recovery,
   staging and trash roots; exact rule for proven-unreachable GC only.
4. **Migration/update:** copy-on-write schema migration, failed-migration
   readable/exportable state, safe service-worker activation and deferred
   reload after a Durable Revision.
5. **Recovery/backup:** read-only state for missing/corrupt references,
   `RecoveryChangeSet`, explicit history discard, `.interiors` staging/import
   and no-overwrite new Project publication.

## Candidate comparison to validate on physical contexts

| Candidate | Potential advantage | Evidence needed before adoption |
| --- | --- | --- |
| IndexedDB metadata + Blob bytes | One transactional browser substrate and closest fit to existing code | Quota/eviction, large resource, Safari/Home Screen, restart and transaction failure traces |
| OPFS bytes + IndexedDB metadata | File-like byte storage and potentially clearer large-resource handling | Atomic cross-store journal/recovery proof, iOS/Android availability and eviction behavior, backup export/import trace |
| Bounded hybrid | May allow a device-specific resource strategy | A single canonical recovery/fence/root model, explicit capability fallback and proof that no context loses references or revision atomicity |

No candidate may treat origin storage as a backup or make catalog availability a
prerequisite for opening a healthy locally pinned Project.

## Required architecture invariants

- One Project has one fenced writer; other contexts are read-only until explicit
  takeover. A lost/stale writer cannot publish a new Durable Revision.
- Pointer, revision, resource roots and writer fence have a project ID binding;
  no `pointers[0]` or first-staging-record shortcut is valid.
- A failed mutation never becomes a Revision; a rejected command does not
  consume a history/resource root.
- Current + undo + redo resource references remain GC roots. New commands may
  be rejected by retention policy but existing history must not silently break.
- A missing/corrupt referenced resource makes the Project read-only until exact
  repair or one complete atomic recovery; history-only corruption requires
  exact repair or explicit `DiscardSessionHistory`.

## Evidence required after adoption

- Fault/candidate corpus for every write and recovery boundary, including
  stale/in-flight takeover, multi-project pointers, quota and hard-close.
- Versioned old-schema fixtures, failed migration and safe-update cases.
- Hostile `.interiors` corpus: paths, archives, checksums, raw integer lexemes,
  duplicate blobs, cancellation and zero-mm semantic round-trip.
- Real Safari tab/Home Screen and Android tab/standalone kill-relaunch,
  quota/eviction, update and browser↔Home Screen handoff traces.

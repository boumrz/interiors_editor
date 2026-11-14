# Blind Hunter prompt — Custom library resource availability

Invoke the `bmad-review-adversarial-general` skill on this feature-scoped diff.

## Scope

- `apps/web/src/ui/AppShell.tsx`
  - Device-local Custom library resource reads now model `loading`, verified
    `ready`, and `unavailable`.
  - Before a card may preview or enter placement, bytes must pass the existing
    static GLB preflight and SHA-256 equality with its content address.
  - Missing, malformed, or hash-mismatched bytes leave visible metadata but a
    disabled card with explicit re-import guidance.
  - Confirmed exact re-import immediately restores the ready card, with no
    Project/Revision/History mutation.
- `apps/web/tests/browser/project-e2e.spec.ts`
  - `PROJECT-E2E-04F` deletes a library-only resource, validates unavailable
    UX/no preview/no Project revision, exact-reimports it, then tampers valid
    GLB bytes and verifies the hash-mismatch unavailable path.
- Evidence and roadmap now describe this only as a bounded common-library
  behavior, explicitly not Portable Backup or durable Project recovery.

## Constraints

- Existing Project-referenced resources keep the stronger controller-open
  `recovery-needed` flow; do not conflate it with this library-only state.
- Static self-contained GLB remains the accepted `CAP-12` contract. FBX/ZIP
  remains experimental.
- No network fetch, silent asset substitution, library GC policy, full backup,
  or visual redesign is in scope.

Find only concrete regressions caused by this diff. For each, identify the
user-visible consequence, exact path/line, and a minimal corrective direction.

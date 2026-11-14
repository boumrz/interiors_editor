# Edge Case Hunter prompt — Custom library resource availability

Invoke the `bmad-review-edge-case-hunter` skill on this feature-scoped diff.

## Scope

- `apps/web/src/ui/AppShell.tsx`: new Custom-library `loading` / verified
  `ready` / `unavailable` read states and re-import refresh.
- `apps/web/tests/browser/project-e2e.spec.ts`: `PROJECT-E2E-04F` fault and
  recovery coverage.

## Required behavior

1. A card is ready only for bytes whose GLB preflight and SHA-256 address both
   match its library definition.
2. Missing, malformed and hash-mismatched library-only bytes never reach
   preview or placement, never wait forever, and never mutate the Project.
3. Exact re-import reuses library metadata, restores bytes/card readiness, and
   does not create a Project Revision until a separate placement is confirmed.
4. Project-owned resource recovery remains a different, stricter flow.

Walk boundary cases: rapid change/reload, same hash with different definition
IDs, late async reads, storage/hash errors, repeated re-import, stale selected
card, and inaccessible mobile controls. Report only unhandled concrete cases
introduced or exposed by this change, with exact location and impact.

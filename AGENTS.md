# Project Agent Rules

## Current phase

The mobile Telegram Mini App (TMA) on iOS and Android is the only product. Allocate product planning, design, implementation, bug fixes, testing, and release work exclusively to TMA. On 24 November 2026 the product owner confirmed that needed Web/PWA projects had been exported and authorized disabling the old public editor. Preserve existing user data and the archived release required for rollback. Changes to the shared core and legacy-file checks are in scope when needed for TMA behavior, data compatibility, or rollback.

The existing Web/PWA Alpha has a historical implementation-readiness verdict of `READY` dated 2026-08-30. Telegram is deployed, with release evidence in `docs/progress/tma-editor-release-2026-11-22.md`. Epic 10 and physical client acceptance have their own assessment. Each approved scope keeps its applicable readiness gate. Browser registered-transfer ingress is disabled. Do not create new extension application code, package manifests, build configuration, tests, generated assets, deployment configuration, or implementation artifacts until the product owner approves the planning package and the BMAD implementation-readiness gate returns `READY` for the applicable scope or an explicit written waiver exists.

The S0–S7 coexistence plan records the historical Web/PWA baseline and data protection obligations. The current decisions and checks for retiring that entry are in `plans/telegram-only-retirement-and-encrypted-backup-2026-11-24.md`.

## Research dashboards and future roadmaps

Scope research dashboards, improvement proposals and future roadmaps exclusively to the mobile Telegram Mini App on iOS and Android. Exclude desktop clients (including Telegram Desktop), desktop-specific defects and phone-to-desktop workflows from these artifacts. For mixed-platform feedback, keep the observations relevant to phone use. If the device is unspecified, distinguish a proposed mobile improvement from a defect observed on a phone. Use competitor features as references only when they inform a mobile TMA decision.

## Sources of truth

Read these before product work:

1. `_bmad-output/specs/spec-interiors-editor-alpha/SPEC.md` and every file in its `companions` frontmatter.
2. `_bmad-output/planning-artifacts/prds/prd-InteriorsEditor-2026-07-26/prd.md`.
3. `_bmad-output/planning-artifacts/architecture/architecture-InteriorsEditor-2026-07-26/ARCHITECTURE-SPINE.md`.
4. `_bmad-output/project-context.md`.

Artifact ownership:

- PRD owns `FR-*` and `NFR-*`.
- SPEC owns stable `CAP-*`; only `bmad-spec` may re-derive `SPEC.md`.
- Architecture Spine owns stable `AD-*`.
- Roadmap and future stories must reference the relevant `CAP-*`, `FR-*`, `NFR-*`, and `AD-*`.
- `.memlog.md` files are append-only and must be changed only through `_bmad/scripts/memlog.py`.

## BMAD

- Installed version: stable BMAD Method `6.10.0`, modules `core` and `bmm`, tool target `codex`.
- Use a fresh Codex task for each BMAD workflow.
- Treat `_bmad/_config/manifest.yaml`, `_bmad/_config/skill-manifest.csv`, and installed `.agents/skills/bmad-*/SKILL.md` as operational truth before live documentation.
- Do not edit installer-owned `_bmad` or generated `.agents/skills` files. Durable team overrides belong in `_bmad/custom/*.toml`.
- Follow [docs/BMAD-INTEGRATION.md](docs/BMAD-INTEGRATION.md).

## Product invariants

- Phone-first Telegram Mini App. Also verify the layout in the Telegram Desktop viewport when the change affects visual behavior there.
- Canonical geometry uses integer millimetres.
- The floor plan is a planar graph; wall segments are centerlines and rooms are derived faces with inward-offset usable polygons, not a second source of truth.
- `Room.heightMm` is the sole editable height source; wall height is derived.
- Three-dimensional engine objects are disposable projections of domain state.
- Asset placement is discriminated as floor/wall and keeps a stable host address.
- Alpha wall directions are orthogonal and 45-degree diagonals only.
- WebGL 2 is the alpha rendering baseline; WebGPU is progressive enhancement.
- A validated mutation is not saved: only a successful atomic publish creates a `Durable Revision`; session history is not portable history.
- User projects are local-first, versioned and recoverable from failure; explicit confirmed Project deletion permanently removes the Project and its owned revisions, while no Project is ever silently deleted.
- Portable Backup is self-contained, including exact referenced catalog/custom resources; browser and iOS Home Screen contexts must not be assumed to share storage.
- Every new referenced asset must be pinned and pass `BackupFeasibilityPolicy`
  before its Project mutation becomes Durable; browse cache is not sufficient.
- Undo and redo Revision resources remain GC roots for the active session;
  `SessionRetentionPolicy` may reject a new command but must never silently
  break an existing history entry.
- A missing/corrupt referenced resource makes the Project read-only until exact
  repair or one complete atomic RecoveryChangeSet restores backup readiness.
- History-only corruption can be resolved only by exact repair or an explicit
  `DiscardSessionHistory` while the current Project is healthy.
- The product owner selects only free or self-authored Alpha catalog models
  outside the application, as defined by PRD/SPEC/AD-14. Formal
  `AssetUsageGrant`, licensing/provenance/declaration/attribution/notice
  admission is not an Alpha gate (owner decision, 2026-11-04). Technical
  resource validation and exact pinning continue to apply. The Android export
  exception approved on 24 November permits a user-initiated, password-encrypted
  archive for temporary download with 15-minute server retention. The password,
  original filename, launch parameters, and plaintext remain on the device.
- One project has one fenced writer; other contexts are read-only until explicit takeover.
- Experimental custom import is static GLB only and must pass resource and security policy.

## Future implementation discipline

- Use one implementation owner per vertical slice.
- Use subagents for read-heavy research and independent review; avoid concurrent edits to the same artifact or module.
- Every code change follows the project TDD workflow and must leave tests, type checks, lint, and required mutation checks passing.
- No commit without explicit user approval.

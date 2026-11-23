# Project Agent Rules

## Current phase

Telegram Mini App (TMA) is the primary application. Product work, visual reviews, and release acceptance default to TMA. Run the TMA checks for TMA-only releases. Keep the already-published Web/PWA assets byte-for-byte for these deployments. Work on other surfaces requires a separate owner request.

The existing Web/PWA Alpha has a historical implementation-readiness verdict of `READY` dated 2026-08-30. Telegram is deployed, with release evidence in `docs/progress/tma-editor-release-2026-11-22.md`. Epic 10 and physical client acceptance have their own assessment. Each approved scope keeps its applicable readiness gate. Browser registered-transfer ingress is disabled. Do not create new extension application code, package manifests, build configuration, tests, generated assets, deployment configuration, or implementation artifacts until the product owner approves the planning package and the BMAD implementation-readiness gate returns `READY` for the applicable scope or an explicit written waiver exists.

During S0–S7 preserve the existing Web/PWA, data and checks while adding Telegram on the shared core. Prepare eventual Web/PWA retirement, but execute removal only after the owner's Telegram verification and a separate retirement decision. See `plans/telegram-mini-app-extension-spec-2026-11-04.md`.

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
  resource validation, exact pinning and the prohibition on uploading user
  Projects/files remain unchanged.
- One project has one fenced writer; other contexts are read-only until explicit takeover.
- Experimental custom import is static GLB only and must pass resource and security policy.

## Future implementation discipline

- Use one implementation owner per vertical slice.
- Use subagents for read-heavy research and independent review; avoid concurrent edits to the same artifact or module.
- Every code change follows the project TDD workflow and must leave tests, type checks, lint, and required mutation checks passing.
- No commit without explicit user approval.

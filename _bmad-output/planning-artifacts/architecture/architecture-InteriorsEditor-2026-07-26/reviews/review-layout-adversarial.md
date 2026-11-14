---
title: "Adversarial review — unified-root delivery and documentation layout"
review_type: architecture-adversarial-layout
status: complete
reviewed: 2026-08-04
reviewer: "independent architecture adversarial reviewer"
reviewed_artifacts:
  - ../ARCHITECTURE-SPINE.md
  - ../../../../../../AGENTS.md
  - ../../../../../../docs/index.md
  - ../.memlog.md
  - ../../../../../../_bmad-output/planning-artifacts/spike-only-waiver-2026-08-04.md
  - ../../../../../../_bmad-output/project-context.md
---

# Adversarial review: unified-root delivery and documentation layout

## Verdict

**PLANNED LAYOUT IS COHERENT; DOCUMENTATION CONSOLIDATION IS NOT YET
COMPLETE.** AD-16/AD-17 correctly define one future repository delivery with
internal `apps/web` and `apps/catalog-control-plane` build roots, and they do
not permit copying any `S-*` prototype into it. This is not an authorization to
bootstrap, move BMAD artifacts, or represent the present repository as a
finished product layout. The current documentation entry needs the follow-up
below before it can safely function as the single human-facing navigation point.

## Findings

1. `docs/index.md` calls itself the single human-facing entry point, while
   root `README.md` still sends readers directly into `_bmad-output/` and calls
   that tree the full map. Either make `README.md` route readers to
   `docs/index.md`, or describe the latter as a curated entry rather than the
   sole one.

2. The index's table is headed “Current authoritative sources”, but it omits
   `_bmad-output/project-context.md` and the required companion chain of
   `SPEC.md`. `AGENTS.md` requires both before product work; a reader following
   only the index can miss geometry, backup, catalog and performance contracts.

3. The same table reduces the architecture to the Spine alone, even though the
   Spine frontmatter names architecture companions. The documentation entry
   should say whether those companions are normative inputs, contextual design,
   or deliberately excluded, instead of leaving a developer to infer it.

4. `_bmad/config.toml` operationally fixes planning and implementation output
   under `_bmad-output/`. Calling that tree merely provenance “until” a future
   migration risks an accidental move that breaks BMAD workflows, relative
   links, and artifact discovery. There is no approved config switch or
   path-mapping manifest today.

5. A future documentation move has no owner, source-to-destination mapping,
   authority-switch record, link/companion validation, stable-ID verification,
   or append-only memlog handling. In particular, `SPEC.md` may only be
   re-derived by its owning workflow and `.memlog.md` may only change through
   `memlog.py`; a filesystem move cannot silently become a source migration.

6. `docs/BMAD-INTEGRATION.md` still describes a document-only phase with no
   prototypes and says owners have not accepted the package. The active
   `W-SPK-2026-08-04` expressly permits five isolated evidence roots. The guide
   needs a dated exception link that preserves the prohibition on product code;
   otherwise the new index leads readers to mutually incompatible phase rules.

7. Root `README.md` says application code is absent and Git is not initialized.
   The repository now contains allowed S-2/S-3/S-4 evidence code and an
   initialized Git governance surface. The distinction should be “no production
   application/root scaffold”, not “no code/Git”, with a link to the current
   documentation index and waiver status.

8. “`S-*` directories” in `docs/index.md` is broader than the waiver. Only
   S-1, S-2, S-3, S-4 and S-6 are authorized, only inside their exact roots,
   and only until the waiver terminates. The entry point should name
   `W-SPK-2026-08-04` rather than normalize arbitrary future `S-*` paths.

9. “One repository-root delivery” needs a precise reader-facing definition:
   the repository root owns the delivery contract and cross-cutting workspace
   files, while `apps/*` are internal build roots. Without that wording,
   “root delivery” can be misread either as a new root `src/` or as two
   separately shippable projects, both contrary to AD-16.

10. The unified root has no adopted polyglot build, test, run, release, or
    contract-test entry point. `pnpm` deliberately covers only `apps/web`, and
    G-CP-ADR still leaves the Kotlin build/test and transport boundaries
    pending. Documentation must not imply that a usable root command surface is
    already designed.

11. The structural seed reserves `docs/product/` and `docs/architecture/`, but
    neither is a completed curated view or a migration plan. Do not create a
    second authority by hand-copying PRD/SPEC/Spine content into those folders;
    first approve the mapping and then validate IDs, companion links, and the
    source-of-truth switch.

12. The index labels a historical final recheck as “Current authorization
    status”. Its `NOT_READY` verdict remains controlling, but portions of its
    filesystem inventory predate the later Git initialization and authorized
    evidence roots. Add an as-of qualifier or a post-assessment status link so
    readers do not treat every historical observation as live state.

13. The no-promotion rule correctly bans copying S-* code, but the entry point
    does not state the positive replacement path: after a final `READY`, each
    product capability must be newly implemented as an owned, reviewed TDD
    vertical slice from the authoritative contracts. A prototype relocation is
    not a delivery step.

## Boundary retained

This review did not change a source of truth, grant readiness, expand the
waiver, or verify a device/product claim. `G-READY` remains closed; S-* remains
isolated evidence only; `apps/*` remains a post-`READY` planned layout.

# Reconciliation — Catalog/Provenance Control Plane (2026-08-04)

## Change signal

The owner selected Kotlin/PostgreSQL but explicitly preserved the Alpha
local-first, no-account contract. The server must be limited to a
catalog/provenance control plane serving catalog metadata/resources. User
Project, Revision, session History and Portable Backup remain local; after all
referenced bytes are pinned, an existing Project remains usable while the
service is unavailable.

## Source extraction and outcome

| Input | Relevant finding | Reconciliation |
| --- | --- | --- |
| Caller-approved course correction | Requires a deliberately narrow service role and forbids account identity, remote Project sync/collaboration, personal Project persistence, hosting/SLA, telemetry and retention assumptions. | `FR-54` defines only catalog metadata/resources plus provenance; the addendum records Kotlin/PostgreSQL as its approved realization and lists the excluded concerns. |
| `prd.md` before this update | `FR-26`–`FR-28`, `FR-37`, `FR-42`, `FR-44`, `NFR-10` and `NFR-21` already establish a curated catalog, pinned exact bytes, offline editing and local privacy, but did not name a server boundary. | `FR-26`, `FR-42`, `NFR-10` and `NFR-21` now make service unavailability and the no-personal-Project boundary testable; `FR-54` is the only new requirement ID. |
| `addendum.md` and `.memlog.md` before this update | The documented rejection of “Cloud account first” and assumption `A-7` preserve no-account local-first Alpha; no prior approved catalog-server role existed. | This is an authorized decision, not an inferred cloud feature. The append-only memlog records the decision, the headless override and the applied change. |
| Product Brief | “Local-first by default” requires the first Project, save and reopen to work without account or network; the catalog remains intentionally small and curated. | The new boundary keeps that promise and limits service dependence to not-yet-pinned catalog discovery/resource delivery. |
| Technical feasibility research | Its curated asset pipeline ends in catalog publication, and its storage model separates browse cache from exact referenced resources pinned before Durable placement. | The PRD preserves the existing pin/backup rule rather than treating a backend cache as Project durability. |
| `project-and-backup-contract.md` | A non-corrupt Durable Project with pinned referenced bytes must export without network; recovery can optionally retrieve an exact catalog version only when available. | `FR-42`, `FR-54` and `NFR-10` make the same existing-Project/offline boundary explicit without promising network recovery. |
| Canonical `SPEC.md` Constraint 6 | It says the basic scenarios require no account, backend or network. A catalog control plane is compatible only if it is not required for those scenarios; the literal “backend” wording is now incomplete. | No direct SPEC edit is permitted. A source-derived `bmad-spec` update must preserve the no-required-network core while defining the optional catalog/provenance boundary. |
| `ARCHITECTURE-SPINE.md` | Its structural seed says “Backend отсутствует в alpha runtime” and models only a static origin/CDN, which contradicts the approved Kotlin/PostgreSQL control plane. | No Architecture edit is permitted here. After SPEC re-derivation, `bmad-architecture` must replace that assertion with a narrow catalog/provenance adapter boundary and preserve local Project persistence. |

## Resulting PRD contract

1. The Kotlin/PostgreSQL Catalog Control Plane serves versioned curated catalog
   metadata/resources together with provenance, AssetUsageGrant and required
   notices.
2. It is not a user account, Project, Revision, session History or Portable
   Backup service; it performs no remote sync, collaboration, storage or
   recovery of personal Project data.
3. If all exact referenced resources are locally pinned, an existing Project
   can open, edit, Durable-save, use local undo/redo and export a Portable
   Backup without the service.
4. Service unavailability may block only browsing/downloading a resource that
   is not already pinned; it does not make an existing Project a remote or
   recovery failure.
5. API, transport, physical resource distribution, hosting, SLA, telemetry and
   retention are deliberately outside this PRD update.

## Downstream reconciliation required (not edited in this PRD-only run)

1. Run `bmad-spec` to re-derive the SPEC-owned contract and reconcile
   Constraint 6 / catalog-related CAP language.
2. Run `bmad-architecture` after the SPEC update to replace the now-conflicting
   “backend absent” runtime statement while preserving AD-4 local durability
   and AD-14 pin/provenance behavior.
3. Run `bmad-create-epics-and-stories` after the approved upstream artifacts
   are available so catalog-control-plane slices do not create account, remote
   Project persistence or sync work.
4. Re-run implementation readiness only after all affected owned artifacts are
   reconciled. This document makes no readiness or device-evidence claim.

## Stable identifiers

- Added: `FR-54`.
- Clarified without renumbering: `FR-26`, `FR-42`, `NFR-10`, `NFR-21`.
- Unchanged and still governing pin/backup behavior: `FR-28`, `FR-37`,
  `FR-44`, `NFR-13`.

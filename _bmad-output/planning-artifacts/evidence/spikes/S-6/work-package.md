---
work_package: W-SPK-2026-08-04
spike: S-6
title: "S-6 — synthetic catalog manifest, provenance, notices and pin boundary"
status: terminal-paused
entered_at: 2026-08-05
remediated_at: 2026-08-05
terminal_status: PAUSED
terminal_recorded_at: 2026-08-05
prototype_cleanup: moved-to-trash-recoverable
waiver: _bmad-output/planning-artifacts/spike-only-waiver-2026-08-04.md
implementation_owner: "Codex /root"
independent_reviewer: "Codex /root/gcp_decision_research"
---

# Work package S-6

## Scope and entry boundary

This package is entered after the ownership assignment recorded in
`sprint-change-proposal-2026-08-05-delegated-alpha-decisions.md`. It is an
isolated, disposable experiment only.

- Prototype root: `_bmad-output/implementation-artifacts/spikes/W-SPK-2026-08-04/S-6/`
- Evidence root: `_bmad-output/planning-artifacts/evidence/spikes/S-6/`
- Input: only the literal synthetic string `synthetic-chair-v1` and synthetic
  descriptor/notice/grant fixture. No user Project, catalog asset, third-party
  model/texture, telemetry or network publication is used.

The package tests whether a small client-side policy harness can make the
following boundaries observable:

1. an unpinned resource stays a cancelable preview;
2. exact hash and byte length are required before experimental pin readiness;
3. a complete-looking synthetic fixture still cannot be represented as a real
   Alpha catalog asset;
4. required notices and provenance are enforced;
5. Project/Revision/History/Portable Backup-shaped data is rejected at the
   catalog boundary.

## Gate state at entry

| Gate / input | State | Effect |
| --- | --- | --- |
| `G-SPIKE-W-001` | Active waiver and named technical owner/reviewer | Allows only this exact isolated experiment. |
| `G-READY` | `NOT READY` | No production bootstrap/V-slice/backend implementation. |
| Human `AssetUsageGrant` | `PENDING` | Synthetic fixture can never produce an Alpha catalog claim. |
| Physical NFR-15/device evidence | Absent | Mobile Playwright is regression observation only. |
| `G-CP-ADR` | `inputs_pending` | No Kotlin/PostgreSQL API/schema/deployment work. |

## Required method

1. Keep RED → GREEN → mutation evidence inside the prototype root.
2. Run mobile-sized Playwright flows through visible labelled controls.
3. Record no-network/static-server boundary and all negative results.
4. Reviewer independently reproduces scope, tests and conclusions without
   editing the owner prototype.
5. Reviewer selects `PASS`, `PAUSED` or `KILLED/PIVOTED`. `PASS` is impossible
   until the human grant, corpus and real-device evidence requirements exist.

No code or package outside the two waiver-approved roots is authorised by this
work package. No commit is authorised.

## Remediation and terminal note

The first independent review found synthetic-boundary bypasses and an evidence
link/hash issue. The owner added only isolated S-6 tests and policy-harness
changes inside the approved prototype root, then copied the allowed screenshot,
lock trace and mutation JSON into this evidence root. The amended independent
review records terminal `PAUSED`; residual H-1R/H-2R/H-3R findings require a
new written waiver before any further S-6 code iteration. The disposable
prototype root was removed from the workspace and moved recoverably to the
operating-system Trash; this evidence root is retained.

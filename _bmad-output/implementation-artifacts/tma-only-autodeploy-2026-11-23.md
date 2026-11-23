---
title: TMA-only deployment from main
type: chore
created: 2026-11-23
status: in-review
review_loop_iteration: 0
owner_approval: explicit
implementation_readiness: READY
baseline_commit: fb161cf9a8528a14f2efbf87bd3b800995bf4021
---

# TMA-only deployment from main

## Scope

The owner approved automating deployment of Telegram Mini App (TMA) from
`main` with exact floor rotation enabled. This operations slice uses the
existing TMA runtime and release contract (AD-25, AD-35) and preserves the
project editing and transfer behavior (CAP-9, CAP-13, FR-55, NFR-28).
Web/PWA, the catalog, and backend services continue to serve their current
publications. The existing manual release and recovery paths remain available.

## Acceptance criteria

1. A push to `main` verifies, builds and transfers only the TMA release
   from that commit. The build enables `INTERIORS_EXACT_FLOOR_YAW=1`.
   The signed entry scenarios exercise the exact configuration. The scoped
   Telegram editor scenarios exercise editing and backup/reopen at 37.5°.
   The workflow guards against stale `main` commits.
2. The dedicated SSH key accepts only the bounded TMA upload protocol.
   The receiver checks artifact integrity and commit identity before
   activation. Activation uses the existing deployment locks, publishes
   atomically, and preserves rollback and retained Telegram asset URLs.
3. Activation carries the verified, already-published Web artifact forward
   byte for byte. The workflow avoids Web/PWA builds and verification suites.
   The catalog publication and backend services keep their active versions.
4. The first push completes the enabled production workflow. Verify the
   remote commit, active Telegram manifest and deployment receipt, plus
   the published Web build and catalog identity against the baseline.

## Readiness

READY for this approved operations slice. The installed deployment identity,
runtime verification entry points, active artifacts, and rollback mechanisms
already exist. The signed entry and scoped runtime cases, bounded artifact tests
and the first production workflow run supply implementation evidence.

## Implementation

- `.github/workflows/deploy.yml` runs the exact-mode build, Telegram verification
  and production delivery with the existing environment and concurrency group.
- `scripts/deploy/frontend.py` seals and verifies the scoped archive, carries
  the active Web files forward and switches the public release atomically.
- `scripts/deploy/receiver.py` and `scripts/deploy/configure_github.py` limit
  the SSH command and update the receiver with the current credentials.

## Verification

- Run the focused deployment tests and GitHub Actions workflow validation.
- Run the signed Telegram launch, retained-release and exact wall placement
  checks with `INTERIORS_EXACT_FLOOR_YAW=1`. The scoped editor checks cover
  exact rotation, the rotation handle and transfer. The existing Telegram
  quality workflow retains the wider visual scenarios.
- Compare the active Telegram build and receipt to the successful push run.
  Compare the Web inventory and catalog publication to the before snapshot.

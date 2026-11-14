# Moved wall / Opening collision guard — 2026-10-25

The live phone regression exposed that moving a 201 mm wall body 100 mm from a 100 mm Door host could publish positive-area overlap with the hole. Moving the Opening host into a stationary wall had the same omission.

The final moved Project now checks every wall body against Openings on other hosts, using the same exact doubled-integer bounds policy as wall creation and legacy thickness changes. Own-host holes are excluded; boundary contact remains valid. The existing `WALL_DOOR_OPENING_COLLISION` + exact Opening identity keeps the UI correction route.

- RED: 145 tests, 4 failed / 141 passed, zero skipped (`domain-red.log`). The new Door, Window, 149 mm overlap and moved-host cases incorrectly returned accepted.
- GREEN: 145/145, zero skipped, including seven new cases: 201 mm Door/Window overlap, 200 mm body at 149/150/151 mm, moving the host into a stationary wall, and a normal own-host move (`domain-green.log`).
- Web type check and scoped lint pass.
- Isolated Stryker scope: only the new final-geometry guard, lines 1486–1499. **7/7 killed, 0 survivors, 0 timeout, 0 errors (100%)**. No equivalence exclusions were needed.
- Execution used a fresh temporary source copy, direct pinned Node 24.19.0 and per-package dependency links. No install ran in the snapshot; original source hash equals the restored snapshot hash. Exact hashes, scope and config are in `snapshot-manifest.json`.
- The scope does not claim mutation coverage for the complete 3,000+ line wall module. Existing geometry behavior is covered by the full 145-test suite.

The browser `PLAN-E2E-05D` retains the actual wall move, rejection without a Durable Revision, focused correction control and the exact Door width after opening the correction form. Its GREEN evidence is in the browser migration delivery directory.

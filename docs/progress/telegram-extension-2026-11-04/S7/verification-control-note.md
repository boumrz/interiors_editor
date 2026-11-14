# Verification control note

The first complete current-source Web run finished with 333 passed and 2 failures: EDITOR-E2E-13J and numeric EDITOR-E2E-04C. Both exposed the browser inspector toggle branch added in AppShell, which expanded instead of toggling when no host navigation was present. The existing tests were not edited. The handler was corrected to toggle in that branch.

A subsequent verification launch used the temporary snapshot working directory for a Python step that expected the repository root. That step failed before editing; its following runner unintentionally began an unfiltered run and truncated current-web-pwa-full.log. This accidental runner and only its descendants were stopped. The first full-run count above is recorded from the actual completed tool output, not a preserved full raw log. No complete-green claim is made from the truncated log. A new immutable full run will use a different log prefix.

The corrected-source focused run uses followup-web-pwa-* logs; four existing matching Web scenarios pass, including both failures, and all ten PWA cases are run separately. The live user dist/server were not involved.

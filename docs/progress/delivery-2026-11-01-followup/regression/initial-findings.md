# Findings during the final regression

The initial frozen candidate was **not published**. These were product failures, not assertions removed to obtain a green run:

- `CATALOG-HARDEN-02` and `CATALOG-E2E-01G`: synchronous layout writes from the new dock ResizeObserver caused an undelivered-notifications error and development error overlay. The isolated correction coalesces updates with requestAnimationFrame, avoids unchanged CSS writes and cancels pending work on unmount.
- `EDITOR-E2E-02VC`, `EDITOR-E2E-02VD`, `PLAN-E2E-04K`: the empty starter contour covered confirmation of the first manually drawn wall. It is now shown only in selection mode. All four affected drawing/catalog scenarios passed in the isolated correction run.
- `PWA-E2E-05`: the starter form covered the real cache-cleanup button in the storage warning. The storage notice and initial contour need one scrollable stack when both are present; increasing z-index alone would block the other form.
- Independent review found opening-move confirmation left actionable after another context took the writer lease. Two new Door/Window scenarios first failed on retirement of the modal, then passed after read-only state discarded the draft. Exact Project, pointer and revision records remain unchanged, including after regaining the lease.
- Visual review found the confirmation word split on a 320 px phone and enlarged Undo/Redo/zoom glyphs exceeding fixed button bounds at 200% text. The corresponding visual assertions were strengthened.

Initial artifacts and final rerun logs are retained separately. See the parent report for final counts, build ID and limitations.

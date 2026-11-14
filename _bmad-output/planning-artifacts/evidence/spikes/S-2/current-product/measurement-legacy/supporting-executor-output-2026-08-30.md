---
title: "S-2 Measurement/legacy supporting executor output"
date: 2026-08-30
status: final
scope: "Current product read-only supporting tests; not an executable TCC-A1 corpus run"
---

# Current supporting executor output

```sh
npx --yes --package=node@24.19.0 --package=pnpm@11.20.0 \
  pnpm --filter @interiors/web exec rstest run --config rstest.config.mjs \
  src/domain/measurement-request.test.ts \
  src/domain/measurement-format.test.ts \
  src/domain/exact-quadratic-surd.test.ts \
  src/domain/migrate-project-v1-to-v2.test.ts \
  src/domain/ppj-a1-lossless-json.test.ts
```

Observed on `2026-08-30T12:12:48.350Z` under Node `v24.19.0` and
`@rstest/core 0.11.5`:

```json
{
  "status": "pass",
  "counts": {
    "testFiles": 5,
    "failedFiles": 0,
    "tests": 121,
    "failedTests": 0,
    "passedTests": 121,
    "skippedTests": 0,
    "todoTests": 0
  },
  "durationMs": { "total": 598, "build": 62, "tests": 536 },
  "snapshot": { "added": 0, "updated": 0, "unmatched": 0, "removed": 0, "unchecked": 0 }
}
```

The output confirms current direct behavior: a revision-bound item-to-wall
distance, stale fail-closed behavior, exact measurement formatting, historical
V1-to-V2 characterization branches, and PPJ-A1 lexical parser cases.  It does
not execute the immutable raw candidates through the adopted TCC-A1 runner and
therefore is supporting evidence only.

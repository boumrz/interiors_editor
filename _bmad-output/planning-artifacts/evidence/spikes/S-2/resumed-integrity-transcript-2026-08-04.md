# S-2 resumed integrity transcript — 2026-08-04

This compact transcript is ANSI-stripped. The latest machine-readable outputs
are [raw/mutation-report-2026-08-04-215733.json](raw/mutation-report-2026-08-04-215733.json)
and [raw/coverage-final-2026-08-04-215650.json](raw/coverage-final-2026-08-04-215650.json).

```text
$ npm test -- test/topology-integrity-regressions.spec.ts
RED before source change at 21:50:07 +03:00

Test Files  1 failed (1)
Tests       2 failed (2)

FAIL rejects unsplit exact T and X crossings even when a stray Vertex shares
the crossing coordinate
  expected { ok: false, reason: "SERIALIZATION_INVALID" }
  received { ok: true, revision: ... }

FAIL returns a stable rejection instead of throwing for a fractional in-memory Revision
  RangeError: The number 999.5 cannot be converted to a BigInt because it is not an integer
  at crossBigInt → intersectSegments → applyAddWallSegment → applyCommand

[exit 1]

$ npm test -- test/topology-integrity-regressions.spec.ts
GREEN after the minimum source change at 21:51:04 +03:00
Test Files  1 passed (1)
Tests       2 passed (2)
[exit 0]

$ npm test
Test Files  4 passed (4)
Tests       43 passed (43)
[exit 0]

$ npm run typecheck
> tsc --noEmit
[exit 0]

$ npm run test:coverage
Test Files  4 passed (4)
Tests       43 passed (43)
All files   97.54% statements | 95.53% branches | 100.00% functions | 97.54% lines
[exit 0]

$ npm run mutation
Found 1 source file to mutate.
Instrumented 1 source file with 1153 mutants.
Initial test run succeeded: 43 tests.
Mutation score: 80.23%.
Killed: 925; survived: 212; no coverage: 16; timeout: 0; errors: 0.
Final mutation score of 80.23 is greater than or equal to break threshold 80.
Done in 38 seconds.
[exit 0]
```

Runtime for the final verification: Node `v22.8.0`, npm `10.8.2`.

No browser or application UI exists in this authorized S-2 prototype, so no
Playwright run or mobile screenshot was applicable to this evidence change.

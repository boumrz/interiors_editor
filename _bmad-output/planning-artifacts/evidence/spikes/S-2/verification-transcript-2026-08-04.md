# S-2 initial verification transcript — superseded

This is a compact, ANSI-stripped transcription of the initial 36-test evidence
run. It is retained for traceability only and is superseded by the resumed
43-test record in
[resumed-integrity-transcript-2026-08-04.md](resumed-integrity-transcript-2026-08-04.md).

```text
$ npm test
Test Files  3 passed (3)
Tests       36 passed (36)
Duration    210ms

$ npm run typecheck
> tsc --noEmit
[exit 0]

$ npm run test:coverage
Test Files  3 passed (3)
Tests       36 passed (36)
All files   97.45% statements | 95.00% branches | 100.00% functions | 97.45% lines
[exit 0]

$ npm run mutation
Found 1 source file to mutate.
Instrumented 1 source file with 1125 mutants.
Initial test run succeeded: 36 tests.
Mutation score: 80.27%.
Killed: 903; survived: 206; no coverage: 16; timeout: 0; errors: 0.
Final mutation score of 80.27 is greater than or equal to break threshold 80.
Done in 38 seconds.
[exit 0]
```

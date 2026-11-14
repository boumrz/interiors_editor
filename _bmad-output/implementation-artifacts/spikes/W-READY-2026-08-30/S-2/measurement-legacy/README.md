# W-READY / S-2 — Measurement and legacy detached candidates

This package was produced under the bounded evidence waiver.  It is not a
production feature, does not mutate `apps/**`, and does not implement a second
PlanGraph, measurement or legacy authority.

Order of evidence:

1. [RED.md](RED.md) records the failed source-completeness claim before new
   candidates existed.
2. `raw/` contains six immutable candidate byte inputs.
3. `fixtures/measurement-legacy-detached-manifest-2026-08-30.json` records
   their hashes and the exact missing adopted-executor outcome.
4. The adjacent planning-evidence directory records the real supporting test
   execution and the non-passing assessment.

The current TCC-A1 runner cannot execute this package.  It remains a precise
handoff for the source owner who must define the missing outcome protocols,
not a substitute for that work.

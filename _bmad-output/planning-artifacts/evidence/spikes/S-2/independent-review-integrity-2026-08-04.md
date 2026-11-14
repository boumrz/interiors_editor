---
title: "S-2 resumed integrity — independent review"
date: 2026-08-04
spike_id: S-2
waiver_id: W-SPK-2026-08-04
reviewer: "Codex /root/architecture_layout_adversarial"
scope: "Read-only review of the two-defect resumed evidence package"
verdict: "No P0/P1; bounded evidence accepted with limits"
spike_status: needs-further-evidence
---

# S-2 resumed integrity — independent review

This is a review result only. It does **not** change S-2's
`needs-further-evidence` status, declare a terminal result, authorize cleanup,
or authorize production work.

## What was independently checked

- The historical RED cases exercise public APIs: `deserializeRevision(...)`
  for the stray-Vertex T/X case and `applyCommand(...)` for malformed
  in-memory data. Their described pre-fix outcomes match the old validator and
  `BigInt` path.
- The green implementation validates the Revision envelope before dispatch and
  rejects a Vertex strictly inside an unsplit WallSegment. The public command
  now returns `SERIALIZATION_INVALID` for the malformed/fractional case rather
  than leaking `RangeError`.
- Valid manual merge remains accepted. A merge that would leave a branch on a
  newly unsplit long wall returns `AMBIGUOUS_INTERSECTION` and preserves the
  prior Revision.
- Source, tests, manifests and reports remain only in the exact S-2 waiver
  roots. No root product source, package, build/test configuration, browser
  harness, or device claim was introduced.

## Independent replay

Run in the S-2 prototype root using Node `v22.8.0` and npm `10.8.2`:

```text
npm test                                      43/43 PASS
npm test -- test/topology-integrity-regressions.spec.ts  7/7 PASS
npm run typecheck                             PASS
```

The reviewer also parsed and hash-checked the retained raw reporters and all
11 source/config/test hashes in the trace manifest. They matched:

- coverage: 97.54% statements/lines, 95.53% branches, 100% functions;
- mutation: 1,153 total, 925 killed, 212 survived, 16 no coverage, zero
  timeouts/errors, 80.23% score.

## Limits retained for a later, separately authorized amendment

1. The historical RED source state is described by a credible public-API
   transcript but is not retained as a hashable, rerunnable baseline.
2. The new T/X regression directly exercises deserialization. `applyCommand`
   reaches the same validator by inspection, but an explicitly in-memory
   unsplit T/X `applyCommand` regression remains useful future evidence.
3. This spike intentionally maps invalid in-memory input to a canonical empty
   Revision. That is a synthetic safety outcome, not the future product's
   corruption/recovery policy.

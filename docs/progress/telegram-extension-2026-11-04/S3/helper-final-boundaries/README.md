# Final five helper boundary cases; historical146 exact-span disposition

Only eight NEW test/verification files in manifest.json are offered. Root already copied frozen159bd and six-case testf980e40a; neither changes here. Production helper remains exact38710fc55101133033f6d381501db5ad22a90f39e362e5a883a386e2eebcdcff, restored after isolated mutation.

- Complete focused unit corpus:26 cases (15baseline +6first handoff +3resource-set +2plain-data), all pass. Scoped TypeScript and new-file lint pass.
- Resource-set scope22 actual mutants:21 killed,0 timeout,1 survivor95.45%;528 activation observations,0 mismatches,all22 IDs. Historical292/294/295/296 newly killed. Remaining306 has a repeated-length/async-buffer-stability precondition; see per-ID triage.
- Plain-data scope65 actual mutants:49 killed,0 timeout,16 survivors75.38%;1690 activation observations,0 mismatches,all65 IDs. This diagnostic selected scope is below80 and is not an accepted full-file gate. Historical394/395/396/397/398/427/428/439/440/441/467/468/469/470 newly killed.
- Full623 raw474K/3T/146S76.57% remains historical FAIL. No combined/adjusted score or broad623 rerun. Per-ID146 JSON includes exact one-based spans, all replacements, source-specific reason/remaining vector and exact mapped focused evidence, including separately retained owner8/80 runs.

The new real API fixtures reject equal-count duplicate/missing resources and unrelated resources before hashing, accept reorder, reject custom array/object prototypes and hidden required data/index descriptors while keeping the source unchanged. Resource-set tests use actual native SHA256; no spoofed public provenance or synthesized Project acceptance is claimed.

190MiB upper arithmetic was independently investigated, not forced with an invalid fixture: strict current V1 reader strings<=256 plus fixed cardinalities imply conservative Project+reserve<=7,432,192 bytes and STORE upper<=187.3349609375MiB with180MiB payload/250 definitions. See explicit assumptions/table in190mib-budget-disposition.md. The attempted4KiB-free-string fixture correctly failed copyProject and is retained only as a rejected experiment, outside the test tree and manifest. No invalid fixture is shipped as a passing test.280MiB dominance is explained separately via the lower190MiB comparison.

Current-route P1 not established by public comparator P2 ([A,A] versus[A,B]); actual profile independently validates left uniqueness. No helper/production/original/package edits, no mutation of originals, no physical/native/Web regression acceptance claim.

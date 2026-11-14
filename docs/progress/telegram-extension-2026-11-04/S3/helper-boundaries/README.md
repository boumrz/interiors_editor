# Browser legacy representability: six independent API boundary vectors

Production helper stays SHA38710fc55101133033f6d381501db5ad22a90f39e362e5a883a386e2eebcdcff. Frozen baseline159bd test is unchanged and required; it is already owned/integrated by root. Only NEW test/proof files are offered.

21 actual tests pass: frozen baseline15 plus new6. Scoped TypeScript and lint pass. Selected36 actual Stryker mutations: 29 killed, zero timeout, seven survivors (80.56% of this selected scope). 756 expected-vs-actual activation observations, zero mismatch, all36 IDs seen. Every targeted mutant maps to the historical full623 by exact 1-based location, mutator and replacement; see summary-targeted.json. The full623 raw474K/3T/146S76.57% remains historical and separate. No combined/adjusted full score.

New vectors independently cover same-byte-length source alteration with rebuilt correct serializer/digest, changed exact resource bytes under a deliberately colliding checksum test port, already-cancelled source before snapshot reads, already-cancelled candidate before project hash, exact50MiB per resource versus next byte, exact180MiB total versus next byte. Controlled resource budget fixtures share bounded backing views and fake only digest lookup; no cryptographic authenticity claim.

Historical survivor IDs98,134,173,196,197,270,271,273,279,280,281,282,283,284 are Killed in this targeted run. Remaining274/275/276/286/287 concern190MiB header accounting and still need a near-boundary API fixture; investigation continues separately. IDs289/290 remove/tighten280MiB guard, dominated by the unmutated190MiB lower cap (do not generalize this to the190MiB group).

Read-only P2 API finding, not changed here: sameBrowserBackupResourceBytes([A,A],[A,B]) can return true for equal-length distinct A/B because only right uniqueness is checked. Current prepare/verify routes independently validate left uniqueness in resourceReferences; beforePublish builds one entry per private unique proof. No confirmed current publication P1. Future callers must preserve that precondition or harden the public helper under its owner's scope.

No original file, helper, policy, package, dependency, default suite or product entry edits. No broad623 rerun or Web/PWA/native/device acceptance claim.
